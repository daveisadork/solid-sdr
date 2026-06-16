/**
 * Helpers for `@solid-primitives/bounds` `createElementBounds`.
 *
 * Default mutation tracking observes `document.body` with `subtree: true` and
 * fires on every style/class change anywhere in the page. For elements whose
 * box is only affected by their own style or the styles of their ancestors,
 * we can skip the costly `getBoundingClientRect` re-read when only descendants
 * mutate — `r.target.contains(target)` is true exactly when the mutation was
 * on the bound element itself or one of its ancestors.
 */
export const onlyAncestorMutations =
  (getTarget: () => Element | undefined) =>
  <Args extends unknown[]>(trigger: (...args: Args) => void) =>
  (...args: Args) => {
    const target = getTarget();
    const records = args[0] as MutationRecord[] | undefined;
    if (!target || !records) {
      trigger(...args);
      return;
    }
    for (const r of records) {
      if ((r.target as Node).contains(target)) {
        trigger(...args);
        return;
      }
    }
  };
