// pcm-sink.ts
// -----------------------------------------------------------------------------
// Worklet: SAB ring-buffer reader (pulls exactly quantum frames each process)
const sabProcessorCode = `
class SabPcmSinkProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ready = false;
    this.channels = 0;
    this.framesCap = 0;
    this.buffers = null;  // Float32Array per channel (views on SAB)
    this.idx = null;      // Int32Array [readIdx, writeIdx] in frames (shared)
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m && m.type === 'init') {
        this.channels = m.channels|0;
        this.framesCap = m.framesPerChannel|0;
        this.idx = new Int32Array(m.indexSAB);
        this.buffers = new Array(this.channels);
        for (let c = 0; c < this.channels; c++) {
          this.buffers[c] = new Float32Array(
            m.audioSAB,
            c * this.framesCap * 4,
            this.framesCap
          );
        }
        this.ready = true;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!this.ready) {
      for (let c = 0; c < output.length; c++) output[c].fill(0);
      return true;
    }

    const need = output[0].length|0; // typically 128 frames
    let r = Atomics.load(this.idx, 0)|0;
    const w = Atomics.load(this.idx, 1)|0;
    const cap = this.framesCap|0;
    const avail = Math.max(0, Math.min(cap, (w - r)|0));
    const take = Math.min(need, avail);

    for (let c = 0; c < this.channels; c++) {
      const buf = this.buffers[c];
      const out = output[c];
      if (take > 0) {
        let pos = (r % cap + cap) % cap;
        const first = Math.min(take, cap - pos);
        out.set(buf.subarray(pos, pos + first), 0);
        if (first < take) out.set(buf.subarray(0, take - first), first);
        if (take < need) out.fill(0, take);
      } else {
        out.fill(0);
      }
    }
    if (take > 0) Atomics.store(this.idx, 0, r + take);
    return true;
  }
}
registerProcessor('pcm-sab-sink', SabPcmSinkProcessor);
`;
const sabWorkletURL = URL.createObjectURL(
  new Blob([sabProcessorCode], { type: "application/javascript" }),
);

// -----------------------------------------------------------------------------
// Types & options
export interface PcmSinkOptions {
  channels?: number; // default 2
  contextRate?: number; // default 48000
  // SAB ring buffer
  ringFrames?: number; // capacity per channel (default 16384)
  targetLeadSec?: number; // keep ~5ms buffered by default
  maxLeadSec?: number; // cap and drop-old over ~250ms by default
  // Fallback buffer scheduler
  scheduleAheadSec?: number; // when to start buffers in fallback (default 0.005s)
  // Opus
  opusPreSkip?: number; // if known (e.g. 312); default 0
  opusRate?: number; // Opus decode rate: 48000
  onOpusError?: (e: Error) => void;
  allowSAB?: boolean; // default true
}

type Mode = "sab" | "buffer";

// -----------------------------------------------------------------------------
// Main class
export class PcmSink {
  private ctx!: AudioContext;
  private msDest!: MediaStreamAudioDestinationNode;
  private audioEl!: HTMLAudioElement;
  private mode: Mode = "buffer";

  private channels: number;
  private quantumFrames = 128; // WebAudio quantum size
  private allowSAB: boolean;

  // SAB state
  private ringFrames: number;
  private targetLeadFrames: number;
  private maxLeadFrames: number;
  private idx!: Int32Array; // [readIdx, writeIdx]
  private planes!: Float32Array[]; // SAB views for writing
  private audioSAB?: SharedArrayBuffer;
  private indexSAB?: SharedArrayBuffer;
  private workletNode?: AudioWorkletNode;

  // Fallback buffer scheduling
  private playheadTime = 0;
  private scheduleAheadSec: number;

  // Opus
  private opusDecoder: AudioDecoder | null = null;
  private opusConfigured = false;
  private opusNextTimestampUs = 0;
  private opusRate: number;
  private opusPreSkip: number;
  private onOpusError: (e: Error) => void;

