import type { Mutable, SnapshotUpdate } from "./common.js";
import { freezeAttributes, isTruthy } from "./common.js";

export interface WaveformSnapshot {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly isContainer: boolean;
  readonly displayName: string;
  /**
   * Environment variables the radio holds for a container waveform. Empty for
   * a legacy waveform, or when the radio sent no environment or one this
   * library cannot decode. Wire: `env`, base64 of a JSON object.
   */
  readonly env: Readonly<Record<string, string>>;
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
  const partial: Mutable<Partial<WaveformSnapshot>> = previous
    ? {}
    : { id, env: EMPTY_ENV };

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
      case "env":
        partial.env = decodeWaveformEnv(value);
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

const EMPTY_ENV: Readonly<Record<string, string>> = Object.freeze({});

/**
 * Decodes a waveform `env` value: base64 of UTF-8 JSON holding an object of
 * string values. Any failure, or a payload that is not an object, gives an
 * empty dictionary.
 */
export function decodeWaveformEnv(
  value: string | undefined,
): Readonly<Record<string, string>> {
  if (!value) return EMPTY_ENV;
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return EMPTY_ENV;
    }
    const env: Record<string, string> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (typeof entry === "string") env[key] = entry;
      else if (typeof entry === "number" || typeof entry === "boolean") {
        env[key] = String(entry);
      }
    }
    return Object.freeze(env);
  } catch {
    return EMPTY_ENV;
  }
}

export function parseLegacyWaveformList(
  value: string | undefined,
): ParsedLegacyWaveformEntry[] {
  if (!value) return [];

  const entries: ParsedLegacyWaveformEntry[] = [];
  for (const rawEntry of value.split(",")) {
    // these are supposed to be separated by a DEL character, but sometimes there's more than 1
    const [name, version] = rawEntry
      .trim()
      .replace(/\u007f+/g, "\u007f")
      .split("\u007f");
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
