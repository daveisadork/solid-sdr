import type { Mutable, SnapshotUpdate } from "./common.js";
import { freezeAttributes } from "./common.js";

/**
 * Immutable snapshot of a radio preset: a named bundle that references
 * sub-configurations to apply together. Presets are read only; a client can
 * apply one but not create, edit, or delete it.
 */
export interface PresetSnapshot {
  /** Preset id, as the radio numbers it. */
  readonly id: string;
  /** Display name. Wire: `name`. */
  readonly name: string;
  /** Slice configuration blob. Wire: `slice_config`. */
  readonly sliceConfig: string;
  /** ALE configuration blob. Wire: `ale_config`. */
  readonly aleConfig: string;
  /** True for the last preset the radio confirmed applying since this client connected. */
  readonly active: boolean;
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Parses wire attributes into a {@link PresetSnapshot}. Keys this library does
 * not model, such as `radio_config`, stay on `raw`.
 */
export function createPresetSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: PresetSnapshot,
): SnapshotUpdate<PresetSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<PresetSnapshot>> = previous
    ? {}
    : { id, name: "", sliceConfig: "", aleConfig: "", active: false };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "name":
        partial.name = value;
        break;
      case "slice_config":
        partial.sliceConfig = value;
        break;
      case "ale_config":
        partial.aleConfig = value;
        break;
      case "active":
        partial.active = value === "1";
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({ ...previous?.raw, ...attributes }),
  }) as PresetSnapshot;
  return { snapshot, diff: Object.freeze(partial), rawDiff };
}
