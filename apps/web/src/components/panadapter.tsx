import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import useFlexRadio, {
  Panadapter as PanadapterState,
  Waterfall,
  type UdpPacketEvent,
} from "~/context/flexradio";
import { DetachedSlices, Slice } from "./slice";
import { debounce } from "@solid-primitives/scheduled";
import { createElementSize } from "@solid-primitives/resize-observer";
import { Portal } from "solid-js/web";
import { LinearScale } from "./linear-scale";
import type { LinearScaleTick } from "./linear-scale";
import { PanadapterGrid } from "./panadapter-grid";
import { buildFrequencyGrid } from "./scale";
import type { FrequencyGridTick } from "./scale";
import { parseColor } from "@kobalte/core/colors";
import { PanadapterController } from "@repo/flexlib";
import { usePanafall } from "~/context/panafall";

export function Panadapter(props: {
  pan: PanadapterState;
  waterfall: Waterfall;
  controller: PanadapterController;
}) {
  const { state } = useFlexRadio();

  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  const [wrapper, setWrapper] = createSignal<HTMLDivElement>();
  const wrapperSize = createElementSize(wrapper);
  const [updating, setUpdating] = createSignal(false);
  const [palette, setPalette] = createSignal(new Uint8ClampedArray(0x400));
  const [paletteCss, setPaletteCss] = createSignal<string[]>([]);
  const [offscreenCanvasRef, setOffscreenCanvasRef] =
    createSignal<OffscreenCanvas | null>(null);
  const [levelTicks, setLevelTicks] = createSignal<LinearScaleTick[]>([]);

  const frameTimes: number[] = [];
  const [fps, setFps] = createSignal(0);

  const frequencyTicks = createMemo<FrequencyGridTick[]>(() => {
    const width = wrapperSize.width;
    if (!(width && props.pan)) return [];
    const { centerFrequencyMHz, bandwidthMHz } = props.pan;
    return buildFrequencyGrid({
      centerFrequencyMHz,
      bandwidthMHz,
      width,
      minPixelSpacing: 72,
    });
  });

  const { slices } = usePanafall();

  createEffect(() => {
    const canvas = canvasRef();
    if (!canvas) return;
    setOffscreenCanvasRef(new OffscreenCanvas(canvas.width, canvas.height));
  });

  createEffect(() => {
    const { gradients } = state.palette;
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
    const { gradients } = state.palette;
    const gradient = ctx.createLinearGradient(0, props.pan.height, 0, 0);
    if (state.display.gradientStyle === "classic") {
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
    const { width, height } = wrapperSize;
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
    let transformDirty = true;

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

    return ({ packet }: UdpPacketEvent<"panadapter">) => {
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
        transformDirty = true;
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
        transformDirty = true;
        skipFrame = frame;
      }
      if (updating()) {
        skipFrame = frame;
      }
      if (frame === skipFrame) {
        return;
      }
      if (transformDirty) {
        const sharpOffset = pixelRatio === 1 ? 0.5 : 0;
        offscreenCtx.setTransform(
          pixelRatio,
          0,
          0,
          pixelRatio,
          sharpOffset,
          sharpOffset,
        );
        offscreenCtx.imageSmoothingEnabled = true;
        transformDirty = false;
      }
      offscreenCtx.clearRect(
        startingBin === 0 ? -1 : startingBin,
        -1,
        startingBin === 0 ? binsInThisFrame + 1 : binsInThisFrame,
        height + 1,
      );
      offscreenCtx.lineWidth = 1;
      const { peakStyle, fillStyle } = state.display;
      if (fillStyle === "gradient") {
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
        let currentColor = "";
        let hasPath = false;
        for (let index = 0; index < binsInThisFrame; index++) {
          const x = startingBin + index;
          const y = bins[index];
          const color = colors[y];
          if (!color) continue;
          if (color !== currentColor) {
            if (hasPath) {
              offscreenCtx.stroke();
            }
            offscreenCtx.strokeStyle = color;
            offscreenCtx.beginPath();
            hasPath = true;
            currentColor = color;
          }
          offscreenCtx.moveTo(x, height);
          offscreenCtx.lineTo(x, y);
        }
        if (hasPath) {
          offscreenCtx.stroke();
        }
      }
      if (peakStyle === "line") {
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
        offscreenCtx.fillStyle = "white";
        for (let index = 0; index < binsInThisFrame; index++) {
          const x = startingBin + index;
          const y = bins[index];
          offscreenCtx.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
      }

      if (startingBin > 0) {
        lastBinValue = bins[binsInThisFrame - 1];
      }

      if (startingBin + binsInThisFrame >= totalBins) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(flushFrame);
        if (state.settings.showFps) {
          frameTimes.push(performance.now() - frameStartTime);
          if (frameTimes.length > 10) frameTimes.shift();
          const avgFrameTime =
            frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          setFps(Math.round(1000 / avgFrameTime));
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
      return state.display.panBackgroundColor;
    }

    const color = parseColor(state.display.panBackgroundColor).toFormat("hsl");

    return state.status.radio.interlockState === "TRANSMITTING"
      ? // shift the hue of the background color to 0 (red) when transmitting, but keep saturation and lightness the same
        color.withChannelValue("hue", 0).toString("css")
      : color.withChannelValue("hue", 60).toString("css");
  });

  return (
    <div
      ref={setWrapper}
      class="relative shrink size-full flex justify-center overflow-clip select-none bg-radial-[ellipse_at_bottom] from-(--panadapter-background-color) via-(--panadapter-background-color)/70 via-30% to-(--panadapter-background-color)/35 to-85%"
      style={{
        "--panadapter-available-height": `${wrapperSize.height}px`,
        "--panadapter-available-width": `${wrapperSize.width}px`,
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
      <Show when={state.settings.showFps}>
        <Portal>
          <div class="fixed top-7 left-2 -z-50 text-lg font-mono whitespace-pre font-bold text-indigo-400/50">
            P: {fps().toString().padStart(4, " ")}
          </div>
        </Portal>
      </Show>
      <div class="absolute top-0 left-(--panafall-left) h-(--panadapter-available-height) w-(--panafall-available-width)">
        <div class="absolute inset-y-0 right-0 w-10">
          <div class="relative h-full px-1.5 flex items-center">
            <LinearScale
              min={props.pan.lowDbm}
              max={props.pan.highDbm}
              class="h-full"
              tickClass="pr-0.5"
              labelClass="text-[10px] font-semibold scale-text-shadow"
              lineClass="bg-primary/25"
              tickLength={9}
              showTicks={false}
              showMin={false}
              showMax={false}
              format={(value) => `${Math.round(value)}`}
              onTicksChange={setLevelTicks}
            />
          </div>
        </div>
        <div class="flex pointer-events-none absolute top-4 right-14 text-fg text-xl font-bold opacity-50 space-x-2">
          <div>{props.pan.preampSetting}</div>
          <Show when={props.pan.wideEnabled}>
            <div>WIDE</div>
          </Show>
        </div>
        <DetachedSlices pan={props.pan} slices={slices()} />
      </div>
      <div class="absolute inset-0">
        <For each={slices()}>
          {(slice) => <Slice slice={slice} pan={props.pan} />}
        </For>
      </div>
    </div>
  );
}
