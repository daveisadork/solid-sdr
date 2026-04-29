import {
  Accessor,
  batch,
  createContext,
  createMemo,
  ParentComponent,
  useContext,
} from "solid-js";
import { produce } from "solid-js/store";
import { MidiControl } from "~/components/midi-control";
import { BANDS } from "~/components/panafall/settings";
import useFlexRadio from "./flexradio";
import { useRuntime } from "./runtime";

export type SliceSelector = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
export type SliceMode = string;
export type PanadapterBand = string;
export type Normalized = number;
export type SignedNormalized = number;

type Empty = Record<never, never>;
type SliceTargeted = { slice?: SliceSelector };

type ToggleAction<T extends string, Extra extends object = Empty> = Extra & {
  target: T;
  op: "toggle";
};

type SetBooleanAction<
  T extends string,
  Extra extends object = Empty,
> = Extra & {
  target: T;
  op: "set";
  value: boolean;
};

type AdjustAction<T extends string, Extra extends object = Empty> = Extra & {
  target: T;
  op: "adjust";
  delta: number;
};

type SetNormalizedAction<
  T extends string,
  Extra extends object = Empty,
> = Extra & {
  target: T;
  op: "set";
  value: Normalized;
};

type SetSignedNormalizedAction<
  T extends string,
  Extra extends object = Empty,
> = Extra & {
  target: T;
  op: "set";
  value: SignedNormalized;
};

type CycleAction<T extends string, Extra extends object = Empty> = Extra & {
  target: T;
  op: "cycle";
  delta: number;
};

type SetValueAction<
  T extends string,
  TValue,
  Extra extends object = Empty,
> = Extra & {
  target: T;
  op: "set";
  value: TValue;
};

type CommandAction<T extends string, Extra extends object = Empty> = Extra & {
  target: T;
};

type ScaleBandwidthAction<Extra extends object = Empty> = Extra & {
  target: "panadapter.bandwidth";
  change: "increase" | "decrease";
  factor: number;
};

type BooleanControlAction<T extends string, Extra extends object = Empty> =
  | ToggleAction<T, Extra>
  | SetBooleanAction<T, Extra>;

type NormalizedControlAction<T extends string, Extra extends object = Empty> =
  | AdjustAction<T, Extra>
  | SetNormalizedAction<T, Extra>;

type SignedNormalizedControlAction<
  T extends string,
  Extra extends object = Empty,
> = AdjustAction<T, Extra> | SetSignedNormalizedAction<T, Extra>;

type ChoiceControlAction<
  T extends string,
  TValue,
  Extra extends object = Empty,
> = CycleAction<T, Extra> | SetValueAction<T, TValue, Extra>;

type FlexRadioApi = ReturnType<typeof useFlexRadio>;
type RuntimeApi = ReturnType<typeof useRuntime>;
type RadioController = NonNullable<ReturnType<FlexRadioApi["radio"]>>;
type SliceController = NonNullable<ReturnType<RadioController["slice"]>>;
type PanadapterController = NonNullable<
  ReturnType<RadioController["panadapter"]>
>;

type ControlScope = "slice" | "panadapter" | "radio";
type ControlOp = "toggle" | "set" | "adjust" | "cycle";
type ChoiceValue = string | number;

type ControlRuntime = {
  radio: FlexRadioApi["radio"];
  state: FlexRadioApi["state"];
  runtime: RuntimeApi["runtime"];
  setRuntime: RuntimeApi["setRuntime"];
  activeSlice: Accessor<SliceController | undefined>;
  activePan: Accessor<PanadapterController | undefined>;
  getSlice: (selector?: SliceSelector) => SliceController | undefined;
  getPan: (selector?: SliceSelector) => PanadapterController | undefined;
  getBandList: () => readonly string[];
  getSelectableSlices: () => readonly SliceSelector[];
};

type ControlEditor<TAction extends { target: string }> =
  | { kind: "command" }
  | { kind: "boolean" }
  | { kind: "relative-step" }
  | { kind: "normalized" }
  | { kind: "signed-normalized" }
  | {
      kind: "choice";
      getChoices: (
        ctx: ControlRuntime,
        action?: TAction,
      ) => readonly ChoiceValue[];
    }
  | { kind: "bandwidth-scale" };

type ControlDefinition<TAction extends { target: string }> = {
  target: TAction["target"];
  label: string;
  scope: ControlScope;
  ops: readonly ControlOp[];
  editor: ControlEditor<TAction>;
  execute: (ctx: ControlRuntime, action: TAction) => void;
};

function defineControl<TAction extends { target: string }>(
  definition: ControlDefinition<TAction>,
) {
  return definition;
}

function resolveBooleanAction(
  action: ToggleAction<string> | SetBooleanAction<string>,
  current: boolean,
) {
  return action.op === "toggle" ? !current : action.value;
}

