import type { StoreSetter } from "solid-js";
import { createMemo } from "solid-js";

/**
 * Keyed substore for maps like Record<string, Value>.
 *
 * @param getMap    accessor for the map object (reactive)
 * @param key       accessor for current key (reactive)
 * @param setRoot   root setState from createStore(...)
 * @param pathToMap static path from the root to the map
 * @returns [itemGetter, setItem]
 */
export function createKeyedSubstore<
  TMap extends Record<PropertyKey, unknown>,
  K extends keyof TMap,
>(
  getMap: () => TMap,
  key: () => K | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: the root shape is opaque here
  setRoot: StoreSetter<any>,
  pathToMap: readonly (string | number)[],
): [() => TMap[K] | undefined, StoreSetter<TMap[K]>] {
  // Reactive getter that follows map + key
  const item = createMemo<TMap[K] | undefined>(() => {
    const m = getMap();
    const k = key();
    return k === undefined ? undefined : (m[k] as TMap[K]);
  });

  // Bound setter that drafts against root[...pathToMap][key()]
  const setItem: StoreSetter<TMap[K]> = (fn) => {
    const k = key();
    if (k === undefined) return; // no-op if key isn't ready
    setRoot((root) => {
      let map = root;
      for (const part of pathToMap) map = map[part];
      const next = fn(map[k]);
      if (next !== undefined) map[k] = next;
    });
  };

  return [item, setItem];
}
