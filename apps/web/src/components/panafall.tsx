import useFlexRadio from "~/context/flexradio";
import { Resizable, ResizablePanel } from "./ui/resizable";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  Show,
  onCleanup,
} from "solid-js";
import { Panadapter } from "./panadapter";
import { Waterfall } from "./waterfall";
import { Scale } from "./scale";
import { createMousePosition } from "@solid-primitives/mouse";
import { createPointerListeners } from "@solid-primitives/pointer";
import { debounce } from "@solid-primitives/scheduled";
import { createStore } from "solid-js/store";
import ArrowCollapseHorizontal from "~icons/mdi/arrow-collapse-horizontal";
import ArrowExpandHorizontal from "~icons/mdi/arrow-expand-horizontal";
import Fullscreen from "~icons/mdi/fullscreen";
import FullscreenExit from "~icons/mdi/fullscreen-exit";
import ThemeLightDark from "~icons/mdi/theme-light-dark";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  createLocalStorageManager,
  useColorMode,
} from "@kobalte/core/color-mode";
import { frequencyToLabel, roundToDecimals } from "~/lib/utils";
import { createFullscreen } from "@solid-primitives/fullscreen";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuCheckboxItem,
} from "./ui/context-menu";
import { createElementBounds } from "@solid-primitives/bounds";
import { Portal } from "solid-js/web";
import { usePanafall } from "~/context/panafall";

