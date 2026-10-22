import { createMemo, type ParentComponent, Show } from "solid-js";
import { MidiControl } from "~/components/midi-control";
import {
  type ChoiceValue,
  CONTROL_REGISTRY,
  type ControlAction,
  type ControlRuntime,
  ControlsContext,
  type ControlTarget,
  type SliceSelector,
} from "./controls";
import useFlexRadio from "./flexradio";
import { usePreferences } from "./preferences";
import { useRuntime } from "./runtime";

export const ControlsProvider: ParentComponent = (props) => {
  const { radio, state, bands } = useFlexRadio();
  const { runtime, setRuntime } = useRuntime();
  const { preferences } = usePreferences();

  const sliceIdsBySelector = createMemo(() => {
    const map = new Map<SliceSelector, string>();

    for (const slice of Object.values(state.status.slice)) {
      if (!slice.isInUse || !slice.indexLetter) continue;
      map.set(slice.indexLetter as SliceSelector, slice.id);
    }

    return map;
  });

  const getSelectableSlices = createMemo(() =>
    Object.values(state.status.slice)
      .filter(
        (slice) =>
          slice.clientHandle === state.clientHandleInt &&
          slice.isInUse &&
          slice.indexLetter,
      )
      .map((slice) => slice.indexLetter as SliceSelector),
  );

  const activeSlice = createMemo(() => {
    const slice = Object.values(state.status.slice).find(
      (entry) =>
        entry.clientHandle === state.clientHandleInt &&
        entry.isInUse &&
        entry.isActive,
    );

    if (!slice) return undefined;
    return radio()?.slice(slice.id);
  });

  const activePan = createMemo(() => {
    const panId = activeSlice()?.panadapterStreamId;
    if (!panId) return undefined;
    return radio()?.panadapter(panId);
  });

  const getSlice = (selector?: SliceSelector) => {
    if (!selector) return activeSlice();

    const id = sliceIdsBySelector().get(selector);
    if (!id) return undefined;
    return radio()?.slice(id);
  };

  const getPan = (selector?: SliceSelector) => {
    if (!selector) return activePan();

    const panId = getSlice(selector)?.panadapterStreamId;
    if (!panId) return undefined;
    return radio()?.panadapter(panId);
  };

  const getWaterfall = (selector?: SliceSelector) => {
    const pan = getPan(selector);
    if (!pan) return undefined;
    return radio()?.waterfall(pan.waterfallStreamId);
  };

  const getBandList = createMemo(() => bands.keys().toArray());

  const controlRuntime: ControlRuntime = {
    radio,
    state,
    runtime,
    setRuntime,
    activeSlice,
    activePan,
    getSlice,
    getPan,
    getWaterfall,
    getBandList,
    getSelectableSlices,
    preferences,
  };

  const getChoices = (target: ControlTarget, slice?: SliceSelector) => {
    const definition = CONTROL_REGISTRY[target];
    if (definition?.editor.kind !== "choice") return [];

    const editor = definition.editor as {
      kind: "choice";
      getChoices: (
        ctx: ControlRuntime,
        action?: { target: ControlTarget; slice?: SliceSelector },
      ) => readonly ChoiceValue[];
    };

    return editor.getChoices(
      controlRuntime as never,
      (slice ? { target, slice } : { target }) as never,
    );
  };

  const dispatch = (action: ControlAction) => {
    const definition = CONTROL_REGISTRY[action.target];

    if (!definition) {
      console.warn("unknown control action:", action);
      return;
    }

    (
      definition.execute as (ctx: ControlRuntime, action: ControlAction) => void
    )(controlRuntime, action);
  };

  return (
    <ControlsContext.Provider value={{ dispatch, getChoices }}>
      {props.children}
      <Show when={preferences.midiMappings.length}>
        <MidiControl />
      </Show>
    </ControlsContext.Provider>
  );
};
