import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
} from "./common.js";

export type KnownMeterUnits =
  | "none"
  | "Volts"
  | "Amps"
  | "dB"
  | "dBm"
  | "dBFS"
  | "RPM"
  | "degF"
  | "degC"
  | "SWR"
  | "Watts"
  | "Percent";

export type MeterUnits = KnownMeterUnits | (string & {});

export const KNOWN_METER_UNITS: readonly KnownMeterUnits[] = Object.freeze([
  "none",
  "Volts",
  "Amps",
  "dB",
  "dBm",
  "dBFS",
  "RPM",
  "degF",
  "degC",
  "SWR",
  "Watts",
  "Percent",
]);

export interface MeterSnapshot {
  readonly id: string;
  readonly source: string;
  readonly sourceIndex: number;
  readonly name: string;
  readonly description: string;
  readonly units: MeterUnits;
  readonly low: number;
  readonly high: number;
  readonly fps: number;
  readonly raw: Readonly<Record<string, string>>;
}

export function parseMeterUnits(
  value: string | undefined,
  fallback?: MeterUnits,
): MeterUnits {
  if (!value) return fallback ?? "none";
  const trimmed = value.trim();
  if (trimmed === "") return fallback ?? "none";
  const normalized = trimmed.toLowerCase() === "none" ? "none" : trimmed;
  const known = KNOWN_METER_UNITS.find((unit) => unit === normalized);
  if (known) return known;
  return normalized as MeterUnits;
}

export function createMeterSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: MeterSnapshot,
): SnapshotUpdate<MeterSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<MeterSnapshot>> = previous ? {} : { id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "src":
        partial.source = value;
        break;
      case "num": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.sourceIndex = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "nam":
        partial.name = value || partial.name || id;
        break;
      case "desc":
        partial.description = value;
        break;
      case "unit":
        partial.units = parseMeterUnits(value, partial.units);
        break;
      case "low": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.low = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "hi": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.high = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "fps": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.fps = parsed;
        else logParseError("meter", key, value);
        break;
      }
      default:
        logUnknownAttribute("meter", key, value);
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
  }) as MeterSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
