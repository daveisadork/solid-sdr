import { createElementSize } from "@solid-primitives/resize-observer";
import { debounce } from "@solid-primitives/scheduled";
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  type ParentComponent,
  Show,
} from "solid-js";
import { ALL_EDGES, type CellEdges } from "~/lib/panafall-layout";
import * as panMath from "~/lib/panafall-math";
import { roundToDevicePixels } from "~/lib/utils";
import { CHROME_TRANSITION_MS, useChromeInsets } from "./chrome-insets";
import useFlexRadio, { type SliceState } from "./flexradio";
import { PanafallContext, type VisibleInsets } from "./panafall";
import { usePreferences } from "./preferences";

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
  const panadapter = createMemo(() => {
    const streamId = props.streamId ?? state.selectedPanadapter;
    return streamId != null ? state.status.panadapter[streamId] : undefined;
  });
  const waterfall = createMemo(() => {
    const streamId = panadapter()?.waterfallStreamId;
    return streamId != null ? state.status.waterfall[streamId] : undefined;
  });
  const panadapterController = createMemo(() => {
    const streamId = panadapter()?.streamId;
    return streamId != null ? radio()?.panadapter(streamId) : undefined;
  });
  const waterfallController = createMemo(() => {
    const streamId = waterfall()?.streamId;
    return streamId != null ? radio()?.waterfall(streamId) : undefined;
  });
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

  const panafallScope = createMemo(() => {
    const pan = panadapter();
    const wf = waterfall();
    const panController = panadapterController();
    const wfController = waterfallController();
    return pan && wf && panController && wfController
      ? {
          panadapter: pan,
          waterfall: wf,
          panadapterController: panController,
          waterfallController: wfController,
        }
      : undefined;
  });

  return (
    <Show when={panafallScope()}>
      {(scope) => (
        <PanafallContext.Provider
          value={{
            activeSlice,
            clientXToCellX,
            freqToX,
            freqToAnchorX,
            mhzPerPx,
            mhzToPx,
            mhzToAnchorPx,
            panadapter: () => scope().panadapter,
            setPanadapterWrapper,
            panadapterWrapperSize,
            panadapterController: () => scope().panadapterController,
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
            waterfall: () => scope().waterfall,
            waterfallController: () => scope().waterfallController,
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
      )}
    </Show>
  );
};
