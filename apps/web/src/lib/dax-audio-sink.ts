import type {
  AudioStreamDataEvent,
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
} from "@repo/flexlib";

const SAMPLE_RATE = 24_000;
const RING_FRAMES = 16384; // ~682ms capacity at 24kHz

const sabWorkletCode = `
class DaxSabSinkProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ready = false;
    this.channels = 0;
    this.framesCap = 0;
    this.buffers = null;
    this.idx = null;
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

    const need = output[0].length|0;
    let r = Atomics.load(this.idx, 0)|0;
    const w = Atomics.load(this.idx, 1)|0;
    const cap = this.framesCap|0;
    const avail = Math.max(0, Math.min(cap, (w - r)|0));
    const take = Math.min(need, avail);

    for (let c = 0; c < this.channels; c++) {
      const buf = this.buffers[c];
      const out = output[c];
      if (take > 0) {
        const pos = (r % cap + cap) % cap;
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
registerProcessor('dax-sab-sink', DaxSabSinkProcessor);
`;

const sabWorkletURL = URL.createObjectURL(
  new Blob([sabWorkletCode], { type: "application/javascript" }),
);

const sinkWorkerCode = `
const SAMPLE_RATE = 24_000;
const SCALE_I16_TO_F32 = 1 / 32768;

class DaxSinkWorker {
  constructor() {
    this.channels = 0;
    this.framesCap = 0;
    this.idx = null;
    this.buffers = null;
    this.queue = [];
    this.queuedFrames = 0;
    this.targetLeadFrames = Math.round(0.05 * SAMPLE_RATE);
    this.maxLeadFrames = Math.max(this.targetLeadFrames, Math.round(0.25 * SAMPLE_RATE));
    this.lastSeqExt = -1;
    this.silenceCache = new Map();
  }

  onMessage(m) {
    if (!m || !m.type) return;
    if (m.type === "init") {
      this.channels = m.channels | 0;
      this.framesCap = m.framesPerChannel | 0;
      this.idx = new Int32Array(m.indexSAB);
      this.buffers = new Array(this.channels);
      for (let c = 0; c < this.channels; c++) {
        this.buffers[c] = new Float32Array(
          m.audioSAB,
          c * this.framesCap * 4,
          this.framesCap,
        );
      }
      this.setBufferMs(m.bufferMs | 0);
      return;
    }
    if (m.type === "bufferMs") {
      this.setBufferMs(m.ms | 0);
      this.drain();
      return;
    }
    if (m.type !== "packet" || !this.buffers || !this.idx) return;

    const seq = this.extendSeq((m.seq | 0) & 0xf);
    let srcPlanes;
    if (m.kind === "daxAudio") {
      const left = m.left;
      const right = m.right || m.left;
      if (!left || left.length === 0 || !right || right.length === 0) return;
      const frames = Math.min(left.length, right.length);
      srcPlanes = [
        frames === left.length ? left : left.subarray(0, frames),
        frames === right.length ? right : right.subarray(0, frames),
      ];
    } else if (m.kind === "daxReducedBw") {
      const samples = m.samples;
      if (!samples || samples.length === 0) return;
      const mono = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) mono[i] = samples[i] * SCALE_I16_TO_F32;
      srcPlanes = [mono];
    } else {
      return;
    }

    const planes = this.mapChannels(srcPlanes, this.channels);
    const frames = planes[0].length | 0;
    if (frames <= 0) return;
    let i = this.queue.length;
    while (i > 0 && seq < this.queue[i - 1].seq) i--;
    this.queue.splice(i, 0, { seq, planes, frames });
    this.queuedFrames += frames;
    this.drain();
  }

  setBufferMs(ms) {
    const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 50;
    this.targetLeadFrames = Math.round((safeMs / 1000) * SAMPLE_RATE);
    this.maxLeadFrames = Math.max(this.targetLeadFrames, Math.round(0.25 * SAMPLE_RATE));
  }

  extendSeq(seq4) {
    if (this.lastSeqExt < 0) {
      this.lastSeqExt = seq4;
      return seq4;
    }
    const last = this.lastSeqExt;
    const base = (last & ~0xf) | seq4;
    const c0 = base - 16;
    const c1 = base;
    const c2 = base + 16;
    let best = c0;
    let bestDist = Math.abs(c0 - last);
    const d1 = Math.abs(c1 - last);
    if (d1 < bestDist) {
      best = c1;
      bestDist = d1;
    }
    const d2 = Math.abs(c2 - last);
    if (d2 < bestDist || (d2 === bestDist && c2 > best)) best = c2;
    if (best > this.lastSeqExt) this.lastSeqExt = best;
    return best;
  }

  mapChannels(src, outChannels) {
    const inCh = src.length;
    if (inCh === outChannels) return src;
    const frames = src[0].length;
    const out = new Array(outChannels);

    if (inCh === 1) {
      for (let c = 0; c < outChannels; c++) out[c] = src[0];
      return out;
    }

    if (outChannels === 1) {
      const mono = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < inCh; c++) sum += src[c][i];
        mono[i] = sum / inCh;
      }
      out[0] = mono;
      return out;
    }

    let silence = this.silenceCache.get(frames);
    if (!silence) {
      silence = new Float32Array(frames);
      this.silenceCache.set(frames, silence);
    }
    for (let c = 0; c < outChannels; c++) out[c] = c < inCh ? src[c] : silence;
    return out;
  }

  drain() {
    const targetFrames = this.targetLeadFrames | 0;
    while (this.queuedFrames > targetFrames && this.queue.length > 0) {
      const entry = this.queue.shift();
      this.queuedFrames -= entry.frames;
      this.writeSAB(entry.planes, entry.frames);
    }
  }

  writeSAB(planes, frames) {
    if (!this.buffers || !this.idx || frames <= 0) return;
    const cap = this.framesCap | 0;
    let r = Atomics.load(this.idx, 0) | 0;
    const w = Atomics.load(this.idx, 1) | 0;

    const lead = (w - r) | 0;
    if (lead > this.maxLeadFrames) {
      r = w - this.targetLeadFrames;
      Atomics.store(this.idx, 0, r);
    }

    const free = Math.max(0, cap - ((w - r) | 0));
    if (frames > free) {
      Atomics.store(this.idx, 0, r + (frames - free));
    }

    const pos = ((w % cap) + cap) % cap;
    const first = Math.min(frames, cap - pos);
    for (let c = 0; c < this.channels; c++) {
      const out = this.buffers[c];
      const src = planes[c];
      out.set(src.subarray(0, first), pos);
      if (first < frames) out.set(src.subarray(first, frames), 0);
    }
    Atomics.store(this.idx, 1, w + frames);
  }
}

const sink = new DaxSinkWorker();
self.onmessage = (e) => sink.onMessage(e.data);
`;

