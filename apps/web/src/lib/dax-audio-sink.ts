import type { AudioStreamDataEvent } from "@repo/flexlib";

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

export interface DaxAudioSinkOptions {
  channels?: number;
  bufferMs?: number;
}

interface QueueEntry {
  seq: number; // packetCount (0–15, wrapping)
  planes: Float32Array[];
  frames: number;
}

export class DaxAudioSink {
  private readonly ctx: AudioContext;
  private readonly msDest: MediaStreamAudioDestinationNode;
  private readonly audio: HTMLAudioElement;
  private readonly channels: number;

  private idx?: Int32Array;
  private sabPlanes?: Float32Array[];
  private workletNode?: AudioWorkletNode;

  private readonly queue: QueueEntry[] = [];
  private queuedFrames = 0;
  private bufferMs: number;
  private targetLeadFrames: number;
  private maxLeadFrames: number;

  constructor({ channels = 2, bufferMs = 50 }: DaxAudioSinkOptions = {}) {
    this.channels = channels;
    this.bufferMs = bufferMs;
    this.targetLeadFrames = Math.round((bufferMs / 1000) * SAMPLE_RATE);
    this.maxLeadFrames = Math.max(
      this.targetLeadFrames,
      Math.round(0.25 * SAMPLE_RATE),
    );

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
    this.workletNode = node;

    const audioSAB = new SharedArrayBuffer(
      this.channels * RING_FRAMES * Float32Array.BYTES_PER_ELEMENT,
    );
    const indexSAB = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
    this.idx = new Int32Array(indexSAB);
    this.sabPlanes = Array.from(
      { length: this.channels },
      (_, c) =>
        new Float32Array(
          audioSAB,
          c * RING_FRAMES * Float32Array.BYTES_PER_ELEMENT,
          RING_FRAMES,
        ),
    );

    node.port.postMessage({
      type: "init",
      channels: this.channels,
      framesPerChannel: RING_FRAMES,
      audioSAB,
      indexSAB,
    });

    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audio.play().catch(() => {});
  }

  play(event: AudioStreamDataEvent): void {
    if (!this.idx) return;

    const { packet, kind, metadata } = event;
    if (!packet.byteLength) return;

    void this.ctx.resume().catch(console.error);

    const view = new DataView(
      packet.buffer,
      packet.byteOffset,
      packet.byteLength,
    );
    let srcPlanes: Float32Array[];

    if (kind === "daxAudio") {
      if (packet.byteLength % 8 !== 0) return;
      const n = packet.byteLength / 8;
      const left = new Float32Array(n);
      const right = new Float32Array(n);
      for (let i = 0, off = 0; i < n; i++) {
        left[i] = view.getFloat32(off);
        off += 4;
        right[i] = view.getFloat32(off);
        off += 4;
      }
      srcPlanes = [left, right];
    } else if (kind === "daxReducedBw") {
      if (packet.byteLength % 2 !== 0) return;
      const n = packet.byteLength / 2;
      const mono = new Float32Array(n);
      for (let i = 0, off = 0; i < n; i++) {
        mono[i] = view.getInt16(off) / 32767;
        off += 2;
      }
      srcPlanes = [mono];
    } else {
      return;
    }

    const planes = mapChannels(srcPlanes, this.channels);
    const frames = planes[0].length;
    const seq = metadata.header.packetCount;

    // Sorted insert by sequence number with wrap-aware comparison.
    // Queue stays small (bufferMs / ~5.33ms per packet), so linear scan is fine.
    let i = this.queue.length;
    while (i > 0 && seqBefore(seq, this.queue[i - 1].seq)) i--;
    this.queue.splice(i, 0, { seq, planes, frames });
    this.queuedFrames += frames;

    this.drain();
  }

  setBufferMs(ms: number): void {
    this.bufferMs = ms;
    this.targetLeadFrames = Math.round((ms / 1000) * SAMPLE_RATE);
    this.maxLeadFrames = Math.max(
      this.targetLeadFrames,
      Math.round(0.25 * SAMPLE_RATE),
    );
    this.drain();
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

  async close(): Promise<void> {
    try {
      this.workletNode?.disconnect();
      this.audio.srcObject = null;
    } finally {
      await this.ctx.close();
    }
  }

  private drain(): void {
    if (!this.sabPlanes) return;
    const targetFrames = Math.round((this.bufferMs / 1000) * SAMPLE_RATE);
    while (this.queuedFrames > targetFrames && this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.queuedFrames -= entry.frames;
      this.writeSAB(entry.planes);
    }
  }

  private writeSAB(planes: Float32Array[]): void {
    const sabPlanes = this.sabPlanes!;
    const idx = this.idx!;
    const frames = planes[0].length;
    if (!frames) return;

    const cap = RING_FRAMES;
    let r = Atomics.load(idx, 0) | 0;
    const w = Atomics.load(idx, 1) | 0;

    // If ahead of maxLead, snap read pointer forward to targetLead
    const lead = (w - r) | 0;
    if (lead > this.maxLeadFrames) {
      r = w - this.targetLeadFrames;
      Atomics.store(idx, 0, r);
    }

    // Ensure there is space for incoming frames
    const free = Math.max(0, cap - ((w - r) | 0));
    if (frames > free) {
      Atomics.store(idx, 0, r + (frames - free));
    }

    const pos = ((w % cap) + cap) % cap;
    const first = Math.min(frames, cap - pos);
    for (let c = 0; c < this.channels; c++) {
      sabPlanes[c].set(planes[c].subarray(0, first), pos);
      if (first < frames) sabPlanes[c].set(planes[c].subarray(first), 0);
    }
    Atomics.store(idx, 1, w + frames);
  }
}

// Returns true if sequence number a comes before b, accounting for 4-bit wrap-around.
function seqBefore(a: number, b: number): boolean {
  return ((b - a + 16) & 0xf) < 8;
}

function mapChannels(src: Float32Array[], outChannels: number): Float32Array[] {
  const inCh = src.length;
  if (inCh === outChannels) return src;
  const frames = src[0].length;
  const out = new Array<Float32Array>(outChannels);

  if (inCh === 1) {
    // Upmix: share the mono buffer across all output channels
    for (let c = 0; c < outChannels; c++) out[c] = src[0];
  } else if (outChannels === 1) {
    // Mix down: average all input channels
    const mono = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let c = 0; c < inCh; c++) sum += src[c][i];
      mono[i] = sum / inCh;
    }
    out[0] = mono;
  } else {
    // Copy available channels, silence the rest
    for (let c = 0; c < outChannels; c++) {
      out[c] = c < inCh ? src[c] : new Float32Array(frames);
    }
  }

  return out;
}
