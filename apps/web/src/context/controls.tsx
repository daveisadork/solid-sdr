import { type Accessor, batch, createContext, useContext } from "solid-js";
import { produce } from "solid-js/store";
import type useFlexRadio from "./flexradio";
import type { usePreferences } from "./preferences";
import type { useRuntime } from "./runtime";

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
export type ChoiceValue = string | number;

export type ControlRuntime = {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const SPEECH_PROCESSOR_LEVELS = ["Norm", "DX", "DX+"] as const;
const AGC_THRESHOLD_MODES = ["auto", "manual"] as const;
const DSP_ADAPT_MODES = ["auto", "fast", "slow"] as const;
// The radio also accepts "zero", which FlexLib documents as not recommended
// and SmartSDR leaves out of its selector.
const DSP_ISDFT_MODES = ["one", "half"] as const;
const DSP_SHORT_WINDOW_LENGTHS = [32, 64, 128, 256, 512] as const;
const DSP_LONG_WINDOW_LENGTHS = [512, 1024, 2048, 4096, 8192] as const;
const AUTO_DX_TRIGGERS = ["either", "call_up", "up"] as const;

function isCwTransmitMode(mode?: string) {
  return mode === "CW";
}

/**
 * One control per macro slot rather than a single parameterised target: firing
 * a macro is a command, and the choice editor's ops (`set`/`cycle`) have no
 * sensible reading for "which macro to send".
 *
 * Macros are numbered 1–12 on the wire and in the official UI while our
 * controller takes them 0-based, so the offset lives here and the target keeps
 * the number an operator would recognise.
 */
function defineCwxMacroControl<TNumber extends number>(macroNumber: TNumber) {
  return defineControl<CommandAction<`cwx.macro.${TNumber}`>>({
    target: `cwx.macro.${macroNumber}`,
    label: `CWX Macro ${macroNumber}`,
    scope: "radio",
    ops: [],
    editor: { kind: "command" },
    execute(ctx) {
      ctx
        .radio()
        ?.cwx()
        ?.sendMacro(macroNumber - 1)
        .catch((error) => console.error("CWX macro send failed", error));
    },
  });
}

/**
 * One control per DVK slot position, mirroring the CWX macro controls. Targets
 * address the Nth recording in display order (sorted by id) rather than the
 * radio's slot id — slot ids are monotonic and never reused, so a mapping
 * bound to a raw id would go stale the first time a slot is removed.
 *
 * Playback keys the transmitter. The radio enforces its own interlock, but the
 * control still refuses when TX is not allowed so a stray MIDI press can't
 * queue up a transmission the panel's own button would have refused.
 */
function defineDvkPlaybackControl<TNumber extends number>(position: TNumber) {
  return defineControl<CommandAction<`dvk.playback.${TNumber}`>>({
    target: `dvk.playback.${position}`,
    label: `DVK Playback ${position}`,
    scope: "radio",
    ops: [],
    editor: { kind: "command" },
    execute(ctx) {
      const dvk = ctx.state.status.dvk;
      if (dvk.enabled === false) return;
      if (ctx.state.status.radio.txAllowed !== true) return;
      const recording = [...(dvk.recordings ?? [])].sort(
        (a, b) => Number(a.id) - Number(b.id),
      )[position - 1];
      if (!recording || recording.durationMs === 0) return;
      ctx
        .radio()
        ?.dvk()
        .startPlayback(recording.id)
        .catch((error) => console.error("DVK playback start failed", error));
    },
  });
}

/**
 * A slice setting with a fixed integer range. `set` spans the whole range and
 * snaps to `step`. `adjust` moves by the mapped amount and does not snap,
 * because snapping would swallow an amount smaller than the step.
 */
function defineSliceNumberControl<T extends string>(spec: {
  target: T;
  label: string;
  min: number;
  max: number;
  step?: number;
  read: (slice: SliceController) => number | undefined;
  write: (slice: SliceController, value: number) => Promise<void>;
}) {
  const step = spec.step ?? 1;
  return defineControl<NormalizedControlAction<T, SliceTargeted>>({
    target: spec.target,
    label: spec.label,
    scope: "slice",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "adjust"
          ? Math.round((spec.read(slice) ?? spec.min) + action.delta)
          : Math.round(
              (spec.min + action.value * (spec.max - spec.min)) / step,
            ) * step;

      spec
        .write(slice, clamp(value, spec.min, spec.max))
        .catch((error) => console.error(`${spec.label} set failed`, error));
    },
  });
}

