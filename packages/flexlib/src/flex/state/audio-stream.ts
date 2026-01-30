import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  logParseError,
  logUnknownAttribute,
  parseInteger,
  parseIntegerHex,
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
  readonly daxChannel?: number;
  readonly slice?: string;
  readonly tx: boolean;
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
  const partial: Mutable<Partial<AudioStreamSnapshot>> = previous
    ? {}
    : { id, tx: false };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "stream_id":
        partial.streamId = value;
        break;
      case "type":
        partial.type = value.toLowerCase() as AudioStreamKind;
        break;
      case "compression":
        partial.compression = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerHex(value);
        if (parsed !== undefined) partial.clientHandle = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "ip":
        partial.ip = value;
        break;
      case "dax_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxChannel = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "slice":
        partial.slice = value;
        break;
      case "tx":
        partial.tx = value === "1";
        break;
      default:
        logUnknownAttribute("audio_stream", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
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
