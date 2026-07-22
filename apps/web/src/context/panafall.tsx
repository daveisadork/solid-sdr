import type { PanadapterController, WaterfallController } from "@repo/flexlib";
import { createElementSize } from "@solid-primitives/resize-observer";
import { debounce } from "@solid-primitives/scheduled";
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  type ParentComponent,
  Show,
  useContext,
} from "solid-js";
import { ALL_EDGES, type CellEdges } from "~/lib/panafall-layout";
import * as panMath from "~/lib/panafall-math";
import { roundToDevicePixels } from "~/lib/utils";
import { CHROME_TRANSITION_MS, useChromeInsets } from "./chrome-insets";
import useFlexRadio, {
  type PanadapterState,
  type SliceState,
  type SpotState,
  type WaterfallState,
} from "./flexradio";
import { usePreferences } from "./preferences";

export type PanafallSpot = SpotState & {
  x: number;
};

/**
 * Context for a single panadapter/waterfall pair ("panafall").
 *
 * Coordinate system notes:
 * - **px** values are cell-local: pixel offsets measured from the left edge of
 *   the panadapter wrapper's content box, in every mode. Convert viewport
 *   `clientX` values at event boundaries with `clientXToCellX`.
 * - **MHz** values are frequency widths (not absolute frequencies).
 * - **freq** values are absolute frequencies in MHz.
 */
export interface VisibleInsets {
  /** Cell-local x where the visible (not-under-chrome) region starts. */
  left: number;
  /** Width of chrome overlaying the cell's right edge. */
  right: number;
  /** Width of the visible region. */
  width: number;
}

const PanafallContext = createContext<{
  /** The currently active (transmit/receive focus) slice, if any. */
  activeSlice: Accessor<SliceState | undefined>;
  /** Converts a viewport clientX to a cell-local x. */
  clientXToCellX: (clientX: number) => number;
  /**
   * Converts an absolute frequency (MHz) to a cell-local x pixel position.
   * Math-space only (drag deltas, hit tests, xToFreq round-trips) — anything
   * RENDERED at a frequency must use `freqToAnchorX` instead so it lands on a
   * device pixel.
   */
  freqToX: (freq: number) => number;
  /**
   * Device-pixel-aligned x for rendering anything anchored at a frequency.
   * The single place frequency→CSS positioning is rounded — components must
   * not layer their own rounding on top.
   */
  freqToAnchorX: (freq: number) => number;
  /** MHz represented by a single pixel — the inverse of `pxPerMHz`. */
  mhzPerPx: Accessor<number>;
  /**
   * Converts a frequency width in MHz to a pixel width. Math-space only —
   * rendered widths/offsets must use `mhzToAnchorPx`.
   */
  mhzToPx: (mhz: number) => number;
  /**
   * Device-pixel-aligned pixel size for rendered widths and offsets derived
   * from MHz spans.
   */
  mhzToAnchorPx: (mhz: number) => number;
  /** The current panadapter state object from the radio. */
  panadapter: Accessor<PanadapterState>;
  /** Sets the panadapter wrapper element so the context can track its size. */
  setPanadapterWrapper: (el: HTMLElement) => void;
  /**
   * Reactive size of the panadapter wrapper (the canvas's CSS box). This is the
   * coordinate space mouse events live in, so all freq<->pixel math keys off its
   * width rather than `pan.width` (the radio's integer dimension).
   */
  panadapterWrapperSize: ReturnType<typeof createElementSize>;
  /** Controller for sending commands to the panadapter (pan, zoom, etc.). */
  panadapterController: Accessor<PanadapterController>;
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
   * Cell-local insets of the region not covered by chrome (sidebars) —
   * derived from known chrome state and this cell's tree edges, never
   * measured.
   */
  visibleInsets: Accessor<VisibleInsets>;
  /**
   * visibleInsets gated by the chrome squeeze transition: updates settle one
   * transition duration after the last change. Flag-side/detach math only, so
   * flags flip when the sliding chrome settles instead of at animation start.
   */
  settledInsets: Accessor<VisibleInsets>;
  /**
   * Whether a slice's flag anchor sits under chrome / outside the cell —
   * derived arithmetic, replaces the old sentinel rect observation.
   */
  isSliceDetached: (slice: SliceState) => boolean;
  /**
   * Which edge a detached slice sits beyond, positionally (tracks the
   * mid-drag translate); null while the slice is visible. Drives which side
   * the detached-slice arrows appear on.
   */
  sliceDetachedSide: (slice: SliceState) => "left" | "right" | null;
  /**
   * Cell-local x of the slice's anchor line, rounded to device pixels
   * (diversity children anchor to their parent). Layout-space: excludes the
   * transient pan-drag translate, which CSS applies via --drag-offset — use
   * this for values that feed CSS-translated elements.
   */
  sliceAnchorX: (slice: SliceState) => number;
  /**
   * Where the slice's anchor line is on screen right now: `sliceAnchorX` plus
   * the transient pan-drag translate (--drag-offset). During a smooth-scroll
   * drag the debounced center-frequency update holds off while the pointer
   * keeps moving, so freqToX alone lags the visual position. All JS position
   * math (detach, flag-side) must use this rather than reading the drag
   * offset directly.
   */
  visualAnchorX: (slice: SliceState) => number;
  /**
   * The transient pan-drag translate, in px. The pan drag machinery owns this
   * signal: it writes it via `setDragOffset` and renders it as --drag-offset.
   * Position math must go through `visualAnchorX` instead of reading it.
   */
  dragOffset: Accessor<number>;
  /** Rounds to device pixels internally — callers pass raw pointer deltas. */
  setDragOffset: (px: number) => void;
  /** Converts a cell-local x pixel position to an absolute frequency (MHz). */
  xToFreq: (x: number) => number;
}>();

