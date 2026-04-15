import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
  parseArgb,
} from "./common.js";

/**
 * Immutable snapshot of a DX spot.
 *
 * Spots represent stations seen on the air, typically from a DX cluster,
 * N1MM, or other spotting source. They appear as callsign labels on the
 * panadapter display at the spotted frequency.
 */
export interface SpotSnapshot {
  /** Radio-assigned spot index. */
  readonly id: string;
  /** Spotted station callsign. */
  readonly callsign: string;
  /** RX frequency in MHz. */
  readonly rxFreqMHz: number;
  /** TX frequency in MHz (0 = simplex, same as RX). */
  readonly txFreqMHz: number;
  /** Mode string (e.g. "FT8", "CW", "SSB"). */
  readonly mode: string;
  /** Display color in #RRGGBBAA hex format. */
  readonly color?: string;
  /** Background color in #RRGGBBAA hex format. */
  readonly backgroundColor?: string;
  /** Originating source (e.g. "N1MM-Station1", "telnet"). */
  readonly source?: string;
  /** Callsign of the spotter. */
  readonly spotterCallsign?: string;
  /** UTC timestamp of the spot (seconds since epoch). */
  readonly timestampSec?: number;
  /** Auto-expiry lifetime in seconds. */
  readonly lifetimeSeconds?: number;
  /** Spot comment text. */
  readonly comment?: string;
  /** Priority (1 = highest, 5 = lowest). */
  readonly priority: number;
  /** Action when spot is clicked: "tune" or "none". */
  readonly triggerAction: string;
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Parses wire attributes into an immutable {@link SpotSnapshot}.
 */
export function createSpotSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: SpotSnapshot,
): SnapshotUpdate<SpotSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<SpotSnapshot>> = previous ? {} : { id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "callsign":
        partial.callsign = value.replace(/\u007f/g, " ");
        break;
      case "rx_freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.rxFreqMHz = parsed;
        else logParseError("spot", key, value);
        break;
      }
      case "tx_freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.txFreqMHz = parsed;
        else logParseError("spot", key, value);
        break;
      }
      case "mode":
        partial.mode = value;
        break;
      case "color":
        partial.color = parseArgb(value || undefined);
        break;
      case "background_color":
        partial.backgroundColor = parseArgb(value || undefined);
        break;
      case "source":
        partial.source = value || undefined;
        break;
      case "spotter_callsign":
        partial.spotterCallsign = value || undefined;
        break;
      case "timestamp": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.timestampSec = parsed;
        else logParseError("spot", key, value);
        break;
      }
      case "lifetime_seconds": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.lifetimeSeconds = parsed;
        else logParseError("spot", key, value);
        break;
      }
      case "comment":
        partial.comment = value.replace(/\u007f/g, " ");
        break;
      case "priority": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.priority = parsed;
        else logParseError("spot", key, value);
        break;
      }
      case "trigger_action":
        partial.triggerAction = value;
        break;
      case "pan":
        // Transient — included in "triggered" echo, not spot state
        break;
      default:
        logUnknownAttribute("spot", key, value);
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
  }) as SpotSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
