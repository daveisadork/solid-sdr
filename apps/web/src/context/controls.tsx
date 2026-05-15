import {
  Accessor,
  batch,
  createContext,
  createMemo,
  ParentComponent,
  Show,
  useContext,
} from "solid-js";
import { produce } from "solid-js/store";
import { MidiControl } from "~/components/midi-control";
import useFlexRadio from "./flexradio";
import { useRuntime } from "./runtime";
import { usePreferences } from "./preferences";

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

type ScaleAction<T extends string, Extra extends object = Empty> = Extra & {
  target: T;
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
type WaterfallController = NonNullable<
  ReturnType<RadioController["waterfall"]>
>;

type ControlScope = "slice" | "panadapter" | "radio";
export type ControlOp = "toggle" | "set" | "adjust" | "cycle";
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
  getWaterfall: (selector?: SliceSelector) => WaterfallController | undefined;
  getBandList: () => readonly string[];
  getSelectableSlices: () => readonly SliceSelector[];
  preferences: ReturnType<typeof usePreferences>["preferences"];
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
  | { kind: "scaled-number" };

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

const SPEECH_PROCESSOR_LEVELS = ["Norm", "DX", "DX+"] as const;

function isCwTransmitMode(mode?: string) {
  return mode === "CW";
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
          ? cycleListValue(
              slice.tuneStepListHz,
              // the current value may not match one of the presets, so find the closest one in the direction of the cycle
              action.delta > 0
                ? (slice.tuneStepListHz.findLast(
                    (step) => step <= slice.tuneStepHz,
                  ) ?? slice.tuneStepListHz.at(0))
                : (slice.tuneStepListHz.find(
                    (step) => step >= slice.tuneStepHz,
                  ) ?? slice.tuneStepListHz.at(-1)),
              action.delta,
            )
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

  defineControl<CommandAction<"slice.cw.autoTune", SliceTargeted>>({
    target: "slice.cw.autoTune",
    label: "Slice CW Auto Tune",
    scope: "slice",
    ops: [],
    editor: { kind: "command" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.cwAutoTune();
    },
  }),

  defineControl<NormalizedControlAction<"slice.filter.width", SliceTargeted>>({
    target: "slice.filter.width",
    label: "Slice Filter Width",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      switch (slice.mode) {
        case "DIGU":
        case "USB": {
          const value =
            action.op === "adjust"
              ? slice.filterHighHz + action.delta
              : Math.round(100 * action.value) * 100;
          return slice.setFilterHigh(Math.max(slice.filterLowHz, value));
        }
        case "DIGL":
        case "LSB": {
          const value =
            action.op === "adjust"
              ? slice.filterLowHz - action.delta
              : Math.round(-100 * action.value) * 100;
          return slice.setFilterLow(Math.min(slice.filterHighHz, value));
        }
        case "CW":
        case "RTTY": {
          const value =
            action.op === "adjust"
              ? slice.filterHighHz + action.delta
              : Math.round(100 * action.value) * 5;
          return slice.setFilter(-value, value);
        }
        case "FM":
        case "NFM":
          return;
        default: {
          const value =
            action.op === "adjust"
              ? slice.filterHighHz + action.delta
              : Math.round(100 * action.value) * 100;
          return slice.setFilter(-value, value);
        }
      }
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

  defineControl<ScaleAction<"panadapter.bandwidth", SliceTargeted>>({
    target: "panadapter.bandwidth",
    label: "Panadapter Bandwidth",
    scope: "panadapter",
    ops: [],
    editor: { kind: "scaled-number" },
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

  defineControl<
    ChoiceControlAction<"panadapter.rxAntenna", string, SliceTargeted>
  >({
    target: "panadapter.rxAntenna",
    label: "Panadapter RX Antenna",
    scope: "panadapter",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx, action) {
        return ctx.getPan(action?.slice)?.rxAntennas ?? [];
      },
    },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      const antennas = pan.rxAntennas;
      if (antennas.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(antennas, pan.rxAntenna, action.delta)
          : action.value;

      if (!value) return;
      pan.setRxAntenna(value);
    },
  }),

  defineControl<NormalizedControlAction<"panadapter.rfGain", SliceTargeted>>({
    target: "panadapter.rfGain",
    label: "Panadapter RF Gain",
    scope: "panadapter",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      const value =
        action.op === "adjust"
          ? pan.rfGain + action.delta
          : fromNormalized(action.value, pan.rfGainHigh, pan.rfGainLow);

      pan.setRfGain(value);
    },
  }),

  defineControl<BooleanControlAction<"panadapter.wnb.enabled", SliceTargeted>>({
    target: "panadapter.wnb.enabled",
    label: "Panadapter WNB Enabled",
    scope: "panadapter",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;
      pan.setWnbEnabled(resolveBooleanAction(action, pan.wnbEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"panadapter.wnb.level", SliceTargeted>>(
    {
      target: "panadapter.wnb.level",
      label: "Panadapter WNB Level",
      scope: "panadapter",
      ops: ["adjust", "set"],
      editor: { kind: "normalized" },
      execute(ctx, action) {
        const pan = ctx.getPan(action.slice);
        if (!pan) return;

        const value =
          action.op === "adjust"
            ? pan.wnbLevel + action.delta
            : fromNormalized(action.value, 100);

        pan.setWnbLevel(value);
      },
    },
  ),

  defineControl<
    BooleanControlAction<"panadapter.weightedAverage", SliceTargeted>
  >({
    target: "panadapter.weightedAverage",
    label: "Panadapter Weighted Average",
    scope: "panadapter",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;
      pan.setWeightedAverage(resolveBooleanAction(action, pan.weightedAverage));
    },
  }),

  defineControl<
    BooleanControlAction<"panadapter.noiseFloor.enabled", SliceTargeted>
  >({
    target: "panadapter.noiseFloor.enabled",
    label: "Panadapter Noise Floor Enabled",
    scope: "panadapter",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;
      pan.setNoiseFloorPositionEnabled(
        resolveBooleanAction(action, pan.noiseFloorPositionEnabled),
      );
    },
  }),

  defineControl<
    NormalizedControlAction<"panadapter.noiseFloor", SliceTargeted>
  >({
    target: "panadapter.noiseFloor",
    label: "Panadapter Noise Floor",
    scope: "panadapter",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      const currentValue = 100 - pan.noiseFloorPosition;
      const nextValue =
        action.op === "adjust"
          ? currentValue + action.delta
          : fromNormalized(action.value, 100);

      pan.setNoiseFloorPosition(100 - nextValue);
    },
  }),

  defineControl<NormalizedControlAction<"panadapter.average", SliceTargeted>>({
    target: "panadapter.average",
    label: "Panadapter Average",
    scope: "panadapter",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      const value =
        action.op === "adjust"
          ? pan.average + action.delta
          : fromNormalized(action.value, 100);

      pan.setAverage(value);
    },
  }),

  defineControl<NormalizedControlAction<"panadapter.fps", SliceTargeted>>({
    target: "panadapter.fps",
    label: "Panadapter FPS",
    scope: "panadapter",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      const value =
        action.op === "adjust"
          ? pan.fps + action.delta
          : fromNormalized(action.value, 60, 1);

      pan.setFps(value);
    },
  }),

  defineControl<NormalizedControlAction<"waterfall.lineSpeed", SliceTargeted>>({
    target: "waterfall.lineSpeed",
    label: "Waterfall Line Speed",
    scope: "panadapter",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const waterfall = ctx.getWaterfall(action.slice);
      if (!waterfall) return;

      const value =
        action.op === "adjust"
          ? (waterfall.lineSpeed ?? 0) + action.delta
          : fromNormalized(action.value, 100);

      waterfall.setLineSpeed(value);
    },
  }),

  defineControl<NormalizedControlAction<"waterfall.colorGain", SliceTargeted>>({
    target: "waterfall.colorGain",
    label: "Waterfall Color Gain",
    scope: "panadapter",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const waterfall = ctx.getWaterfall(action.slice);
      if (!waterfall) return;

      const value =
        action.op === "adjust"
          ? waterfall.colorGain + action.delta
          : fromNormalized(action.value, 100);

      waterfall.setColorGain(value);
    },
  }),

  defineControl<
    BooleanControlAction<"waterfall.autoBlackLevel", SliceTargeted>
  >({
    target: "waterfall.autoBlackLevel",
    label: "Waterfall Auto Black Level",
    scope: "panadapter",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const waterfall = ctx.getWaterfall(action.slice);
      if (!waterfall) return;
      waterfall.setAutoBlackLevelEnabled(
        resolveBooleanAction(action, waterfall.autoBlackLevelEnabled),
      );
    },
  }),

  defineControl<NormalizedControlAction<"waterfall.blackLevel", SliceTargeted>>(
    {
      target: "waterfall.blackLevel",
      label: "Waterfall Black Level",
      scope: "panadapter",
      ops: ["adjust", "set"],
      editor: { kind: "normalized" },
      execute(ctx, action) {
        const waterfall = ctx.getWaterfall(action.slice);
        if (!waterfall) return;

        const value =
          action.op === "adjust"
            ? waterfall.blackLevel + action.delta
            : fromNormalized(action.value, 100);

        waterfall.setBlackLevel(value);
      },
    },
  ),

  defineControl<
    ChoiceControlAction<"waterfall.gradient", number, SliceTargeted>
  >({
    target: "waterfall.gradient",
    label: "Waterfall Gradient",
    scope: "panadapter",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.preferences.palette.gradients.map((_, index) => index);
      },
    },
    execute(ctx, action) {
      const waterfall = ctx.getWaterfall(action.slice);
      if (!waterfall) return;

      const gradients = ctx.preferences.palette.gradients.map(
        (_, index) => index,
      );
      if (gradients.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(gradients, waterfall.gradientIndex, action.delta)
          : action.value;

      if (value === undefined) return;
      waterfall.setGradientIndex(value);
    },
  }),

  defineControl<NormalizedControlAction<"slice.agc.threshold", SliceTargeted>>({
    target: "slice.agc.threshold",
    label: "Slice AGC Threshold",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.agcThreshold + action.delta
          : fromNormalized(action.value, 100);

      slice.setAgcSettings({ threshold: value });
    },
  }),

  defineControl<BooleanControlAction<"slice.wnb.enabled", SliceTargeted>>({
    target: "slice.wnb.enabled",
    label: "Slice WNB Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setWnbEnabled(resolveBooleanAction(action, slice.wnbEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.wnb.level", SliceTargeted>>({
    target: "slice.wnb.level",
    label: "Slice WNB Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.wnbLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setWnbLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.nb.enabled", SliceTargeted>>({
    target: "slice.nb.enabled",
    label: "Slice NB Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setNbEnabled(resolveBooleanAction(action, slice.nbEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.nb.level", SliceTargeted>>({
    target: "slice.nb.level",
    label: "Slice NB Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.nbLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setNbLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.anf.enabled", SliceTargeted>>({
    target: "slice.anf.enabled",
    label: "Slice ANF Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setAnfEnabled(resolveBooleanAction(action, slice.anfEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.anf.level", SliceTargeted>>({
    target: "slice.anf.level",
    label: "Slice ANF Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.anfLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setAnfLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.apf.enabled", SliceTargeted>>({
    target: "slice.apf.enabled",
    label: "Slice APF Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setApfEnabled(resolveBooleanAction(action, slice.apfEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.apf.level", SliceTargeted>>({
    target: "slice.apf.level",
    label: "Slice APF Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.apfLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setApfLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.nrl.enabled", SliceTargeted>>({
    target: "slice.nrl.enabled",
    label: "Slice NRL Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setNrlEnabled(resolveBooleanAction(action, slice.nrlEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.nrl.level", SliceTargeted>>({
    target: "slice.nrl.level",
    label: "Slice NRL Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.nrlLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setNrlLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.anfl.enabled", SliceTargeted>>({
    target: "slice.anfl.enabled",
    label: "Slice ANFL Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setAnflEnabled(resolveBooleanAction(action, slice.anflEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.anfl.level", SliceTargeted>>({
    target: "slice.anfl.level",
    label: "Slice ANFL Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.anflLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setAnflLevel(value);
    },
  }),

  defineControl<NormalizedControlAction<"slice.nrs.level", SliceTargeted>>({
    target: "slice.nrs.level",
    label: "Slice NRS Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.nrsLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setNrsLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"slice.anft.enabled", SliceTargeted>>({
    target: "slice.anft.enabled",
    label: "Slice ANFT Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setAnftEnabled(resolveBooleanAction(action, slice.anftEnabled));
    },
  }),

  defineControl<BooleanControlAction<"slice.nrf.enabled", SliceTargeted>>({
    target: "slice.nrf.enabled",
    label: "Slice NRF Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;
      slice.setNrfEnabled(resolveBooleanAction(action, slice.nrfEnabled));
    },
  }),

  defineControl<NormalizedControlAction<"slice.nrf.level", SliceTargeted>>({
    target: "slice.nrf.level",
    label: "Slice NRF Level",
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? slice.nrfLevel + action.delta
          : fromNormalized(action.value, 100);

      slice.setNrfLevel(value);
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

  defineControl<ChoiceControlAction<"radio.profile.tx", string>>({
    target: "radio.profile.tx",
    label: "Radio TX Profile",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.state.status.radio.profileTxList;
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const profiles = ctx.state.status.radio.profileTxList;
      if (profiles.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              profiles,
              ctx.state.status.radio.profileTxSelection ?? profiles[0],
              action.delta,
            )
          : action.value;

      if (!value) return;
      radioController.loadTxProfile(value);
    },
  }),

  defineControl<ChoiceControlAction<"radio.profile.mic", string>>({
    target: "radio.profile.mic",
    label: "Radio Mic Profile",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.state.status.radio.profileMicList;
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const profiles = ctx.state.status.radio.profileMicList;
      if (profiles.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              profiles,
              ctx.state.status.radio.profileMicSelection ?? profiles[0],
              action.delta,
            )
          : action.value;

      if (!value) return;
      radioController.loadMicProfile(value);
    },
  }),

  defineControl<ChoiceControlAction<"radio.profile.display", string>>({
    target: "radio.profile.display",
    label: "Radio Display Profile",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.state.status.radio.profileDisplayList;
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const profiles = ctx.state.status.radio.profileDisplayList;
      if (profiles.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              profiles,
              ctx.state.status.radio.profileDisplaySelection ?? profiles[0],
              action.delta,
            )
          : action.value;

      if (!value) return;
      radioController.loadDisplayProfile(value);
    },
  }),

  defineControl<ChoiceControlAction<"radio.profile.global", string>>({
    target: "radio.profile.global",
    label: "Radio Global Profile",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.state.status.radio.profileGlobalList;
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const profiles = ctx.state.status.radio.profileGlobalList;
      if (profiles.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              profiles,
              ctx.state.status.radio.profileGlobalSelection ?? profiles[0],
              action.delta,
            )
          : action.value;

      if (!value) return;
      radioController.loadGlobalProfile(value);
    },
  }),

  defineControl<ChoiceControlAction<"radio.mic.input", string>>({
    target: "radio.mic.input",
    label: "Radio Mic Input",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.state.status.radio.micInputList;
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const inputs = ctx.state.status.radio.micInputList;
      if (inputs.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              inputs,
              radioController.micSelection ?? inputs[0],
              action.delta,
            )
          : action.value;

      if (!value) return;
      radioController.setMicSelection(value);
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

  defineControl<BooleanControlAction<"radio.mic.accessory">>({
    target: "radio.mic.accessory",
    label: "Radio Mic Accessory",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setMicAccessoryEnabled(
        resolveBooleanAction(action, radioController.micAccessoryEnabled),
      );
    },
  }),

  defineControl<BooleanControlAction<"radio.dax">>({
    target: "radio.dax",
    label: "Radio DAX",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setDaxEnabled(
        resolveBooleanAction(action, radioController.daxEnabled),
      );
    },
  }),

  defineControl<NormalizedControlAction<"radio.mic.level">>({
    target: "radio.mic.level",
    label: "Radio Mic Level",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const value =
        action.op === "adjust"
          ? (radioController.micLevel ?? 0) + action.delta
          : fromNormalized(action.value, 100);

      radioController.setMicLevel(value);
    },
  }),

  defineControl<BooleanControlAction<"radio.mic.bias">>({
    target: "radio.mic.bias",
    label: "Radio Mic Bias",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setMicBias(
        resolveBooleanAction(action, radioController.micBias),
      );
    },
  }),

  defineControl<BooleanControlAction<"radio.mic.boost">>({
    target: "radio.mic.boost",
    label: "Radio Mic Boost",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setMicBoost(
        resolveBooleanAction(action, radioController.micBoost),
      );
    },
  }),

  defineControl<BooleanControlAction<"radio.meterInRx">>({
    target: "radio.meterInRx",
    label: "Radio Meter In RX",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setMeterInRxEnabled(
        resolveBooleanAction(action, radioController.meterInRx),
      );
    },
  }),

  defineControl<BooleanControlAction<"radio.speechProcessor.enabled">>({
    target: "radio.speechProcessor.enabled",
    label: "Radio Speech Processor Enabled",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setSpeechProcessorEnabled(
        resolveBooleanAction(action, radioController.speechProcessorEnabled),
      );
    },
  }),

  defineControl<ChoiceControlAction<"radio.speechProcessor.level", string>>({
    target: "radio.speechProcessor.level",
    label: "Radio Speech Processor Level",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices() {
        return SPEECH_PROCESSOR_LEVELS;
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const current =
        SPEECH_PROCESSOR_LEVELS[radioController.speechProcessorLevel ?? 0] ??
        SPEECH_PROCESSOR_LEVELS[0];
      const value =
        action.op === "cycle"
          ? cycleListValue(SPEECH_PROCESSOR_LEVELS, current, action.delta)
          : action.value;

      if (!value) return;
      radioController.setSpeechProcessorLevel(
        SPEECH_PROCESSOR_LEVELS.indexOf(
          value as (typeof SPEECH_PROCESSOR_LEVELS)[number],
        ),
      );
    },
  }),

  defineControl<BooleanControlAction<"radio.txMonitor.enabled">>({
    target: "radio.txMonitor.enabled",
    label: "Radio TX Monitor Enabled",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setTxMonitorEnabled(
        resolveBooleanAction(action, radioController.txMonitorEnabled),
      );
    },
  }),

  defineControl<NormalizedControlAction<"radio.txMonitor.level">>({
    target: "radio.txMonitor.level",
    label: "Radio TX Monitor Level",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const isCw = isCwTransmitMode(radioController.txMode);
      const currentLevel = isCw
        ? (radioController.txCwMonitorGain ?? 0)
        : (radioController.txSbMonitorGain ?? 0);
      const value =
        action.op === "adjust"
          ? currentLevel + action.delta
          : fromNormalized(action.value, 100);

      if (isCw) {
        radioController.setTxCwMonitorGain(value);
        return;
      }

      radioController.setTxSbMonitorGain(value);
    },
  }),

  defineControl<BooleanControlAction<"radio.vox.enabled">>({
    target: "radio.vox.enabled",
    label: "Radio VOX Enabled",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setVoxEnabled(
        resolveBooleanAction(action, radioController.voxEnabled),
      );
    },
  }),

  defineControl<NormalizedControlAction<"radio.vox.level">>({
    target: "radio.vox.level",
    label: "Radio VOX Level",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const value =
        action.op === "adjust"
          ? (radioController.voxLevel ?? 0) + action.delta
          : fromNormalized(action.value, 100);

      radioController.setVoxLevel(value);
    },
  }),

  defineControl<NormalizedControlAction<"radio.vox.delay">>({
    target: "radio.vox.delay",
    label: "Radio VOX Delay",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const value =
        action.op === "adjust"
          ? (radioController.voxDelay ?? 0) + action.delta
          : fromNormalized(action.value, 100);

      radioController.setVoxDelay(value);
    },
  }),

  defineControl<BooleanControlAction<"radio.compander.enabled">>({
    target: "radio.compander.enabled",
    label: "Radio Compander Enabled",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setCompanderEnabled(
        resolveBooleanAction(action, radioController.companderEnabled),
      );
    },
  }),

  defineControl<NormalizedControlAction<"radio.compander.level">>({
    target: "radio.compander.level",
    label: "Radio Compander Level",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const value =
        action.op === "adjust"
          ? (radioController.companderLevel ?? 0) + action.delta
          : fromNormalized(action.value, 100);

      radioController.setCompanderLevel(value);
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
  getChoices: (
    target: ControlTarget,
    slice?: SliceSelector,
  ) => readonly ChoiceValue[];
}>();

export function useControls() {
  const ctx = useContext(ControlsContext);
  if (!ctx)
    throw new Error("useControls must be used within <ControlsProvider>");
  return ctx;
}

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
    if (definition.editor.kind !== "choice") return [];

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
