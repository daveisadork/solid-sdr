import {
  batch,
  createContext,
  createMemo,
  ParentComponent,
  useContext,
} from "solid-js";
import useFlexRadio from "./flexradio";
import { BANDS } from "~/components/panafall/settings";
import { useRuntime } from "./runtime";
import { produce } from "solid-js/store";
import { MidiControl } from "~/components/midi-control";

/**
 * User-facing slice identifiers.
 *
 * Flex labels slices as A, B, C, etc. These are stable enough for user
 * mappings and avoid coupling bindings to runtime slice ids.
 */
export type SliceSelector = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

/**
 * Flex slice mode name.
 *
 * This can be narrowed later to a literal union once the supported mode list
 * is centralized.
 */
export type SliceMode = string;

/**
 * Flex band identifier.
 *
 * This can be narrowed later to a literal union once the supported band list
 * is centralized.
 */
export type PanadapterBand = string;

/**
 * Absolute scalar value normalized to the range 0..1.
 *
 * This is not range-safe at the type level; validate at runtime.
 */
export type Normalized = number;

/**
 * Centered scalar value normalized to the range -1..1.
 *
 * This is useful for values with a natural center point such as offsets.
 * This is not range-safe at the type level; validate at runtime.
 */
export type SignedNormalized = number;

/**
 * Optional slice selector for slice- and panadapter-scoped actions.
 *
 * When omitted, the action targets the active slice. When present, the action
 * targets the explicitly addressed slice.
 */
type SliceTargeted = {
  /**
   * Slice letter to target.
   *
   * If omitted, resolve the action against the active slice.
   */
  slice?: SliceSelector;
};

type Empty = Record<never, never>;

/**
 * Boolean property toggle action.
 *
 * Use this for stateful boolean properties where the current value should be
 * inverted by the executor.
 */
type Toggle<T extends string, Extra extends object = Empty> = Extra & {
  /**
   * Semantic action target.
   */
  target: T;

  /**
   * Toggle the current boolean value.
   */
  op: "toggle";
};

/**
 * Boolean property set action.
 *
 * Use this for explicit on/off control, including momentary bindings that emit
 * true on press and false on release.
 */
type SetBoolean<T extends string, Extra extends object = Empty> = Extra & {
  /**
   * Semantic action target.
   */
  target: T;

  /**
   * Set the property to an explicit boolean value.
   */
  op: "set";

  /**
   * Boolean value to apply.
   */
  value: boolean;
};

/**
 * Relative stepped adjustment action.
 *
 * The executor interprets `delta` in target-specific steps. For example,
 * `slice.frequency` may interpret one step as the current tune step size.
 */
type AdjustSteps<T extends string, Extra extends object = Empty> = Extra & {
  /**
   * Semantic action target.
   */
  target: T;

  /**
   * Apply a relative adjustment.
   */
  op: "adjust";

  /**
   * Signed step delta.
   *
   * Positive values increase, negative values decrease.
   */
  delta: number;
};

/**
 * Absolute normalized set action.
 *
 * Use this for bounded scalar properties that can be represented as 0..1,
 * such as volume, power, or zoom.
 */
type SetNormalized<T extends string, Extra extends object = Empty> = Extra & {
  /**
   * Semantic action target.
   */
  target: T;

  /**
   * Set the property to an absolute value.
   */
  op: "set";

  /**
   * Normalized scalar value in the range 0..1.
   */
  value: Normalized;
};

/**
 * Absolute centered normalized set action.
 *
 * Use this for bounded scalar properties with a natural center, such as
 * offsets that can move above or below zero.
 */
type SetSignedNormalized<
  T extends string,
  Extra extends object = Empty,
> = Extra & {
  /**
   * Semantic action target.
   */
  target: T;

  /**
   * Set the property to an absolute value.
   */
  op: "set";

  /**
   * Centered normalized scalar value in the range -1..1.
   */
  value: SignedNormalized;
};

/**
 * Relative cycling action for discrete choices.
 *
 * This is useful for mode/band/tune-step style controls where the executor
 * advances or reverses within a finite set of values.
 */
type Cycle<T extends string, Extra extends object = Empty> = Extra & {
  /**
   * Semantic action target.
   */
  target: T;

  /**
   * Cycle through a discrete value set.
   */
  op: "cycle";

  /**
   * Signed cycle delta.
   *
   * `1` typically means next, `-1` means previous.
   */
  delta: number;
};