function defineSliceChoiceControl<
  T extends string,
  V extends ChoiceValue,
>(spec: {
  target: T;
  label: string;
  choices: readonly V[];
  read: (slice: SliceController) => V | undefined;
  write: (slice: SliceController, value: V) => Promise<void>;
}) {
  return defineControl<ChoiceControlAction<T, V, SliceTargeted>>({
    target: spec.target,
    label: spec.label,
    scope: "slice",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices() {
        return spec.choices;
      },
    },
    execute(ctx, action) {
      const slice = ctx.getSlice(action.slice);
      if (!slice) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              spec.choices,
              spec.read(slice) ?? spec.choices[0],
              action.delta,
            )
          : action.value;

      if (value === undefined || !spec.choices.includes(value)) return;
      spec
        .write(slice, value)
        .catch((error) => console.error(`${spec.label} set failed`, error));
    },
  });
}

/** One command per algorithm, matching the per-algorithm Reset buttons. */
function defineSliceDspResetControl<T extends string>(
  target: T,
  label: string,
  algorithm: Parameters<SliceController["resetDspParameters"]>[0],
) {
  return defineControl<CommandAction<T, SliceTargeted>>({
    target,
    label,
    scope: "slice",
    ops: [],
    editor: { kind: "command" },
    execute(ctx, action) {
      ctx
        .getSlice(action.slice)
        ?.resetDspParameters(algorithm)
        .catch((error) => console.error(`${label} failed`, error));
    },
  });
}

/**
 * AutoDX timings report 0 when the radio picks the value. Adjusting from that
 * state starts at the bottom of the range instead of at 0.
 */
function autoDxTiming(value: number) {
  return value > 0 ? value : undefined;
}

