export const DAX_IQ_RING_FRAMES = 16384; // ring buffer capacity (frames), shared across all rates

export interface InitMessage {
  type: "init";
  channels: number; // always 2 (I + Q)
  framesPerChannel: number;
  audioSAB: SharedArrayBuffer;
  indexSAB: SharedArrayBuffer;
  bufferMs: number;
  sampleRate: number; // chosen IQ rate — worker needs it for lead-frame math
}

export interface BufferMsMessage {
  type: "bufferMs";
  ms: number;
}

export interface DaxIqPacketMessage {
  type: "packet";
  kind: "daxIq";
  seq: number;
  left: Float32Array;
  right: Float32Array;
}

export type SinkMessage = InitMessage | BufferMsMessage | DaxIqPacketMessage;
