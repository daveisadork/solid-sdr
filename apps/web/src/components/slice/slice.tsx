import { ToggleButton } from "@kobalte/core/toggle-button";
import type { SliceController } from "@repo/flexlib";
import { createPointerListeners } from "@solid-primitives/pointer";
import { createElementSize } from "@solid-primitives/resize-observer";
import type { Accessor, Component, ComponentProps, JSX } from "solid-js";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
  splitProps,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Portal } from "solid-js/web";
import { FrequencyInput } from "~/components/frequency-input";
import { LevelMeter } from "~/components/level-meter";
import { Separator } from "~/components/ui/separator";
import { TxMeter } from "~/components/ui/tx-meter";
import { type SliceSelector, useControls } from "~/context/controls";
import useFlexRadio, {
  type MeterState,
  type PanadapterState,
  type SliceState,
} from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";
import { usePreferences } from "~/context/preferences";
import { useRuntime } from "~/context/runtime";
import { ceilToDevicePixels, cn } from "~/lib/utils";
import SplitIcon from "~icons/material-symbols/split-scene-left-outline";
import SwapIcon from "~icons/material-symbols/swap-horiz";
import { RxAntennaSelect, TxAntennaSelect } from "./controls/antenna-select";
import { AudioControls } from "./controls/audio-controls";
import { DaxChannelSelect } from "./controls/dax-channel-select";
import { ExtraSliceControls } from "./controls/extra-slice-controls";
import { SliceFilter } from "./controls/filter-controls";
import { ModeControls } from "./controls/mode-controls";
import { OptDspControls } from "./controls/opt-dsp-controls";
import { RitControls } from "./controls/rit-controls";
import { SliceSettings } from "./controls/slice-settings";

const Triangle: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class", "style"]);
  return (
    <div
      class={cn("h-1.5 aspect-[2]", local.class)}
      style={{
        "clip-path": "polygon(50% 100%,100% 0,0 0)",
        ...(local.style as JSX.CSSProperties),
      }}
      {...others}
    />
  );
};

