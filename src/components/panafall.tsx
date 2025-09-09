import useFlexRadio from "~/context/flexradio";
import { Resizable, ResizablePanel } from "./ui/resizable";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
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

export function Panafall() {
  const { state, sendCommand, setState } = useFlexRadio();
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(() => document.body, fs);
  const [clickRef, setClickRef] = createSignal<HTMLElement>();
  const [panStreamId, setPanStreamId] = createSignal<string | null>(null);
  const [waterfallStreamId, setWaterfallStreamId] = createSignal<string | null>(
    null,
  );
  const [dragState, setDragState] = createStore({
    down: false,
    dragging: false,
    nextX: null as number | null,
    originX: 0,
    originFreq: 0,
    offset: 0,
    freq: 0,
  });
  const [smoothScroll, setSmoothScroll] = createSignal(true);
  const pos = createMousePosition(clickRef);
  const pan = () => state.status.display.pan[panStreamId()!];

  createEffect(() => setFullscreen(fullscreen()));

  const setCenter = createMemo(() => {
    const setCenter = (
      streamId: string,
      center: number,
      x: number | null = null,
    ) => {
      setDragState("nextX", x);
      sendCommand(`display pan s ${streamId} center=${center}`);
    };
    return smoothScroll() ? debounce(setCenter, 50) : setCenter;
  });

  // createEffect((dragging) => {
  //   if (dragging && !dragState.dragging) {
  //     setCenter()(panStreamId()!, dragState.freq);
  //   }
  //   return dragState.dragging;
  // }, dragState.dragging);

  createPointerListeners({
    target: clickRef,
    onDown({ button, x }) {
      if (button !== 0) return; // Only left mouse button
      const streamId = panStreamId();
      if (!streamId) return;
      const { center } = state.status.display.pan[streamId];

      setDragState({
        down: true,
        dragging: false,
        nextX: undefined,
        originX: x,
        originFreq: center,
        offset: 0,
      });
    },
    onMove(event) {
      if (!dragState.down) return;
      if (!dragState.dragging) {
        setDragState("dragging", true);
      }
      const { originX, originFreq } = dragState;
      const streamId = panStreamId();
      if (!streamId) return;
      const { bandwidth, x_pixels } = state.status.display.pan[streamId];
      const newX = Math.max(0, Math.min(event.x, x_pixels - 1));
      const newOffset = newX - originX;
      if (smoothScroll()) {
        setDragState("offset", newOffset);
      }

      const mhzPerPx = bandwidth / x_pixels;
      const freq = originFreq - newOffset * mhzPerPx;
      setCenter()(streamId, freq, newX);
      // setDragState("freq", freq);
    },
    onUp() {
      setDragState({
        down: false,
        dragging: false,
      });
    },
    onLeave() {
      setDragState({
        down: false,
        dragging: false,
      });
    },
  });

  createEffect((lastCenter) => {
    const streamId = panStreamId();
    if (!streamId) return;
    const { center } = state.status.display.pan[streamId];
    let { dragging, originX, nextX, offset } = dragState;
    if (smoothScroll() && center !== lastCenter) {
      offset = dragging ? nextX! - (originX + offset) : 0;
      setDragState({ offset, originX: nextX || 0, originFreq: center });
    }
    return center;
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
    <>
      <Resizable
        class="overflow-clip select-none"
        orientation="vertical"
        style={{ "--drag-offset": `${dragState.offset}px` }}
      >
        <ResizablePanel class="overflow-clip select-none" initialSize={0.25}>
          <Show when={panStreamId()} keyed>
            {(streamId) => <Panadapter streamId={streamId} />}
          </Show>
        </ResizablePanel>
        <Show when={panStreamId()} keyed>
          {(streamId) => <Scale streamId={streamId} />}
        </Show>
        <ResizablePanel class="overflow-clip select-none" initialSize={0.75}>
          <Show when={waterfallStreamId()} keyed>
            {(streamId) => <Waterfall streamId={streamId} />}
          </Show>
        </ResizablePanel>
      </Resizable>
      <div
        classList={{
          "cursor-grabbing": dragState.dragging,
          "cursor-crosshair": !dragState.dragging,
        }}
        class="absolute top-0 left-0 w-full h-full select-none"
        onDblClick={async (e) => {
          const streamId = panStreamId();
          if (!streamId) return;
          const activeSlice = Object.keys(state.status.slice).find((key) => {
            const slice = state.status.slice[key];
            return slice.pan === streamId && slice.active;
          });
          if (!activeSlice) return;
          const { bandwidth, x_pixels } = state.status.display.pan[streamId];
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(e.clientX - rect.left, x_pixels - 1));
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
      <div class="absolute bottom-12 left-2 grid grid-cols-2 gap-0.5 text-xs">
        <Tooltip>
          <TooltipTrigger
            as={Button}
            size="icon"
            variant="ghost"
            class="backdrop-blur-lg size-5"
            classList={{
              "bg-background/50":
                !state.status.display.pan[panStreamId()!]?.band_zoom,
              "bg-primary/75 text-primary-foreground":
                state.status.display.pan[panStreamId()!]?.band_zoom,
            }}
            onClick={() => {
              const zoom = state.status.display.pan[panStreamId()!]?.band_zoom;
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
              "bg-background/50":
                !state.status.display.pan[panStreamId()!]?.segment_zoom,
              "bg-primary/75 text-primary-foreground":
                state.status.display.pan[panStreamId()!]?.segment_zoom,
            }}
            onClick={() => {
              const zoom =
                state.status.display.pan[panStreamId()!]?.segment_zoom;
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
            class="backdrop-blur-lg backdrop-brightness-50 size-5"
            onClick={async () => {
              const bandwidth = pan()?.bandwidth * 2;
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
            Zoom Out (from {frequencyToLabel(pan()?.bandwidth)} to{" "}
            {frequencyToLabel(pan()?.bandwidth * 2)})
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            as={Button}
            size="icon"
            variant="ghost"
            class="backdrop-blur-lg backdrop-brightness-50 size-5"
            onClick={async () => {
              const bandwidth = pan()?.bandwidth / 2;
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
            Zoom In (from {frequencyToLabel(pan()?.bandwidth)} to{" "}
            {frequencyToLabel(pan()?.bandwidth / 2)})
          </TooltipContent>
        </Tooltip>
      </div>
      <Tooltip>
        <TooltipTrigger
          as={Button}
          size="icon"
          variant="ghost"
          class="backdrop-blur-lg backdrop-brightness-50 size-5 absolute bottom-12 right-2"
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
      <Show when={pos.isInside}>
        <div
          class="absolute h-full left-[calc(var(--cursor-x)-1.5px)] pointer-events-none w-0.5 backdrop-invert-25"
          style={{
            "--cursor-x": `${pos.x}px`,
          }}
        />
      </Show>
    </>
  );
}
