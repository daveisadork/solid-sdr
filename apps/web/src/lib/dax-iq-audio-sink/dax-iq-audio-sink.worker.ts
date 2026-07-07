import type { SinkMessage } from "./types";

interface QueueEntry {
  seq: number;
  planes: Float32Array[];
  frames: number;
}

class DaxIqSinkWorker {
  private channels = 0;
  private sampleRate = 48_000;
  private framesCap = 0;
  private idx: Int32Array | null = null;
  private buffers: Float32Array[] | null = null;
  private queue: QueueEntry[] = [];
  private queuedFrames = 0;
  private targetLeadFrames = 0;
  private maxLeadFrames = 0;
  private lastSeqExt = -1;

  onMessage(m: SinkMessage): void {
    if (!m?.type) return;
    if (m.type === "init") {
      this.channels = m.channels | 0;
      this.framesCap = m.framesPerChannel | 0;
      this.idx = new Int32Array(m.indexSAB);
      this.buffers = new Array(this.channels);
      for (let c = 0; c < this.channels; c += 1) {
        this.buffers[c] = new Float32Array(
          m.audioSAB,
          c * this.framesCap * Float32Array.BYTES_PER_ELEMENT,
          this.framesCap,
        );
      }
      this.sampleRate = m.sampleRate;
      this.setBufferMs(m.bufferMs);
      return;
    }
    if (m.type === "bufferMs") {
      this.setBufferMs(m.ms);
      this.drain();
      return;
    }
    if (m.type !== "packet" || !this.buffers || !this.idx) return;
    if (m.kind !== "daxIq") return;

    const seq = this.extendSeq((m.seq | 0) & 0xf);
    if (!m.left || m.left.length === 0 || !m.right || m.right.length === 0) {
      return;
    }
    const frames = Math.min(m.left.length, m.right.length);
    if (frames <= 0) return;
    const planes: Float32Array[] = [
      frames === m.left.length ? m.left : m.left.subarray(0, frames),
      frames === m.right.length ? m.right : m.right.subarray(0, frames),
    ];

    let i = this.queue.length;
    while (i > 0 && seq < this.queue[i - 1].seq) i -= 1;
    this.queue.splice(i, 0, { seq, planes, frames });
    this.queuedFrames += frames;
    this.drain();
  }

  private setBufferMs(ms: number): void {
    const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 50;
    this.targetLeadFrames = Math.round((safeMs / 1000) * this.sampleRate);
    this.maxLeadFrames = Math.max(
      this.targetLeadFrames,
      Math.round(0.25 * this.sampleRate),
    );
  }

  private extendSeq(seq4: number): number {
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

  private drain(): void {
    const targetFrames = this.targetLeadFrames | 0;
    while (this.queuedFrames > targetFrames && this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!entry) return;
      this.queuedFrames -= entry.frames;
      this.writeSAB(entry.planes, entry.frames);
    }
  }

  private writeSAB(planes: Float32Array[], frames: number): void {
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
    for (let c = 0; c < this.channels; c += 1) {
      const out = this.buffers[c];
      const src = planes[c];
      if (!out || !src) continue;
      out.set(src.subarray(0, first), pos);
      if (first < frames) out.set(src.subarray(first, frames), 0);
    }
    Atomics.store(this.idx, 1, w + frames);
  }
}

const sink = new DaxIqSinkWorker();
self.onmessage = (e: MessageEvent<SinkMessage>) => {
  sink.onMessage(e.data);
};
