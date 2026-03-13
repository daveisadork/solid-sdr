import useFlexRadio from "~/context/flexradio";
import { Resizable, ResizablePanel } from "./ui/resizable";
import {
  batch,
  createEffect,
  createSignal,
  Show,
  onCleanup,
  JSX,
  ComponentProps,
  splitProps,
  ValidComponent,
  Switch,
  Match,
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
import LightMode from "~icons/material-symbols/light-mode-outline";
import DarkMode from "~icons/material-symbols/dark-mode-outline";
import MaterialSymbolsAddCommentOutlineRounded from "~icons/material-symbols/add-comment-outline-rounded";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  createLocalStorageManager,
  useColorMode,
} from "@kobalte/core/color-mode";
import { cn, frequencyToLabel, roundToDecimals } from "~/lib/utils";
import { createFullscreen } from "@solid-primitives/fullscreen";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuCheckboxItem,
} from "./ui/context-menu";
import { Portal } from "solid-js/web";
import { usePanafall } from "~/context/panafall";
import { createWindowSize } from "@solid-primitives/resize-observer";
import { usePreferences } from "~/context/preferences";
import { Toggle } from "./ui/toggle";

type PanafallButtonProps<T extends ValidComponent = "button"> = ComponentProps<
  typeof TooltipTrigger<T>
> &
  ComponentProps<typeof Button<T>> & {
    tooltip?: JSX.Element;
    class?: JSX.ElementClass;
  };

