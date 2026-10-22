import { type Accessor, createContext, useContext } from "solid-js";
import type { SlotId } from "~/lib/panafall-layout";

/**
 * Session-scoped stream->slot assignment. Stream ids are per-connection, so
 * this is deliberately NOT persisted; only per-slot preferences persist
 * (panadapterSizes).
 */
export const PanafallLayoutContext = createContext<{
  /** slot index -> pan stream id (null = empty slot). */
  slotAssignments: readonly (string | null)[];
  /** Stream id assigned to a slot. */
  streamForSlot: (slot: SlotId) => string | null;
  /** Number of this client's open panafalls. */
  panCount: Accessor<number>;
}>();

export function usePanafallLayout() {
  const context = useContext(PanafallLayoutContext);
  if (!context) {
    throw new Error(
      "usePanafallLayout must be used within a PanafallLayoutProvider",
    );
  }
  return context;
}