export const PanafallProvider: ParentComponent<{
  streamId?: string;
  edges?: CellEdges;
}> = (props) => {
  const { radio, state } = useFlexRadio();
  const { preferences } = usePreferences();
  const chromeInsets = useChromeInsets();
  const [panafallPortalRef, setPanafallPortalRef] = createSignal<HTMLElement>();
  const [panafallControlsRef, setPanafallControlsRef] =
    createSignal<HTMLElement>();
  const [waterfallControlsRef, setWaterfallControlsRef] =
    createSignal<HTMLElement>();
  const [panadapterControlsRef, setPanadapterControlsRef] =
    createSignal<HTMLElement>();
  const [panadapterWrapper, setPanadapterWrapper] = createSignal<HTMLElement>();
  const panadapterWrapperSize = createElementSize(panadapterWrapper);
  const cellEdges = () => props.edges ?? ALL_EDGES;
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

  const scale = (): panMath.PanScale => ({
    width: panadapterWrapperSize.width ?? 0,
    centerMHz: panadapter()?.centerFrequencyMHz ?? 0,
    bandwidthMHz: panadapter()?.bandwidthMHz ?? 0,
  });

  /**
   * Viewport x of the cell's left edge. Re-measured only when layout-affecting
   * signals change — never per pointer event, to keep getBoundingClientRect
   * off the hot paths.
   */
  const cellLeft = createMemo(
    on(
      () => [panadapterWrapperSize.width, panadapterWrapperSize.height],
      () => panadapterWrapper()?.getBoundingClientRect().left ?? 0,
    ),
  );

  const clientXToCellX = (clientX: number) => clientX - cellLeft();

  const visibleInsets = createMemo((): VisibleInsets => {
    const width = panadapterWrapperSize.width ?? 0;
    const edges = cellEdges();
    const left = edges.left ? chromeInsets.left() : 0;
    const right = edges.right ? chromeInsets.right() : 0;
    return { left, right, width: Math.max(0, width - left - right) };
  });

  const [settledInsets, setSettledInsets] = createSignal<VisibleInsets>({
    left: 0,
    right: 0,
    width: 0,
  });
  const applySettledInsets = debounce(
    (insets: VisibleInsets) => setSettledInsets(insets),
    CHROME_TRANSITION_MS,
  );
  createEffect(() => applySettledInsets(visibleInsets()));
  onCleanup(() => applySettledInsets.clear());

  const pxPerMHz = createMemo(() => panMath.pxPerMHz(scale()));
  const mhzPerPx = createMemo(() => panMath.mhzPerPx(scale()));
  const mhzToPx = (mhz: number) => panMath.mhzToPx(scale(), mhz);
  const pxToMHz = (px: number) => panMath.pxToMHz(scale(), px);
  const xToFreq = (x: number) => panMath.xToFreq(scale(), x);
  const freqToX = (freq: number) => panMath.freqToX(scale(), freq);
  const freqToAnchorX = (freq: number) => roundToDevicePixels(freqToX(freq));
  const mhzToAnchorPx = (mhz: number) => roundToDevicePixels(mhzToPx(mhz));

  const [dragOffset, setDragOffsetRaw] = createSignal(0);
  const setDragOffset = (px: number) =>
    setDragOffsetRaw(roundToDevicePixels(px));

  const sliceAnchorX = (slice: SliceState) => {
    const target = slice.diversityChild
      ? (state.status.slice[slice.diversityIndex.toString()] ?? slice)
      : slice;
    return roundToDevicePixels(
      freqToX(target.frequencyMHz) + preferences.panadapterOffset,
    );
  };

  const visualAnchorX = (slice: SliceState) =>
    sliceAnchorX(slice) + dragOffset();

  const sliceDetachedSide = (slice: SliceState): "left" | "right" | null => {
    const width = panadapterWrapperSize.width ?? 0;
    if (!width) return null;
    const insets = settledInsets();
    const x = visualAnchorX(slice);
    if (x < insets.left) return "left";
    if (x > width - insets.right) return "right";
    return null;
  };

  const isSliceDetached = (slice: SliceState): boolean =>
    sliceDetachedSide(slice) !== null;

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
          clientXToCellX,
          freqToX,
          freqToAnchorX,
          mhzPerPx,
          mhzToPx,
          mhzToAnchorPx,
          panadapter,
          setPanadapterWrapper,
          panadapterWrapperSize,
          panadapterController,
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
          visibleInsets,
          settledInsets,
          isSliceDetached,
          sliceDetachedSide,
          sliceAnchorX,
          visualAnchorX,
          dragOffset,
          setDragOffset,
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
