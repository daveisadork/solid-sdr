import {
  createContext,
  createMemo,
  type ParentComponent,
  Show,
  useContext,
  type Accessor,
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

const PanafallContext = createContext<{
  panadapter: Accessor<Panadapter>;
  waterfall: Accessor<Waterfall>;
  panadapterController: Accessor<PanadapterController>;
  waterfallController: Accessor<WaterfallController>;
  slices: Accessor<Slice[]>;
  activeSlice: Accessor<Slice | undefined>;
  pxPerMHz: Accessor<number>;
  mhzPerPx: Accessor<number>;
  pxToMHz: (px: number) => number;
  mhzToPx: (mhz: number) => number;
  xToFreq: (x: number) => number;
  freqToX: (freq: number) => number;
}>();

export const PanafallProvider: ParentComponent = (props) => {
  const { radio, state } = useFlexRadio();
  const panadapter = createMemo(
    () => state.status.panadapter[state.selectedPanadapter],
  );
  const waterfall = createMemo(
    () => state.status.waterfall[panadapter()?.waterfallStreamId],
  );
  const panadapterController = () => radio()?.panadapter(panadapter()?.id);
  const waterfallController = () => radio()?.waterfall(waterfall()?.id);
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
          panadapter,
          waterfall,
          panadapterController,
          waterfallController,
          slices,
          activeSlice,
          pxPerMHz,
          mhzPerPx,
          pxToMHz,
          mhzToPx,
          xToFreq,
          freqToX,
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
