import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  EMPTY_ATTRIBUTES,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
  parseIntegerMaybeHex,
} from "./common.js";

export interface ApdSnapshot {
  readonly enabled: boolean;
  readonly configurable: boolean;
  readonly equalizerActive: boolean;
  readonly antenna?: string;
  readonly frequencyMHz?: number;
  readonly txErrorMilliHz?: number;
  readonly rxErrorMilliHz?: number;
  readonly sliceId?: string;
  readonly mmx?: number;
  readonly clientHandle?: number;
  readonly sampleIndex?: number;
  readonly raw: Readonly<Record<string, string>>;
}

export function createApdSnapshot(
  attributes: Record<string, string>,
  previous?: ApdSnapshot,
): SnapshotUpdate<ApdSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<ApdSnapshot>> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const normalized = key.toLowerCase();
    switch (normalized) {
      case "enable":
        partial.enabled = isTruthy(value);
        break;
      case "configurable":
        partial.configurable = isTruthy(value);
        break;
      case "equalizer_active":
        partial.equalizerActive = isTruthy(value);
        break;
      case "equalizer_reset":
        partial.equalizerActive = false;
        break;
      case "ant":
        partial.antenna = value || undefined;
        break;
      case "freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.frequencyMHz = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "tx_error_mhz": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.txErrorMilliHz = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "rx_error_mhz": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.rxErrorMilliHz = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "slice":
        partial.sliceId = value || undefined;
        break;
      case "mmx": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.mmx = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) partial.clientHandle = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "sample_index": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.sampleIndex = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      default:
        logUnknownAttribute("apd", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...(previous?.raw ?? EMPTY_ATTRIBUTES),
      ...attributes,
    }),
  }) as ApdSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
