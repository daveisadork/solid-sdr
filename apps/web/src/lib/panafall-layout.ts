/**
 * Fixed multi-panafall grid. Panafalls fill slots by index; the arrangement
 * per pan count is not user-configurable and cells are not resizable:
 *
 *   1: single full-screen cell
 *   2: two stacked rows
 *   3: slots 0/1 stacked on the left, slot 2 full-height on the right
 *   4: 2x2 filled column-major (0 top-left, 1 bottom-left, 2 top-right,
 *      3 bottom-right)
 */

export type SlotId = 0 | 1 | 2 | 3;
export type PanCount = 1 | 2 | 3 | 4;

export const SLOT_COUNT = 4;

export function clampPanCount(count: number): PanCount {
  return Math.min(Math.max(count, 1), 4) as PanCount;
}

export interface CellEdges {
  top: boolean;
  left: boolean;
  right: boolean;
  bottom: boolean;
}

export const ALL_EDGES: CellEdges = {
  top: true,
  left: true,
  right: true,
  bottom: true,
};

const EDGES_BY_COUNT: Record<PanCount, CellEdges[]> = {
  1: [ALL_EDGES],
  2: [
    { top: true, left: true, right: true, bottom: false },
    { top: false, left: true, right: true, bottom: true },
  ],
  3: [
    { top: true, left: true, right: false, bottom: false },
    { top: false, left: true, right: false, bottom: true },
    { top: true, left: false, right: true, bottom: true },
  ],
  4: [
    { top: true, left: true, right: false, bottom: false },
    { top: false, left: true, right: false, bottom: true },
    { top: true, left: false, right: true, bottom: false },
    { top: false, left: false, right: true, bottom: true },
  ],
};

/** Which viewport edges the given slot's cell touches at the given pan count. */
export function cellEdges(panCount: number, slot: SlotId): CellEdges {
  return (
    EDGES_BY_COUNT[clampPanCount(panCount)][slot] ?? {
      top: false,
      left: false,
      right: false,
      bottom: false,
    }
  );
}

export interface PanafallSlotPrefs {
  /** Fractions of the pan/waterfall vertical split (was panadapterSizes[i]). */
  panWaterfallSplit: [number, number];
  /** Whether the per-panafall settings sidebar is open (was panadapterSettingsOpen[i]). */
  settingsOpen: boolean;
}

export interface PanafallLayoutPrefs {
  version: 1;
  /** Per slot (fill order), shared across pan counts. */
  slots: PanafallSlotPrefs[];
}

export const DEFAULT_PAN_WATERFALL_SPLIT: [number, number] = [0.25, 0.75];

export function defaultPanafallLayoutPrefs(): PanafallLayoutPrefs {
  return {
    version: 1,
    slots: Array.from({ length: SLOT_COUNT }, () => ({
      panWaterfallSplit: [...DEFAULT_PAN_WATERFALL_SPLIT] as [number, number],
      settingsOpen: false,
    })),
  };
}

/**
 * In-place migration of a persisted preferences payload from the positional
 * panadapterSizes/panadapterSettingsOpen arrays to panafallLayout. Legacy
 * index i was the vertical-stack row i, which is fill-order slot i, so the
 * mapping is lossless. Idempotent; the legacy keys are dropped afterwards by
 * the deepMerge against defaults that no longer contain them.
 */
export function migrateLegacyLayout(prefs: Record<string, unknown>): void {
  if (prefs.panafallLayout) return;
  if (!prefs.panadapterSizes && !prefs.panadapterSettingsOpen) return;
  const sizes = Array.isArray(prefs.panadapterSizes)
    ? prefs.panadapterSizes
    : [];
  const open = Array.isArray(prefs.panadapterSettingsOpen)
    ? prefs.panadapterSettingsOpen
    : [];
  const layout = defaultPanafallLayoutPrefs();
  layout.slots = layout.slots.map((slot, i) => {
    const legacy = sizes[i];
    const valid =
      Array.isArray(legacy) &&
      legacy.length === 2 &&
      legacy.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
    return {
      panWaterfallSplit: valid
        ? ([legacy[0], legacy[1]] as [number, number])
        : slot.panWaterfallSplit,
      settingsOpen: Boolean(open[i]),
    };
  });
  prefs.panafallLayout = layout;
}

/**
 * Reconcile stream->slot assignments against the current stream list.
 * Surviving streams keep their relative slot order (radio-side list reorders
 * do not shuffle slots), assignments are packed into the leading slots so
 * every open stream renders, and new streams fill in after the survivors.
 * Streams beyond SLOT_COUNT are left unassigned.
 */
export function reconcileSlotAssignments(
  current: readonly (string | null)[],
  streams: readonly string[],
): (string | null)[] {
  const survivors = current.filter(
    (s): s is string => s !== null && streams.includes(s),
  );
  const newcomers = streams.filter((s) => !survivors.includes(s));
  const packed = [...survivors, ...newcomers].slice(0, SLOT_COUNT);
  return Array.from({ length: SLOT_COUNT }, (_, i) => packed[i] ?? null);
}
