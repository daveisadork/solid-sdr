// Shared memory layout for the panadapter SAB, used by both the main thread
// (writer) and the worker (reader). Keeping these constants in one module
// guarantees both sides agree on the layout.
//
// The SAB is laid out as:
//   [ control: Int32Array(CONTROL_LENGTH) ][ fft data: Uint16Array(DATA_LENGTH) ]
//
// The data region is split into NUM_BUFFERS slots of MAX_BINS each. The main
// thread accumulates each frame into the current write slot, then publishes by
// storing the slot index + bin count into the control region and bumping the
// sequence counter (which the worker waits on). Multiple slots let the writer
// move on to the next frame without overwriting the slot the worker may still
// be reading.

/** Maximum bins per frame. Comfortably above any realistic panadapter width. */
export const MAX_BINS = 8192;

/** Number of rotating data slots (writer stays ahead of the reader). */
export const NUM_BUFFERS = 3;

// Control region — Int32 slots, accessed via Atomics.
export const CONTROL_LENGTH = 4;
/** Frame sequence counter; bumped on each completed frame. Worker waits here. */
export const CONTROL_SEQ = 0;
/** Slot index (0..NUM_BUFFERS-1) holding the most recently completed frame. */
export const CONTROL_BUF = 1;
/** Bin count of the most recently completed frame. */
export const CONTROL_BINS = 2;

export const CONTROL_BYTES = CONTROL_LENGTH * Int32Array.BYTES_PER_ELEMENT;
export const DATA_LENGTH = NUM_BUFFERS * MAX_BINS;
export const SAB_BYTES =
  CONTROL_BYTES + DATA_LENGTH * Uint16Array.BYTES_PER_ELEMENT;
