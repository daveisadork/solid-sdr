import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  EMPTY_ATTRIBUTES,
  freezeAttributes,
  logParseError,
  logUnknownAttribute,
  parseInteger,
} from "./common.js";

/** Fixed filter-preset mode groups reported by the radio. */
export const FILTER_PRESET_MODE_GROUPS = Object.freeze([
  "ssb",
  "cw",
  "am",
  "digital",
  "rtty",
] as const);

/** Number of preset slots maintained per mode group. */
export const FILTER_PRESET_COUNT = 6;

/** Filter-preset mode group identifier used by `filt_preset` commands. */
export type FilterPresetModeGroup = (typeof FILTER_PRESET_MODE_GROUPS)[number];

/** A single filter preset entry within a mode group. */
export interface FilterPresetEntry {
  /** Zero-based preset slot index. */
  readonly index: number;
  /** Short display name shown in the UI. */
  readonly name: string;
  /** Low filter edge in Hz. */
  readonly filterLowHz: number;
  /** High filter edge in Hz. */
  readonly filterHighHz: number;
}

/**
 * Immutable snapshot of all radio filter presets.
 *
 * The radio exposes 6 presets for each fixed mode group: SSB, CW, AM,
 * Digital, and RTTY.
 */
export interface FilterPresetSnapshot {
  /** SSB filter presets. */
  readonly ssb: readonly FilterPresetEntry[];
  /** CW filter presets. */
  readonly cw: readonly FilterPresetEntry[];
  /** AM/DFM-family filter presets. */
  readonly am: readonly FilterPresetEntry[];
  /** Digital-mode filter presets. */
  readonly digital: readonly FilterPresetEntry[];
  /** RTTY filter presets. */
  readonly rtty: readonly FilterPresetEntry[];
  /** Raw attribute map from the last status update. */
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Parses a mode-group wire string such as `ssb` or `digital`.
 */
export function parseFilterPresetModeGroup(
  value: string | undefined,
): FilterPresetModeGroup | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return FILTER_PRESET_MODE_GROUPS.find((group) => group === normalized);
}

/**
 * Maps a slice demod mode to the corresponding filter-preset mode group.
 */
export function filterPresetModeGroupFromSliceMode(
  value: string | undefined,
): FilterPresetModeGroup | undefined {
  switch (value?.trim().toLowerCase()) {
    case "usb":
    case "lsb":
      return "ssb";
    case "cw":
      return "cw";
    case "am":
    case "ame":
    case "dfm":
    case "dsb":
    case "dstr":
    case "sam":
      return "am";
    case "digl":
    case "digu":
    case "fdv":
    case "fdvu":
    case "fdvl":
      return "digital";
    case "rtty":
      return "rtty";
    default:
      return undefined;
  }
}

/**
 * Parses one preset update into an immutable {@link FilterPresetSnapshot}.
 */
export function createFilterPresetSnapshot(
  modeGroup: FilterPresetModeGroup,
  index: number,
  attributes: Record<string, string>,
  previous?: FilterPresetSnapshot,
): SnapshotUpdate<FilterPresetSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<FilterPresetSnapshot>> = previous
    ? {}
    : createDefaultSnapshotPartial();
  const groupKey = modeGroup;
  const group = [...(previous?.[groupKey] ?? createDefaultGroup())];
  const existing = group[index] ?? createDefaultEntry(index);
  let name = existing.name;
  let filterLowHz = existing.filterLowHz;
  let filterHighHz = existing.filterHighHz;

  for (const [key, value] of Object.entries(attributes)) {
    switch (key.toLowerCase()) {
      case "group":
      case "num":
        // Identity is resolved before snapshot creation.
        break;
      case "name":
        name = normalizePresetName(value);
        break;
      case "low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) filterLowHz = parsed;
        else logParseError("filt_preset", key, value);
        break;
      }
      case "high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) filterHighHz = parsed;
        else logParseError("filt_preset", key, value);
        break;
      }
      default:
        logUnknownAttribute("filt_preset", key, value);
        break;
    }
  }

  if (
    existing.name !== name ||
    existing.filterLowHz !== filterLowHz ||
    existing.filterHighHz !== filterHighHz
  ) {
    group[index] = Object.freeze({
      index,
      name,
      filterLowHz,
      filterHighHz,
    });
    partial[groupKey] = Object.freeze(
      group,
    ) as FilterPresetSnapshot[typeof groupKey];
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...(previous?.raw ?? EMPTY_ATTRIBUTES),
      ...attributes,
    }),
  }) as FilterPresetSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

function createDefaultSnapshotPartial(): Mutable<
  Partial<FilterPresetSnapshot>
> {
  return {
    ssb: createDefaultGroup(),
    cw: createDefaultGroup(),
    am: createDefaultGroup(),
    digital: createDefaultGroup(),
    rtty: createDefaultGroup(),
  };
}

function createDefaultGroup(): readonly FilterPresetEntry[] {
  return Object.freeze(
    Array.from({ length: FILTER_PRESET_COUNT }, (_, index) =>
      createDefaultEntry(index),
    ),
  );
}

function createDefaultEntry(index: number): FilterPresetEntry {
  return Object.freeze({
    index,
    name: "N/A",
    filterLowHz: 0,
    filterHighHz: 0,
  });
}

function normalizePresetName(value: string): string {
  return value.replace(/^"|"$/g, "");
}
