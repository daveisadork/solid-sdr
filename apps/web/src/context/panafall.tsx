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
  /** Converts an absolute frequency (MHz) to a cell-local x pixel position. */
  freqToX: (freq: number) => number;
  /** MHz represented by a single pixel — the inverse of `pxPerMHz`. */
  mhzPerPx: Accessor<number>;
  /** Converts a frequency width in MHz to a pixel width. */
  mhzToPx: (mhz: number) => number;
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
  /** Which viewport edges this cell touches in the layout tree. */
  cellEdges: Accessor<CellEdges>;
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
   * The transient pan-drag translate (--drag-offset), in px. During a
   * smooth-scroll drag the debounced center-frequency update holds off while
   * the pointer keeps moving, so freqToX alone lags the visual position by
   * this amount — detach/flag math must add it to flip mid-drag.
   */
  dragOffset: Accessor<number>;
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

  const [dragOffset, setDragOffset] = createSignal(0);

  /** Cell-local x of the slice's anchor line (diversity children anchor to their parent). */
  const sliceAnchorX = (slice: SliceState) => {
    const target = slice.diversityChild
      ? (state.status.slice[slice.diversityIndex.toString()] ?? slice)
      : slice;
    return freqToX(target.frequencyMHz) + preferences.panadapterOffset;
  };

  const isSliceDetached = (slice: SliceState): boolean => {
    const width = panadapterWrapperSize.width ?? 0;
    if (!width) return false;
    const insets = settledInsets();
    const x = sliceAnchorX(slice) + dragOffset();
    return x < insets.left || x > width - insets.right;
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
          clientXToCellX,
          freqToX,
          mhzPerPx,
          mhzToPx,
          panadapter,
          setPanadapterWrapper,
          panadapterWrapperSize,
          panadapterController,
          cellEdges,
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
