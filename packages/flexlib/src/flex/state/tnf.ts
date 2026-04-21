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
 * Immutable snapshot of a Tracking Notch Filter (TNF).
 *
 * TNFs are narrow band-reject filters that suppress interference
 * at a specific frequency. Each TNF has a center frequency,
 * adjustable depth (1-3), and bandwidth.
 */
export interface TnfSnapshot {
  /** TNF identifier (the radio's unique ID for this TNF). */
  readonly id: string;
  /** Center frequency in MHz. */
  readonly frequencyMHz: number;
  /** Filter depth: 1 (normal), 2 (deep), or 3 (very deep). */
  readonly depth: number;
  /** Filter bandwidth in MHz. */
  readonly bandwidthMHz: number;
  /** Whether this TNF persists across radio reboots. */
  readonly permanent: boolean;
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Parses wire attributes into an immutable {@link TnfSnapshot}.
 *
 * When `previous` is provided, only changed fields appear in `diff`.
 * On first creation (`previous` undefined), the `id` is included in the diff.
 */
export function createTnfSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: TnfSnapshot,
): SnapshotUpdate<TnfSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<TnfSnapshot>> = previous ? {} : { id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.frequencyMHz = parsed;
        else logParseError("tnf", key, value);
        break;
      }
      case "depth": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.depth = parsed;
        else logParseError("tnf", key, value);
        break;
      }
      case "width": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.bandwidthMHz = parsed;
        else logParseError("tnf", key, value);
        break;
      }
      case "permanent":
        partial.permanent = isTruthy(value);
        break;
      default:
        logUnknownAttribute("tnf", key, value);
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
  }) as TnfSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