  private jb?: TimestampJitterBuffer;
  private clock = new ClockModel();
  private adaptive = true; // auto-tune lead using measured jitter

  constructor({
    channels = 2,
    contextRate = 48000,
    ringFrames = 16384,
    targetLeadSec = 0.005,
    maxLeadSec = 0.25,
    scheduleAheadSec = 0.005,
    opusPreSkip = 0,
    opusRate = 48000,
    onOpusError = () => {},
    allowSAB = true,
  }: PcmSinkOptions = {}) {
    this.channels = channels;
    this.ringFrames = ringFrames;
    this.opusRate = opusRate;
    this.opusPreSkip = opusPreSkip;
    this.onOpusError = onOpusError;
    this.allowSAB = allowSAB;

    this.ctx = new AudioContext({
      sampleRate: contextRate,
      latencyHint: "interactive",
    });
    this.quantumFrames = 128; // fixed by WebAudio
    this.playheadTime = this.ctx.currentTime;

    this.targetLeadFrames = Math.max(
      0,
      Math.round(targetLeadSec * this.ctx.sampleRate),
    );
    this.maxLeadFrames = Math.max(
      this.targetLeadFrames,
      Math.round(maxLeadSec * this.ctx.sampleRate),
    );
    this.scheduleAheadSec = scheduleAheadSec;
    this.jb = new TimestampJitterBuffer(
      this.targetLeadFrames / this.ctx.sampleRate,
      this.maxLeadFrames / this.ctx.sampleRate,
    );
  }

