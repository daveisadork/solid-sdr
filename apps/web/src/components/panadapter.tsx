import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
} from "solid-js";
import useFlexRadio, { PacketEvent } from "~/context/flexradio";
import { DetachedSlices, Slice } from "./slice";
import { debounce } from "@solid-primitives/scheduled";
import { createElementSize } from "@solid-primitives/resize-observer";
import { Portal } from "solid-js/web";
import { createKeyedSubstore } from "~/lib/keyed-substore";

export function Panadapter(props: { streamId: string }) {
  const streamId = () => props.streamId;
  const { events, sendCommand, state, setState } = useFlexRadio();
  const [pan, setPan] = createKeyedSubstore(
    () => state.status.display.pan,
    streamId,
    setState,
    ["status", "display", "pan"],
  );

  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  const [wrapper, setWrapper] = createSignal<HTMLDivElement>();
  const wrapperSize = createElementSize(wrapper);
  const [updating, setUpdating] = createSignal(false);
  const [slices, setSlices] = createSignal([] as (number | string)[]);
  const [palette, setPalette] = createSignal(new Uint8ClampedArray(0x400));
  const [paletteCss, setPaletteCss] = createSignal<string[]>([]);
  const [offscreenCanvasRef, setOffscreenCanvasRef] =
    createSignal<OffscreenCanvas | null>(null);

  const frameTimes: number[] = [];
  const [fps, setFps] = createSignal(0);

  createEffect(() => {
    setSlices(
      Object.keys(state.status.slice).filter(
        (key) =>
          state.status.slice[key].pan === streamId() &&
          state.status.slice[key].in_use,
      ),
    );
  });
  createEffect(() => {
    const canvas = canvasRef();
    if (!canvas) return;
    setOffscreenCanvasRef(new OffscreenCanvas(canvas.width, canvas.height));
  });

  createEffect(() => {
    const { gradients } = state.palette;
    const { gradient_index } = state.status.display.waterfall[pan().waterfall];
    const { colors } = gradients[gradient_index];
    const colorMin = 0;
    const colorMax = 1;
    const stepSize = (colorMax - colorMin) / colors.length;
    const offscreen = new OffscreenCanvas(1, pan().y_pixels);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(
      offscreen.width,
      offscreen.height,
      0,
      0,
    );
    colors.forEach((color, index) => {
      gradient.addColorStop(index * stepSize + colorMin, color);
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
    const waterfall = state.status.display.waterfall[pan().waterfall];
    if (!waterfall) return;
    const { gradient_index } = waterfall;
    const { colors } = gradients[gradient_index];
    const stepSize = 1 / colors.length;

    const gradient = ctx.createLinearGradient(0, pan().y_pixels, 0, 0);
    colors.forEach((color, index) => {
      gradient.addColorStop(index * stepSize, color);
    });
    return gradient;
  });

  const resizeCallback = debounce(async (width: number, height: number) => {
    const xPixels = Math.round(width);
    const yPixels = Math.round(height);
    setUpdating(true);
    await sendCommand(
      `display pan s ${streamId()} xpixels=${xPixels} ypixels=${yPixels}`,
    );
    setPan("y_pixels", yPixels);
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

    const stream_id = parseInt(streamId(), 16);
    let skipFrame = 0;
    let frameStartTime = performance.now();
    let rafId: number | null = null;
    const getPixelRatio = () =>
      typeof window === "undefined"
        ? 1
        : Math.max(window.devicePixelRatio || 1, 1);
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    };

    return ({ packet }: PacketEvent<"panadapter">) => {
      if (packet.streamId !== stream_id) return;
      const startingBin = packet.startBinIndex;
      const binsInThisFrame = packet.numBins;
      const totalBins = packet.totalBinsInFrame;
      const frame = packet.frameIndex;
      const bins = packet.payload;
      if (binsInThisFrame === 0) return;
      if (startingBin === 0) {
        frameStartTime = performance.now();
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
          setPan("x_pixels", width);
        }
        if (offscreen.height !== scaleHeight) {
          offscreen.height = scaleHeight;
          setPan("y_pixels", height);
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
        offscreenCtx.imageSmoothingEnabled = false;
        transformDirty = false;
      }
      offscreenCtx.clearRect(startingBin, 0, binsInThisFrame, height);
      offscreenCtx.lineWidth = 1;
      const { peakStyle, fillStyle } = state.display;
      if (fillStyle === "gradient") {
        const gradient = fillGradient();
        offscreenCtx.strokeStyle = gradient || "white";
        offscreenCtx.beginPath();
        for (let index = 0; index < binsInThisFrame; index++) {
          const x = startingBin + index;
          const y = bins[index];
          offscreenCtx.moveTo(x, height);
          offscreenCtx.lineTo(x, y);
        }
        offscreenCtx.stroke();
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
        offscreenCtx.moveTo(startingBin, bins[0]);
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

      if (startingBin + binsInThisFrame >= totalBins) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(flushFrame);
        frameTimes.push(performance.now() - frameStartTime);
        if (frameTimes.length > 10) frameTimes.shift();
        const avgFrameTime =
          frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        setFps(Math.round(1000 / avgFrameTime));
      }
    };
  });

  createEffect(() => {
    const handler = onPanadapter();
    if (!handler) return;
    events.addEventListener("panadapter", handler);
    onCleanup(() => {
      events.removeEventListener("panadapter", handler);
    });
  });

  return (
    <div
      ref={setWrapper}
      class="relative shrink size-full flex justify-center overflow-clip select-none"
    >
      <canvas
        ref={setCanvasRef}
        class="absolute size-full translate-x-[var(--drag-offset)] select-none"
      />

      <Portal>
        <div class="fixed top-7 left-2 -z-50 text-lg font-bold text-indigo-400/50">
          {fps()}
        </div>
      </Portal>
      <div class="absolute top-0 left-0 h-[var(--panafall-available-height)] w-[var(--panafall-available-width)]">
        <For each={slices()}>
          {(sliceIndex) => <Slice sliceIndex={sliceIndex} />}
        </For>
        <DetachedSlices streamId={streamId()} />
      </div>
    </div>
  );
}