/**
 * Explicit set action for non-boolean, non-normalized values.
 *
 * Use this for values such as mode names, band names, slice letters, or
 * concrete numeric values like a tune step in Hz.
 */
type SetValue<
  T extends string,
  TValue,
  Extra extends object = Empty,
> = Extra & {
  /**
   * Semantic action target.
   */
  target: T;

  /**
   * Set the property to an explicit value.
   */
  op: "set";

  /**
   * Value to apply.
   */
  value: TValue;
};

/**
 * Multiplicative bandwidth scaling action.
 *
 * This is used for panadapter zooming where the most useful user-facing
 * control is a percentage change rather than an absolute target value.
 */
type ScaleBandwidth<Extra extends object = Empty> = Extra & {
  /**
   * Semantic action target.
   */
  target: "panadapter.bandwidth";

  /**
   * Bandwidth change direction.
   *
   * `"increase"` widens the bandwidth and `"decrease"` narrows it.
   */
  change: "increase" | "decrease";

  /**
   * Positive scale factor.
   *
   * A value of `0.25` means "change by 25%". Executors should typically apply
   * this as `bandwidth *= 1 + factor` for increase and
   * `bandwidth /= 1 + factor` for decrease.
   */
  factor: number;
};

/**
 * FlexRadio semantic action union for the initial v1 action catalog.
 *
 * Design notes:
 * - Omitted `slice` means "active slice".
 * - `panadapter.*` actions resolve to the panadapter that owns the addressed
 *   slice, or the active slice's panadapter when `slice` is omitted.
 * - `radio.*` actions always target the connected radio directly.
 * - Targets with no `op` are one-shot commands rather than stateful properties.
 */
