import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseInteger,
  parseIntegerMaybeHex,
} from "./common.js";

export type AudioStreamKind =
  | "remote_audio_rx"
  | "remote_audio_tx"
  | "dax_rx"
  | "dax_tx"
  | "dax_mic"
  | (string & {});

export interface AudioStreamSnapshot {
  readonly id: string;
  readonly streamId: string;
  readonly type: AudioStreamKind;
  readonly compression?: string;
  readonly clientHandle?: number;
  readonly ip?: string;
  readonly port?: number;
  readonly daxChannel?: number;
  readonly slice?: string;
  readonly rxGain?: number;
  readonly rxMuted?: boolean;
  readonly txGain?: number;
  readonly txMuted?: boolean;
  readonly clients?: number;
  readonly raw: Readonly<Record<string, string>>;
}

export const AUDIO_STREAM_TYPES: ReadonlySet<AudioStreamKind> = new Set([
  "remote_audio_rx",
  "remote_audio_tx",
  "dax_rx",
  "dax_tx",
  "dax_mic",
]);

export function createAudioStreamSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: AudioStreamSnapshot,
): SnapshotUpdate<AudioStreamSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<AudioStreamSnapshot>> = {};

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "stream_id":
      case "stream":
        partial.streamId = value || partial.streamId;
        break;
      case "type":
        partial.type = value.toLowerCase() as AudioStreamKind;
        break;
      case "compression":
        partial.compression = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) partial.clientHandle = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "ip":
        partial.ip = value;
        break;
      case "port": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.port = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "dax_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxChannel = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "slice":
        partial.slice = value;
        break;
      case "rx_gain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rxGain = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "rx_mute":
      case "rx_muted":
        partial.rxMuted = isTruthy(value);
        break;
      case "tx_gain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.txGain = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "tx_mute":
      case "tx_muted":
        partial.txMuted = isTruthy(value);
        break;
      case "clients": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.clients = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      default:
        logUnknownAttribute("audio_stream", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {
      id,
      streamId: id,
    }),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as AudioStreamSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
