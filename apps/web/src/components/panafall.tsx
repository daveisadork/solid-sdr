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
import { createLocalStorageManager, useColorMode } from "@kobalte/core";
import { frequencyToLabel } from "~/lib/utils";
import { createFullscreen } from "@solid-primitives/fullscreen";
import { createElementSize } from "@solid-primitives/resize-observer";
import { TabToSignal } from "./tab-to-signal";

export function Panafall() {
  const { colorMode, setColorMode } = useColorMode();
  const storageManager = createLocalStorageManager("vite-ui-theme");
  const themeSequence = ["system", "light", "dark"] as const;
  const [modePreference, setModePreference] = createSignal<
    (typeof themeSequence)[number]
  >(storageManager.get("system") ?? "system");

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

  const { session, state } = useFlexRadio();
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(() => document.documentElement, fs);
  const [clickRef, setClickRef] = createSignal<HTMLElement>();
  const [sizeRef, setSizeRef] = createSignal<HTMLElement>();
  const [panStreamId, setPanStreamId] = createSignal<string | null>(null);
  const [waterfallStreamId, setWaterfallStreamId] = createSignal<string | null>(
    null,
  );

  const panController = () => session()?.panadapter(panStreamId());
  const [dragState, setDragState] = createStore({
    down: false,
    dragging: false,
    downX: 0,
    originX: 0,
    originFreq: 0,
    offset: 0,
  });
  const [smoothScroll, setSmoothScroll] = createSignal(true);
  const pos = createMousePosition(clickRef);
  const panafallSize = createElementSize(sizeRef);

  const selectedPan = createMemo(() => {
    const streamId = panStreamId();
    if (!streamId) return null;
    return state.status.display.pan[streamId] || null;
  });

  const pxPerMHz = createMemo(() => {
    const pan = selectedPan();
    if (!pan || !pan.bandwidthMHz || !pan.width) return 0;
    return pan.width / pan.bandwidthMHz;
  });

  createEffect(() => setFullscreen(fullscreen()));

  const _setPanCenter = (newCenter: number) => {
    const streamId = panStreamId();
    if (!streamId) return;
    newCenter = parseFloat(newCenter.toFixed(6));
    if (newCenter === selectedPan()?.centerFrequencyMHz) {
      if (!dragState.down) setDragState("originX", 0);
      return;
    }
    panController()?.setCenterFrequency(newCenter);
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
      if (!smoothScroll()) return;
      const newOffset = event.x - dragState.originX;
      const freq = dragState.originFreq - newOffset / pxPerMHz();
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
        originFreq: selectedPan()?.centerFrequencyMHz,
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
      const freq = dragState.originFreq - newOffset / pxPerMHz();
      if (smoothScroll()) {
        setDragState("offset", newOffset);
      }
      setPanCenter(freq, smoothScroll());
    },
    onUp: finalizeDrag,
    onLeave: finalizeDrag,
  });

  const updateScroll = (prevCenter: number, newCenter: number) => {
    if (dragState.offset === 0) {
      return;
    }
    const deltaPx = (newCenter - prevCenter) * pxPerMHz();
    let offset = smoothScroll() ? Math.round(dragState.offset + deltaPx) : 0;
    let originX = dragState.down ? dragState.originX - deltaPx : 0;
    if (Math.abs(deltaPx) > (panafallSize.width ?? 0)) {
      // this typically happens when changing bands
      offset = 0;
      originX = (panafallSize.width ?? 0) / 2;
    }
    setDragState({ offset, originX, originFreq: newCenter });
  };

  createEffect((prev?: { center?: number; pxPerMHz?: number }) => {
    const prevCenter = prev?.center;
    const prevPxPerMHz = prev?.pxPerMHz;
    const newCenter = selectedPan()?.centerFrequencyMHz;
    if (prevPxPerMHz !== pxPerMHz()) {
      // bandwidth changed or screen resize
      setDragState("offset", 0);
    } else if (prevCenter && newCenter && prevCenter !== newCenter) {
      updateScroll(prevCenter, newCenter);
    }
    return { center: newCenter, pxPerMHz: pxPerMHz() };
  });

  createEffect(() => {
    const streamId = state.selectedPanadapter;
    const panadapter = streamId ? state.status.display.pan[streamId] : null;
    setPanStreamId(panadapter?.clientHandle ? streamId : null);
    const waterfallStreamId = panadapter?.waterfallStreamId ?? null;
    const waterfall = waterfallStreamId
      ? state.status.display.waterfall[waterfallStreamId]
      : null;
    setWaterfallStreamId(
      waterfall?.panadapterStreamId === streamId ? waterfallStreamId : null,
    );
  });

  return (
    <div
      ref={setSizeRef}
      class="relative size-full overflow-visible"
      style={{
        "--panafall-available-width": `${panafallSize.width}px`,
        "--panafall-available-height": `${panafallSize.height}px`,
        "--drag-offset": `${dragState.offset}px`,
      }}
    >
      <Show when={selectedPan()}>
        {(pan) => (
          <>
            <div class="absolute top-0 left-0 w-dvw h-dvh overflow-clip select-none">
              <Resizable
                class="size-full overflow-clip select-none"
                orientation="vertical"
              >
                <ResizablePanel
                  class="overflow-clip select-none"
                  initialSize={0.25}
                >
                  <Show when={state.selectedPanadapter} keyed>
                    {(streamId) => <Panadapter streamId={streamId} />}
                  </Show>
                </ResizablePanel>
                <Show when={state.selectedPanadapter} keyed>
                  {(streamId) => <Scale streamId={streamId} />}
                </Show>
                <ResizablePanel
                  class="overflow-clip select-none"
                  initialSize={0.75}
                >
                  <Show when={waterfallStreamId()} keyed>
                    {(streamId) => <Waterfall streamId={streamId} />}
                  </Show>
                </ResizablePanel>
              </Resizable>
              <Show when={false && state.selectedPanadapter} keyed>
                {(streamId) => <TabToSignal streamId={streamId} />}
              </Show>
              <div
                classList={{
                  "cursor-grabbing": dragState.dragging,
                  "cursor-crosshair": !dragState.dragging,
                }}
                class="absolute inset-0 select-none"
                onDblClick={async (e) => {
                  if (dragState.dragging) return;
                  setDragState("originX", 0);
                  const streamId = panStreamId();
                  if (!streamId) return;
                  const { bandwidthMHz, width } =
                    state.status.display.pan[streamId];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(
                    0,
                    Math.min(e.clientX - rect.left, width - 1),
                  );
                  const mhzPerPx = bandwidthMHz / width;
                  const freq = (
                    state.status.display.pan[streamId].centerFrequencyMHz +
                    (x - width / 2) * mhzPerPx
                  ).toFixed(3);
                  panController()?.clickTune(Number(freq));
                }}
                ref={setClickRef}
              />
            </div>
            <div class="absolute bottom-2 left-2 grid grid-cols-2 gap-0.5 text-xs">
              <Tooltip>
                <TooltipTrigger
                  as={Button}
                  size="icon"
                  variant="ghost"
                  class="backdrop-blur-lg size-5"
                  classList={{
                    "bg-background/50": !pan().isBandZoomOn,
                    "bg-primary/50 text-primary-foreground": pan().isBandZoomOn,
                  }}
                  onClick={() => {
                    const zoom = pan().isBandZoomOn;
                    panController()?.setBandZoom(!zoom);
                  }}
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
                  class="backdrop-blur-lg size-5"
                  classList={{
                    "bg-background/50": !pan().isSegmentZoomOn,
                    "bg-primary/50 text-primary-foreground":
                      pan().isSegmentZoomOn,
                  }}
                  onClick={() => {
                    const zoom = pan().isSegmentZoomOn;
                    panController()?.setSegmentZoom(!zoom);
                  }}
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
                  class="bg-background/50 backdrop-blur-lg size-5"
                  onClick={() => {
                    const controller = panController();
                    if (!controller) return;
                    controller.setBandwidth(controller.bandwidthMHz * 2);
                  }}
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
                  class="bg-background/50 backdrop-blur-lg size-5"
                  onClick={() => {
                    const controller = panController();
                    if (!controller) return;
                    controller.setBandwidth(controller.bandwidthMHz / 2);
                  }}
                >
                  <ArrowExpandHorizontal />
                </TooltipTrigger>
                <TooltipContent>
                  Zoom In (from {frequencyToLabel(pan().bandwidthMHz)} to{" "}
                  {frequencyToLabel(pan().bandwidthMHz / 2)})
                </TooltipContent>
              </Tooltip>
            </div>
            <div class="absolute bottom-2 right-2 flex gap-2">
              <Tooltip>
                <TooltipTrigger
                  as={Button}
                  size="icon"
                  variant="ghost"
                  class="bg-background/50 backdrop-blur-lg size-5"
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
                  class="bg-background/50 backdrop-blur-lg size-5"
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
            <Show when={pos.sourceType === "mouse" && pos.isInside}>
              <div
                class="absolute h-full left-[calc(var(--cursor-x)-1.5px)] pointer-events-none w-0.5 backdrop-invert-50"
                style={{
                  "--cursor-x": `${pos.x}px`,
                }}
              />
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
