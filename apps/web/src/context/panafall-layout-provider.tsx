import {
  createEffect,
  createMemo,
  createStore,
  type ParentComponent,
} from "solid-js";
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

  createEffect(
    () => reconcileSlotAssignments(assignments, panStreams()),
    (next) => {
      setAssignments((draft) => {
        for (let i = 0; i < SLOT_COUNT; i++) {
          if (draft[i] !== next[i]) draft[i] = next[i];
        }
      });
    },
  );

  return (
    <PanafallLayoutContext
      value={{
        slotAssignments: assignments,
        streamForSlot: (slot) => assignments[slot] ?? null,
        panCount: () => panStreams().length,
      }}
    >
      {props.children}
    </PanafallLayoutContext>
  );
};
