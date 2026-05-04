import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  EMPTY_ATTRIBUTES,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseInteger,
} from "./common.js";

/** Possible DVK system states. */
export type DvkStatus =
  | "disabled"
  | "idle"
  | "recording"
  | "preview"
  | "playback";

/** A single DVK recording entry. */
export interface DvkRecording {
  readonly id: string;
  readonly name: string;
  readonly durationMs: number;
}

/**
 * Immutable snapshot of the DVK (Digital Voice Keyer) state.
 *
 * DVK allows recording, storing, and playing back audio messages
 * for contest operation and automated announcements.
 */
export interface DvkSnapshot {
  /** Current DVK system status. */
  readonly status: DvkStatus;
  /** Whether DVK is enabled on this radio. */
  readonly enabled: boolean;
  /** ID of the recording associated with the current status (e.g. which recording is playing). */
  readonly statusRecordingId?: string;
  /** All stored recordings. */
  readonly recordings: readonly DvkRecording[];
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
}

const EMPTY_RECORDINGS: readonly DvkRecording[] = Object.freeze([]);

function parseDvkStatus(value: string): DvkStatus | undefined {
  switch (value.toLowerCase()) {
    case "disabled":
      return "disabled";
    case "idle":
      return "idle";
    case "recording":
      return "recording";
    case "preview":
      return "preview";
    case "playback":
      return "playback";
    default:
      return undefined;
  }
}

/**
 * Parses wire attributes into an immutable {@link DvkSnapshot}.
 *
 * DVK status messages come in two forms:
 * - Global status: `status=idle enabled=1 id=0`
 * - Recording lifecycle: `added id=1 name="Rec 1" duration=5000`
 *   or `deleted id=1`
 */
export function createDvkSnapshot(
  attributes: Record<string, string>,
  previous?: DvkSnapshot,
): SnapshotUpdate<DvkSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<DvkSnapshot>> = {};

  // Check for recording lifecycle events first
  const isAdded = "added" in attributes;
  const isDeleted = "deleted" in attributes;

  if (isAdded || isDeleted) {
    const recId = attributes["id"];
    if (recId) {
      const prevRecordings = previous?.recordings ?? EMPTY_RECORDINGS;
      if (isDeleted) {
        const filtered = prevRecordings.filter((r) => r.id !== recId);
        if (filtered.length !== prevRecordings.length) {
          partial.recordings = Object.freeze(filtered);
        }
      } else {
        const name = attributes["name"] ?? "";
        const durationMs = parseInteger(attributes["duration"]) ?? 0;
        const existing = prevRecordings.findIndex((r) => r.id === recId);
        const recording: DvkRecording = Object.freeze({
          id: recId,
          name,
          durationMs,
        });
        if (existing >= 0) {
          const updated = [...prevRecordings];
          updated[existing] = recording;
          partial.recordings = Object.freeze(updated);
        } else {
          partial.recordings = Object.freeze([...prevRecordings, recording]);
        }
      }
    }
  } else {
    // Global status update
    for (const [key, value] of Object.entries(attributes)) {
      switch (key.toLowerCase()) {
        case "status": {
          const parsed = parseDvkStatus(value);
          if (parsed) partial.status = parsed;
          else logParseError("dvk", key, value);
          break;
        }
        case "enabled":
          partial.enabled = isTruthy(value);
          break;
        case "id":
          partial.statusRecordingId = value || undefined;
          break;
        default:
          logUnknownAttribute("dvk", key, value);
          break;
      }
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...(previous?.raw ?? EMPTY_ATTRIBUTES),
      ...attributes,
    }),
  }) as DvkSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