  // ---------------------------------------------------------------------------
  // Init / teardown
  async init(): Promise<void> {
    // Output graph: Worklet (sab) or direct buffer scheduling (fallback) -> MediaStream -> <audio>
    this.msDest = new MediaStreamAudioDestinationNode(this.ctx, {
      channelCount: this.channels,
    });
    this.audioEl = new Audio();
    this.audioEl.autoplay = true;
    this.audioEl.setAttribute("playsinline", "");
    this.audioEl.muted = false;
    this.audioEl.srcObject = this.msDest.stream;

    const sabOK =
      this.allowSAB &&
      typeof SharedArrayBuffer !== "undefined" &&
      (self as any).crossOriginIsolated === true;
    if (sabOK) {
      // SAB mode
      await this.ctx.audioWorklet.addModule(sabWorkletURL);
      const node = new AudioWorkletNode(this.ctx, "pcm-sab-sink", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [this.channels],
      });
      node.connect(this.msDest);
      this.workletNode = node;

      // Allocate SABs
      this.audioSAB = new SharedArrayBuffer(
        this.channels * this.ringFrames * 4,
      );
      this.indexSAB = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
      this.idx = new Int32Array(this.indexSAB);
      this.idx[0] = 0; // read
      this.idx[1] = 0; // write

      this.planes = new Array(this.channels);
      for (let c = 0; c < this.channels; c++) {
        this.planes[c] = new Float32Array(
          this.audioSAB,
          c * this.ringFrames * 4,
          this.ringFrames,
        );
      }

      // Initialize worklet
      node.port.postMessage({
        type: "init",
        channels: this.channels,
        framesPerChannel: this.ringFrames,
        audioSAB: this.audioSAB,
        indexSAB: this.indexSAB,
      });

      this.mode = "sab";
    } else {
      // Buffer-scheduling fallback (no worklet needed)
      this.mode = "buffer";
    }

    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audioEl.play().catch(() => {});
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audioEl.play().catch(() => {});
  }

  async close(): Promise<void> {
    try {
      if (this.opusDecoder) {
        try {
          await this.opusDecoder.flush();
        } catch {}
        this.opusDecoder.close();
        this.opusDecoder = null;
      }
      if (this.workletNode) {
        try {
          this.workletNode.disconnect();
        } catch {}
        this.workletNode = undefined;
      }
      this.audioEl.srcObject = null;
    } finally {
      await this.ctx.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Public API: PCM + Opus

  /** Push planar PCM at any sample rate (e.g., 24000). */
  pushPcm(
    planes: Float32Array[],
    sampleRate: number = 24_000,
    tsGpsSec?: number,
  ): void {
    if (!planes.length || planes.length !== this.channels)
      throw new Error(`expected ${this.channels} channels`);
    this.pushDecodedToOutput(planes, sampleRate, tsGpsSec);
  }

  /** Push a raw Opus packet (WebCodecs). */
  pushOpus(packet: Uint8Array, tsGpsSec?: number): void {
    if (!packet || packet.length === 0) return;

    if (!this.opusConfigured) {
      const toc = packet[0];
      const stereo = (toc & 0x04) !== 0;
      const ch = stereo ? 2 : 1;
      const head = buildOpusHead(ch, this.opusPreSkip, this.opusRate, 0, 0);
      this.ensureOpusDecoder(head, ch);
      this.opusConfigured = true;
      this.opusNextTimestampUs = 0;
    }
    if (!this.opusDecoder || this.opusDecoder.state === "closed") return;
    const { durationUs } = opusDurationFromPacket(packet, this.opusRate);
    const chunk = new EncodedAudioChunk({
      type: "key",
      timestamp: this.opusNextTimestampUs,
      duration: durationUs,
      data: packet,
    });
    (chunk as any).__gpsTsSec = tsGpsSec; // stash for use in output callback
    this.opusDecoder!.decode(chunk);
    this.opusNextTimestampUs += durationUs;
  }

  private pushDecodedToOutput(
    planes: Float32Array[],
    rate: number,
    tsGpsSec?: number,
  ): void {
    // Optional micro skew correction: derive a tiny resample ratio from clock model
    let ratio = 1.0;
    if (tsGpsSec !== undefined && this.clock.initialized) {
      // keep within safety bounds (±1000 ppm)
      const r = this.clock.resampleRatio;
      ratio = Math.max(0.999, Math.min(1.001, r));
    }

    // Resample (to context rate) with optional tiny skew correction
    const targetRate = this.ctx.sampleRate | 0;
    const effectiveFrom = rate;
    const effectiveTo = Math.round(targetRate * ratio);
    const out =
      effectiveFrom === effectiveTo
        ? planes
        : resamplePlanarLinear(planes, effectiveFrom, effectiveTo);

    const frames = out[0].length;
    const durSec = frames / targetRate;

    // Update clock model with an anchor: this frame’s sender time should map to "now + targetLead"
    if (tsGpsSec !== undefined) {
      const now = this.ctx.currentTime;
      const desiredCtx = now + this.targetLeadFrames / targetRate;
      this.clock.update(tsGpsSec, desiredCtx);
    }

    if (this.mode === "sab") {
      // Timestamped jitter buffering
      const nowWall = performance.now() / 1000;
      this.jb!.push(
        {
          planes: out,
          frames,
          sampleRate: targetRate,
          tsSec: tsGpsSec,
          durSec,
        },
        nowWall,
      );

      // Adaptive lead: aim for ~3× measured jitter, 20–150 ms
      if (this.adaptive && Math.random() < 0.05) {
        const j = this.jb!.getJitterSec();
        const targ = Math.max(0.02, Math.min(0.15, 3 * j));
        const max = Math.max(targ, 0.25);
        this.jb!.setTargets(targ, max);
        this.targetLeadFrames = Math.round(targ * targetRate);
        this.maxLeadFrames = Math.round(max * targetRate);
      }

      // Pop anything ready and write to SAB
      const ready = this.jb!.popReady(this.ctx.currentTime, this.clock);
      for (const f of ready) this.enqueueSAB(f.planes);
    } else {
      // buffer fallback: schedule immediately (engine timing)
      const buf = this.ctx.createBuffer(this.channels, frames, targetRate);
      for (let c = 0; c < this.channels; c++) {
        const plane = out[c];
        let source: Float32Array<ArrayBuffer>;
        if (
          typeof SharedArrayBuffer !== "undefined" &&
          plane.buffer instanceof SharedArrayBuffer
        ) {
          source = new Float32Array(plane) as Float32Array<ArrayBuffer>;
        } else {
          source = plane as Float32Array<ArrayBuffer>;
        }
        buf.copyToChannel(source, c);
      }
      this.scheduleBuffer(buf);
    }
  }

  // ---------------------------------------------------------------------------
  // Device selection
  static async listOutputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audiooutput");
  }
  async setOutputDevice(deviceId: string): Promise<void> {
    const anyEl = this.audioEl as unknown as {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!anyEl.setSinkId)
      throw new Error("setSinkId is not supported in this browser");
    await anyEl.setSinkId!(deviceId);
  }
  get currentSinkId(): string | undefined {
    return (this.audioEl as unknown as { sinkId?: string }).sinkId;
  }

  // ---------------------------------------------------------------------------
  // Internals

  /** Configure WebCodecs Opus decoder. */
  private ensureOpusDecoder(opusHead: Uint8Array, channels: number) {
    if (this.opusDecoder) return;
    this.opusDecoder = new AudioDecoder({
      output: (ad: AudioData) => {
        try {
          // Extract the GPS ts attached to the chunk if present (not standard; we pass it above).
          // WebCodecs doesn't expose the chunk in output; so pass tsGpsSec along another way:
          // Option 1: include ts in a queue parallel to decode calls.
          // Simpler: estimate from running counter when you can't attach (see note below).
          const tsGpsSec = (ad as any).__gpsTsSec as number | undefined; // if you route it yourself

          const ch = ad.numberOfChannels | 0;
          const frames = ad.numberOfFrames | 0;
          const rate = ad.sampleRate | 0; // Opus: 48000
          const planes: Float32Array[] = new Array(ch);
          for (let c = 0; c < ch; c++) {
            const arr = new Float32Array(frames);
            ad.copyTo(arr, { planeIndex: c, format: "f32-planar" });
            planes[c] = arr;
          }
          const aligned = alignChannels(planes, this.channels);
          this.pushDecodedToOutput(aligned, rate, tsGpsSec);
        } finally {
          ad.close();
        }
      },
      error: (e) => this.onOpusError(e as any),
    });

    this.opusDecoder.configure({
      codec: "opus",
      sampleRate: this.opusRate,
      numberOfChannels: channels,
      description: tightArrayBuffer(opusHead),
    });
  }

  /** SAB writer with latency cap & wrap handling. */
  private enqueueSAB(planes: Float32Array[]): void {
    const frames = planes[0]?.length | 0;
    if (!frames) return;
    for (let c = 1; c < planes.length; c++) {
      if (planes[c].length !== frames)
        throw new Error("channel length mismatch");
    }
    let r = Atomics.load(this.idx, 0) | 0;
    let w = Atomics.load(this.idx, 1) | 0;
    const cap = this.ringFrames | 0;
    const lead = (w - r) | 0;

    // If ahead too far, drop oldest to target lead
    if (lead > this.maxLeadFrames) {
      const newR = w - this.targetLeadFrames;
      Atomics.store(this.idx, 0, newR);
      r = newR;
    }

    // Ensure space for this write (drop oldest frames if needed)
    w = Atomics.load(this.idx, 1) | 0;
    const free = Math.max(0, cap - ((w - r) | 0));
    let writeFrames = frames;
    if (writeFrames > free) {
      const drop = writeFrames - free;
      Atomics.store(this.idx, 0, r + drop);
      r += drop;
    }

    let pos = ((w % cap) + cap) % cap;
    const first = Math.min(writeFrames, cap - pos);
    for (let c = 0; c < this.channels; c++) {
      this.planes[c].set(planes[c].subarray(0, first), pos);
      if (first < writeFrames) {
        this.planes[c].set(planes[c].subarray(first), 0);
      }
    }
    Atomics.store(this.idx, 1, w + writeFrames);
  }

  /** Fallback: schedule an AudioBuffer with tiny lead (engine does resampling). */
  private scheduleBuffer(buf: AudioBuffer): void {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.msDest);

    const now = this.ctx.currentTime;
    const minWhen = now + this.scheduleAheadSec;

    const lead = this.playheadTime - now;
    if (lead > 0.03 || this.playheadTime < now) {
      // snap if drifted too far
      this.playheadTime = minWhen;
    }

    const when = Math.max(minWhen, this.playheadTime);
    src.start(when);
    this.playheadTime = when + buf.duration;
  }

  /** Quick check: is the environment cross-origin isolated with SAB? */
  static supportsSAB(): boolean {
    return (
      typeof SharedArrayBuffer !== "undefined" &&
      (self as any).crossOriginIsolated === true
    );
  }

  /**
   * Detect Opus decode support via WebCodecs.
   * Uses a minimal "OpusHead" description so Safari/Chromium can validate properly.
   */
  static async supportsOpus(): Promise<boolean> {
    try {
      if (typeof (self as any).AudioDecoder === "undefined") return false;

      // minimal OpusHead (mono) – same builder you already have
      const opusHead = (function buildOpusHead(): Uint8Array {
        const b = new Uint8Array(19);
        const v = new DataView(b.buffer);
        b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
        b[8] = 1; // version
        b[9] = 1; // channels
        v.setUint16(10, 0, true); // preSkip
        v.setUint32(12, 48000, true); // input sample rate
        v.setInt16(16, 0, true); // output gain q8
        b[18] = 0; // mapping family 0 (mono/stereo)
        return b;
      })();

      const cfg: AudioDecoderConfig = {
        codec: "opus",
        numberOfChannels: 1,
        sampleRate: 48000,
        description: opusHead.buffer, // ArrayBuffer (not a view)
      };

      // Some browsers require description to be an ArrayBuffer without offset
      const res = await (AudioDecoder as any).isConfigSupported(cfg);
      return !!(res && res.supported);
    } catch {
      return false;
    }
  }
}

