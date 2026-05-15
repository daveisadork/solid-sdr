import {
  createContext,
  createMemo,
  type ParentComponent,
  Show,
  useContext,
  type Accessor,
  createSignal,
} from "solid-js";
import useFlexRadio, {
  type SpotState,
  type PanadapterState,
  type SliceState,
  type WaterfallState,
} from "./flexradio";
import {
  type PanadapterController,
  type WaterfallController,
} from "@repo/flexlib";
import { createElementBounds } from "@solid-primitives/bounds";
import { usePreferences } from "./preferences";
import { roundToDecimals } from "~/lib/utils";

export type PanafallSpot = SpotState & {
  x: number;
};

/**
 * Context for a single panadapter/waterfall pair ("panafall").
 *
 * Coordinate system notes:
 * - **px** values are pixel offsets measured from the left edge of the panadapter canvas.
 * - **MHz** values are frequency widths (not absolute frequencies).
 * - **freq** values are absolute frequencies in MHz.
 *
 * When transparency effects are enabled, `x` coordinates are viewport-relative
 * (the canvas is full-screen). When disabled, they are element-relative.
 */
const PanafallContext = createContext<{
  /** The currently active (transmit/receive focus) slice, if any. */
  activeSlice: Accessor<SliceState | undefined>;
  /**
   * Converts an absolute frequency (MHz) to an x pixel position on the canvas.
   * Accounts for the transparency-effects offset when that preference is disabled.
   */
  freqToX: (freq: number) => number;
  /** MHz represented by a single pixel — the inverse of `pxPerMHz`. */
  mhzPerPx: Accessor<number>;
  /** Converts a frequency width in MHz to a pixel width. */
  mhzToPx: (mhz: number) => number;
  /** The current panadapter state object from the radio. */
  panadapter: Accessor<PanadapterState>;
  /** Controller for sending commands to the panadapter (pan, zoom, etc.). */
  panadapterController: Accessor<PanadapterController>;
  /** Reactive bounding rect of the panadapter/waterfall element. */
  panafallBounds: ReturnType<typeof createElementBounds>;
  /** Pixels per MHz — how many pixels represent one MHz of bandwidth. */
  pxPerMHz: Accessor<number>;
  /** Converts a pixel width to a frequency width in MHz. */
  pxToMHz: (px: number) => number;
  panafallPortalRef: Accessor<HTMLElement | undefined>;
  setPanafallPortalRef: (el: HTMLElement) => void;
  panafallControlsRef: Accessor<HTMLElement | undefined>;
  setPanafallControlsRef: (el: HTMLElement) => void;
  panadapterControlsRef: Accessor<HTMLElement | undefined>;
  setPanadapterControlsRef: (el: HTMLElement) => void;
  waterfallControlsRef: Accessor<HTMLElement | undefined>;
  setWaterfallControlsRef: (el: HTMLElement) => void;
  /** All slices that are in-use and belong to this panadapter. */
  slices: Accessor<SliceState[]>;
  /** The current waterfall state object from the radio. */
  waterfall: Accessor<WaterfallState>;
  /** Controller for sending commands to the waterfall (speed, colors, etc.). */
  waterfallController: Accessor<WaterfallController>;
  /**
   * Converts an x pixel position on the canvas to an absolute frequency (MHz).
   * Accounts for the transparency-effects offset when that preference is disabled.
   */
  xToFreq: (x: number) => number;
}>();

export const PanafallProvider: ParentComponent<{ streamId?: string }> = (
  props,
) => {
  const { radio, state } = useFlexRadio();
  const { preferences } = usePreferences();
  const [panafallPortalRef, setPanafallPortalRef] = createSignal<HTMLElement>();
  const [panafallControlsRef, setPanafallControlsRef] =
    createSignal<HTMLElement>();
  const [waterfallControlsRef, setWaterfallControlsRef] =
    createSignal<HTMLElement>();
  const [panadapterControlsRef, setPanadapterControlsRef] =
    createSignal<HTMLElement>();
  const panafallBounds = createElementBounds(panafallControlsRef);
  const panadapter = createMemo(
    () => state.status.panadapter[props.streamId ?? state.selectedPanadapter],
  );
  const waterfall = createMemo(
    () => state.status.waterfall[panadapter()?.waterfallStreamId],
  );
  const panadapterController = createMemo(() =>
    radio()?.panadapter(panadapter()?.streamId),
  );
  const waterfallController = createMemo(() =>
    radio()?.waterfall(waterfall()?.streamId),
  );
  const slices = createMemo(() => {
    const streamId = panadapter()?.streamId;
    return Object.values(state.status.slice).filter(
      (s) => s.panadapterStreamId === streamId && s.isInUse,
    );
  });

  const activeSlice = createMemo(() =>
    slices().find((s) => s.isActive && s.isInUse),
  );

  const pxPerMHz = createMemo(() => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    return pan.width / pan.bandwidthMHz;
  });

  const mhzPerPx = createMemo(() => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    return pan.bandwidthMHz / pan.width;
  });

  const mhzToPx = (mhz: number) => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    return mhz * pxPerMHz();
  };

  const pxToMHz = (px: number) => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    return roundToDecimals(px * mhzPerPx(), 6);
  };

  const xToFreq = (x: number) => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    const centerFreq = pan.centerFrequencyMHz;
    const offsetPx = preferences.enableTransparencyEffects
      ? x
      : x - panafallBounds.left;
    const offsetMHz = pxToMHz(offsetPx - pan.width / 2);
    return roundToDecimals(centerFreq + offsetMHz, 6);
  };

  const freqToX = (freq: number) => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    const centerFreq = pan.centerFrequencyMHz;
    const offsetMHz = freq - centerFreq;
    const offsetPx = preferences.enableTransparencyEffects
      ? 0
      : panafallBounds.left;
    return pan.width / 2 + mhzToPx(offsetMHz) + offsetPx;
  };

  return (
    <Show
      when={
        panadapter() &&
        waterfall() &&
        panadapterController() &&
        waterfallController()
      }
    >
      <PanafallContext.Provider
        value={{
          activeSlice,
          freqToX,
          mhzPerPx,
          mhzToPx,
          panadapter,
          panadapterController,
          panafallBounds,
          pxPerMHz,
          pxToMHz,
          setPanafallPortalRef,
          panafallPortalRef,
          setPanafallControlsRef,
          panafallControlsRef,
          setPanadapterControlsRef,
          panadapterControlsRef,
          setWaterfallControlsRef,
          waterfallControlsRef,
          slices,
          waterfall,
          waterfallController,
          xToFreq,
        }}
      >
        {props.children}
      </PanafallContext.Provider>
    </Show>
  );
};

export function usePanafall() {
  const context = useContext(PanafallContext);
  if (!context) {
    throw new Error("usePanafall must be used within a PanafallProvider");
  }

  return context;
}
