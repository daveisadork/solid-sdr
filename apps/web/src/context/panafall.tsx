import {
  createContext,
  createMemo,
  type ParentComponent,
  Show,
  useContext,
  type Accessor,
  createSignal,
  createEffect,
} from "solid-js";
import useFlexRadio, {
  type Panadapter,
  type Slice,
  type Waterfall,
} from "./flexradio";
import {
  type PanadapterController,
  type WaterfallController,
} from "@repo/flexlib";
import { createElementBounds } from "@solid-primitives/bounds";
import { usePreferences } from "./preferences";

const PanafallContext = createContext<{
  activeSlice: Accessor<Slice | undefined>;
  freqToX: (freq: number) => number;
  mhzPerPx: Accessor<number>;
  mhzToPx: (mhz: number) => number;
  panadapter: Accessor<Panadapter>;
  panadapterController: Accessor<PanadapterController>;
  panafallBounds: ReturnType<typeof createElementBounds>;
  pxPerMHz: Accessor<number>;
  pxToMHz: (px: number) => number;
  sizeRef: Accessor<HTMLElement | undefined>;
  setSizeRef: (el: HTMLElement) => void;
  slices: Accessor<Slice[]>;
  waterfall: Accessor<Waterfall>;
  waterfallController: Accessor<WaterfallController>;
  xToFreq: (x: number) => number;
}>();

export const PanafallProvider: ParentComponent = (props) => {
  const { radio, state } = useFlexRadio();
  const { preferences } = usePreferences();
  const [sizeRef, setSizeRef] = createSignal<HTMLElement>();
  const [wakeLock, setWakeLock] = createSignal<WakeLockSentinel>();
  const panafallBounds = createElementBounds(sizeRef);
  const panadapter = createMemo(
    () => state.status.panadapter[state.selectedPanadapter],
  );
  const waterfall = createMemo(
    () => state.status.waterfall[panadapter()?.waterfallStreamId],
  );
  const panadapterController = createMemo(() =>
    radio()?.panadapter(panadapter()?.id),
  );
  const waterfallController = createMemo(() =>
    radio()?.waterfall(waterfall()?.id),
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
    return px * mhzPerPx();
  };

  const xToFreq = (x: number) => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    const centerFreq = pan.centerFrequencyMHz;
    const offsetMHz = pxToMHz(x - pan.width / 2);
    return centerFreq + offsetMHz;
  };

  const freqToX = (freq: number) => {
    const pan = panadapter();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    const centerFreq = pan.centerFrequencyMHz;
    const offsetMHz = freq - centerFreq;
    return pan.width / 2 + mhzToPx(offsetMHz);
  };

  createEffect(() => {
    if (!(preferences.preventScreenSleep && state.clientHandle))
      return wakeLock()?.release();
    if (wakeLock()?.released !== false) {
      navigator.wakeLock?.request("screen").then(setWakeLock);
    }
  });

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
          setSizeRef,
          sizeRef,
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