export function Panafall() {
  const { colorMode, setColorMode } = useColorMode();
  const storageManager = createLocalStorageManager("vite-ui-theme");
  const themeSequence = ["system", "light", "dark"] as const;
  const [modePreference, setModePreference] = createSignal<
    (typeof themeSequence)[number]
  >(storageManager.get("system") ?? "dark");

  createEffect(() => {
    const preference = modePreference();
    storageManager.set(preference);
    setColorMode(preference);
  });

  createEffect(() => {
    if (modePreference() !== "system") return;
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setColorMode(media.matches ? "dark" : "light");
    sync();
    media.addEventListener("change", sync);
    onCleanup(() => media.removeEventListener("change", sync));
  });

  const cycleTheme = () => {
    const currentPref = modePreference();
    const index = themeSequence.indexOf(currentPref);
    const next = themeSequence[(index + 1) % themeSequence.length];
    setModePreference(next);
  };

  const { radio, state, setState } = useFlexRadio();
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(() => document.documentElement, fs);
  const [clickRef, setClickRef] = createSignal<HTMLElement>();
  const [sizeRef, setSizeRef] = createSignal<HTMLElement>();

  const [dragState, setDragState] = createStore({
    down: false,
    dragging: false,
    downX: 0,
    originX: 0,
    originFreq: 0,
    offset: 0,
  });
  const pos = createMousePosition(clickRef);
  const panafallBounds = createElementBounds(sizeRef);

  const {
    panadapter,
    waterfall,
    panadapterController,
    waterfallController,
    pxPerMHz,
    pxToMHz,
    mhzToPx,
    xToFreq,
  } = usePanafall();

  createEffect(() => setFullscreen(fullscreen()));

  const _setPanCenter = (newCenter: number) => {
    newCenter = parseFloat(newCenter.toFixed(6));
    if (newCenter === panadapter()?.centerFrequencyMHz) {
      if (!dragState.down) setDragState("originX", 0);
      return;
    }
    panadapterController()?.setCenterFrequency(newCenter);
  };

  // eslint-disable-next-line solid/reactivity
  const _setPanCenterDebounced = debounce(_setPanCenter, 100);

  const setPanCenter = (newCenter: number, debounce: boolean = false) => {
    if (debounce) {
      return _setPanCenterDebounced(newCenter);
    }
    _setPanCenterDebounced.clear();
    return _setPanCenter(newCenter);
  };

  const finalizeDrag = (event: PointerEvent) => {
    if (event.button !== 0 && event.type !== "pointerleave") return;
    if (!dragState.down) return;
    batch(() => {
      setDragState("down", false);
      if (!dragState.dragging) {
        setDragState("originX", 0);
        return;
      }
      setDragState("dragging", false);
      if (!state.display.smoothScroll) {
        setDragState("originX", 0);
        return;
      }
      const newOffset = event.x - dragState.originX;
      const freq = dragState.originFreq - pxToMHz(newOffset);
      setPanCenter(freq);
    });
  };

  createPointerListeners({
    target: clickRef,
    onDown({ button, x }) {
      if (button !== 0) return; // Only left mouse button

      setDragState({
        down: true,
        downX: x,
        originFreq: panadapter()?.centerFrequencyMHz,
      });
    },
    onMove(event) {
      if (!dragState.down) return;
      if (!dragState.dragging) {
        setDragState({
          dragging: true,
          originX: dragState.originX || dragState.downX,
        });
      }
      const newOffset = event.x - dragState.originX;
      const freq = dragState.originFreq - pxToMHz(newOffset);
      if (state.display.smoothScroll) {
        setDragState("offset", newOffset);
      }
      setPanCenter(freq, state.display.smoothScroll);
    },
    onUp: finalizeDrag,
    onLeave: finalizeDrag,
  });

  const updateScroll = (prevCenter: number, newCenter: number) => {
    if (dragState.offset === 0) {
      return;
    }
    const deltaPx = mhzToPx(newCenter - prevCenter);
    let offset = state.display.smoothScroll
      ? Math.round(dragState.offset + deltaPx)
      : 0;
    let originX = dragState.down ? dragState.originX - deltaPx : 0;
    if (Math.abs(deltaPx) > (panafallBounds.width ?? 0)) {
      // this typically happens when changing bands
      offset = 0;
      originX = (panafallBounds.width ?? 0) / 2;
    }
    setDragState({ offset, originX, originFreq: newCenter });
  };

  createEffect((prev?: { center?: number; pxPerMHz?: number }) => {
    const prevCenter = prev?.center;
    const prevPxPerMHz = prev?.pxPerMHz;
    const newCenter = panadapter()?.centerFrequencyMHz;
    if (prevPxPerMHz !== pxPerMHz()) {
      // bandwidth changed or screen resize
      setDragState("offset", 0);
    } else if (prevCenter && newCenter && prevCenter !== newCenter) {
      updateScroll(prevCenter, newCenter);
    }
    return { center: newCenter, pxPerMHz: pxPerMHz() };
  });

  return (
    <>
      <div
        class="absolute inset-0 overflow-visible"
        style={{
          "--panafall-available-width": `${panafallBounds.width}px`,
          "--panafall-available-height": `${panafallBounds.height}px`,
          "--panafall-left": `${panafallBounds.left}px`,
          "--panafall-top": `${panafallBounds.top}px`,
          "--panafall-right": `${panafallBounds.right}px`,
          "--panafall-bottom": `${panafallBounds.bottom}px`,

          "--drag-offset": `${dragState.offset}px`,
        }}
      >
        <Show when={panadapter()}>
          {(pan) => (
            <Show when={waterfall()}>
              <div class="absolute top-0 left-0 w-dvw h-dvh overflow-clip select-none">
                <Resizable
                  class="size-full overflow-clip select-none"
                  orientation="vertical"
                >
                  <ResizablePanel
                    class="overflow-clip select-none"
                    initialSize={0.25}
                  >
                    <Panadapter
                      pan={pan()}
                      waterfall={waterfall()}
                      controller={panadapterController()}
                    />
                  </ResizablePanel>
                  <Scale pan={pan()} />
                  <ResizablePanel
                    class="overflow-clip select-none"
                    initialSize={0.75}
                  >
                    <Waterfall
                      pan={pan()}
                      waterfall={waterfall()}
                      controller={waterfallController()}
                    />
                  </ResizablePanel>
                </Resizable>
                {/* <Show when={state.selectedPanadapter} keyed> */}
                {/*   {(streamId) => <TabToSignal streamId={streamId} />} */}
                {/* </Show> */}
                <ContextMenu>
                  <ContextMenuTrigger
                    classList={{
                      "cursor-grabbing": dragState.dragging,
                      "cursor-crosshair": !dragState.dragging,
                    }}
                    class="absolute inset-0 select-none"
                    onDblClick={(e: PointerEvent) => {
                      if (dragState.dragging) return;
                      setDragState("originX", 0);
                      // const { bandwidthMHz, centerFrequencyMHz, width } = pan();
                      // const rect = clickRef().getBoundingClientRect();
                      // const x = Math.max(
                      //   0,
                      //   Math.min(e.clientX - rect.left, width - 1),
                      // );
                      // const mhzPerPx = bandwidthMHz / width;
                      // const freq = (
                      //   centerFrequencyMHz +
                      //   (x - width / 2) * mhzPerPx
                      // ).toFixed(3);
                      const freq = roundToDecimals(xToFreq(e.clientX), 3);
                      panadapterController()?.clickTune(freq);
                    }}
                    ref={setClickRef}
                  />
                  <ContextMenuPortal>
                    <ContextMenuContent>
                      <ContextMenuCheckboxItem
                        checked={state.settings.showTuningGuide}
                        onChange={(checked) => {
                          setState("settings", "showTuningGuide", checked);
                        }}
                      >
                        Show Tuning Guide
                      </ContextMenuCheckboxItem>
                      <ContextMenuItem
                        onClick={() => {
                          radio().requestSlice({
                            panadapterStreamId: pan().streamId,
                            frequencyMHz: roundToDecimals(xToFreq(pos.x), 3),
                          });
                        }}
                      >
                        Create Slice
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenuPortal>
                </ContextMenu>
              </div>
              <Portal mount={sizeRef()}>
                <div class="absolute bottom-2 left-2 grid grid-cols-2 gap-0.5 text-xs">
                  <Tooltip>
                    <TooltipTrigger
                      as={Button}
                      size="icon"
                      variant="ghost"
                      class="size-5"
                      classList={{
                        "fancy-bg-background": !pan().isBandZoomOn,
                        "fancy-bg-primary text-primary-foreground":
                          pan().isBandZoomOn,
                      }}
                      onClick={() =>
                        panadapterController()?.setBandZoom(!pan().isBandZoomOn)
                      }
                    >
                      B
                    </TooltipTrigger>
                    <TooltipContent>Band Zoom</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      as={Button}
                      size="icon"
                      variant="ghost"
                      class="size-5"
                      classList={{
                        "fancy-bg-background": !pan().isSegmentZoomOn,
                        "fancy-bg-primary text-primary-foreground":
                          pan().isSegmentZoomOn,
                      }}
                      onClick={() =>
                        panadapterController()?.setSegmentZoom(
                          !pan().isSegmentZoomOn,
                        )
                      }
                    >
                      S
                    </TooltipTrigger>
                    <TooltipContent>Segment Zoom</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      as={Button}
                      size="icon"
                      variant="ghost"
                      class="fancy-bg-background size-5"
                      onClick={() =>
                        panadapterController()?.setBandwidth(
                          pan().bandwidthMHz * 2,
                        )
                      }
                    >
                      <ArrowCollapseHorizontal />
                    </TooltipTrigger>
                    <TooltipContent>
                      Zoom Out (from {frequencyToLabel(pan().bandwidthMHz)} to{" "}
                      {frequencyToLabel(pan().bandwidthMHz * 2)})
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      as={Button}
                      size="icon"
                      variant="ghost"
                      class="fancy-bg-background size-5"
                      onClick={() =>
                        panadapterController()?.setBandwidth(
                          pan().bandwidthMHz / 2,
                        )
                      }
                    >
                      <ArrowExpandHorizontal />
                    </TooltipTrigger>
                    <TooltipContent>
                      Zoom In (from {frequencyToLabel(pan().bandwidthMHz)} to{" "}
                      {frequencyToLabel(pan().bandwidthMHz / 2)})
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div class="absolute bottom-2 right-12 flex gap-2">
                  <Tooltip>
                    <TooltipTrigger
                      as={Button}
                      size="icon"
                      variant="ghost"
                      class="fancy-bg-background size-5"
                      onClick={cycleTheme}
                      aria-label="Toggle theme"
                    >
                      <ThemeLightDark />
                    </TooltipTrigger>
                    <TooltipContent>
                      Theme: {modePreference()} ({colorMode()} active)
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      as={Button}
                      size="icon"
                      variant="ghost"
                      class="fancy-bg-background size-5"
                      onClick={() => setFullscreen(!fullscreen())}
                      aria-label={
                        fullscreen() ? "Exit fullscreen" : "Enter fullscreen"
                      }
                    >
                      <Show when={fullscreen()} fallback={<Fullscreen />}>
                        <FullscreenExit />
                      </Show>
                    </TooltipTrigger>
                    <TooltipContent>
                      {fullscreen() ? "Exit" : "Enter"} Fullscreen
                    </TooltipContent>
                  </Tooltip>
                </div>
              </Portal>
              <Show
                when={
                  state.settings.showTuningGuide && pos.sourceType === "mouse"
                }
              >
                <div
                  class="absolute inset-y-0 w-px translate-x-(--cursor-x) pointer-events-none will-change-transform backdrop-invert-100"
                  classList={{
                    "opacity-100": pos.isInside,
                    "opacity-0": !pos.isInside,
                  }}
                  style={{
                    "--cursor-x": `${pos.x}px`,
                  }}
                />
              </Show>
            </Show>
          )}
        </Show>
      </div>
      <div
        ref={setSizeRef}
        id="panafall-sizer"
        class="relative size-full pointer-events-none *:pointer-events-auto"
      />
    </>
  );
}
