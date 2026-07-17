import { parseColor } from "@kobalte/core/colors";
import type { PanadapterController, VitaFFTPacket } from "@repo/flexlib";
import { debounce } from "@solid-primitives/scheduled";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import useFlexRadio, {
  type PanadapterState,
  type WaterfallState,
} from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";
import { usePreferences } from "~/context/preferences";
import { useRuntime } from "~/context/runtime";
import { deviceScale, pixelDensity } from "~/lib/device-scale";
import type { LinearScaleTick } from "../linear-scale";
import { LinearScale } from "../linear-scale";
import { DetachedSlices, Slice } from "../slice";
import { DisplayMarkers } from "./display-markers";
import { PanadapterGrid } from "./panadapter-grid";
import {
  CONTROL_BINS,
  CONTROL_BUF,
  CONTROL_BYTES,
  CONTROL_LENGTH,
  CONTROL_SEQ,
  DATA_LENGTH,
  MAX_BINS,
  NUM_BUFFERS,
  SAB_BYTES,
} from "./panadapter-protocol";
import type { FrequencyGridTick } from "./scale";
import { buildFrequencyGrid } from "./scale";
import { Spots } from "./spots";
import { Tnf } from "./tnf";

export function Panadapter(props: {
  pan: PanadapterState;
  waterfall: WaterfallState;
  controller: PanadapterController;
}) {
  const { state } = useFlexRadio();
  const { preferences } = usePreferences();

  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  const [paletteCss, setPaletteCss] = createSignal<string[]>([]);
  const [levelTicks, setLevelTicks] = createSignal<LinearScaleTick[]>([]);
  const [worker, setWorker] = createSignal<Worker>();

  const { setRuntime } = useRuntime();

  // Shared buffer the worker draws from. The data event handler writes bins
  // straight into it and publishes completed frames via the control region;
  // nothing is copied or messaged per packet.
  const sab = new SharedArrayBuffer(SAB_BYTES);
  const control = new Int32Array(sab, 0, CONTROL_LENGTH);
  const fftData = new Uint16Array(sab, CONTROL_BYTES, DATA_LENGTH);
  let writeBuf = 0;
  let frameSeq = 0;

  const {
    slices,
    setPanadapterControlsRef,
    setPanadapterWrapper,
    panadapterWrapperSize,
  } = usePanafall();

  const frequencyTicks = createMemo<FrequencyGridTick[]>(() => {
    const width = panadapterWrapperSize.width;
    if (!(width && props.pan)) return [];
    const { centerFrequencyMHz, bandwidthMHz } = props.pan;
    return buildFrequencyGrid({
      centerFrequencyMHz,
      bandwidthMHz,
      width,
      alignmentOffset: preferences.panadapterOffset,
      minPixelSpacing: 72,
    });
  });

  createEffect(() => {
    const { gradients } = preferences.palette;
    const { stops } = gradients[props.waterfall.gradientIndex];
    const offscreen = new OffscreenCanvas(1, props.pan.height);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(
      offscreen.width,
      offscreen.height,
      0,
      0,
    );
    stops.forEach(({ offset, color }) => {
      gradient.addColorStop(offset, color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;
    const css = new Array<string>(data.length / 4);
    for (let index = 0; index < css.length; index++) {
      const offset = index * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3] / 255;
      css[index] = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    setPaletteCss(css);
  });

  const resizeCallback = debounce(async (width: number, height: number) => {
    await props.controller.setSize({ width, height });
  }, 250);

  createEffect(() => {
    const { width, height } = panadapterWrapperSize;
    if (!width || !height) return;
    const density = pixelDensity();
    const scale = deviceScale();
    resizeCallback(
      Math.round((width * density) / scale),
      Math.round((height * density) / scale),
    );
  });

  // Hand the canvas to a worker that owns all rasterization. transferControl-
  // ToOffscreen is one-shot per element, so this is keyed to the canvas ref;
  // if the canvas ever remounts, the old worker is torn down and a new one
  // takes over the new canvas.
  createEffect(() => {
    const canvas = canvasRef();
    if (!canvas) return;
    const w = new Worker(new URL("./panadapter.worker.ts", import.meta.url), {
      type: "module",
    });
    const offscreen = canvas.transferControlToOffscreen();
    w.postMessage({ type: "init", canvas: offscreen, sab }, [offscreen]);
    w.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "fps") {
        setRuntime("fps", "P", event.data.value);
      }
    };
    setWorker(w);
    onCleanup(() => {
      w.terminate();
      setWorker(undefined);
    });
  });

  // Push rendering config to the worker whenever any input changes. These all
  // change rarely (palette edits, preference toggles, resize, DPR), so
  // re-posting the whole config on any change is cheap. The worker sizes its
  // backing store from the expected pan dimensions × scale and derives the
  // per-frame draw scale from the actual bin count it receives.
  createEffect(() => {
    const w = worker();
    if (!w) return;
    const { gradients } = preferences.palette;
    // Unwrap reactive store proxies to plain data — structuredClone (used by
    // postMessage) can't serialize Solid store proxies.
    const stops = (gradients[props.waterfall.gradientIndex]?.stops ?? []).map(
      ({ offset, color }) => ({ offset, color }),
    );
    w.postMessage({
      type: "config",
      config: {
        width: props.pan.width,
        height: props.pan.height,
        scale: deviceScale(),
        paletteCss: [...paletteCss()],
        fillStyle: preferences.fillStyle,
        peakStyle: preferences.peakStyle,
        gradientStyle: preferences.gradientStyle,
        gradientStops: stops,
        showFps: preferences.showFps,
      },
    });
  });

  // Accumulate FFT packets directly into the shared buffer. On the main thread
  // this is just a typed-array copy into shared memory per packet — no
  // allocation, no postMessage. When a frame completes we publish the slot and
  // bin count, then bump the sequence counter (and notify) so the worker draws
  // it. Frames rotate through NUM_BUFFERS slots so the writer never overwrites
  // the slot the worker is reading.
  createEffect(() => {
    const w = worker();
    if (!w) return;
    const subscription = props.controller.on(
      "data",
      (packet: VitaFFTPacket) => {
        const numBins = packet.numBins;
        if (numBins === 0) return;
        const startBin = packet.startBinIndex;
        const totalBins = packet.totalBinsInFrame;
        const end = startBin + numBins;
        if (end > MAX_BINS) return;

        fftData.set(
          packet.payload.subarray(0, numBins),
          writeBuf * MAX_BINS + startBin,
        );

        if (end >= totalBins) {
          Atomics.store(control, CONTROL_BUF, writeBuf);
          Atomics.store(control, CONTROL_BINS, totalBins);
          Atomics.store(control, CONTROL_SEQ, ++frameSeq);
          Atomics.notify(control, CONTROL_SEQ);
          writeBuf = (writeBuf + 1) % NUM_BUFFERS;
        }
      },
    );
    if (!subscription) return;
    onCleanup(subscription.unsubscribe);
  });

  const txBackgroundColor = createMemo(() => {
    if (state.status.radio.interlockTxClientHandle !== state.clientHandleInt) {
      return preferences.panBackgroundColor;
    }

    const color = parseColor(preferences.panBackgroundColor).toFormat("hsl");

    return state.status.radio.interlockState === "TRANSMITTING"
      ? // shift the hue of the background color to 0 (red) when transmitting, but keep saturation and lightness the same
        color.withChannelValue("hue", 0).toString("css")
      : color.withChannelValue("hue", 30).toString("css");
  });

  return (
    <div
      ref={setPanadapterWrapper}
      class="relative shrink size-full flex justify-center overflow-clip select-none bg-radial-[ellipse_at_bottom] from-(--panadapter-background-color) via-(--panadapter-background-color)/70 via-30% to-(--panadapter-background-color)/35 to-85%"
      style={{
        "--panadapter-available-height": `${panadapterWrapperSize.height}px`,
        "--panadapter-background-color": txBackgroundColor(),
      }}
    >
      <PanadapterGrid
        horizontalTicks={levelTicks()}
        verticalTicks={frequencyTicks()}
      />
      <canvas
        ref={setCanvasRef}
        class="absolute size-full translate-x-(--drag-offset) select-none"
      />
      <DisplayMarkers />
      <div class="flex absolute top-0 left-(--cell-inset-left) h-(--panadapter-available-height) w-(--cell-visible-width)">
        <div class="relative size-full" ref={setPanadapterControlsRef}>
          <div class="flex pointer-events-none absolute top-control-inset right-control-inset text-fg text-xl font-bold opacity-50 gap-4">
            <div>{props.pan.preampSetting}</div>
            <Show when={props.pan.xvtr}>
              <div>{props.pan.xvtr}</div>
            </Show>
            <Show when={props.pan.wideEnabled}>
              <div>WIDE</div>
            </Show>
          </div>
          <DetachedSlices pan={props.pan} slices={slices()} />
        </div>
        <div class="grow-0 shrink-0 w-scale-gutter">
          <div class="relative h-full px-1.5 flex items-center">
            <LinearScale
              min={props.pan.lowDbm}
              max={props.pan.highDbm}
              class="h-full"
              tickClass="pr-0.5"
              labelClass="text-[10px] font-semibold scale-text-shadow"
              format={(value) => `${Math.round(value)}`}
              onTicksChange={setLevelTicks}
            />
          </div>
        </div>
      </div>
      <div class="absolute inset-0 translate-x-(--drag-offset) z-10 pointer-events-none">
        <For each={slices()}>
          {(slice) => <Slice slice={slice} pan={props.pan} />}
        </For>
        <For each={Object.values(state.status.tnf)}>
          {(tnf) => <Tnf tnf={tnf} pan={props.pan} />}
        </For>
        <Show when={preferences.spots.enabled}>
          <Spots pan={props.pan} />
        </Show>
      </div>
    </div>
  );
}
