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
