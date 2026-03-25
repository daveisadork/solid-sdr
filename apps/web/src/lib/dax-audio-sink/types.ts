export const DAX_AUDIO_SAMPLE_RATE = 24_000;
export const DAX_AUDIO_RING_FRAMES = 16384; // ~682ms capacity at 24kHz

export interface InitMessage {
  type: "init";
  channels: number;
  framesPerChannel: number;
  audioSAB: SharedArrayBuffer;
  indexSAB: SharedArrayBuffer;
  bufferMs: number;
}

export interface BufferMsMessage {
  type: "bufferMs";
  ms: number;
}

export interface DaxAudioPacketMessage {
  type: "packet";
  kind: "daxAudio";
  seq: number;
  left: Float32Array;
  right: Float32Array;
}

export interface DaxReducedBwPacketMessage {
  type: "packet";
  kind: "daxReducedBw";
  seq: number;
  samples: Int16Array;
}

export type SinkMessage =
  | InitMessage
  | BufferMsMessage
  | DaxAudioPacketMessage
  | DaxReducedBwPacketMessage;