function cycleListValue<T>(
  values: readonly T[],
  current: T,
  delta: number,
): T | undefined {
  if (values.length === 0) return undefined;
  const currentIndex = values.indexOf(current);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex =
    (((startIndex + delta) % values.length) + values.length) % values.length;
  return values[nextIndex];
}

function fromNormalized(value: Normalized, max: number, min = 0) {
  return Math.round(min + value * (max - min));
}

function fromSignedNormalized(value: SignedNormalized, maxAbsValue: number) {
  return Math.round(value * maxAbsValue);
}

function warnNotImplemented(action: { target: string }) {
  console.warn("not implemented:", action);
}

/**
 * Add new controls here.
 *
 * Each entry is the source of truth for:
 * - the runtime list of available controls
 * - the action type for that target
 * - the handler used by dispatch
 */
export const CONTROL_DEFINITIONS = [
  defineControl<AdjustAction<"slice.frequency", SliceTargeted>>({
    target: "slice.frequency",
    label: "Slice Frequency",
    scope: "slice",
    ops: ["adjust"],
    editor: { kind: "relative-step" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const deltaMhz = (slice.tuneStepHz / 1_000_000) * action.delta;
      const nextFrequency = slice.frequencyMHz + deltaMhz;
      const pan = ctx.getPan(action.slice);

      if (pan) {
        const panLow = pan.centerFrequencyMHz - pan.bandwidthMHz / 2;
        const panHigh = pan.centerFrequencyMHz + pan.bandwidthMHz / 2;
        const filterLow = nextFrequency + slice.filterLowHz / 1_000_000;
        const filterHigh = nextFrequency + slice.filterHighHz / 1_000_000;

        batch(() => {
          if (filterHigh > panHigh || filterLow < panLow) {
            pan.setCenterFrequency(pan.centerFrequencyMHz + deltaMhz);
          }
          slice.setFrequency(nextFrequency, false);
        });
        return;
      }

      slice.setFrequency(nextFrequency, false);
    },
  }),

  defineControl<ChoiceControlAction<"slice.tuneStep", number, SliceTargeted>>({
    target: "slice.tuneStep",
    label: "Slice Tune Step",
    scope: "slice",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx, action) {
        return ctx.getSlice(action?.slice)?.tuneStepListHz ?? [];
      },
    },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(slice.tuneStepListHz, slice.tuneStepHz, action.delta)
          : action.value;

      if (value === undefined) return;
      slice.setTuneStep(value);
    },
  }),

  defineControl<ChoiceControlAction<"slice.mode", SliceMode, SliceTargeted>>({
    target: "slice.mode",
    label: "Slice Mode",
    scope: "slice",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx, action) {
        return ctx.getSlice(action?.slice)?.modeList ?? [];
      },
    },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(slice.modeList, slice.mode, action.delta)
          : action.value;

      if (!value) return;
      slice.setMode(value);
    },
  }),

  defineControl<NormalizedControlAction<"slice.filter.width", SliceTargeted>>({
    target: "slice.filter.width",
    label: "Slice Filter Width",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(_ctx, action) {
      warnNotImplemented(action);
    },
  }),

  defineControl<NormalizedControlAction<"slice.audio.level", SliceTargeted>>({
    target: "slice.audio.level",
    label: "Slice Audio Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.audioGain + action.delta
          : fromNormalized(action.value, 100);

      slice.setAudioGain(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.audio.mute", SliceTargeted>>({
    target: "slice.audio.mute",
    label: "Slice Audio Mute",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setMute(resolveBooleanAction(action, slice.isMuted));
    },
  }),

  defineControl<BooleanControlAction<"slice.rit.enabled", SliceTargeted>>({
    target: "slice.rit.enabled",
    label: "Slice RIT Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setRitEnabled(resolveBooleanAction(action, slice.ritEnabled));
    },
  }),

  defineControl<
    SignedNormalizedControlAction<"slice.rit.offset", SliceTargeted>
  >({
    target: "slice.rit.offset",
    label: "Slice RIT Offset",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "signed-normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.ritOffsetHz + action.delta
          : fromSignedNormalized(action.value, 100);

      slice.setRitOffset(value);
    },
  }),

  defineControl<CommandAction<"slice.rit.clear", SliceTargeted>>({
    target: "slice.rit.clear",
    label: "Slice RIT Clear",
    scope: "slice",
    ops: [],
    editor: { kind: "command" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setRitOffset(0);
    },
  }),

  defineControl<BooleanControlAction<"slice.split.enabled", SliceTargeted>>({
    target: "slice.split.enabled",
    label: "Slice Split Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const source = ctx.getSlice(action.slice);
      if (!source) return;

      const splitState = ctx.runtime.split[source.id];
      const isSplit = source.id in ctx.runtime.split;
      const enableSplit = resolveBooleanAction(action, isSplit);

      if (isSplit === enableSplit) return;

      if (enableSplit) {
        source.clone().then((child) => {
          batch(() => {
            ctx.setRuntime("split", source.id, {
              child: child.id,
              parent: null,
            });
            ctx.setRuntime("split", child.id, {
              child: null,
              parent: source.id,
            });
          });
          child.setMute(true);
          if (source.isTransmitEnabled) {
            child.enableTransmit(true);
          }
        });
        return;
      }

      if (!splitState) return;
      const splitParent = splitState.parent
        ? ctx.radio()?.slice(splitState.parent)
        : source;
      const splitChild = splitState.child
        ? ctx.radio()?.slice(splitState.child)
        : source;

      if (!splitParent || !splitChild) return;

      splitParent.enableTransmit(
        splitParent.isTransmitEnabled || splitChild.isTransmitEnabled,
      );
      splitChild.close().then(() => {
        ctx.setRuntime(
          "split",
          produce((split) => {
            delete split[splitParent.id];
            delete split[splitChild.id];
          }),
        );
      });
    },
  }),

  defineControl<CommandAction<"slice.split.swap", SliceTargeted>>({
    target: "slice.split.swap",
    label: "Slice Split Swap",
    scope: "slice",
    ops: [],
    editor: { kind: "command" },
    execute(ctx, action) {
      const source = ctx.getSlice(action.slice);
      if (!source) return;

      const splitState = ctx.runtime.split[source.id];
      if (!splitState) return;

      const splitParent = splitState.parent
        ? ctx.radio()?.slice(splitState.parent)
        : source;
      const splitChild = splitState.child
        ? ctx.radio()?.slice(splitState.child)
        : source;

      if (!splitParent || !splitChild) return;

      batch(() => {
        ctx.setRuntime("split", splitChild.id, {
          child: splitParent.id,
          parent: null,
        });
        ctx.setRuntime("split", splitParent.id, {
          child: null,
          parent: splitChild.id,
        });

        const partnerMute = splitParent.isMuted;
        splitParent.enableTransmit(splitChild.isTransmitEnabled);
        splitParent.setMute(splitChild.isMuted);
        splitChild.setMute(partnerMute);
      });
    },
  }),

  defineControl<ChoiceControlAction<"slice.select", SliceSelector>>({
    target: "slice.select",
    label: "Active Slice",
    scope: "slice",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.getSelectableSlices();
      },
    },
    execute(ctx, action) {
      const slices = ctx.getSelectableSlices();
      if (slices.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              slices,
              ctx.activeSlice()?.indexLetter as SliceSelector,
              action.delta,
            )
          : action.value;

      if (!value) return;
      ctx.getSlice(value)?.setActive(true);
    },
  }),

  defineControl<
    ChoiceControlAction<"panadapter.band", PanadapterBand, SliceTargeted>
  >({
    target: "panadapter.band",
    label: "Panadapter Band",
    scope: "panadapter",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.getBandList();
      },
    },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      const bands = ctx.getBandList();
      if (bands.length === 0) return;

      const currentBand = pan.xvtr
        ? Object.values(ctx.state.status.xvtr).find(
            (xvtr) => xvtr.name === pan.xvtr,
          )?.id
        : pan.band;

      const value =
        action.op === "cycle"
          ? cycleListValue(bands, currentBand ?? bands[0], action.delta)
          : action.value;

      if (!value) return;
      pan.setBand(value);
    },
  }),

  defineControl<BooleanControlAction<"panadapter.bandZoom", SliceTargeted>>({
    target: "panadapter.bandZoom",
    label: "Panadapter Band Zoom",
    scope: "panadapter",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;
      pan.setBandZoom(resolveBooleanAction(action, pan.isBandZoomOn));
    },
  }),

  defineControl<BooleanControlAction<"panadapter.segmentZoom", SliceTargeted>>({
    target: "panadapter.segmentZoom",
    label: "Panadapter Segment Zoom",
    scope: "panadapter",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;
      pan.setSegmentZoom(resolveBooleanAction(action, pan.isSegmentZoomOn));
    },
  }),

  defineControl<ScaleBandwidthAction<SliceTargeted>>({
    target: "panadapter.bandwidth",
    label: "Panadapter Bandwidth",
    scope: "panadapter",
    ops: [],
    editor: { kind: "bandwidth-scale" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      const factor = 1 + action.factor;
      const bandwidth =
        action.change === "increase"
          ? pan.bandwidthMHz * factor
          : pan.bandwidthMHz / factor;

      pan.setBandwidth(bandwidth);
    },
  }),

  defineControl<NormalizedControlAction<"slice.agc.threshold", SliceTargeted>>({
    target: "slice.agc.threshold",
    label: "Slice AGC Threshold",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(_ctx, action) {
      warnNotImplemented(action);
    },
  }),

  defineControl<BooleanControlAction<"slice.nr.enabled", SliceTargeted>>({
    target: "slice.nr.enabled",
    label: "Slice NR Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setNrEnabled(resolveBooleanAction(action, slice.nrEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.nr.level", SliceTargeted>>({
    target: "slice.nr.level",
    label: "Slice NR Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.nrLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setNrLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.nrs.enabled", SliceTargeted>>({
    target: "slice.nrs.enabled",
    label: "Slice NRS Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setNrsEnabled(resolveBooleanAction(action, slice.nrsEnabled));
    },
  }),

  defineControl<BooleanControlAction<"slice.rnn.enabled", SliceTargeted>>({
    target: "slice.rnn.enabled",
    label: "Slice RNN Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setRnnEnabled(resolveBooleanAction(action, slice.rnnEnabled));
    },
  }),

  defineControl<BooleanControlAction<"radio.mox">>({
    target: "radio.mox",
    label: "Radio MOX",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setMox(resolveBooleanAction(action, radioController.mox));
    },
  }),

  defineControl<CommandAction<"radio.atu.startTune">>({
    target: "radio.atu.startTune",
    label: "Radio ATU Start Tune",
    scope: "radio",
    ops: [],
    editor: { kind: "command" },
    execute(ctx) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.startAtuTune();
    },
  }),

  defineControl<NormalizedControlAction<"radio.rfPower">>({
    target: "radio.rfPower",
    label: "Radio RF Power",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const value =
        action.op === "adjust"
          ? radioController.rfPower + action.delta
          : fromNormalized(action.value, 100);

      radioController.setRfPower(value);
    },
  }),

  defineControl<NormalizedControlAction<"radio.tunePower">>({
    target: "radio.tunePower",
    label: "Radio Tune Power",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const value =
        action.op === "adjust"
          ? radioController.tunePower + action.delta
          : fromNormalized(action.value, 100);

      radioController.setTunePower(value);
    },
  }),

  defineControl<BooleanControlAction<"radio.txTune">>({
    target: "radio.txTune",
    label: "Radio TX Tune",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setTxTune(
        resolveBooleanAction(action, radioController.txTune),
      );
    },
  }),

  defineControl<NormalizedControlAction<"radio.cw.speed">>({
    target: "radio.cw.speed",
    label: "Radio CW Speed",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const currentSpeed = radioController.cwSpeedWpm ?? 5;
      const value =
        action.op === "adjust"
          ? currentSpeed + action.delta
          : fromNormalized(action.value, 100, 5);

      radioController.setCwSpeedWpm(value);
    },
  }),
] as const;

