import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
} from "./common.js";

/**
 * Immutable snapshot of a display marker.
 *
 * Display markers are radio-provided overlays such as IARU band-plan
 * segments or other labeled frequency regions shown on the panadapter.
 */
export interface DisplayMarkerSnapshot {
  /** Marker identifier within the group. */
  readonly id: string;
  /** Marker group name, e.g. "IARU1". */
  readonly group: string;
  /** Display label shown for the marker. */
  readonly label?: string;
  /** Start frequency in MHz. */
  readonly startFrequencyMHz?: number;
  /** Stop frequency in MHz. */
  readonly stopFrequencyMHz?: number;
  /** Color name reported by the radio. */
  readonly colorName?: string;
  /** Marker opacity from 0 to 100. */
  readonly opacity?: number;
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Parses wire attributes into an immutable {@link DisplayMarkerSnapshot}.
 */
export function createDisplayMarkerSnapshot(
  group: string,
  id: string,
  attributes: Record<string, string>,
  previous?: DisplayMarkerSnapshot,
): SnapshotUpdate<DisplayMarkerSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<DisplayMarkerSnapshot>> = previous
    ? {}
    : { group, id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "group":
        // Identity is resolved before snapshot creation.
        break;
      case "id":
        // Identity is resolved before snapshot creation.
        break;
      case "label":
        partial.label = value.replace(/\u007f/g, " ").replace(/^"|"$/g, "");
        break;
      case "start_freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.startFrequencyMHz = parsed;
        else logParseError("display_marker", key, value);
        break;
      }
      case "stop_freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.stopFrequencyMHz = parsed;
        else logParseError("display_marker", key, value);
        break;
      }
      case "color":
        partial.colorName = value || undefined;
        break;
      case "opacity": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.opacity = parsed;
        else logParseError("display_marker", key, value);
        break;
      }
      case "removed":
        // Lifecycle-only flag handled by the store.
        break;
      default:
        logUnknownAttribute("display_marker", key, value);
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
  }) as DisplayMarkerSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
