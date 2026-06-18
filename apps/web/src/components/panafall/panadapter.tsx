import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import useFlexRadio, {
  PanadapterState,
  WaterfallState,
} from "~/context/flexradio";
import { DetachedSlices, Slice } from "../slice";
import { debounce } from "@solid-primitives/scheduled";
import { LinearScale } from "../linear-scale";
import type { LinearScaleTick } from "../linear-scale";
import { PanadapterGrid } from "./panadapter-grid";
import { buildFrequencyGrid } from "./scale";
import type { FrequencyGridTick } from "./scale";
import { parseColor } from "@kobalte/core/colors";
import type { PanadapterController, VitaFFTPacket } from "@repo/flexlib";
import { usePanafall } from "~/context/panafall";
import { usePreferences } from "~/context/preferences";
import { Spots } from "./spots";
import { Tnf } from "./tnf";
import { useRuntime } from "~/context/runtime";
import { DisplayMarkers } from "./display-markers";

export function Panadapter(props: {
  pan: PanadapterState;
  waterfall: WaterfallState;
  controller: PanadapterController;
}) {
  const { state } = useFlexRadio();
  const { preferences } = usePreferences();

  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  const [updating, setUpdating] = createSignal(false);
  const [palette, setPalette] = createSignal(new Uint8ClampedArray(0x400));
  const [paletteCss, setPaletteCss] = createSignal<string[]>([]);
  const [offscreenCanvasRef, setOffscreenCanvasRef] =
    createSignal<OffscreenCanvas | null>(null);
  const [levelTicks, setLevelTicks] = createSignal<LinearScaleTick[]>([]);

  const frameTimes: number[] = [];
  const { setRuntime } = useRuntime();

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
    const canvas = canvasRef();
    if (!canvas) return;
    setOffscreenCanvasRef(new OffscreenCanvas(canvas.width, canvas.height));
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
    setPalette(data);
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

  const fillGradient = createMemo(() => {
    const canvas = offscreenCanvasRef();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { gradients } = preferences.palette;
    const gradient = ctx.createLinearGradient(0, props.pan.height, 0, 0);
    if (preferences.gradientStyle === "classic") {
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 1)");
    } else {
      const { stops } = gradients[props.waterfall.gradientIndex];
      stops.forEach(({ offset, color }) => {
        gradient.addColorStop(offset, color);
      });
    }
    return gradient;
  });

  const resizeCallback = debounce(async (width: number, height: number) => {
    setUpdating(true);
    await props.controller.setSize({ width, height });
    setUpdating(false);
  }, 250);

  createEffect(() => {
    const { width, height } = panadapterWrapperSize;
    if (!width || !height) return;
    resizeCallback(width, height);
  });

  const onPanadapter = createMemo(() => {
    const canvas = canvasRef();
    if (!canvas) return;
    const ctx = canvas.getContext("2d", {
      colorSpace: "display-p3",
    });
    if (!ctx) return;
    const offscreen = offscreenCanvasRef();
    if (!offscreen) return;
    const offscreenCtx = offscreen.getContext("2d", {
      colorSpace: "display-p3",
    });
    if (!offscreenCtx) return;
    ctx.imageSmoothingEnabled = false;
    offscreenCtx.imageSmoothingEnabled = false;

    let skipFrame = 0;
    let frameStartTime = performance.now();
    let rafId: number | null = null;
    const getPixelRatio = () =>
      Math.max(Number(devicePixelRatio?.toFixed(2) ?? 1), 1);
    let pixelRatio = getPixelRatio();

    const flushFrame = () => {
      rafId = null;
      if (canvas.width !== offscreen.width) {
        canvas.width = offscreen.width;
      }
      if (canvas.height !== offscreen.height) {
        canvas.height = offscreen.height;
      }
      ctx.clearRect(-1, -1, canvas.width + 1, canvas.height + 1);
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    };

    let lastBinValue = 0;

    // Reusable per-color buckets for the solid fill. Each frame we group bins
    // by amplitude (= palette index) so every distinct color is drawn as one
    // batched path of integer device-pixel rects. Pre-allocated and reused
    // across frames to avoid per-frame allocation. bucketX[colorIndex] holds
    // the logical bin x-positions for that color; bucketCount its length.
    let bucketX: Int32Array[] = [];
    let bucketCount = new Int32Array(0);
    let bucketColors = 0;
    let bucketCapacity = 0;
    const ensureBuckets = (colorCount: number, capacity: number) => {
      if (bucketColors !== colorCount || bucketCapacity < capacity) {
        bucketX = Array.from(
          { length: colorCount },
          () => new Int32Array(capacity),
        );
        bucketCount = new Int32Array(colorCount);
        bucketColors = colorCount;
        bucketCapacity = capacity;
      }
    };

    return (packet: VitaFFTPacket) => {
      const startingBin = packet.startBinIndex;
      const binsInThisFrame = packet.numBins;
      const totalBins = packet.totalBinsInFrame;
      const frame = packet.frameIndex;
      const bins = packet.payload;
      if (binsInThisFrame === 0) return;
      if (startingBin === 0) {
        frameStartTime = performance.now();
        lastBinValue = bins[0];
      }
      const p = palette();
      const colors = paletteCss();
      if (!p.length || !colors.length) return;
      const width = totalBins;
      const height = p.length / 4;
      const nextRatio = getPixelRatio();
      if (nextRatio !== pixelRatio) {
        pixelRatio = nextRatio;
      }
      const scaleWidth = Math.round(width * pixelRatio);
      const scaleHeight = Math.round(height * pixelRatio);
      if (offscreen.width !== scaleWidth || offscreen.height !== scaleHeight) {
        if (offscreen.width !== scaleWidth) {
          offscreen.width = scaleWidth;
        }
        if (offscreen.height !== scaleHeight) {
          offscreen.height = scaleHeight;
        }
        skipFrame = frame;
      }
      if (updating()) {
        skipFrame = frame;
      }
      if (frame === skipFrame) {
        return;
      }
      // Logical-space transform (for gradient fill / peak line, where smooth
      // antialiasing is wanted). sharpOffset centers 1px lines at DPR 1.
      const sharpOffset = pixelRatio === 1 ? 0.5 : 0;
      const hDev = offscreen.height;
      const segLeft = Math.round(startingBin * pixelRatio);
      const segRight = Math.round((startingBin + binsInThisFrame) * pixelRatio);

      // Clear this segment's device-pixel column span (identity transform).
      offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
      offscreenCtx.clearRect(
        startingBin === 0 ? -1 : segLeft,
        -1,
        startingBin === 0 ? segRight + 1 : segRight - segLeft,
        hDev + 1,
      );

      const { peakStyle, fillStyle } = preferences;
      if (fillStyle === "gradient") {
        // Filled spectrum polygon, drawn in logical space (antialiased).
        offscreenCtx.setTransform(
          pixelRatio,
          0,
          0,
          pixelRatio,
          sharpOffset,
          sharpOffset,
        );
        offscreenCtx.lineWidth = 1;
        const gradient = fillGradient();
        if (peakStyle === "points") {
          // if the peaks are points, we need to draw the "fill" as individual lines
          offscreenCtx.strokeStyle = gradient || "white";
          offscreenCtx.beginPath();
          offscreenCtx.moveTo(startingBin, height);
          for (let index = 0; index < binsInThisFrame; index++) {
            const x = startingBin + index;
            const y = bins[index];
            offscreenCtx.moveTo(x, height);
            offscreenCtx.lineTo(x, y);
          }
          offscreenCtx.stroke();
        } else {
          // otherwise we can just outline the shape and fill it
          offscreenCtx.strokeStyle = "transparent";
          offscreenCtx.lineWidth = 0;
          offscreenCtx.fillStyle = gradient || "white";
          offscreenCtx.beginPath();
          offscreenCtx.moveTo(startingBin - 1, height);
          offscreenCtx.lineTo(startingBin - 1, lastBinValue);
          for (let index = 0; index < binsInThisFrame; index++) {
            const x = startingBin + index;
            const y = bins[index];
            offscreenCtx.lineTo(x, y);
          }
          offscreenCtx.lineTo(startingBin + binsInThisFrame - 1, height);
          offscreenCtx.lineTo(startingBin + binsInThisFrame - 1, height);
          offscreenCtx.closePath();
          offscreenCtx.fill();
        }
      } else if (fillStyle === "solid") {
        // Solid spectrum: one vertical bar per bin, colored by amplitude.
        // Drawn as integer device-pixel rects so bars stay crisp at any DPR
        // (incl. fractional), batched one fill() per distinct color via reused
        // amplitude buckets (no per-frame allocation).
        ensureBuckets(height, totalBins);
        bucketCount.fill(0);
        for (let index = 0; index < binsInThisFrame; index++) {
          const y = bins[index];
          if (y < 0 || y >= height) continue;
          bucketX[y][bucketCount[y]++] = startingBin + index;
        }
        offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
        for (let y = 0; y < height; y++) {
          const count = bucketCount[y];
          if (!count) continue;
          const color = colors[y];
          if (!color) continue;
          offscreenCtx.fillStyle = color;
          offscreenCtx.beginPath();
          const yTop = Math.round(y * pixelRatio);
          const rectH = hDev - yTop;
          const xs = bucketX[y];
          for (let j = 0; j < count; j++) {
            const x = xs[j];
            const x0 = Math.round(x * pixelRatio);
            const x1 = Math.round((x + 1) * pixelRatio);
            offscreenCtx.rect(x0, yTop, x1 - x0, rectH);
          }
          offscreenCtx.fill();
        }
      }
      if (peakStyle === "line") {
        // Peak line: diagonal polyline, logical space (antialiased — sharp
        // pixel-snapping would make a diagonal look worse, not better).
        offscreenCtx.setTransform(
          pixelRatio,
          0,
          0,
          pixelRatio,
          sharpOffset,
          sharpOffset,
        );
        offscreenCtx.lineWidth = 1;
        offscreenCtx.strokeStyle = "white";
        offscreenCtx.beginPath();
        offscreenCtx.moveTo(startingBin - 1, lastBinValue);
        for (let index = 0; index < binsInThisFrame; index++) {
          const x = startingBin + index;
          const y = bins[index];
          offscreenCtx.lineTo(x, y);
        }
        offscreenCtx.stroke();
      } else if (peakStyle === "points") {
        // Peak points: crisp dots aligned to the device-pixel grid. All white,
        // so batch into one path + single fill() rather than N fillRect calls.
        offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
        offscreenCtx.fillStyle = "white";
        offscreenCtx.beginPath();
        const dot = Math.max(1, Math.round(pixelRatio));
        for (let index = 0; index < binsInThisFrame; index++) {
          const y = bins[index];
          const x0 = Math.round((startingBin + index) * pixelRatio);
          const yTop = Math.round(y * pixelRatio);
          offscreenCtx.rect(x0, yTop, dot, dot);
        }
        offscreenCtx.fill();
      }

      if (startingBin > 0) {
        lastBinValue = bins[binsInThisFrame - 1];
      }

      if (startingBin + binsInThisFrame >= totalBins) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(flushFrame);
        if (preferences.showFps) {
          frameTimes.push(performance.now() - frameStartTime);
          if (frameTimes.length > 10) frameTimes.shift();
          const avgFrameTime =
            frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          setRuntime("fps", "P", Math.round(1000 / avgFrameTime));
        }
      }
    };
  });

  createEffect(() => {
    const handler = onPanadapter();
    if (!handler) return;
    const subscription = props.controller.on("data", handler);
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
      <div class="flex absolute top-0 left-(--panafall-left) h-(--panadapter-available-height) w-(--panafall-available-width)">
        <div class="relative size-full" ref={setPanadapterControlsRef}>
          <div class="flex pointer-events-none absolute top-4 right-4 text-fg text-xl font-bold opacity-50 gap-4">
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
        <div class="grow-0 shrink-0 w-10">
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