const sinkWorkerURL = URL.createObjectURL(
  new Blob([sinkWorkerCode], { type: "application/javascript" }),
);

export interface DaxAudioSinkOptions {
  channels?: number;
  bufferMs?: number;
}

export class DaxAudioSink {
  private readonly ctx: AudioContext;
  private readonly msDest: MediaStreamAudioDestinationNode;
  private readonly audio: HTMLAudioElement;
  private readonly channels: number;

  private workletNode?: AudioWorkletNode;
  private worker?: Worker;
  private resumePending = false;
  private analyser?: AnalyserNode;
  private analyserBuf?: Float32Array;
  private smoothedRms = 0;
  private _peak = -Infinity;
  private peakHoldFrames = 0;
  private static readonly PEAK_HOLD = 120; // ~2s at 60fps
  private static readonly PEAK_DECAY = 0.2; // dB per frame

  private bufferMs: number;

  constructor({ channels = 2, bufferMs = 50 }: DaxAudioSinkOptions = {}) {
    this.channels = channels;
    this.bufferMs = bufferMs;

    this.ctx = new AudioContext({
      sampleRate: SAMPLE_RATE,
      latencyHint: "interactive",
    });
    this.msDest = new MediaStreamAudioDestinationNode(this.ctx, {
      channelCount: channels,
    });
    this.audio = new Audio();
    this.audio.autoplay = true;
    this.audio.setAttribute("playsinline", "");
    this.audio.srcObject = this.msDest.stream;
  }

