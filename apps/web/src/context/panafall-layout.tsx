import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type ParentComponent,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import {
  reconcileSlotAssignments,
  SLOT_COUNT,
  type SlotId,
} from "~/lib/panafall-layout";
import useFlexRadio from "./flexradio";

/**
 * Session-scoped stream->slot assignment. Stream ids are per-connection, so
 * this is deliberately NOT persisted; only per-slot preferences persist
 * (panadapterSizes/panadapterSettingsOpen).
 */
const PanafallLayoutContext = createContext<{
  /** slot index -> pan stream id (null = empty slot). */
  slotAssignments: readonly (string | null)[];
  /** Stream id assigned to a slot. */
  streamForSlot: (slot: SlotId) => string | null;
  /** Number of this client's open panafalls. */
  panCount: Accessor<number>;
}>();

export const PanafallLayoutProvider: ParentComponent = (props) => {
  const { state } = useFlexRadio();

  const panStreams = createMemo(() =>
    Object.values(state.status.panadapter)
      .filter(
        (p) =>
          p.clientHandle === state.clientHandleInt &&
          state.status.waterfall[p.waterfallStreamId]?.clientHandle ===
            state.clientHandleInt,
      )
      .map((p) => p.id)
      .toSorted(),
  );

  const [assignments, setAssignments] = createStore<(string | null)[]>(
    Array.from({ length: SLOT_COUNT }, () => null),
  );

  createEffect(() => {
    const next = reconcileSlotAssignments(assignments, panStreams());
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (assignments[i] !== next[i]) setAssignments(i, next[i]);
    }
  });

  return (
    <PanafallLayoutContext.Provider
      value={{
        slotAssignments: assignments,
        streamForSlot: (slot) => assignments[slot] ?? null,
        panCount: () => panStreams().length,
      }}
    >
      {props.children}
    </PanafallLayoutContext.Provider>
  );
};

export function usePanafallLayout() {
  const context = useContext(PanafallLayoutContext);
  if (!context) {
    throw new Error(
      "usePanafallLayout must be used within a PanafallLayoutProvider",
    );
  }
  return context;
}