// -----------------------------------------------------------------------------
// Helpers

// Minimal OpusHead (RFC7845 §5.1) for mono/stereo (mapping family 0)
function buildOpusHead(
  channels: number,
  preSkip = 0,
  inputSampleRate = 48000,
  outputGainQ8 = 0,
  mappingFamily = 0,
): Uint8Array {
  const b = new Uint8Array(19);
  const v = new DataView(b.buffer);
  b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  b[8] = 1;
  b[9] = channels & 0xff;
  v.setUint16(10, preSkip, true);
  v.setUint32(12, inputSampleRate >>> 0, true);
  v.setInt16(16, outputGainQ8, true);
  b[18] = mappingFamily & 0xff;
  return b;
}

function tightArrayBuffer(u8: Uint8Array): ArrayBufferLike {
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? u8.buffer
    : u8.slice().buffer;
}

// Rough enough for your stream (10 ms, 1 frame/packet)
function opusDurationFromPacket(
  pkt: Uint8Array,
  sampleRate = 48000,
): { samples: number; durationUs: number } {
  if (pkt.length === 0) return { samples: 0, durationUs: 0 };
  const toc = pkt[0];
  const config = toc >> 3;
  const frameCode = toc & 0x03;
  const durIdx = config & 0x03; // 0:2.5, 1:5, 2:10, 3:20 ms
  const durMs = [2.5, 5, 10, 20][durIdx];
  let frames = frameCode === 1 ? 2 : 1;
  const samples = Math.round(frames * (durMs / 1000) * sampleRate);
  const durationUs = Math.round((samples / sampleRate) * 1_000_000);
  return { samples, durationUs };
}

