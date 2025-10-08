// src/lib/jitter-buffer.ts
export type JBStats = {
  queueMs: number; // span of buffered frames (ms)
  dropped: number; // frames dropped by policy
  recvFps: number; // recent arrival rate (frames/sec)
  p95JitterMs: number; // p95 of inter-arrival jitter over window
};

type Frame = { t: number; buf: ArrayBuffer };

export class JitterBuffer {
  // tune these live; 40–80ms usually feels best
  targetMs = 60;
  // cap to avoid runaway memory if sender bursts
  maxQueueMs = 120;

  private q: Frame[] = [];
  private running = false;
  private onFrame?: (buf: ArrayBuffer) => void;

  // telemetry
  private dropped = 0;
  private arrivals: number[] = []; // inter-arrival deltas (ms), ring buffer
  private lastArrivalTs = 0;
  private statsCb?: (s: JBStats) => void;
  private lastStatsAt = 0;

  constructor(opts?: Partial<Pick<JitterBuffer, "targetMs" | "maxQueueMs">>) {
    Object.assign(this, opts);
  }

  setOnFrame(cb: (buf: ArrayBuffer) => void) {
    this.onFrame = cb;
  }

  setOnStats(cb: (s: JBStats) => void) {
    this.statsCb = cb;
  }

  /** Push a new datagram; stamp arrival time here (ms) */
  push(buf: ArrayBuffer, arrivalTs = performance.now()) {
    // telemetry: inter-arrival jitter
    if (this.lastArrivalTs) {
      const d = arrivalTs - this.lastArrivalTs;
      this.arrivals.push(d);
      if (this.arrivals.length > 500) this.arrivals.shift();
    }
    this.lastArrivalTs = arrivalTs;

    this.q.push({ t: arrivalTs, buf });

    // Trim if queue span too large
    while (
      this.q.length &&
      this.q[this.q.length - 1].t - this.q[0].t > this.maxQueueMs
    ) {
      this.q.shift();
      this.dropped++; // dropped old frame(s)
    }

    if (!this.running) {
      this.running = true;
      this.tick();
    }
  }

  stop() {
    this.running = false;
    this.q.length = 0;
    this.arrivals.length = 0;
    this.lastArrivalTs = 0;
  }

  private tick = () => {
    if (!this.running) return;

    const now = performance.now();
    const target = now - this.targetMs;

    // pick newest frame whose timestamp <= target (drop older)
    let pick: Frame | undefined;
    while (this.q.length && this.q[0].t <= target) {
      pick = this.q.shift();
    }
    if (pick && this.onFrame) this.onFrame(pick.buf);

    // stats ~every 2s
    if (this.statsCb && now - this.lastStatsAt > 2000) {
      const queueMs = this.q.length
        ? this.q[this.q.length - 1].t - this.q[0].t
        : 0;
      const p95 = percentile95(this.arrivals);
      const recvFps = rateFromDeltas(this.arrivals);
      this.statsCb({
        queueMs,
        dropped: this.dropped,
        recvFps,
        p95JitterMs: p95,
      });
      this.lastStatsAt = now;
      // decay dropped count slowly so it’s not ever-growing
      this.dropped = Math.floor(this.dropped * 0.5);
    }

    requestAnimationFrame(this.tick);
  };
}

function percentile95(values: number[]) {
  if (values.length === 0) return 0;
  const arr = [...values].sort((a, b) => a - b);
  const idx = Math.min(arr.length - 1, Math.floor(arr.length * 0.95));
  // jitter = |delta - median|
  const median = arr[Math.floor(arr.length / 2)];
  return Math.abs(arr[idx] - median);
}

function rateFromDeltas(deltas: number[]) {
  if (deltas.length < 5) return 0;
  const sum = deltas.reduce((a, b) => a + b, 0);
  const avg = sum / deltas.length;
  return avg > 0 ? 1000 / avg : 0;
}