function sortedPresets(ctx: ControlRuntime) {
  return Object.values(ctx.state.status.preset).sort(
    (a, b) => Number(a.id) - Number(b.id),
  );
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

  defineControl<
    NormalizedControlAction<"panadapter.noiseFloorRange", SliceTargeted>
  >({
    target: "panadapter.noiseFloorRange",
    label: "Panadapter Noise Floor Range",
    scope: "panadapter",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const pan = ctx.getPan(action.slice);
      if (!pan) return;

      // 0 to 10 dB in 0.5 dB steps, as on the SmartSDR slider.
      const value =
        action.op === "adjust"
          ? (pan.noiseFloorRange ?? 0) + action.delta
          : Math.round(action.value * 20) / 2;

      pan
        .setNoiseFloorRange(clamp(value, 0, 10))
        .catch((error) =>
          console.error("Panadapter noise floor range set failed", error),
        );
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

  defineSliceChoiceControl({
    target: "slice.agc.thresholdMode",
    label: "Slice AGC Threshold Mode",
    choices: AGC_THRESHOLD_MODES,
    read: (slice) => slice.agcThresholdMode,
    write: (slice, mode) => slice.setAgcThresholdMode(mode),
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
          : fromNormalized(action.value, 50);

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

  defineSliceNumberControl({
    target: "slice.nr.delay",
    label: "Slice NR Delay",
    min: 1,
    max: 512,
    read: (slice) => slice.nrDelay,
    write: (slice, value) => slice.setNrDelay(value),
  }),

  defineSliceChoiceControl({
    target: "slice.nr.window",
    label: "Slice NR Window",
    choices: DSP_SHORT_WINDOW_LENGTHS,
    read: (slice) =>
      slice.nrWlen as (typeof DSP_SHORT_WINDOW_LENGTHS)[number] | undefined,
    write: (slice, value) => slice.setNrWlen(value),
  }),

  defineSliceChoiceControl({
    target: "slice.nr.adaptMode",
    label: "Slice NR Adapt Mode",
    choices: DSP_ADAPT_MODES,
    read: (slice) => slice.nrAdaptMode,
    write: (slice, mode) => slice.setNrAdaptMode(mode),
  }),

  defineSliceChoiceControl({
    target: "slice.nr.inverse",
    label: "Slice NR Inverse",
    choices: DSP_ISDFT_MODES,
    read: (slice) =>
      slice.nrIsdftMode as (typeof DSP_ISDFT_MODES)[number] | undefined,
    write: (slice, mode) => slice.setNrIsdftMode(mode),
  }),

  defineSliceDspResetControl("slice.nr.reset", "Slice NR Reset", "nr"),

  defineSliceNumberControl({
    target: "slice.nrl.delay",
    label: "Slice NRL Delay",
    min: 1,
    max: 512,
    read: (slice) => slice.nrlDelay,
    write: (slice, value) => slice.setNrlDelay(value),
  }),

  defineSliceNumberControl({
    target: "slice.nrl.taps",
    label: "Slice NRL Taps",
    min: 1,
    max: 512,
    read: (slice) => slice.nrlFilterSize,
    write: (slice, value) => slice.setNrlFilterSize(value),
  }),

  defineSliceNumberControl({
    target: "slice.nrl.leakage",
    label: "Slice NRL Leakage",
    min: 0,
    max: 100,
    read: (slice) => slice.nrlLeakageLevel,
    write: (slice, value) => slice.setNrlLeakageLevel(value),
  }),

  defineSliceDspResetControl("slice.nrl.reset", "Slice NRL Reset", "lms_nr"),

  defineSliceChoiceControl({
    target: "slice.nrf.window",
    label: "Slice NRF Window",
    choices: DSP_LONG_WINDOW_LENGTHS,
    read: (slice) =>
      slice.nrfWlen as (typeof DSP_LONG_WINDOW_LENGTHS)[number] | undefined,
    write: (slice, value) => slice.setNrfWlen(value),
  }),

  defineSliceDspResetControl("slice.nrf.reset", "Slice NRF Reset", "nrf"),

  defineSliceDspResetControl("slice.nrs.reset", "Slice NRS Reset", "speex_nr"),

  defineSliceNumberControl({
    target: "slice.anf.delay",
    label: "Slice ANF Delay",
    min: 1,
    max: 512,
    read: (slice) => slice.anfDelay,
    write: (slice, value) => slice.setAnfDelay(value),
  }),

  defineSliceChoiceControl({
    target: "slice.anf.window",
    label: "Slice ANF Window",
    choices: DSP_SHORT_WINDOW_LENGTHS,
    read: (slice) =>
      slice.anfWlen as (typeof DSP_SHORT_WINDOW_LENGTHS)[number] | undefined,
    write: (slice, value) => slice.setAnfWlen(value),
  }),

  defineSliceChoiceControl({
    target: "slice.anf.adaptMode",
    label: "Slice ANF Adapt Mode",
    choices: DSP_ADAPT_MODES,
    read: (slice) => slice.anfAdaptMode,
    write: (slice, mode) => slice.setAnfAdaptMode(mode),
  }),

  defineSliceChoiceControl({
    target: "slice.anf.inverse",
    label: "Slice ANF Inverse",
    choices: DSP_ISDFT_MODES,
    read: (slice) =>
      slice.anfIsdftMode as (typeof DSP_ISDFT_MODES)[number] | undefined,
    write: (slice, mode) => slice.setAnfIsdftMode(mode),
  }),

  defineSliceDspResetControl("slice.anf.reset", "Slice ANF Reset", "anf"),

  defineSliceNumberControl({
    target: "slice.anfl.delay",
    label: "Slice ANFL Delay",
    min: 1,
    max: 512,
    read: (slice) => slice.anflDelay,
    write: (slice, value) => slice.setAnflDelay(value),
  }),

  defineSliceNumberControl({
    target: "slice.anfl.taps",
    label: "Slice ANFL Taps",
    min: 1,
    max: 512,
    read: (slice) => slice.anflFilterSize,
    write: (slice, value) => slice.setAnflFilterSize(value),
  }),

  defineSliceNumberControl({
    target: "slice.anfl.leakage",
    label: "Slice ANFL Leakage",
    min: 0,
    max: 100,
    read: (slice) => slice.anflLeakageLevel,
    write: (slice, value) => slice.setAnflLeakageLevel(value),
  }),

  defineSliceDspResetControl("slice.anfl.reset", "Slice ANFL Reset", "lms_anf"),

  // FlexLib does not clamp these. The ranges are the SmartSDR slider bounds.
  defineSliceNumberControl({
    target: "slice.anft.toneMin",
    label: "Slice ANFT Tone Min",
    min: -150,
    max: -50,
    read: (slice) => slice.anftMinDb,
    write: (slice, value) => slice.setAnftMinDb(value),
  }),

  defineSliceNumberControl({
    target: "slice.anft.toneDiff",
    label: "Slice ANFT Tone Diff",
    min: 1,
    max: 60,
    read: (slice) => slice.anftToneDbDiff,
    write: (slice, value) => slice.setAnftToneDbDiff(value),
  }),

  defineSliceDspResetControl("slice.anft.reset", "Slice ANFT Reset", "anft"),

  defineSliceDspResetControl("slice.dsp.reset", "Slice DSP Reset All", "all"),

  defineControl<BooleanControlAction<"slice.autoDx.enabled", SliceTargeted>>({
    target: "slice.autoDx.enabled",
    label: "Slice AutoDX Enabled",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const autoDx = ctx.getSlice(action.slice)?.autoDx;
      if (!autoDx) return;

      const enable = resolveBooleanAction(action, autoDx.enabled);
      // Armed AutoDX keys the transmitter on its own. Refuse to arm when TX is
      // not allowed, so that a stray press cannot queue a transmission.
      // Disarming is always allowed.
      if (enable && ctx.state.status.radio.txAllowed !== true) return;

      autoDx
        .setEnabled(enable)
        .catch((error) => console.error("AutoDX enable failed", error));
    },
  }),

  defineSliceChoiceControl({
    target: "slice.autoDx.trigger",
    label: "Slice AutoDX Trigger",
    choices: AUTO_DX_TRIGGERS,
    read: (slice) =>
      slice.autoDx.trigger === "unknown" ? undefined : slice.autoDx.trigger,
    write: (slice, trigger) => slice.autoDx.setTrigger(trigger),
  }),

  // Timing ranges and steps follow the SmartSDR AutoDX setup sliders.
  defineSliceNumberControl({
    target: "slice.autoDx.txDelay",
    label: "Slice AutoDX TX Delay",
    min: 100,
    max: 2000,
    step: 100,
    read: (slice) => autoDxTiming(slice.autoDx.txDelayMs),
    write: (slice, ms) => slice.autoDx.setTxDelayMs(ms),
  }),

  defineSliceNumberControl({
    target: "slice.autoDx.awaitReply",
    label: "Slice AutoDX Await Reply",
    min: 2000,
    max: 60000,
    step: 1000,
    read: (slice) => autoDxTiming(slice.autoDx.awaitReplyMs),
    write: (slice, ms) => slice.autoDx.setAwaitReplyMs(ms),
  }),

  defineSliceNumberControl({
    target: "slice.autoDx.timeout",
    label: "Slice AutoDX Timeout",
    min: 60000,
    max: 600000,
    step: 60000,
    read: (slice) => autoDxTiming(slice.autoDx.timeoutMs),
    write: (slice, ms) => slice.autoDx.setTimeoutMs(ms),
  }),

  defineControl<
    BooleanControlAction<"slice.autoDx.timeoutRestart", SliceTargeted>
  >({
    target: "slice.autoDx.timeoutRestart",
    label: "Slice AutoDX Timeout Restart",
    scope: "slice",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const autoDx = ctx.getSlice(action.slice)?.autoDx;
      if (!autoDx) return;
      autoDx
        .setTimeoutRestart(resolveBooleanAction(action, autoDx.timeoutRestart))
        .catch((error) =>
          console.error("AutoDX timeout restart set failed", error),
        );
    },
  }),

  defineSliceNumberControl({
    target: "slice.autoDx.callRetries",
    label: "Slice AutoDX Call Retries",
    min: 1,
    max: 10,
    read: (slice) => slice.autoDx.callRetries,
    write: (slice, retries) => slice.autoDx.setCallRetries(retries),
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
        return ctx.state.status.radio.profileDisplayList ?? [];
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const profiles = ctx.state.status.radio.profileDisplayList;
      if (!profiles || profiles.length === 0) return;

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

  defineControl<ChoiceControlAction<"radio.profile.cw", string>>({
    target: "radio.profile.cw",
    label: "Radio CW Profile",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return ctx.state.status.radio.profileCwList;
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const profiles = ctx.state.status.radio.profileCwList;
      if (profiles.length === 0) return;

      const value =
        action.op === "cycle"
          ? cycleListValue(
              profiles,
              ctx.state.status.radio.profileCwSelection ?? profiles[0],
              action.delta,
            )
          : action.value;

      if (!value) return;
      radioController
        .loadCwProfile(value)
        .catch((error) => console.error("CW profile load failed", error));
    },
  }),

  /**
   * Presets are chosen by name, because a name is what an operator binds to.
   * When two presets share a name, the lowest id wins.
   */
  defineControl<ChoiceControlAction<"radio.preset", string>>({
    target: "radio.preset",
    label: "Radio Preset",
    scope: "radio",
    ops: ["cycle", "set"],
    editor: {
      kind: "choice",
      getChoices(ctx) {
        return sortedPresets(ctx).map((preset) => preset.name);
      },
    },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;

      const presets = sortedPresets(ctx);
      if (presets.length === 0) return;
      const names = presets.map((preset) => preset.name);

      const value =
        action.op === "cycle"
          ? cycleListValue(
              names,
              presets.find((preset) => preset.active)?.name ?? names[0],
              action.delta,
            )
          : action.value;

      const preset = presets.find((candidate) => candidate.name === value);
      if (!preset) return;
      radioController
        .preset(preset.id)
        ?.select()
        .catch((error) => console.error("Preset apply failed", error));
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

  defineControl<BooleanControlAction<"radio.tnf.enabled">>({
    target: "radio.tnf.enabled",
    label: "Radio TNF Enabled",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController.setTnfEnabled(
        resolveBooleanAction(action, radioController.tnfEnabled),
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

  defineControl<BooleanControlAction<"radio.pttMicOverride">>({
    target: "radio.pttMicOverride",
    label: "Radio PTT Mic Override",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      const radioController = ctx.radio();
      if (!radioController) return;
      radioController
        .setPttMicOverride(
          resolveBooleanAction(action, radioController.pttMicOverride),
        )
        .catch((error) => console.error("PTT mic override set failed", error));
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

  defineControl<NormalizedControlAction<"cwx.speed">>({
    target: "cwx.speed",
    label: "CWX Speed",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const cwxController = ctx.radio()?.cwx();
      if (!cwxController) return;

      const value =
        action.op === "adjust"
          ? ctx.state.status.cwx.speed + action.delta
          : fromNormalized(action.value, 100, 5);

      cwxController
        .setSpeed(value)
        .catch((error) => console.error("CWX speed set failed", error));
    },
  }),

  defineControl<NormalizedControlAction<"cwx.delay">>({
    target: "cwx.delay",
    label: "CWX Break-In Delay",
    scope: "radio",
    ops: ["adjust", "set"],
    editor: { kind: "normalized" },
    execute(ctx, action) {
      const cwxController = ctx.radio()?.cwx();
      if (!cwxController) return;

      const value =
        action.op === "adjust"
          ? ctx.state.status.cwx.delay + action.delta
          : fromNormalized(action.value, 2000);

      // Under the cw delay's speed-derived floor the radio still applies the
      // CWX value and reports a range error from the mirroring write, so a
      // rejection here does not mean the setting failed.
      cwxController.setDelay(value).catch(() => {});
    },
  }),

  defineControl<BooleanControlAction<"cwx.qsk">>({
    target: "cwx.qsk",
    label: "CWX QSK Enabled",
    scope: "radio",
    ops: ["toggle", "set"],
    editor: { kind: "boolean" },
    execute(ctx, action) {
      ctx
        .radio()
        ?.cwx()
        ?.setQskEnabled(
          resolveBooleanAction(
            action,
            ctx.state.status.cwx.qskEnabled ?? false,
          ),
        )
        .catch((error) => console.error("CWX QSK set failed", error));
    },
  }),

  defineCwxMacroControl(1),
  defineCwxMacroControl(2),
  defineCwxMacroControl(3),
  defineCwxMacroControl(4),
  defineCwxMacroControl(5),
  defineCwxMacroControl(6),
  defineCwxMacroControl(7),
  defineCwxMacroControl(8),
  defineCwxMacroControl(9),
  defineCwxMacroControl(10),
  defineCwxMacroControl(11),
  defineCwxMacroControl(12),

  defineDvkPlaybackControl(1),
  defineDvkPlaybackControl(2),
  defineDvkPlaybackControl(3),
  defineDvkPlaybackControl(4),
  defineDvkPlaybackControl(5),
  defineDvkPlaybackControl(6),
  defineDvkPlaybackControl(7),
  defineDvkPlaybackControl(8),
  defineDvkPlaybackControl(9),
  defineDvkPlaybackControl(10),
  defineDvkPlaybackControl(11),
  defineDvkPlaybackControl(12),

  defineControl<CommandAction<"dvk.stop">>({
    target: "dvk.stop",
    label: "DVK Stop",
    scope: "radio",
    ops: [],
    editor: { kind: "command" },
    execute(ctx) {
      const dvk = ctx.state.status.dvk;
      const id = dvk.statusRecordingId;
      if (id === undefined) return;
      const controller = ctx.radio()?.dvk();
      if (!controller) return;
      const stop =
        dvk.status === "recording"
          ? controller.stopRecording(id)
          : dvk.status === "preview"
            ? controller.stopPreview(id)
            : dvk.status === "playback"
              ? controller.stopPlayback(id)
              : undefined;
      stop?.catch((error) => console.error("DVK stop failed", error));
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

export const ControlsContext = createContext<{
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
