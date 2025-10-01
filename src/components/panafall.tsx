import useFlexRadio from "~/context/flexradio";
import { Resizable, ResizablePanel } from "./ui/resizable";
import { batch, createEffect, createMemo, createSignal, Show } from "solid-js";
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
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { frequencyToLabel } from "~/lib/utils";
import { createFullscreen } from "@solid-primitives/fullscreen";
import { createElementSize } from "@solid-primitives/resize-observer";
import { TabToSignal } from "./tab-to-signal";

export function Panafall() {
  const { state, sendCommand, setState } = useFlexRadio();
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(() => document.documentElement, fs);
  const [clickRef, setClickRef] = createSignal<HTMLElement>();
  const [sizeRef, setSizeRef] = createSignal<HTMLElement>();
  const [panStreamId, setPanStreamId] = createSignal<string | null>(null);
  const [waterfallStreamId, setWaterfallStreamId] = createSignal<string | null>(
    null,
  );
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
    if (!pan || !pan.bandwidth || !pan.x_pixels) return 0;
    return pan.x_pixels / pan.bandwidth;
  });

  createEffect(() => setFullscreen(fullscreen()));

  const _setPanCenter = (newCenter: number) => {
    const streamId = panStreamId();
    if (!streamId) return;
    newCenter = parseFloat(newCenter.toFixed(6));
    if (newCenter === selectedPan()?.center) return;
    sendCommand(`display pan s ${streamId} center=${newCenter}`);
  };

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
      if (!dragState.dragging) return;
      setDragState("dragging", false);
      if (!smoothScroll()) return;
      const { originX, originFreq } = dragState;
      const newOffset = event.x - originX;
      const freq = originFreq - newOffset / pxPerMHz();
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
        offset: 0,
        dragging: false,
        originFreq: selectedPan()?.center,
      });
    },
    onMove(event) {
      if (!dragState.down) return;
      if (!dragState.dragging) {
        setDragState({
          dragging: true,
          originX: dragState.downX,
        });
      }
      const { originX, originFreq } = dragState;
      const newOffset = event.x - originX;
      const freq = originFreq - newOffset / pxPerMHz();
      if (smoothScroll()) {
        setDragState("offset", Math.round(newOffset));
      }
      setPanCenter(freq, smoothScroll());
    },
    onUp: finalizeDrag,
    onLeave: finalizeDrag,
  });

  const updateScroll = (prevCenter: number, newCenter: number) => {
    let { originFreq, originX, offset } = dragState;
    if (offset === 0) {
      return;
    }
    const deltaPx = (newCenter - prevCenter) * pxPerMHz();
    offset = smoothScroll() ? Math.round(offset + deltaPx) : 0;
    originX -= deltaPx;
    if (Math.abs(deltaPx) > (panafallSize.width ?? 0)) {
      // this typically happens when changing bands
      offset = 0;
      originX = (panafallSize.width ?? 0) / 2;
    }
    originFreq = newCenter;
    const newState = { offset, originX, originFreq };
    console.log("Updating scroll", newState);
    setDragState(newState);
  };

  createEffect((prev?: { center?: number; pxPerMHz?: number }) => {
    const prevCenter = prev?.center;
    const prevPxPerMHz = prev?.pxPerMHz;
    const newCenter = selectedPan()?.center;
    if (prevPxPerMHz !== pxPerMHz()) {
      // bandwidth changed or screen resize
      setDragState("offset", 0);
    } else if (prevCenter && newCenter && prevCenter !== newCenter) {
      console.log("Center changed externally", prevCenter, "->", newCenter);
      updateScroll(prevCenter, newCenter);
    }
    return { center: newCenter, pxPerMHz: pxPerMHz() };
  });

  createEffect(() => {
    const streamId = state.selectedPanadapter;
    const panadapter = streamId ? state.status.display.pan[streamId] : null;
    setPanStreamId(panadapter?.client_handle ? streamId : null);
    const waterfallStreamId = panadapter?.waterfall ?? null;
    const waterfall = waterfallStreamId
      ? state.status.display.waterfall[waterfallStreamId]
      : null;
    setWaterfallStreamId(
      waterfall?.panadapter === streamId ? waterfallStreamId : null,
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
              <Show when={state.selectedPanadapter} keyed>
                {/* {(streamId) => <TabToSignal streamId={streamId} />} */}
              </Show>
              <div
                classList={{
                  "cursor-grabbing": dragState.dragging,
                  "cursor-crosshair": !dragState.dragging,
                }}
                class="absolute inset-0 select-none"
                onDblClick={async (e) => {
                  if (dragState.dragging) return;
                  const streamId = panStreamId();
                  if (!streamId) return;
                  const activeSlice = Object.keys(state.status.slice).find(
                    (key) => {
                      const slice = state.status.slice[key];
                      return slice.pan === streamId && slice.active;
                    },
                  );
                  if (!activeSlice) return;
                  const { bandwidth, x_pixels } =
                    state.status.display.pan[streamId];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(
                    0,
                    Math.min(e.clientX - rect.left, x_pixels - 1),
                  );
                  const mhzPerPx = bandwidth / x_pixels;
                  const freq = (
                    state.status.display.pan[streamId].center +
                    (x - x_pixels / 2) * mhzPerPx
                  ).toFixed(3);
                  await sendCommand(`slice t ${activeSlice} ${freq}`);
                  setState(
                    "status",
                    "slice",
                    activeSlice,
                    "RF_frequency",
                    Number(freq),
                  );
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
                    "bg-background/50": !pan().band_zoom,
                    "bg-primary/50 text-primary-foreground": pan().band_zoom,
                  }}
                  onClick={() => {
                    const zoom = pan().band_zoom;
                    sendCommand(
                      `display pan s ${panStreamId()} band_zoom=${zoom ? 0 : 1}`,
                    );
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
                    "bg-background/50": !pan().segment_zoom,
                    "bg-primary/50 text-primary-foreground": pan().segment_zoom,
                  }}
                  onClick={() => {
                    const zoom = pan().segment_zoom;
                    sendCommand(
                      `display pan s ${panStreamId()} segment_zoom=${zoom ? 0 : 1}`,
                    );
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
                  onClick={async () => {
                    const bandwidth = pan().bandwidth * 2;
                    sendCommand(
                      `display pan s ${panStreamId()} bandwidth=${bandwidth}`,
                    );
                    setState(
                      "status",
                      "display",
                      "pan",
                      panStreamId()!,
                      "bandwidth",
                      bandwidth,
                    );
                  }}
                >
                  <ArrowCollapseHorizontal />
                </TooltipTrigger>
                <TooltipContent>
                  Zoom Out (from {frequencyToLabel(pan().bandwidth)} to{" "}
                  {frequencyToLabel(pan().bandwidth * 2)})
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  as={Button}
                  size="icon"
                  variant="ghost"
                  class="bg-background/50 backdrop-blur-lg size-5"
                  onClick={async () => {
                    const bandwidth = pan().bandwidth / 2;
                    sendCommand(
                      `display pan s ${panStreamId()} bandwidth=${bandwidth}`,
                    );
                    setState(
                      "status",
                      "display",
                      "pan",
                      panStreamId()!,
                      "bandwidth",
                      bandwidth,
                    );
                  }}
                >
                  <ArrowExpandHorizontal />
                </TooltipTrigger>
                <TooltipContent>
                  Zoom In (from {frequencyToLabel(pan().bandwidth)} to{" "}
                  {frequencyToLabel(pan().bandwidth / 2)})
                </TooltipContent>
              </Tooltip>
            </div>
            <Tooltip>
              <TooltipTrigger
                as={Button}
                size="icon"
                variant="ghost"
                class="bg-background/50 backdrop-blur-lg size-5 absolute bottom-2 right-2"
                onClick={() => setFullscreen(!fullscreen())}
              >
                <Show when={fullscreen()} fallback={<Fullscreen />}>
                  <FullscreenExit />
                </Show>
              </TooltipTrigger>
              <TooltipContent>
                {fullscreen() ? "Exit" : "Enter"} Fullscreen
              </TooltipContent>
            </Tooltip>
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
