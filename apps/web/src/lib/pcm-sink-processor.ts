// Build a blob URL at startup:
const processorCode = `
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
        this.framesCap = m.framesPerChannel|0; // capacity per channel (frames)
        this.idx = new Int32Array(m.indexSAB);
        // Layout: channel-contiguous planes in the same SAB
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
export const audioWorkletBlobUrl = URL.createObjectURL(
  new Blob([processorCode], { type: "application/javascript" }),
);
