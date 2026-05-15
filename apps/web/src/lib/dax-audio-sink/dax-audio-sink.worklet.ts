declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

class DaxSabSinkProcessor extends AudioWorkletProcessor {
  private ready = false;
  private channels = 0;
  private framesCap = 0;
  private buffers: Float32Array[] | null = null;
  private idx: Int32Array | null = null;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data as {
        type?: string;
        channels?: number;
        framesPerChannel?: number;
        audioSAB?: SharedArrayBuffer;
        indexSAB?: SharedArrayBuffer;
      };
      if (m?.type !== "init") return;
      if (!m.audioSAB || !m.indexSAB) return;

      this.channels = m.channels ?? 0;
      this.framesCap = m.framesPerChannel ?? 0;
      this.idx = new Int32Array(m.indexSAB);
      this.buffers = new Array(this.channels);
      for (let c = 0; c < this.channels; c += 1) {
        this.buffers[c] = new Float32Array(
          m.audioSAB,
          c * this.framesCap * Float32Array.BYTES_PER_ELEMENT,
          this.framesCap,
        );
      }
      this.ready = true;
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    if (!this.ready || !this.idx || !this.buffers) {
      for (let c = 0; c < output.length; c += 1) output[c].fill(0);
      return true;
    }

    const need = output[0].length | 0;
    const r = Atomics.load(this.idx, 0) | 0;
    const w = Atomics.load(this.idx, 1) | 0;
    const cap = this.framesCap | 0;
    const avail = Math.max(0, Math.min(cap, (w - r) | 0));
    const take = Math.min(need, avail);

    for (let c = 0; c < output.length; c += 1) {
      const out = output[c];
      const buf = this.buffers[c];
      if (!buf) {
        out.fill(0);
        continue;
      }
      if (take > 0) {
        const pos = ((r % cap) + cap) % cap;
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

registerProcessor("dax-sab-sink", DaxSabSinkProcessor);
