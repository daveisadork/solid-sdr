import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
} from "./common.js";

/**
 * Immutable snapshot of a transverter (XVTR) definition.
 *
 * Transverters allow the radio to operate on bands outside its native
 * frequency range by translating between an IF frequency (within the
 * radio's range) and an RF frequency (the actual operating frequency).
 */
export interface XvtrSnapshot {
  /** Transverter index (the radio's unique identifier for this XVTR). */
  readonly id: string;
  /** Display name of the transverter (max 4 characters). */
  readonly name: string;
  /** RF frequency in MHz — the actual over-the-air frequency. */
  readonly rfFreqMHz: number;
  /** IF frequency in MHz — the frequency the radio tunes to internally. */
  readonly ifFreqMHz: number;
  /** LO error in MHz — correction offset for the transverter's local oscillator. */
  readonly loErrorMHz: number;
  /** Receive gain in dB applied when using this transverter. */
  readonly rxGainDb: number;
  /** Whether this transverter is receive-only (no transmit). */
  readonly rxOnly: boolean;
  /** Maximum transmit power in dBm. */
  readonly maxPowerDbm: number;
  /** Display order in the transverter list. */
  readonly order: number;
  /** Whether this is the preferred transverter for its frequency range. */
  readonly preferred: boolean;
  /** Two-meter internal transverter setting. */
  readonly twoMeterInt: number;
  /** Whether the radio considers this XVTR definition valid. */
  readonly valid: boolean;
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Parses wire attributes into an immutable {@link XvtrSnapshot}.
 *
 * When `previous` is provided, only changed fields appear in `diff`.
 * On first creation (`previous` undefined), the `id` is included in the diff.
 */
export function createXvtrSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: XvtrSnapshot,
): SnapshotUpdate<XvtrSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<XvtrSnapshot>> = previous ? {} : { id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "name":
        partial.name = value;
        break;
      case "rf_freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.rfFreqMHz = parsed;
        else logParseError("xvtr", key, value);
        break;
      }
      case "if_freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.ifFreqMHz = parsed;
        else logParseError("xvtr", key, value);
        break;
      }
      case "lo_error": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.loErrorMHz = parsed;
        else logParseError("xvtr", key, value);
        break;
      }
      case "rx_gain": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.rxGainDb = parsed;
        else logParseError("xvtr", key, value);
        break;
      }
      case "rx_only":
        partial.rxOnly = isTruthy(value);
        break;
      case "max_power": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.maxPowerDbm = parsed;
        else logParseError("xvtr", key, value);
        break;
      }
      case "order": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.order = parsed;
        else logParseError("xvtr", key, value);
        break;
      }
      case "preferred":
        partial.preferred = isTruthy(value);
        break;
      case "two_meter_int": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.twoMeterInt = parsed;
        else logParseError("xvtr", key, value);
        break;
      }
      case "is_valid":
        partial.valid = isTruthy(value);
        break;
      default:
        logUnknownAttribute("xvtr", key, value);
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
  }) as XvtrSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
