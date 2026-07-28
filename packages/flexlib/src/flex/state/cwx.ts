import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  EMPTY_ATTRIBUTES,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseInteger,
} from "./common.js";

const EMPTY_MACROS: readonly string[] = Object.freeze(
  Array.from({ length: 12 }, () => ""),
);

/**
 * Immutable snapshot of the CWX (character-based CW keyer) state.
 *
 * CWX allows sending Morse code text from the radio, with configurable
 * speed, break-in delay, and up to 12 storable macros.
 */
export interface CwxSnapshot {
  /** Break-in delay in milliseconds (0–2000). */
  readonly delay: number;
  /** Sending speed in words per minute (5–100). */
  readonly speed: number;
  /** Whether QSK (full break-in) is enabled. */
  readonly qskEnabled: boolean;
  /** Whether DAX sidetone is enabled for CW. */
  readonly daxSidetoneEnabled: boolean;
  /** Whether MF sidetone is enabled for CW. */
  readonly mfSidetoneEnabled: boolean;
  /** 12 macro slots (indices 0–11). */
  readonly macros: readonly string[];
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * A transient CWX progress notification.
 *
 * These arrive as `sent=`/`erase=` keys in `cwx` status messages and describe
 * transmit progress rather than persistent state, so they are delivered as
 * events instead of being folded into {@link CwxSnapshot}.
 */
export type CwxProgressEvent =
  | {
      readonly kind: "charSent";
      /** Absolute position in the radio's CWX buffer of the sent character. */
      readonly radioIndex: number;
    }
  | {
      readonly kind: "erased";
      /** First buffer index that was erased (inclusive). */
      readonly start: number;
      /** Last buffer index that was erased (inclusive). */
      readonly stop: number;
    };

const NO_PROGRESS: readonly CwxProgressEvent[] = Object.freeze([]);

/**
 * Extracts ordered `sent=`/`erase=` progress events from a raw `cwx` status
 * line.
 *
 * The parsed attribute map cannot be used here: a single status line may carry
 * several `sent=` pairs and a map collapses them to the last one. Quoted values
 * (macro text) are skipped so a macro containing `sent=` cannot fake an event.
 */
export function parseCwxProgressEvents(
  raw: string,
): readonly CwxProgressEvent[] {
  const payloadStart = raw.indexOf("|cwx");
  if (payloadStart === -1) return NO_PROGRESS;
  const segment = raw.slice(payloadStart + 4);

  const events: CwxProgressEvent[] = [];
  let index = 0;
  while (index < segment.length) {
    while (index < segment.length && segment[index] === " ") index += 1;
    if (index >= segment.length) break;

    const equals = segment.indexOf("=", index);
    if (equals === -1) break;
    const key = segment.slice(index, equals).toLowerCase();

    index = equals + 1;
    let end = index;
    let quoted = false;
    while (end < segment.length) {
      const char = segment[end];
      if (char === '"' && segment[end - 1] !== "\\") quoted = !quoted;
      else if (char === " " && !quoted) break;
      end += 1;
    }
    const value = segment.slice(index, end);
    index = end + 1;

    if (key === "sent") {
      const radioIndex = parseInteger(value);
      if (radioIndex !== undefined)
        events.push({ kind: "charSent", radioIndex });
      else logParseError("cwx", "sent", value);
    } else if (key === "erase") {
      const [startText, stopText] = value.split(",");
      const start = parseInteger(startText ?? "");
      const stop = parseInteger(stopText ?? "");
      if (start !== undefined && stop !== undefined)
        events.push({ kind: "erased", start, stop });
      else logParseError("cwx", "erase", value);
    }
  }

  return events.length > 0 ? Object.freeze(events) : NO_PROGRESS;
}

/**
 * Parses wire attributes into an immutable {@link CwxSnapshot}.
 *
 * Macro attributes arrive as `macro1` through `macro12` (1-indexed on the wire,
 * mapped to 0-indexed in the array).
 */
export function createCwxSnapshot(
  attributes: Record<string, string>,
  previous?: CwxSnapshot,
): SnapshotUpdate<CwxSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<CwxSnapshot>> = {};
  let macrosChanged = false;
  let macros: string[] | undefined;

  for (const [key, value] of Object.entries(attributes)) {
    const normalized = key.toLowerCase();

    const macroMatch = normalized.match(/^macro(\d+)$/);
    if (macroMatch) {
      const index = parseInt(macroMatch[1], 10) - 1; // wire is 1-indexed
      if (index >= 0 && index < 12) {
        if (!macros) {
          macros = [...(previous?.macros ?? EMPTY_MACROS)];
        }
        macros[index] = value;
        macrosChanged = true;
      }
      continue;
    }

    switch (normalized) {
      case "break_in_delay": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.delay = parsed;
        else logParseError("cwx", key, value);
        break;
      }
      case "wpm": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.speed = parsed;
        else logParseError("cwx", key, value);
        break;
      }
      case "qsk_enabled":
        partial.qskEnabled = isTruthy(value);
        break;
      case "dax_sidetone_enabled":
        partial.daxSidetoneEnabled = isTruthy(value);
        break;
      case "mf_sidetone_enabled":
        partial.mfSidetoneEnabled = isTruthy(value);
        break;
      case "sent":
      case "erase":
        // Transient events — not stored in snapshot state
        break;
      default:
        logUnknownAttribute("cwx", key, value);
        break;
    }
  }

  if (macrosChanged && macros) {
    partial.macros = Object.freeze(macros);
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...(previous?.raw ?? EMPTY_ATTRIBUTES),
      ...attributes,
    }),
  }) as CwxSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
