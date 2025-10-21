import { createMemo } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";

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
  setRoot: SetStoreFunction<unknown>,
  pathToMap: readonly (string | number)[],
): [() => TMap[K] | undefined, SetStoreFunction<TMap[K]>] {
  // Reactive getter that follows map + key
  const item = createMemo<TMap[K] | undefined>(() => {
    const m = getMap();
    const k = key();
    return k === undefined ? undefined : (m[k] as TMap[K]);
  });

  // Bound setter that writes to ["...pathToMap", key()]
  const setItem = ((...args: unknown[]) => {
    const k = key();
    if (k === undefined) return; // no-op if key isn't ready
    const call = setRoot as unknown as (...xs: unknown[]) => void;
    const p = [...pathToMap, k] as unknown[];
    call(...p, ...args);
  }) as unknown as SetStoreFunction<TMap[K]>;

  return [item, setItem];
}