type ControlDefinitionUnion = (typeof CONTROL_DEFINITIONS)[number];
type ActionFromDefinition<TDefinition> =
  TDefinition extends ControlDefinition<infer TAction> ? TAction : never;

export type ControlAction = ActionFromDefinition<ControlDefinitionUnion>;
export type ControlTarget = ControlAction["target"];

type ControlRegistry = {
  [TTarget in ControlTarget]: Extract<
    ControlDefinitionUnion,
    { target: TTarget }
  >;
};

export const CONTROL_REGISTRY = Object.fromEntries(
  CONTROL_DEFINITIONS.map((definition) => [definition.target, definition]),
) as ControlRegistry;

const ControlsContext = createContext<{
  dispatch: (action: ControlAction) => void;
}>();

export function useControls() {
  const ctx = useContext(ControlsContext);
  if (!ctx)
    throw new Error("useControls must be used within <ControlsProvider>");
  return ctx;
}

export const ControlsProvider: ParentComponent = (props) => {
  const { radio, state } = useFlexRadio();
  const { runtime, setRuntime } = useRuntime();

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
    const slice = activeSlice();
    if (!slice) return undefined;
    return radio()?.panadapter(slice.panadapterStreamId);
  });

  const getSlice = (selector?: SliceSelector) => {
    if (!selector) return activeSlice();

    const id = sliceIdsBySelector().get(selector);
    if (!id) return undefined;
    return radio()?.slice(id);
  };

  const getPan = (selector?: SliceSelector) => {
    if (!selector) return activePan();

    const slice = getSlice(selector);
    if (!slice) return undefined;
    return radio()?.panadapter(slice.panadapterStreamId);
  };

  const getBandList = createMemo(() => [
    ...BANDS.map((band) => band.id),
    ...Object.keys(state.status.xvtr),
  ]);

  const controlRuntime: ControlRuntime = {
    radio,
    state,
    runtime,
    setRuntime,
    activeSlice,
    activePan,
    getSlice,
    getPan,
    getBandList,
    getSelectableSlices,
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
    <ControlsContext.Provider value={{ dispatch }}>
      {props.children}
      <MidiControl />
    </ControlsContext.Provider>
  );
};
