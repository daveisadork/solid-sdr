import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  logParseError,
  logUnknownAttribute,
  parseInteger,
} from "./common.js";

export const EQUALIZER_BANDS = [
  "32Hz",
  "63Hz",
  "125Hz",
  "250Hz",
  "500Hz",
  "1000Hz",
  "2000Hz",
  "4000Hz",
  "8000Hz",
] as const;

export type EqualizerBand = (typeof EQUALIZER_BANDS)[number];

export type EqualizerBandLevels = Readonly<Record<EqualizerBand, number>>;

export type EqualizerId = "rx" | "tx";

export interface EqualizerSnapshot {
  readonly id: EqualizerId;
  readonly enabled: boolean;
  readonly bands: EqualizerBandLevels;
  readonly raw: Readonly<Record<string, string>>;
}

const BAND_SET = new Set<string>(EQUALIZER_BANDS);

export function createEqualizerSnapshot(
  id: EqualizerId,
  attributes: Record<string, string>,
  previous?: EqualizerSnapshot,
): SnapshotUpdate<EqualizerSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<EqualizerSnapshot>> = {};
  let bandOverrides: Partial<Record<EqualizerBand, number>> | null = null;

  for (const [key, value] of Object.entries(attributes)) {
    if (key === "mode") {
      const parsed = parseInteger(value);
      if (parsed === undefined) {
        logParseError("equalizer", key, value);
        continue;
      }
      const enabled = parsed !== 0;
      if (enabled !== previous?.enabled) {
        partial.enabled = enabled;
      }
      continue;
    }

    if (BAND_SET.has(key)) {
      const band = key as EqualizerBand;
      const parsed = parseInteger(value);
      if (parsed === undefined) {
        logParseError("equalizer", key, value);
        continue;
      }

      if (previous?.bands?.[band] === parsed) {
        continue; // No change for this band
      }

      bandOverrides = bandOverrides ?? {};
      bandOverrides[band] = parsed;
      continue;
    }

    logUnknownAttribute("equalizer", key, value);
  }

  if (bandOverrides) {
    partial.bands = Object.freeze({
      ...previous?.bands,
      ...bandOverrides,
    } as Record<EqualizerBand, number>);
  }

  const snapshot = Object.freeze({
    ...(previous ?? { id }),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as EqualizerSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