export function PanafallButton(props: PanafallButtonProps) {
  const [local, others] = splitProps(props, ["class", "tooltip"]);
  return (
    <Tooltip>
      <TooltipTrigger
        as={Button}
        size="icon"
        variant="ghost"
        class={cn(
          "aspect-square fancy-bg-background not-pointer-coarse:size-5 pointer-coarse:border",
          local.class,
        )}
        {...others}
      />
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
}

type PanafallToggleButtonProps = ComponentProps<typeof TooltipTrigger> &
  ComponentProps<typeof Toggle> & {
    tooltip?: JSX.Element;
    class?: JSX.ElementClass;
  };

export function PanafallToggleButton(props: PanafallToggleButtonProps) {
  const [local, others] = splitProps(props, ["class", "tooltip"]);
  return (
    <Tooltip>
      <TooltipTrigger
        as={Toggle}
        size="icon"
        variant="ghost"
        class={cn(
          "aspect-square not-pointer-coarse:size-5 pointer-coarse:border fancy-bg-background data-pressed:fancy-bg-primary data-pressed:text-primary-foreground",
          local.class,
        )}
        {...others}
      />
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
}

export function Panafall() {
  const { preferences, setPreferences } = usePreferences();
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

  const { radio } = useFlexRadio();
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(() => document.documentElement, fs);
  const [clickRef, setClickRef] = createSignal<HTMLElement>();

  const [dragState, setDragState] = createStore({
    down: false,
    dragging: false,
    downX: 0,
    originX: 0,
    originFreq: 0,
    offset: 0,
  });
  const pos = createMousePosition(clickRef);
  const windowSize = createWindowSize();

  const {
    panadapter,
    waterfall,
    panadapterController,
    waterfallController,
    pxPerMHz,
    pxToMHz,
    mhzToPx,
    xToFreq,
    sizeRef,
    setSizeRef,
    panafallBounds,
  } = usePanafall();

  createEffect(() => setFullscreen(fullscreen()));
  createEffect(
    (lastSize: { width: number; height: number }) => {
      if (
        windowSize.width !== lastSize.width ||
        windowSize.height !== lastSize.height
      ) {
        setDragState({
          down: false,
          dragging: false,
          downX: 0,
          originX: 0,
          originFreq: 0,
          offset: 0,
        });
      }
      return { ...windowSize };
    },
    { width: 0, height: 0 },
  );

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

  const fitPanadapterToPanafallBounds = () => {
    const pan = panadapter();
    const boundsWidth = panafallBounds.width;
    const boundsLeft = panafallBounds.left;

    const fullWidth = pan.width;
    const currentCenter = pan.centerFrequencyMHz;
    const currentBandwidth = pan.bandwidthMHz;

    const targetBandwidth = (currentBandwidth * fullWidth) / boundsWidth;
    const targetMhzPerPixel = targetBandwidth / fullWidth;
    const boundsCenterX = boundsLeft + boundsWidth / 2;
    const targetCenter =
      currentCenter - (boundsCenterX - fullWidth / 2) * targetMhzPerPixel;

    panadapterController().update({
      centerFrequencyMHz: targetCenter,
      bandwidthMHz: targetBandwidth,
    });
  };

  const expandPanafallBoundsToFullPanadapter = () => {
    const pan = panadapter();
    const boundsWidth = panafallBounds.width;
    const boundsLeft = panafallBounds.left;

    const fullWidth = pan.width;
    const currentCenter = pan.centerFrequencyMHz;
    const currentBandwidth = pan.bandwidthMHz;
    const mhzPerPixel = currentBandwidth / fullWidth;
    const boundsRight = boundsLeft + boundsWidth;
    const boundedLeftFrequency =
      currentCenter + (boundsLeft - fullWidth / 2) * mhzPerPixel;
    const boundedRightFrequency =
      currentCenter + (boundsRight - fullWidth / 2) * mhzPerPixel;

    const targetBandwidth = boundedRightFrequency - boundedLeftFrequency;
    const targetCenter = (boundedLeftFrequency + boundedRightFrequency) / 2;

    panadapterController().update({
      centerFrequencyMHz: targetCenter,
      bandwidthMHz: targetBandwidth,
    });
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
      if (!preferences.smoothScroll) {
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
      if (preferences.smoothScroll) {
        setDragState("offset", newOffset);
      }
      setPanCenter(freq, preferences.smoothScroll);
    },
    onUp: finalizeDrag,
    onLeave: finalizeDrag,
  });

  const updateScroll = (prevCenter: number, newCenter: number) => {
    if (dragState.offset === 0) {
      return;
    }
    const deltaPx = mhzToPx(newCenter - prevCenter);
    let offset = preferences.smoothScroll
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
    <div
      class="size-full"
      classList={{
        relative: !preferences.enableTransparencyEffects,
      }}
      ref={setSizeRef}
    >
      <div
        class="absolute overflow-visible"
        classList={{
          "top-0 left-0 w-dvw h-dvh": preferences.enableTransparencyEffects,
          "inset-0": !preferences.enableTransparencyEffects,
        }}
        style={{
          "--panafall-available-width": `${panafallBounds.width}px`,
          "--panafall-available-height": `${panafallBounds.height}px`,
          "--panafall-left": `${preferences.enableTransparencyEffects ? panafallBounds.left : 0}px`,
          "--panafall-top": `${panafallBounds.top}px`,
          "--panafall-right": `${panafallBounds.right}px`,
          "--panafall-bottom": `${panafallBounds.bottom}px`,

          "--drag-offset": `${dragState.offset}px`,
        }}
      >
        <Show when={panadapter()}>
          {(pan) => (
            <Show when={waterfall()}>
              <div class="relative size-full overflow-clip select-none">
                <Resizable
                  class="size-full overflow-clip select-none"
                  orientation="vertical"
                  sizes={[
                    preferences.panadapterSize,
                    preferences.waterfallSize,
                  ]}
                  initialSizes={[0.25, 0.75]}
                  onSizesChange={(sizes) => {
                    if (sizes?.length !== 2) return;
                    const [panadapterSize, waterfallSize] = sizes;
                    setPreferences({ panadapterSize, waterfallSize });
                  }}
                >
                  <ResizablePanel class="overflow-clip select-none">
                    <Panadapter
                      pan={pan()}
                      waterfall={waterfall()}
                      controller={panadapterController()}
                    />
                  </ResizablePanel>
                  <Scale pan={pan()} />
                  <ResizablePanel class="overflow-clip select-none">
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
                      const freq = roundToDecimals(xToFreq(e.clientX), 3);
                      panadapterController()?.clickTune(freq);
                    }}
                    ref={setClickRef}
                  />
                  <ContextMenuPortal>
                    <ContextMenuContent>
                      <ContextMenuCheckboxItem
                        checked={preferences.showTuningGuide}
                        onChange={(checked) => {
                          setPreferences("showTuningGuide", checked);
                        }}
                      >
                        Show Tuning Guide
                      </ContextMenuCheckboxItem>
                      <ContextMenuItem
                        class="pl-8"
                        onClick={() => {
                          radio().requestSlice({
                            panadapterStreamId: pan().streamId,
                            frequencyMHz: roundToDecimals(xToFreq(pos.x), 3),
                          });
                        }}
                      >
                        <div class="absolute left-2 flex size-3.5 items-center justify-center">
                          <MaterialSymbolsAddCommentOutlineRounded />
                        </div>
                        Create Slice
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenuPortal>
                </ContextMenu>
              </div>
              <Portal mount={sizeRef()}>
                <div class="absolute bottom-2 left-2 grid grid-cols-2 gap-0.5 text-xs">
                  <PanafallToggleButton
                    pressed={pan().isBandZoomOn}
                    onChange={(pressed) =>
                      panadapterController()?.setBandZoom(pressed)
                    }
                    tooltip="Band Zoom"
                  >
                    B
                  </PanafallToggleButton>
                  <PanafallToggleButton
                    pressed={pan().isSegmentZoomOn}
                    onChange={(pressed) =>
                      panadapterController()?.setSegmentZoom(pressed)
                    }
                    tooltip="Segment Zoom"
                  >
                    S
                  </PanafallToggleButton>
                  <PanafallButton
                    onClick={() =>
                      panadapterController()?.setBandwidth(
                        pan().bandwidthMHz * 2,
                      )
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      fitPanadapterToPanafallBounds();
                    }}
                    tooltip={
                      <>
                        Zoom Out (from {frequencyToLabel(pan().bandwidthMHz)} to{" "}
                        {frequencyToLabel(pan().bandwidthMHz * 2)})
                      </>
                    }
                  >
                    <ArrowCollapseHorizontal />
                  </PanafallButton>
                  <PanafallButton
                    onClick={() =>
                      panadapterController()?.setBandwidth(
                        pan().bandwidthMHz / 2,
                      )
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      expandPanafallBoundsToFullPanadapter();
                    }}
                    tooltip={
                      <>
                        Zoom In (from {frequencyToLabel(pan().bandwidthMHz)} to{" "}
                        {frequencyToLabel(pan().bandwidthMHz / 2)})
                      </>
                    }
                  >
                    <ArrowExpandHorizontal />
                  </PanafallButton>
                </div>
                <div class="absolute bottom-2 right-12 flex gap-2">
                  <PanafallButton
                    onClick={cycleTheme}
                    aria-label="Toggle theme"
                    tooltip={
                      <>
                        Theme: {modePreference()} ({colorMode()} active)
                      </>
                    }
                  >
                    <Switch fallback={<ThemeLightDark />}>
                      <Match when={modePreference() === "light"}>
                        <LightMode />
                      </Match>
                      <Match when={modePreference() === "dark"}>
                        <DarkMode />
                      </Match>
                    </Switch>
                  </PanafallButton>
                  <PanafallButton
                    onClick={() => setFullscreen(!fullscreen())}
                    tooltip={<>{fullscreen() ? "Exit" : "Enter"} Fullscreen</>}
                    aria-label={
                      fullscreen() ? "Exit fullscreen" : "Enter fullscreen"
                    }
                  >
                    <Show when={fullscreen()} fallback={<Fullscreen />}>
                      <FullscreenExit />
                    </Show>
                  </PanafallButton>
                </div>
              </Portal>
              <Show
                when={
                  preferences.showTuningGuide &&
                  pos.sourceType === "mouse" &&
                  pos.isInside
                }
              >
                <div
                  class="absolute inset-y-0 w-px translate-x-(--cursor-x) pointer-events-none will-change-transform pointer-coarse:hidden"
                  classList={{
                    "backdrop-invert-100":
                      preferences.enableTransparencyEffects,
                    "border-x border-l-foreground border-r-background opacity-75":
                      !preferences.enableTransparencyEffects,
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
    </div>
  );
}