function alignChannels(src: Float32Array[], targetCh: number): Float32Array[] {
  const inCh = src.length;
  if (inCh === targetCh) return src;
  const frames = src[0].length;
  if (inCh === 1 && targetCh === 2) return [src[0], new Float32Array(src[0])];
  if (inCh === 2 && targetCh === 1) {
    const L = src[0],
      R = src[1],
      M = new Float32Array(frames);
    for (let i = 0; i < frames; i++) M[i] = 0.5 * (L[i] + R[i]);
    return [M];
  }
  const out: Float32Array[] = new Array(targetCh);
  const common = Math.min(inCh, targetCh);
  for (let c = 0; c < common; c++) out[c] = src[c];
  for (let c = common; c < targetCh; c++) out[c] = new Float32Array(frames);
  return out;
}

/** Fast linear resampler (very low CPU, good for comms). */
function resamplePlanarLinear(
  planes: Float32Array[],
  fromRate: number,
  toRate: number,
): Float32Array[] {
  if (fromRate === toRate) return planes;
  const ratio = toRate / fromRate;
  const inLen = planes[0].length | 0;
  const outLen = Math.max(1, Math.floor(inLen * ratio));
  const out: Float32Array[] = new Array(planes.length);
  for (let c = 0; c < planes.length; c++) {
    const src = planes[c];
    const dst = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const x = i / ratio;
      const i0 = Math.floor(x);
      const i1 = Math.min(inLen - 1, i0 + 1);
      const t = x - i0;
      dst[i] = (1 - t) * src[i0] + t * src[i1];
    }
    out[c] = dst;
  }
  return out;
}