export type ControlAction =
  /**
   * Adjust a slice's tuned frequency by a target-specific number of steps.
   *
   * With no `slice`, affects the active slice.
   */
  | AdjustSteps<"slice.frequency", SliceTargeted>

  /**
   * Cycle the slice's tune step selection.
   *
   * With no `slice`, affects the active slice.
   */
  | Cycle<"slice.tuneStep", SliceTargeted>

  /**
   * Set the slice's tune step directly.
   *
   * The numeric value is intended to represent a concrete step size in Hz.
   * With no `slice`, affects the active slice.
   */
  | SetValue<"slice.tuneStep", number, SliceTargeted>

  /**
   * Cycle the slice's mode selection.
   *
   * With no `slice`, affects the active slice.
   */
  | Cycle<"slice.mode", SliceTargeted>

  /**
   * Set the slice's mode directly.
   *
   * With no `slice`, affects the active slice.
   */
  | SetValue<"slice.mode", SliceMode, SliceTargeted>

  /**
   * Adjust the slice filter width by steps.
   *
   * With no `slice`, affects the active slice.
   */
  | AdjustSteps<"slice.filter.width", SliceTargeted>

  /**
   * Set the slice filter width as a normalized value.
   *
   * With no `slice`, affects the active slice.
   */
  | SetNormalized<"slice.filter.width", SliceTargeted>

  /**
   * Adjust the slice audio level by steps.
   *
   * With no `slice`, affects the active slice.
   */
  | AdjustSteps<"slice.audio.level", SliceTargeted>

  /**
   * Set the slice audio level as a normalized value.
   *
   * With no `slice`, affects the active slice.
   */
  | SetNormalized<"slice.audio.level", SliceTargeted>

  /**
   * Toggle the slice audio mute state.
   *
   * With no `slice`, affects the active slice.
   */
  | Toggle<"slice.audio.mute", SliceTargeted>

  /**
   * Set the slice audio mute state explicitly.
   *
   * With no `slice`, affects the active slice.
   */
  | SetBoolean<"slice.audio.mute", SliceTargeted>

  /**
   * Toggle the slice RIT enabled state.
   *
   * With no `slice`, affects the active slice.
   */
  | Toggle<"slice.rit.enabled", SliceTargeted>

  /**
   * Set the slice RIT enabled state explicitly.
   *
   * With no `slice`, affects the active slice.
   */
  | SetBoolean<"slice.rit.enabled", SliceTargeted>

  /**
   * Adjust the slice RIT offset by steps.
   *
   * With no `slice`, affects the active slice.
   */
  | AdjustSteps<"slice.rit.offset", SliceTargeted>

  /**
   * Set the slice RIT offset as a centered normalized value.
   *
   * With no `slice`, affects the active slice.
   */
  | SetSignedNormalized<"slice.rit.offset", SliceTargeted>

  /**
   * Clear the slice RIT offset.
   *
   * With no `slice`, affects the active slice.
   */
  | {
      /**
       * One-shot command target.
       */
      target: "slice.rit.clear";

      /**
       * Slice letter to target.
       *
       * If omitted, resolve against the active slice.
       */
      slice?: SliceSelector;
    }

  /**
   * Toggle the slice split state.
   *
   * With no `slice`, affects the active slice.
   */
  | Toggle<"slice.split.enabled", SliceTargeted>

  /**
   * Set the slice split state explicitly.
   *
   * With no `slice`, affects the active slice.
   */
  | SetBoolean<"slice.split.enabled", SliceTargeted>
  | {
      target: "slice.split.swap";
      slice?: SliceSelector;
    }

  /**
   * Cycle the active slice selection.
   *
   * This changes which slice is active rather than mutating a specific slice.
   */
  | {
      /**
       * Semantic action target.
       */
      target: "slice.select";

      /**
       * Cycle through available slices.
       */
      op: "cycle";

      /**
       * Signed cycle delta.
       *
       * `1` typically means next, `-1` means previous.
       */
      delta: number;
    }

  /**
   * Set the active slice explicitly by slice letter.
   */
  | {
      /**
       * Semantic action target.
       */
      target: "slice.select";

      /**
       * Set the active slice explicitly.
       */
      op: "set";

      /**
       * Slice letter to activate.
       */
      value: SliceSelector;
    }

  /**
   * Cycle the panadapter's band selection.
   *
   * With no `panadapter`, affects the active slice.
   */
  | Cycle<"panadapter.band", SliceTargeted>

  /**
   * Set the panadapter's band directly.
   *
   * With no `panadapter`, affects the active slice.
   */
  | SetValue<"panadapter.band", PanadapterBand, SliceTargeted>

  /**
   * Toggle the addressed slice's panadapter band zoom mode.
   *
   * With no `slice`, resolves through the active slice's panadapter.
   */
  | Toggle<"panadapter.bandZoom", SliceTargeted>

  /**
   * Set the addressed slice's panadapter band zoom mode explicitly.
   *
   * With no `slice`, resolves through the active slice's panadapter.
   */
  | SetBoolean<"panadapter.bandZoom", SliceTargeted>

  /**
   * Toggle the addressed slice's panadapter segment zoom mode.
   *
   * With no `slice`, resolves through the active slice's panadapter.
   */
  | Toggle<"panadapter.segmentZoom", SliceTargeted>

  /**
   * Set the addressed slice's panadapter segment zoom mode explicitly.
   *
   * With no `slice`, resolves through the active slice's panadapter.
   */
  | SetBoolean<"panadapter.segmentZoom", SliceTargeted>

  /**
   * Scale the addressed slice's panadapter bandwidth by a percentage factor.
   *
   * With no `slice`, resolves through the active slice's panadapter.
   */
  | ScaleBandwidth<SliceTargeted>

  /**
   * Adjust the slice AGC threshold by steps.
   *
   * With no `slice`, affects the active slice.
   */
  | AdjustSteps<"slice.agc.threshold", SliceTargeted>

  /**
   * Set the slice AGC threshold as a normalized value.
   *
   * With no `slice`, affects the active slice.
   */
  | SetNormalized<"slice.agc.threshold", SliceTargeted>
  | Toggle<"slice.nr.enabled", SliceTargeted>
  | SetBoolean<"slice.nr.enabled", SliceTargeted>
  | AdjustSteps<"slice.nr.level", SliceTargeted>
  | SetNormalized<"slice.nr.level", SliceTargeted>
  | Toggle<"slice.nrs.enabled", SliceTargeted>
  | SetBoolean<"slice.nrs.enabled", SliceTargeted>
  | Toggle<"slice.rnn.enabled", SliceTargeted>
  | SetBoolean<"slice.rnn.enabled", SliceTargeted>

  /**
   * Toggle MOX on the connected radio.
   */
  | Toggle<"radio.mox">

  /**
   * Set MOX explicitly on the connected radio.
   */
  | SetBoolean<"radio.mox">

  /**
   * Start an ATU tune operation on the connected radio.
   */
  | {
      /**
       * One-shot command target.
       */
      target: "radio.atu.startTune";
    }

  /**
   * Adjust RF power by steps on the connected radio.
   */
  | AdjustSteps<"radio.rfPower">

  /**
   * Set RF power as a normalized value on the connected radio.
   */
  | SetNormalized<"radio.rfPower">

  /**
   * Adjust tune power by steps on the connected radio.
   */
  | AdjustSteps<"radio.tunePower">

  /**
   * Set tune power as a normalized value on the connected radio.
   */
  | SetNormalized<"radio.tunePower">

  /**
   * Toggle TX Tune on the connected radio.
   */
  | Toggle<"radio.txTune">

  /**
   * Set TX Tune explicitly on the connected radio.
   */
  | SetBoolean<"radio.txTune">

  /**
   * Adjust CW speed by steps on the connected radio.
   */
  | AdjustSteps<"radio.cw.speed">

  /**
   * Set CW speed as a normalized value on the connected radio.
   */
  | SetNormalized<"radio.cw.speed">;

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

  const activeSlice = createMemo(() => {
    const slice = Object.values(state.status.slice).find(
      (slice) =>
        slice.clientHandle === state.clientHandleInt &&
        slice.isInUse &&
        slice.isActive,
    );
    return radio()?.slice(slice?.id);
  });

  const getSlice = (index?: SliceSelector | undefined) =>
    index
      ? radio()
          ?.slices()
          .find((slice) => slice.indexLetter === index)
      : activeSlice();

  const getPan = (index?: SliceSelector | undefined) =>
    radio()?.panadapter(getSlice(index)?.panadapterStreamId);

  const bandList = createMemo(() => [
    ...BANDS.map((band) => band.id),
    ...Object.keys(state.status.xvtr),
  ]);

  const dispatch = (action: ControlAction) => {
    switch (action.target) {
      case "slice.frequency": {
        const slice = getSlice(action.slice);
        const pan = getPan(action.slice);
        if (!slice) return;
        const delta = (slice.tuneStepHz / 1_000_000) * action.delta;
        const panLow = pan.centerFrequencyMHz - pan.bandwidthMHz / 2;
        const panHigh = pan.centerFrequencyMHz + pan.bandwidthMHz / 2;
        const nextFreq = slice.frequencyMHz + delta;
        const filterLow = nextFreq + slice.filterLowHz / 1_000_000;
        const filterHigh = nextFreq + slice.filterHighHz / 1_000_000;
        batch(() => {
          if (filterHigh > panHigh || filterLow < panLow) {
            pan.setCenterFrequency(pan.centerFrequencyMHz + delta);
          }
          slice.setFrequency(nextFreq, false);
        });
        break;
      }
      case "slice.tuneStep": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value =
          action.op === "cycle"
            ? slice.tuneStepListHz.at(
                (slice.tuneStepListHz.indexOf(slice.tuneStepHz) +
                  action.delta) %
                  slice.tuneStepListHz.length,
              )
            : action.value;
        slice.setTuneStep(value);
        break;
      }
      case "slice.mode": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value =
          action.op === "cycle"
            ? slice.modeList.at(
                (slice.modeList.indexOf(slice.mode) + action.delta) %
                  slice.modeList.length,
              )
            : action.value;
        slice.setMode(value);
        break;
      }
      case "slice.audio.level": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value =
          action.op === "adjust"
            ? slice.audioGain + action.delta
            : Math.round(action.value * 100);
        slice.setAudioGain(value);
        break;
      }
      case "slice.audio.mute": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value = action.op === "toggle" ? !slice.isMuted : action.value;
        slice.setMute(value);
        break;
      }
      case "slice.rit.enabled": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value = action.op === "toggle" ? !slice.ritEnabled : action.value;
        slice.setRitEnabled(value);
        break;
      }
      case "slice.rit.offset": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value =
          action.op === "adjust"
            ? slice.ritOffsetHz + action.delta
            : Math.round(action.value * 200) - 100;
        slice.setRitOffset(value);
        break;
      }
      case "slice.rit.clear": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        slice.setRitOffset(0);
        break;
      }
      case "slice.split.enabled": {
        const slice = getSlice();
        if (!slice) return;
        const isSplit = slice.id in runtime.split;
        const splitParent = isSplit
          ? (radio()?.slice(runtime.split[slice.id]?.parent) ?? slice)
          : undefined;
        const splitChild = isSplit
          ? (radio()?.slice(runtime.split[slice.id]?.child) ?? slice)
          : undefined;
        const enableSplit = action.op === "toggle" ? !isSplit : action.value;
        if (isSplit === enableSplit) return;
        if (enableSplit) {
          slice.clone().then((child) =>
            batch(() => {
              setRuntime("split", slice.id, {
                child: child.id,
                parent: null,
              });
              setRuntime("split", child.id, {
                child: null,
                parent: slice.id,
              });
              child.setMute(true);
              if (slice.isTransmitEnabled) {
                child.enableTransmit(true);
              }
            }),
          );
        } else {
          splitParent.enableTransmit(
            splitParent.isTransmitEnabled || splitChild.isTransmitEnabled,
          );
          splitChild.close().then(() => {
            setRuntime(
              "split",
              produce((split) => {
                delete split[splitParent.id];
                delete split[splitChild.id];
              }),
            );
          });
        }
        break;
      }
      case "slice.split.swap": {
        const slice = getSlice();
        if (!slice) return;
        const isSplit = slice.id in runtime.split;
        if (!isSplit) return;
        const splitParent =
          radio()?.slice(runtime.split[slice.id]?.parent) ?? slice;
        const splitChild =
          radio()?.slice(runtime.split[slice.id]?.child) ?? slice;

        batch(() => {
          setRuntime("split", splitChild.id, {
            child: splitParent.id,
            parent: null,
          });
          setRuntime("split", splitParent.id, {
            child: null,
            parent: splitChild.id,
          });
          const partnerMute = splitParent.isMuted;
          splitParent.enableTransmit(splitChild.isTransmitEnabled);
          splitParent.setMute(splitChild.isMuted);
          splitChild.setMute(partnerMute);
        });
        break;
      }
      case "slice.nr.enabled": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value = action.op === "toggle" ? !slice.nrEnabled : action.value;
        slice.setNrEnabled(value);
        break;
      }
      case "slice.nrs.enabled": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value = action.op === "toggle" ? !slice.nrsEnabled : action.value;
        slice.setNrsEnabled(value);
        break;
      }
      case "slice.rnn.enabled": {
        const slice = getSlice(action.slice);
        if (!slice) return;
        const value = action.op === "toggle" ? !slice.rnnEnabled : action.value;
        slice.setRnnEnabled(value);
        break;
      }
      case "panadapter.band": {
        const pan = getPan(action.slice);
        if (!pan) return;
        const currentBand = pan.xvtr
          ? Object.values(state.status.xvtr).find(
              (xvtr) => xvtr.name === pan.xvtr,
            )?.id
          : pan.band;
        const bands = bandList();
        const value =
          action.op === "cycle"
            ? bands.at(
                (bands.indexOf(currentBand) + action.delta) % bands.length,
              )
            : action.value;
        pan.setBand(value);
        break;
      }
      case "panadapter.bandZoom": {
        const pan = getPan(action.slice);
        if (!pan) return;
        const value = action.op === "toggle" ? !pan.isBandZoomOn : action.value;
        pan.setBandZoom(value);
        break;
      }
      case "panadapter.segmentZoom": {
        const pan = getPan(action.slice);
        if (!pan) return;
        const value =
          action.op === "toggle" ? !pan.isSegmentZoomOn : action.value;
        pan.setSegmentZoom(value);
        break;
      }
      case "panadapter.bandwidth": {
        console.log(action);
        const pan = getPan(action.slice);
        if (!pan) return;
        const factor = 1 + action.factor;
        const bandwidth =
          action.change === "increase"
            ? pan.bandwidthMHz * factor
            : pan.bandwidthMHz / factor;
        pan.setBandwidth(bandwidth);
        break;
      }
      case "radio.rfPower": {
        const r = radio();
        if (!r) return;
        const value =
          action.op === "set"
            ? Math.round(action.value * 100)
            : r.rfPower + action.delta;
        r.setRfPower(value);
        break;
      }
      case "radio.mox": {
        const r = radio();
        const value = action.op === "toggle" ? !r.mox : action.value;
        r.setMox(value);
        break;
      }
      case "radio.txTune": {
        const r = radio();
        const value = action.op === "toggle" ? !r.txTune : action.value;
        r.setTxTune(value);
        break;
      }
      case "radio.atu.startTune": {
        radio().startAtuTune();
        break;
      }
      case "radio.tunePower": {
        const r = radio();
        const value =
          action.op === "adjust"
            ? r.tunePower + action.delta
            : Math.round(action.value * 100);
        r.setTunePower(value);
        break;
      }
      case "slice.filter.width":
      case "slice.select":
      case "slice.agc.threshold":
      case "radio.cw.speed":
      default:
        console.warn("not implemented:", action);
    }
  };

  return (
    <ControlsContext.Provider value={{ dispatch }}>
      {props.children}
      <MidiControl />
    </ControlsContext.Provider>
  );
};