export function Slice(props: {
  slice: SliceState;
  pan: PanadapterState;
  sliceController: Accessor<SliceController>;
}) {
  const { state } = useFlexRadio();
  const {
    pxToMHz,
    panadapterController,
    freqToX,
    mhzToAnchorPx,
    clientXToCellX,
    visibleInsets,
    settledInsets,
    isSliceDetached,
    sliceAnchorX,
    visualAnchorX,
    panadapterWrapperSize,
    panafallPortalRef,
  } = usePanafall();
  const sliceController = () => props.sliceController();
  const [flag, setFlag] = createSignal<HTMLElement>();
  const [filterWidth, setFilterWidth] = createSignal(0);
  const [filterOffset, setFilterOffset] = createSignal(0);
  const [txFilterWidth, setTxFilterWidth] = createSignal(0);
  const [txFilterOffset, setTxFilterOffset] = createSignal(0);
  const [dragState, setDragState] = createStore({
    dragging: false,
    originX: 0,
    originFreq: 0,
    offset: 0,
    contain: 0,
  });
  const flagSize = createElementSize(flag);
  const { preferences } = usePreferences();
  const { runtime, setRuntime } = useRuntime();
  const { dispatch } = useControls();
  const [compactLayout, setCompactLayout] = createSignal(false);

  const splitParent = createMemo(() => {
    const parent = runtime.split[props.slice.id]?.parent;
    return parent != null ? state.status.slice[parent] : null;
  });

  const splitChild = createMemo(() => {
    const child = runtime.split[props.slice.id]?.child;
    return child != null ? state.status.slice[child] : null;
  });

  const splitPartner = () => splitParent() || splitChild();

  const splitDisabled = createMemo(() => {
    if (!state.status.radio.availableSlices) {
      return !splitChild();
    }
    return props.slice.diversityChild;
  });

  const diversityParent = createMemo(() => {
    if (!props.slice.diversityChild) return;
    return state.status.slice[props.slice.diversityIndex.toString()];
  });

  const isActive = createMemo(() => {
    return diversityParent()?.isActive ?? props.slice.isActive;
  });

  const levelMeter = createMemo(() => {
    const sliceIndex = Number(props.slice.id);
    for (const meterId in state.status.meter) {
      const meter: MeterState = state.status.meter[meterId];
      if (
        meter &&
        meter.source === "SLC" &&
        meter.sourceIndex === sliceIndex &&
        meter.name === "LEVEL"
      ) {
        return meter;
      }
    }
  });

  // Effect-mirrored so flagSide never pairs a new center frequency with the
  // not-yet-rebased dragOffset (rebasing happens in a Panafall effect) —
  // that transient would latch a spurious side flip.
  const [anchorX, setAnchorX] = createSignal(0);
  createEffect(() => setAnchorX(visualAnchorX(props.slice)));

  // Hysteresis reducer: keeps the current side until the flag would poke past
  // a visible edge, then flips to whichever side has more room.
  const flagSide = createMemo<"left" | "right">((side) => {
    if (props.slice.diversityParent) return "left";
    if (props.slice.diversityChild) return "right";

    const partnerFreqMHz = splitPartner()?.frequencyMHz;
    if (partnerFreqMHz !== undefined) {
      if (partnerFreqMHz > props.slice.frequencyMHz) return "left";
      if (partnerFreqMHz < props.slice.frequencyMHz) return "right";
    }

    const width = panadapterWrapperSize.width ?? 0;
    if (!width) return side;
    const insets = settledInsets();
    const x = anchorX();
    const flagWidth = flagSize.width ?? 0;
    const visRight = width - insets.right;
    const flagLeft = side === "left" ? x - flagWidth : x;
    const flagRight = side === "left" ? x : x + flagWidth;
    if (flagLeft < insets.left || flagRight > visRight) {
      return visRight - x >= x - insets.left ? "right" : "left";
    }
    return side;
  }, "left");

  createPointerListeners({
    onMove({ x }) {
      if (!dragState.dragging) return;
      const localX = clientXToCellX(x);
      const newOffset = dragState.originX - localX;

      // Round frequency to the nearest step
      const step = props.slice.tuneStepHz / 1e6; // Convert Hz to MHz
      const freqUnrounded = dragState.originFreq - pxToMHz(newOffset);
      const freqSteps = Math.round(freqUnrounded / step);
      const freq = freqSteps * step;

      if (freq === props.slice.frequencyMHz) {
        return;
      }

      const insets = visibleInsets();
      const offsetX = localX - insets.left;
      const xPercent = offsetX / insets.width;
      if (xPercent < 0.05 || xPercent > 0.95) {
        setDragState({
          contain: freq < props.pan.centerFrequencyMHz ? -1 : 1,
        });
        return;
      }

      setDragState("contain", 0);
      sliceController().setFrequency(freq, false);
    },
    onUp() {
      setDragState({ dragging: false, contain: 0 });
    },
    onLeave() {
      setDragState({ dragging: false, contain: 0 });
    },
  });

  createEffect(() => {
    if (!dragState.contain) return;
    const pan = panadapterController();
    const slice = sliceController();
    const stepMHz = (slice.tuneStepHz / 1e6) * dragState.contain;
    const xOffsetPx = filterWidth() / 2;

    const interval = setInterval(() => {
      const newSliceFreq = slice.frequencyMHz + stepMHz;
      batch(() => {
        pan.setCenterFrequency(pan.centerFrequencyMHz + stepMHz);
        slice.setFrequency(newSliceFreq, false);
      });
      setDragState({
        originFreq: newSliceFreq,
        originX: freqToX(newSliceFreq) + xOffsetPx,
      });
    }, 20);
    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    const txFilterLow =
      props.slice.mode === "CW"
        ? -50
        : ["USB", "DIGU", "FDVU"].includes(props.slice.mode)
          ? state.status.radio.txFilterLowHz
          : -state.status.radio.txFilterHighHz;
    const txFilterHigh =
      props.slice.mode === "CW"
        ? 50
        : ["LSB", "DIGL", "FDVL", "RTTY"].includes(props.slice.mode)
          ? -state.status.radio.txFilterLowHz
          : state.status.radio.txFilterHighHz;

    batch(() => {
      setFilterWidth(
        mhzToAnchorPx(
          (props.slice.filterHighHz - props.slice.filterLowHz) / 1e6,
        ),
      );
      setFilterOffset(mhzToAnchorPx(props.slice.filterLowHz / 1e6));
      setTxFilterWidth(mhzToAnchorPx((txFilterHigh - txFilterLow) / 1e6));
      setTxFilterOffset(
        mhzToAnchorPx(
          (props.slice.mode === "RTTY"
            ? props.slice.rttyMarkHz + txFilterLow
            : txFilterLow) / 1e6,
        ),
      );
    });
  });

  const tuneSlice = async (hz: number) => {
    if (!Number.isFinite(hz)) {
      return;
    }
    const freqMhz = hz / 1e6;
    if (Math.abs(freqMhz - props.slice.frequencyMHz) < 1e-9) {
      return;
    }
    try {
      await sliceController()?.setFrequency(freqMhz);
    } catch {
      // Ignore errors; the UI will reflect the previous baseline frequency.
    }
  };

  const makeActive = async () => {
    if (isActive()) return;
    sliceController()?.setActive(true);
  };

  createEffect(() => {
    // we have to compute and set the tx offset since the radio doesn't do it for us.
    const ctrl = sliceController();
    if (!props.slice.mode.endsWith("FM")) {
      ctrl.setTxOffsetFrequency(0);
      return;
    }
    switch (props.slice.repeaterOffsetDirection) {
      case "UP":
        ctrl.setTxOffsetFrequency(Math.abs(props.slice.fmRepeaterOffsetMHz));
        break;
      case "DOWN":
        ctrl.setTxOffsetFrequency(-Math.abs(props.slice.fmRepeaterOffsetMHz));
        break;
      default:
        ctrl.setTxOffsetFrequency(0);
    }
  });

  return (
    <Show when={!isSliceDetached(props.slice)}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard activation is handled via focus on child controls */
      /* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard activation is handled via focus on child controls */}
      <div
        class="absolute inset-y-0 translate-x-(--slice-offset) z-(--z-cell-overlays)"
        classList={{
          "translate-z-1": isActive(),
          "pointer-events-auto": !props.slice.diversityChild,
        }}
        style={{
          "--slice-offset": `${sliceAnchorX(props.slice)}px`,
        }}
        onClick={makeActive}
      >
        <Show when={!props.slice.diversityChild}>
          <div
            class="absolute inset-y-0 pointer-coarse:w-10 -translate-x-1/2 touch-none"
            classList={{
              "cursor-grab": !dragState.dragging,
              "cursor-grabbing": dragState.dragging,
            }}
            onPointerDown={(event) => {
              setDragState({
                dragging: true,
                originX: clientXToCellX(event.clientX),
                originFreq: props.slice.frequencyMHz,
                offset: 0,
              });
              makeActive();
            }}
          >
            <div class="absolute inset-y-0 left-1/2">
              <Show
                when={
                  preferences.showTxFilterInPan && props.slice.isTransmitEnabled
                }
              >
                <div
                  class="absolute inset-y-0 overflow-clip translate-x-(--tx-filter-offset) w-(--tx-filter-width) bg-radial from-red-500/25 to-red-500/20"
                  style={{
                    "--tx-filter-width": `${txFilterWidth()}px`,
                    "--tx-filter-offset": `${txFilterOffset()}px`,
                  }}
                >
                  <div class="absolute inset-0 border-x border-x-background/40" />
                </div>
              </Show>
              <div
                class="absolute inset-y-0 overflow-clip translate-x-(--filter-offset) w-(--filter-width) bg-radial from-sky-500/35 to-sky-500/25"
                style={{
                  "--filter-width": `${filterWidth()}px`,
                  "--filter-offset": `${filterOffset()}px`,
                }}
              >
                <div class="absolute inset-0 border-x border-x-background/40" />
              </div>
            </div>
          </div>
        </Show>
        <div
          class="absolute inset-y-0 max-w-px w-px flex flex-col items-center m-auto top-0 pointer-events-none"
          classList={{
            "bg-yellow-300 z-10": props.slice.isActive,
            "bg-red-500 -z-10":
              !props.slice.isActive && !props.slice.diversityChild,
          }}
        >
          <Show when={props.slice.isActive}>
            <Triangle
              class="relative top-0"
              classList={{
                "bg-red-500 -z-10": props.slice.diversityChild,
                "bg-yellow-300": !props.slice.diversityChild,
              }}
            />
            <Show when={props.slice.diversityEnabled}>
              <Triangle
                class="relative -translate-y-1/2"
                classList={{
                  "bg-red-500 -z-10 -translate-z-1":
                    props.slice.diversityParent,
                  "bg-yellow-300": props.slice.diversityChild,
                }}
              />
            </Show>
          </Show>
        </div>
        <Portal mount={panafallPortalRef()}>
          <div
            class="absolute top-0 left-0 w-0 max-w-0 translate-x-(--flag-offset) overflow-visible"
            classList={{
              "z-(--z-cell-flags)": isActive(),
              "z-(--z-cell-overlays)": !isActive(),
            }}
            style={{
              "--flag-offset": `calc(var(--drag-offset) + ${sliceAnchorX(props.slice)}px)`,
            }}
          >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-events-none panel; onMouseDown only stops propagation from children, not user interaction */}
            <div
              class="absolute top-0 pt-1 pb-4 z-20 overflow-visible pointer-events-none"
              classList={{
                "left-px": flagSide() === "right",
                "right-0": flagSide() === "left",
              }}
              style={{
                // Quantize the box width to the device pixel grid so both
                // edges land on device pixels; the ≤1-device-px slack sits at
                // the far edge (inner is marker-side-pinned).
                width: flagSize.width
                  ? `${ceilToDevicePixels(flagSize.width)}px`
                  : undefined,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                class="w-max px-1"
                classList={{ "ml-auto": flagSide() === "left" }}
                ref={setFlag}
              >
                <Show
                  when={!compactLayout()}
                  fallback={
                    <div
                      class="flex items-center gap-1 flex-row-reverse"
                      classList={{
                        "flex-row-reverse": flagSide() === "right",
                      }}
                    >
                      <span class="font-mono font-normal text-xl text-shadow-black text-shadow-sm">
                        {(props.slice.frequencyMHz * 1_000_000).toLocaleString(
                          "de-DE",
                        )}
                      </span>
                      <div class="flex flex-col items-center pointer-events-auto text-xs border rounded-sm overflow-clip font-extrabold">
                        <ToggleButton
                          pressed={compactLayout()}
                          onChange={setCompactLayout}
                          class="flex justify-around items-center bg-blue-500 p-0.5 w-full"
                        >
                          <span class="textbox-edge-cap-alphabetic textbox-trim-both">
                            {props.slice.indexLetter}
                          </span>
                        </ToggleButton>
                        <Separator />
                        <ToggleButton
                          class="flex justify-center items-center p-0.5 text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground font-stretch-ultra-condensed"
                          pressed={props.slice.isTransmitEnabled}
                          onChange={(pressed) => {
                            sliceController().enableTransmit(pressed);
                          }}
                        >
                          <span class="leading-tight textbox-trim-both textbox-edge-cap-alphabetic">
                            TX
                          </span>
                        </ToggleButton>
                      </div>
                    </div>
                  }
                >
                  <div
                    class="flex gap-0.5 pointer-events-auto"
                    classList={{ "flex-row-reverse": flagSide() === "right" }}
                  >
                    <Show when={!props.slice.diversityChild}>
                      <ExtraSliceControls
                        slice={props.slice}
                        controller={sliceController()}
                      />
                    </Show>
                    <div
                      class="h-fit border rounded-md overflow-hidden flex flex-col p-1.5 gap-1 pointer-events-auto text-sm font-mono drop-shadow-black fancy-bg-background"
                      classList={{
                        "drop-shadow-lg": isActive(),
                        "drop-shadow-md": !isActive(),
                      }}
                    >
                      <div
                        class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-md"
                        classList={{
                          "bg-background/25": !isActive(),
                        }}
                      />
                      <div class="flex justify-between items-center gap-1">
                        <RxAntennaSelect
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <TxAntennaSelect
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <SliceFilter
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <Show when={!splitParent()}>
                          <ToggleButton
                            disabled={splitDisabled()}
                            class="flex justify-center items-center h-4.5 px-1 rounded-sm text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            pressed={Boolean(splitChild())}
                            onChange={(pressed) =>
                              dispatch({
                                target: "slice.split.enabled",
                                slice: props.slice.indexLetter as SliceSelector,
                                op: "set",
                                value: pressed,
                              })
                            }
                          >
                            <SplitIcon />
                          </ToggleButton>
                        </Show>
                        <Show when={splitParent()}>
                          <ToggleButton
                            class="flex justify-center items-center h-4.5 px-1 rounded-sm text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground"
                            pressed={Boolean(splitChild())}
                            onChange={() =>
                              dispatch({
                                target: "slice.split.swap",
                                slice: props.slice.indexLetter as SliceSelector,
                              })
                            }
                          >
                            <SwapIcon />
                          </ToggleButton>
                        </Show>
                        <ToggleButton
                          class="flex justify-center items-center h-4.5 font-extrabold px-1 rounded-sm text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground"
                          pressed={props.slice.isTransmitEnabled}
                          onChange={(pressed) => {
                            sliceController().enableTransmit(pressed);
                          }}
                        >
                          <span class="leading-tight textbox-trim-both textbox-edge-cap-alphabetic">
                            TX
                          </span>
                        </ToggleButton>
                        <ToggleButton
                          pressed={compactLayout()}
                          onChange={setCompactLayout}
                          class="flex items-center bg-blue-500 h-4.5 px-1 rounded-sm"
                        >
                          <span class="font-extrabold textbox-edge-cap-alphabetic textbox-trim-both">
                            {props.slice.indexLetter}
                          </span>
                        </ToggleButton>
                      </div>
                      <Show when={!props.slice.diversityChild}>
                        <div class="flex justify-between items-center">
                          <ModeControls
                            slice={props.slice}
                            controller={sliceController()}
                          />
                          <FrequencyInput
                            class="text-right bg-transparent text-lg/tight font-mono"
                            size={14}
                            valueHz={Math.round(props.slice.frequencyMHz * 1e6)}
                            onCommit={tuneSlice}
                            // `on:touchstart` binds directly to the element
                            // (non-passive); the camelCase `onTouchStart` is
                            // delegated to document, where Chrome forces passive
                            // and preventDefault() is ignored. We need
                            // preventDefault to open the panel instead of
                            // focusing the input (which pops the soft keyboard).
                            // Fires only on touch, so mouse/pen keep inline edit.
                            on:touchstart={(event) => {
                              event.preventDefault();
                              makeActive();
                              setRuntime("tuningPanelOpen", true);
                            }}
                          />
                        </div>
                      </Show>
                      <div
                        classList={{
                          hidden:
                            props.slice.isTransmitEnabled &&
                            state.status.radio.interlockTxClientHandle ===
                              state.clientHandleInt,
                        }}
                      >
                        <LevelMeter
                          meter={levelMeter()}
                          compressionFactor={0.6}
                          compressionThreshold={-73}
                        />
                      </div>
                      <Show when={props.slice.isTransmitEnabled}>
                        <div
                          classList={{
                            hidden:
                              state.status.radio.interlockTxClientHandle !==
                              state.clientHandleInt,
                          }}
                        >
                          <TxMeter />
                        </div>
                      </Show>
                      <div class="grid grid-cols-5  text-xs h-3.5 font-medium justify-evenly *:flex *:justify-center *:items-center *:h-full *:basis-0 *:grow *:shrink *:min-w-0">
                        <AudioControls
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <OptDspControls
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <RitControls
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <DaxChannelSelect
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <SliceSettings
                          slice={props.slice}
                          controller={sliceController()}
                        />
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </Portal>
      </div>
    </Show>
  );
}