/** Convert AudioData (WebCodecs) to AudioBuffer for fallback scheduling. */
function audioDataToAudioBuffer(ctx: AudioContext, ad: AudioData): AudioBuffer {
  const ch = ad.numberOfChannels | 0;
  const frames = ad.numberOfFrames | 0;
  const rate = ad.sampleRate | 0;
  const buf = new AudioBuffer({
    length: frames,
    numberOfChannels: ch,
    sampleRate: rate,
  });
  for (let c = 0; c < ch; c++) {
    const arr = new Float32Array(frames);
    ad.copyTo(arr, { planeIndex: c, format: "f32-planar" });
    buf.copyToChannel(arr, c);
  }
  return buf;
}

/** Rechannel an AudioBuffer to the requested channel count. */
function rechannelAudioBuffer(
  ctx: AudioContext,
  buf: AudioBuffer,
  targetCh: number,
): AudioBuffer {
  if (buf.numberOfChannels === targetCh) return buf;
  const frames = buf.length | 0;
  const out = new AudioBuffer({
    length: frames,
    numberOfChannels: targetCh,
    sampleRate: buf.sampleRate,
  });
  if (buf.numberOfChannels === 1 && targetCh === 2) {
    const m = new Float32Array(frames);
    buf.copyFromChannel(m, 0);
    out.copyToChannel(m, 0);
    out.copyToChannel(m, 1);
  } else if (buf.numberOfChannels === 2 && targetCh === 1) {
    const L = new Float32Array(frames);
    const R = new Float32Array(frames);
    buf.copyFromChannel(L, 0);
    buf.copyFromChannel(R, 1);
    const M = new Float32Array(frames);
    for (let i = 0; i < frames; i++) M[i] = 0.5 * (L[i] + R[i]);
    out.copyToChannel(M, 0);
  } else {
    // generic copy / zero-fill
    const common = Math.min(buf.numberOfChannels, targetCh);
    for (let c = 0; c < common; c++) {
      const tmp = new Float32Array(frames);
      buf.copyFromChannel(tmp, c);
      out.copyToChannel(tmp, c);
    }
  }
  return out;
}

// --- Timestamp-aware jitter + simple PLL clock model ------------------

type PcmFrame = {
  planes: Float32Array[];
  frames: number;
  sampleRate: number;
  tsSec?: number; // sender (GPS) timestamp in seconds, if provided
  durSec: number;
};

class ClockModel {
  // t_ctx ≈ a * t_sender + b
  private a = 1.0; // slope (accounts for small sample-rate skew)
  private b = 0.0; // offset (maps sender epoch to ctx time)
  private inited = false;

  // Gentle lock parameters
  private alphaOff = 0.02; // offset smoothing
  private alphaSkew = 0.0005; // slope smoothing (very slow)

