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
  /** 12 macro slots (indices 0–11). */
  readonly macros: readonly string[];
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
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
