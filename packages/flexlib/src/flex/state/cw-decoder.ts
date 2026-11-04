import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
} from "./common.js";
import { decodeCwxText } from "./cwx.js";

/**
 * Immutable snapshot of the CW decoder running on one slice. The radio
 * reports it on the `cw` status object, routed by the slice index.
 */
export interface CwDecoderSnapshot {
  /** Id of the slice the decoder runs on. */
  readonly id: string;
  /** Whether a decoder is running on the slice. Wire: `active`. */
  readonly active: boolean;
  /** Text from the most recent message, usually one character. Wire: `text`. */
  readonly text: string;
  /** Estimated sending speed in words per minute. Wire: `wpm`. */
  readonly wpm: number;
  /** Estimated signal-to-noise ratio in dB. Wire: `snr`. */
  readonly snrDb: number;
  /** Whether the decoder timing is locked to the signal. Wire: `lock`. */
  readonly locked: boolean;
  /** Tone pitch the decoder uses, in Hz. Wire: `pitch`. */
  readonly pitchHz: number;
  /** Whether the decoder copies on the lower sideband. Wire: `cwl`. */
  readonly lowerSideband: boolean;
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Every field the message carries goes into the diff, even when the value
 * repeats, because each `text` value is a newly decoded character.
 */
export function createCwDecoderSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: CwDecoderSnapshot,
): SnapshotUpdate<CwDecoderSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<CwDecoderSnapshot>> = previous ? {} : { id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "active":
        partial.active = isTruthy(value);
        break;
      case "lock":
        partial.locked = isTruthy(value);
        break;
      case "cwl":
        partial.lowerSideband = isTruthy(value);
        break;
      case "wpm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.wpm = parsed;
        else logParseError("cw", key, value);
        break;
      }
      case "snr": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.snrDb = parsed;
        else logParseError("cw", key, value);
        break;
      }
      case "pitch": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.pitchHz = parsed;
        else logParseError("cw", key, value);
        break;
      }
      case "text":
        partial.text = decodeCwxText(value);
        break;
      case "slice":
        break;
      default:
        logUnknownAttribute("cw", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({ ...previous?.raw, ...attributes }),
  }) as CwDecoderSnapshot;
  return { snapshot, diff: Object.freeze(partial), rawDiff };
}