  /** Update mapping given one anchor: sender time (s) should play at ctx time (s). */
  update(tSender: number, tCtx: number): void {
    if (!this.inited) {
      this.a = 1.0;
      this.b = tCtx - tSender;
      this.inited = true;
      return;
    }
    const tEst = this.a * tSender + this.b;
    const err = tCtx - tEst; // seconds
    // correct offset quickly
    this.b += this.alphaOff * err;
    // correct slope slowly using proportional to sender time
    // small derivative term: change slope so future large tSender have less error
    this.a += this.alphaSkew * err;
    // clamp slope to reasonable ppm range (±1000 ppm)
    const minA = 1 - 0.001,
      maxA = 1 + 0.001;
    if (this.a < minA) this.a = minA;
    if (this.a > maxA) this.a = maxA;
  }

  /** Map a sender timestamp to expected ctx time. */
  map(tSender: number): number {
    return this.a * tSender + this.b;
  }

  /** Current slope→resample ratio nudge (1.0 means no change). */
  get resampleRatio(): number {
    return 1.0 / this.a;
  }

  get initialized(): boolean {
    return this.inited;
  }
}

class TimestampJitterBuffer {
  private q: PcmFrame[] = []; // kept ordered by tsSec if present, else FIFO
  private bufferedSec = 0;
  private targetLeadSec: number;
  private maxLeadSec: number;

  // Network jitter estimator (RFC3550-ish)
  private prevArrivalSec = 0;
  private jitterSec = 0;

  constructor(targetLeadSec: number, maxLeadSec: number) {
    this.targetLeadSec = targetLeadSec;
    this.maxLeadSec = maxLeadSec;
  }

  setTargets(targetLeadSec: number, maxLeadSec: number) {
    this.targetLeadSec = targetLeadSec;
    this.maxLeadSec = Math.max(targetLeadSec, maxLeadSec);
  }

  /** Insert frame (optionally timestamped). arrivalSec=performance.now()/1000 */
  push(frame: PcmFrame, arrivalSec: number) {
    // update jitter estimate on arrival deltas
    if (this.prevArrivalSec !== 0) {
      const d = Math.abs(arrivalSec - this.prevArrivalSec);
      const alpha = 1 / 16;
      this.jitterSec += alpha * (d - this.jitterSec);
    }
    this.prevArrivalSec = arrivalSec;

    // insert ordered if tsSec is present
    if (frame.tsSec !== undefined) {
      // binary insert by tsSec
      let lo = 0,
        hi = this.q.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const ts = this.q[mid].tsSec;
        if (ts === undefined || ts > frame.tsSec) hi = mid;
        else lo = mid + 1;
      }
      this.q.splice(lo, 0, frame);
    } else {
      this.q.push(frame);
    }
    this.bufferedSec += frame.durSec;

    // trim if over max lead (drop oldest)
    while (this.bufferedSec > this.maxLeadSec && this.q.length > 1) {
      const old = this.q.shift()!;
      this.bufferedSec -= old.durSec;
    }
  }

  /**
   * Pop frames ready to play at ctxNow, using sender→ctx mapping.
   * If frame has tsSec, ready when map(tsSec) + targetLead ≤ ctxNow.
   * If no tsSec, use bufferedSec ≥ targetLead fallback.
   */
  popReady(ctxNow: number, clock: ClockModel): PcmFrame[] {
    const out: PcmFrame[] = [];
    if (!this.q.length) return out;

    while (this.q.length) {
      const f = this.q[0];
      if (f.tsSec !== undefined && clock.initialized) {
        const playAt = clock.map(f.tsSec) + this.targetLeadSec;
        if (playAt <= ctxNow) {
          out.push(this.q.shift()!);
          this.bufferedSec -= f.durSec;
          // keep looping to flush anything else due
        } else {
          break;
        }
      } else {
        // no timestamp path: release only when buffer meets target lead
        if (this.bufferedSec >= this.targetLeadSec) {
          out.push(this.q.shift()!);
          this.bufferedSec -= f.durSec;
        } else {
          break;
        }
      }
    }
    return out;
  }

  getBufferedSec() {
    return this.bufferedSec;
  }
  getJitterSec() {
    return this.jitterSec;
  }
}
