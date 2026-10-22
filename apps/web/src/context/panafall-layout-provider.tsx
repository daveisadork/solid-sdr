import { createEffect, createMemo, type ParentComponent } from "solid-js";
import { createStore } from "solid-js/store";
import { reconcileSlotAssignments, SLOT_COUNT } from "~/lib/panafall-layout";
import useFlexRadio from "./flexradio";
import { PanafallLayoutContext } from "./panafall-layout";

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
