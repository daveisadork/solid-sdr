import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseInteger,
  parseMegahertz,
} from "./common.js";
import type { SliceToneMode, SliceRepeaterOffsetDirection } from "./slice.js";

export type MemoryToneMode = SliceToneMode;
export type MemoryRepeaterOffsetDirection = SliceRepeaterOffsetDirection;

export interface MemorySnapshot {
  readonly id: string;
  readonly owner: string;
  readonly group: string;
  readonly name: string;
  readonly frequencyMHz: number;
  readonly mode: string;
  readonly stepHz: number;
  readonly repeaterOffsetDirection: MemoryRepeaterOffsetDirection;
  readonly repeaterOffsetMHz: number;
  readonly fmToneMode: MemoryToneMode;
  readonly fmToneValue: number;
  readonly squelchEnabled: boolean;
  readonly squelchLevel: number;
  readonly filterLowHz: number;
  readonly filterHighHz: number;
  readonly rttyMarkHz: number;
  readonly rttyShiftHz: number;
  readonly diglOffsetHz: number;
  readonly diguOffsetHz: number;
  readonly raw: Readonly<Record<string, string>>;
}

export function createMemorySnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: MemorySnapshot,
): SnapshotUpdate<MemorySnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<MemorySnapshot>> = previous ? {} : { id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "owner":
        partial.owner = value.replace(/\u007f/g, " ");
        break;
      case "group":
        partial.group = value.replace(/\u007f/g, " ");
        break;
      case "name":
        partial.name = value.replace(/\u007f/g, " ");
        break;
      case "freq": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.frequencyMHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "mode":
        partial.mode = value;
        break;
      case "step": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.stepHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "repeater":
        partial.repeaterOffsetDirection = value;
        break;
      case "repeater_offset": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.repeaterOffsetMHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "tone_mode":
        partial.fmToneMode = value;
        break;
      case "tone_value":
        partial.fmToneValue = Number(value);
        break;
      case "squelch":
        partial.squelchEnabled = isTruthy(value);
        break;
      case "squelch_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.squelchLevel = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "rx_filter_low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.filterLowHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "rx_filter_high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.filterHighHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "rtty_mark": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rttyMarkHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "rtty_shift": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rttyShiftHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "digl_offset": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.diglOffsetHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "digu_offset": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.diguOffsetHz = parsed;
        else logParseError("memory", key, value);
        break;
      }
      case "power":
        // radio sends this, but the official lib says it isn't used
        break;
      case "highlight":
      case "highlight_color":
        // radio sends these, but the official lib ignores them
        break;
      default:
        logUnknownAttribute("memory", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({ ...previous?.raw, ...attributes }),
  }) as MemorySnapshot;

  return { snapshot, diff: Object.freeze(partial), rawDiff };
}
