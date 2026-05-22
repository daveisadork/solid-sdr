import type { Mutable, SnapshotUpdate } from "./common.js";
import { freezeAttributes, isTruthy } from "./common.js";

export interface WaveformSnapshot {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly isContainer: boolean;
  readonly displayName: string;
  readonly raw: Readonly<Record<string, string>>;
}

export interface ParsedLegacyWaveformEntry {
  readonly name: string;
  readonly version: string;
  readonly id: string;
  readonly displayName: string;
}

export function formatWaveformDisplayName(
  name: string,
  version: string,
): string {
  return version ? `${name} ${version}` : name;
}

export function createWaveformId(
  name: string,
  version: string,
  isContainer: boolean,
): string {
  return [
    isContainer ? "container" : "legacy",
    encodeURIComponent(normalizeWaveformToken(name).toLowerCase()),
    encodeURIComponent(normalizeWaveformToken(version).toLowerCase()),
  ].join(":");
}

export function createWaveformSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: WaveformSnapshot,
): SnapshotUpdate<WaveformSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<WaveformSnapshot>> = previous ? {} : { id };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "name":
        partial.name = normalizeWaveformToken(value);
        break;
      case "version":
        partial.version = normalizeWaveformToken(value);
        break;
      case "is_container":
        partial.isContainer = isTruthy(value);
        break;
    }
  }

  const name = partial.name ?? previous?.name ?? "";
  const version = partial.version ?? previous?.version ?? "";
  partial.displayName = formatWaveformDisplayName(name, version);

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    id,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as WaveformSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

export function parseLegacyWaveformList(
  value: string | undefined,
): ParsedLegacyWaveformEntry[] {
  if (!value) return [];

  const entries: ParsedLegacyWaveformEntry[] = [];
  for (const rawEntry of value.split(",")) {
    const trimmed = rawEntry.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf("  ");
    if (separatorIndex === -1) continue;

    const name = normalizeWaveformToken(trimmed.slice(0, separatorIndex));
    const version = normalizeWaveformToken(trimmed.slice(separatorIndex + 2));
    if (!name) continue;

    entries.push({
      name,
      version,
      id: createWaveformId(name, version, false),
      displayName: formatWaveformDisplayName(name, version),
    });
  }

  return entries;
}

function normalizeWaveformToken(value: string | undefined): string {
  return value?.trim() ?? "";
}
