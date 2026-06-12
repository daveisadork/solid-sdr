// apps/web/src/lib/dax-audio/telemetry.ts

// Atomic Int32 slot indices. Writers (worklet, worker, main-thread sender)
// update slots via Atomics.add / setMax CAS; readers snapshot via Atomics.load.

export const RxSlot = {
  PktReceived: 0,
  PktSeqGaps: 1,
  PktReordered: 2,
  PktLateDropped: 3,
  BufFillFrames: 4,        // last drain snapshot
  BufTargetFrames: 5,      // governor target snapshot (stage 3)
  BufForcedDrops: 6,       // overrun drops (frames)
  BufFastTrimEvents: 7,    // stage 3
  BufFastTrimFrames: 8,    // stage 3
  WorkletUnderruns: 9,
  WorkletQuantaServed: 10,
  EpsilonPpm: 11,          // stage 3: ε * 1e6 as int32 (signed)
  CtxSampleRateHz: 12,     // populated once at init
} as const;

// WorkletFramesCaptured must stay at 0 — the worklet references the literal 0
// for that slot (workers/worklets currently can't import this module at runtime).
export const TxSlot = {
  WorkletFramesCaptured: 0,
  MainPacketsSent: 1,
  MainSendStallMaxUs: 2,
  CtxSampleRateHz: 3,
  MainSendStallOver10msCount: 4,
  MainSendStallOver25msCount: 5,
  MainSendStallOver50msCount: 6,
  MainSendStallOver100msCount: 7,
} as const;

export const RX_SLOT_COUNT = 16; // pad to 16 for cache-line alignment + headroom
export const TX_SLOT_COUNT = 16;

export function allocTelemetrySAB(slotCount: number): SharedArrayBuffer {
  return new SharedArrayBuffer(slotCount * Int32Array.BYTES_PER_ELEMENT);
}

export function viewTelemetry(sab: SharedArrayBuffer): Int32Array {
  return new Int32Array(sab);
}

/** Increment a counter atomically. Returns the previous value. */
export function incr(view: Int32Array, slot: number, by = 1): number {
  return Atomics.add(view, slot, by);
}

/** Compare-and-swap loop to store the maximum of `value` and the current slot. */
export function setMax(view: Int32Array, slot: number, value: number): void {
  while (true) {
    const current = Atomics.load(view, slot);
    if (value <= current) return;
    const prev = Atomics.compareExchange(view, slot, current, value);
    if (prev === current) return;
  }
}

/** Direct write (non-atomic semantics fine for one-shot constants like sample rate). */
export function set(view: Int32Array, slot: number, value: number): void {
  Atomics.store(view, slot, value);
}

export function load(view: Int32Array, slot: number): number {
  return Atomics.load(view, slot);
}

export interface RxTelemetrySnapshot {
  pktReceived: number;
  pktSeqGaps: number;
  pktReordered: number;
  pktLateDropped: number;
  bufFillFrames: number;
  bufTargetFrames: number;
  bufForcedDrops: number;
  bufFastTrimEvents: number;
  bufFastTrimFrames: number;
  workletUnderruns: number;
  workletQuantaServed: number;
  epsilonPpm: number;
  ctxSampleRateHz: number;
}

export interface TxTelemetrySnapshot {
  workletFramesCaptured: number;
  mainPacketsSent: number;
  mainSendStallMaxUs: number;
  ctxSampleRateHz: number;
  mainSendStallOver10msCount: number;
  mainSendStallOver25msCount: number;
  mainSendStallOver50msCount: number;
  mainSendStallOver100msCount: number;
}

export function snapshotRx(view: Int32Array): RxTelemetrySnapshot {
  return {
    pktReceived: load(view, RxSlot.PktReceived),
    pktSeqGaps: load(view, RxSlot.PktSeqGaps),
    pktReordered: load(view, RxSlot.PktReordered),
    pktLateDropped: load(view, RxSlot.PktLateDropped),
    bufFillFrames: load(view, RxSlot.BufFillFrames),
    bufTargetFrames: load(view, RxSlot.BufTargetFrames),
    bufForcedDrops: load(view, RxSlot.BufForcedDrops),
    bufFastTrimEvents: load(view, RxSlot.BufFastTrimEvents),
    bufFastTrimFrames: load(view, RxSlot.BufFastTrimFrames),
    workletUnderruns: load(view, RxSlot.WorkletUnderruns),
    workletQuantaServed: load(view, RxSlot.WorkletQuantaServed),
    epsilonPpm: load(view, RxSlot.EpsilonPpm),
    ctxSampleRateHz: load(view, RxSlot.CtxSampleRateHz),
  };
}

export function snapshotTx(view: Int32Array): TxTelemetrySnapshot {
  return {
    workletFramesCaptured: load(view, TxSlot.WorkletFramesCaptured),
    mainPacketsSent: load(view, TxSlot.MainPacketsSent),
    mainSendStallMaxUs: load(view, TxSlot.MainSendStallMaxUs),
    ctxSampleRateHz: load(view, TxSlot.CtxSampleRateHz),
    mainSendStallOver10msCount: load(view, TxSlot.MainSendStallOver10msCount),
    mainSendStallOver25msCount: load(view, TxSlot.MainSendStallOver25msCount),
    mainSendStallOver50msCount: load(view, TxSlot.MainSendStallOver50msCount),
    mainSendStallOver100msCount: load(view, TxSlot.MainSendStallOver100msCount),
  };
}