  async init(): Promise<void> {
    await this.ctx.audioWorklet.addModule(sabWorkletURL);
    const node = new AudioWorkletNode(this.ctx, "dax-sab-sink", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [this.channels],
    });
    node.connect(this.msDest);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256;
    node.connect(analyser);
    this.analyser = analyser;
    this.analyserBuf = new Float32Array(analyser.fftSize);
    this.workletNode = node;

    const audioSAB = new SharedArrayBuffer(
      this.channels * RING_FRAMES * Float32Array.BYTES_PER_ELEMENT,
    );
    const indexSAB = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);

    node.port.postMessage({
      type: "init",
      channels: this.channels,
      framesPerChannel: RING_FRAMES,
      audioSAB,
      indexSAB,
    });

    const worker = new Worker(sinkWorkerURL);
    worker.postMessage({
      type: "init",
      channels: this.channels,
      framesPerChannel: RING_FRAMES,
      audioSAB,
      indexSAB,
      bufferMs: this.bufferMs,
    });
    this.worker = worker;

    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audio.play().catch(() => {});
  }

  play(event: AudioStreamDataEvent): void {
    if (!this.worker) return;

    const { kind, metadata } = event;
    this.maybeResume();

    const seq = metadata.header.packetCount;

    if (kind === "daxAudio") {
      const pkt = event.packet as VitaDaxAudioPacket;
      if (!pkt.numFrames) return;
      this.worker.postMessage({
        type: "packet",
        kind,
        seq,
        left: pkt.left,
        right: pkt.right,
      });
    } else if (kind === "daxReducedBw") {
      const pkt = event.packet as VitaDaxReducedBwPacket;
      if (!pkt.numFrames) return;
      this.worker.postMessage({
        type: "packet",
        kind,
        seq,
        samples: pkt.samples,
      });
    } else {
      return;
    }
  }

  setBufferMs(ms: number): void {
    this.bufferMs = ms;
    this.worker?.postMessage({ type: "bufferMs", ms });
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const target = this.audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!target.setSinkId) {
      console.warn("setSinkId not supported in this browser");
      return;
    }
    await target.setSinkId(deviceId);
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audio.play().catch(() => {});
  }

  getLevel(): number {
    if (!this.analyser || !this.analyserBuf) return -Infinity;
    this.analyser.getFloatTimeDomainData(
      this.analyserBuf as Float32Array<ArrayBuffer>,
    );
    let sum = 0;
    let maxAbs = 0;
    for (const s of this.analyserBuf) {
      sum += s * s;
      const abs = Math.abs(s);
      if (abs > maxAbs) maxAbs = abs;
    }
    const rms = Math.sqrt(sum / this.analyserBuf.length);
    const alpha = rms > this.smoothedRms ? 0.3 : 0.05;
    this.smoothedRms = alpha * rms + (1 - alpha) * this.smoothedRms;
    const peakDb = 20 * Math.log10(Math.max(maxAbs, 1e-7));
    if (peakDb >= this._peak) {
      this._peak = peakDb;
      this.peakHoldFrames = DaxAudioSink.PEAK_HOLD;
    } else if (this.peakHoldFrames > 0) {
      this.peakHoldFrames--;
    } else {
      this._peak = Math.max(this._peak - DaxAudioSink.PEAK_DECAY, peakDb);
    }
    return 20 * Math.log10(Math.max(this.smoothedRms, 1e-7));
  }

  get peak(): number {
    return this._peak;
  }

  async close(): Promise<void> {
    try {
      this.worker?.terminate();
      this.worker = undefined;
      this.workletNode?.disconnect();
      this.analyser?.disconnect();
      this.audio.srcObject = null;
    } finally {
      await this.ctx.close();
    }
  }

  private maybeResume(): void {
    if (this.resumePending || this.ctx.state === "running") return;
    this.resumePending = true;
    void this.ctx
      .resume()
      .then(() => this.audio.play().catch(() => {}))
      .finally(() => {
        this.resumePending = false;
      });
  }
}
