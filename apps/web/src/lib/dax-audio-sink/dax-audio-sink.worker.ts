import {
  DAX_AUDIO_SAMPLE_RATE as SAMPLE_RATE,
  type DaxChannelMode,
  type SinkMessage,
} from "./types";
import {
  incr as telemetryIncr,
  RxSlot,
  viewTelemetry,
} from "../dax-audio/telemetry";

const SCALE_I16_TO_F32 = 1 / 32768;

// Headroom above target before we shed back. Smaller value → smaller, more
// frequent catch-up drops as the buffer drifts up due to source/sink clock
// mismatch; larger value → rarer but bigger drops with more latency creep.
const MAX_LEAD_HEADROOM_FRAMES = Math.round(0.025 * SAMPLE_RATE);

interface QueueEntry {
  seq: number;
  planes: Float32Array[];
  frames: number;
}

class DaxSinkWorker {
  private channels = 0;
  private channelMode: DaxChannelMode = "both";
  private framesCap = 0;
  private idx: Int32Array | null = null;
  private telemetry: Int32Array | null = null;
  private lastSeenSeqForGapCount = -1;
  private buffers: Float32Array[] | null = null;
  private queue: QueueEntry[] = [];
  private queuedFrames = 0;
  private targetLeadFrames = Math.round(0.05 * SAMPLE_RATE);
  private maxLeadFrames = this.targetLeadFrames + MAX_LEAD_HEADROOM_FRAMES;
  private lastSeqExt = -1;
  private silenceCache = new Map<number, Float32Array>();

  onMessage(m: SinkMessage): void {
    if (!m || !m.type) return;
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
      this.channelMode = m.channelMode ?? "both";
      this.telemetry = viewTelemetry(m.telemetrySAB);
      this.setBufferMs(m.bufferMs);
      return;
    }
    if (m.type === "channelMode") {
      this.channelMode = m.mode;
      return;
    }
    if (m.type === "bufferMs") {
      this.setBufferMs(m.ms);
      this.drain();
      return;
    }
    if (m.type !== "packet" || !this.buffers || !this.idx) return;

    const seq = this.extendSeq((m.seq | 0) & 0xf);
    if (this.telemetry) {
      telemetryIncr(this.telemetry, RxSlot.PktReceived);
      if (this.lastSeenSeqForGapCount >= 0) {
        const expected = this.lastSeenSeqForGapCount + 1;
        if (seq > expected) {
          telemetryIncr(this.telemetry, RxSlot.PktSeqGaps, seq - expected);
        } else if (seq < this.lastSeenSeqForGapCount) {
          telemetryIncr(this.telemetry, RxSlot.PktReordered);
        }
      }
      this.lastSeenSeqForGapCount = Math.max(
        this.lastSeenSeqForGapCount,
        seq,
      );
    }
    let srcPlanes: Float32Array[];
    if (m.kind === "daxAudio") {
      if (!m.left || m.left.length === 0 || !m.right || m.right.length === 0) {
        return;
      }
      const frames = Math.min(m.left.length, m.right.length);
      srcPlanes = [
        frames === m.left.length ? m.left : m.left.subarray(0, frames),
        frames === m.right.length ? m.right : m.right.subarray(0, frames),
      ];
    } else {
      if (!m.samples || m.samples.length === 0) return;
      const mono = new Float32Array(m.samples.length);
      for (let i = 0; i < m.samples.length; i += 1) {
        mono[i] = m.samples[i] * SCALE_I16_TO_F32;
      }
      srcPlanes = [mono];
    }

    const planes = this.mapChannels(srcPlanes, this.channels);
    const frames = planes[0].length | 0;
    if (frames <= 0) return;
    let i = this.queue.length;
    while (i > 0 && seq < this.queue[i - 1].seq) i -= 1;
    this.queue.splice(i, 0, { seq, planes, frames });
    this.queuedFrames += frames;
    this.drain();
  }

  private setBufferMs(ms: number): void {
    const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 50;
    this.targetLeadFrames = Math.round((safeMs / 1000) * SAMPLE_RATE);
    this.maxLeadFrames = this.targetLeadFrames + MAX_LEAD_HEADROOM_FRAMES;
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

  private getSilence(frames: number): Float32Array {
    let silence = this.silenceCache.get(frames);
    if (!silence) {
      silence = new Float32Array(frames);
      this.silenceCache.set(frames, silence);
    }
    return silence;
  }

  private mapChannels(
    src: Float32Array[],
    outChannels: number,
  ): Float32Array[] {
    const inCh = src.length;
    const frames = src[0].length;
    const out = new Array<Float32Array>(outChannels);

    // Mono input to stereo output — apply channel routing
    if (inCh === 1 && outChannels === 2) {
      const silence = this.getSilence(frames);
      switch (this.channelMode) {
        case "left":
          out[0] = src[0];
          out[1] = silence;
          return out;
        case "right":
          out[0] = silence;
          out[1] = src[0];
          return out;
        default:
          out[0] = src[0];
          out[1] = src[0];
          return out;
      }
    }

    if (inCh === outChannels) return src;

    if (inCh === 1) {
      for (let c = 0; c < outChannels; c += 1) out[c] = src[0];
      return out;
    }

    if (outChannels === 1) {
      const mono = new Float32Array(frames);
      for (let i = 0; i < frames; i += 1) {
        let sum = 0;
        for (let c = 0; c < inCh; c += 1) sum += src[c][i];
        mono[i] = sum / inCh;
      }
      out[0] = mono;
      return out;
    }

    const silence = this.getSilence(frames);
    for (let c = 0; c < outChannels; c += 1) {
      out[c] = c < inCh ? src[c] : silence;
    }
    return out;
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
      if (this.telemetry) {
        telemetryIncr(
          this.telemetry,
          RxSlot.BufForcedDrops,
          lead - this.targetLeadFrames,
        );
      }
    }

    const free = Math.max(0, cap - ((w - r) | 0));
    if (frames > free) {
      Atomics.store(this.idx, 0, r + (frames - free));
      if (this.telemetry) {
        telemetryIncr(this.telemetry, RxSlot.BufForcedDrops, frames - free);
      }
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
    if (this.telemetry) {
      const fill = (w + frames - Atomics.load(this.idx, 0)) | 0;
      Atomics.store(this.telemetry, RxSlot.BufFillFrames, fill);
    }
    Atomics.store(this.idx, 1, w + frames);
  }
}

const sink = new DaxSinkWorker();
self.onmessage = (e: MessageEvent<SinkMessage>) => {
  sink.onMessage(e.data);
};
