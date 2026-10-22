import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
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
  readonly sliceId: string;
  /** Whether a decoder is running on the slice. Wire: `active`. */
  readonly active: boolean;
  /** Most recently decoded text. Wire: `text`. */
  readonly text: string;
  /** Estimated sending speed in words per minute. Wire: `wpm`. */
  readonly wpm: number;
  /** Estimated signal-to-noise ratio in dB. Wire: `snr`. */
  readonly snrDb: number;
  /** Whether the decoder timing is locked to the signal. Wire: `lock`. */
  readonly locked: boolean;
  /** Effective tone pitch in Hz. Wire: `pitch`. */
  readonly pitchHz: number;
  /** Whether the decoder copies on the lower sideband. Wire: `cwl`. */
  readonly lowerSideband: boolean;
  readonly raw: Readonly<Record<string, string>>;
}

export function createCwDecoderSnapshot(
  sliceId: string,
  attributes: Record<string, string>,
  previous?: CwDecoderSnapshot,
): SnapshotUpdate<CwDecoderSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<CwDecoderSnapshot>> = previous
    ? {}
    : {
        sliceId,
        active: false,
        text: "",
        wpm: 0,
        snrDb: 0,
        locked: false,
        pitchHz: 0,
        lowerSideband: false,
      };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "active": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.active = parsed !== 0;
        break;
      }
      case "lock": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.locked = parsed !== 0;
        break;
      }
      case "cwl": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.lowerSideband = parsed !== 0;
        break;
      }
      case "wpm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.wpm = parsed;
        break;
      }
      case "snr": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.snrDb = parsed;
        break;
      }
      case "pitch": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.pitchHz = parsed;
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
