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
  | "dax_iq"
  | (string & {});

export interface AudioStreamSnapshot {
  readonly id: string;
  readonly streamId: string;
  readonly type: AudioStreamKind;
  readonly compression?: string;
  readonly clientHandle?: number;
  readonly radioAck: boolean;
  readonly ip?: string;
  readonly daxChannel?: number;
  readonly daxIqChannel?: number;
  readonly daxIqRate?: number;
  readonly active?: boolean;
  readonly pan?: string;
  readonly endpointType?: string;
  readonly clientGuiHandle?: number;
  readonly payloadEndian?: string;
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
  "dax_iq",
]);

export function createAudioStreamSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: AudioStreamSnapshot,
): SnapshotUpdate<AudioStreamSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<AudioStreamSnapshot>> = previous
    ? {}
    : { id, radioAck: false, tx: false };

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
        if (parsed !== undefined) {
          partial.clientHandle = parsed;
          partial.radioAck = true;
        } else {
          logParseError("audio_stream", key, value);
        }
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
      case "daxiq_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxIqChannel = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "daxiq_rate": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxIqRate = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "active":
        partial.active = value === "1";
        break;
      case "pan":
        partial.pan = value;
        break;
      case "endpoint_type":
        partial.endpointType = value;
        break;
      case "client_gui_handle": {
        const parsed = parseIntegerHex(value);
        if (parsed !== undefined) partial.clientGuiHandle = parsed;
        else logParseError("audio_stream", key, value);
        break;
      }
      case "payload_endian":
        partial.payloadEndian = value;
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
