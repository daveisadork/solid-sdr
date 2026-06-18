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

  const [pixelDensity, setPixelDensity] = createSignal(
    Math.max(window.devicePixelRatio || 1, 1),
  );
  createEffect(() => {
    // A resolution media query only fires when it stops matching its fixed
    // value, so re-subscribe whenever the density changes. This catches the
    // window moving to a monitor with a different DPR, where the CSS wrapper
    // size is unchanged but the device-pixel size isn't.
    const current = pixelDensity();
    const query = window.matchMedia(`(resolution: ${current}dppx)`);
    const onChange = () =>
      setPixelDensity(Math.max(window.devicePixelRatio || 1, 1));
    query.addEventListener("change", onChange);
    onCleanup(() => query.removeEventListener("change", onChange));
  });

  createEffect(() => {
    const { width, height } = panadapterWrapperSize;
    const density = pixelDensity();
    if (!width || !height) return;
    // The panadapter occupies a fixed device-pixel region (width * density);
    // the radio renders it at that region divided by round(density), so the bin
    // count steps on the DPR rounding boundary and holds constant within each
    // bucket. We then scale those bins back up to device pixels ourselves while
    // drawing, so both fills and peak lines rasterize natively at full DPR.
    const scale = Math.max(1, Math.round(density));
    resizeCallback(
      Math.round((width * density) / scale),
      Math.round((height * density) / scale),
    );
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
    // Integer upscale factor: round(DPR). The offscreen is sized to full device
    // pixels (bins * scale) and a scale transform draws each bin as a scale-wide
    // block, so the spectrum rasterizes natively at device resolution and the
    // canvas blit is 1:1 — no nearest-neighbor upscale to blur or ghost.
    const getScale = () => Math.max(1, Math.round(devicePixelRatio || 1));
    let scale = getScale();
    let transformDirty = true;

    const flushFrame = () => {
      rafId = null;
      // The offscreen is already at device resolution, so the canvas matches it
      // 1:1 and the blit does no scaling.
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
      // Size the offscreen to full device pixels: the stepped bin count times
      // the integer scale. The scale only changes when DPR crosses a rounding
      // boundary, which is also when the radio re-sends a new bin count.
      scale = getScale();
      const offscreenWidth = width * scale;
      const offscreenHeight = height * scale;
      if (
        offscreen.width !== offscreenWidth ||
        offscreen.height !== offscreenHeight
      ) {
        if (offscreen.width !== offscreenWidth) {
          offscreen.width = offscreenWidth;
        }
        if (offscreen.height !== offscreenHeight) {
          offscreen.height = offscreenHeight;
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
        // Scale bin coordinates up to device pixels. Bin values are integers
        // (Uint16) and scale is an integer, so every fillRect lands on whole
        // device pixels — crisp with no offset needed — while strokes (the peak
        // line) anti-alias smoothly at full device resolution.
        offscreenCtx.setTransform(scale, 0, 0, scale, 0, 0);
        offscreenCtx.imageSmoothingEnabled = false;
        transformDirty = false;
      }
      offscreenCtx.clearRect(
        startingBin === 0 ? -1 : startingBin,
        -1,
        startingBin === 0 ? binsInThisFrame + 1 : binsInThisFrame,
        height + 1,
      );
      offscreenCtx.lineWidth = 1;
      const { peakStyle, fillStyle } = preferences;
      if (fillStyle === "gradient") {
        const gradient = fillGradient();
        if (peakStyle === "points") {
          // Discrete columns under each point — the same fillRect-per-bin method
          // as the solid fill, just filled with the gradient. Keeps the columns
          // pixel-aligned with the point markers drawn on top.
          offscreenCtx.fillStyle = gradient || "white";
          for (let index = 0; index < binsInThisFrame; index++) {
            const x = startingBin + index;
            const y = bins[index];
            offscreenCtx.fillRect(x, y, 1, height - y);
          }
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
        // One scale-wide fillRect per bin (bar from its peak down to the floor)
        // rather than scale separate 1px lines. Same draw-call count as the old
        // stroked version; the rasterizer fills the wider rect in one go.
        let currentColor = "";
        for (let index = 0; index < binsInThisFrame; index++) {
          const x = startingBin + index;
          const y = bins[index];
          const color = colors[y];
          if (!color) continue;
          if (color !== currentColor) {
            offscreenCtx.fillStyle = color;
            currentColor = color;
          }
          offscreenCtx.fillRect(x, y, 1, height - y);
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
        // Each point is one scale x scale block at integer device coords (bin
        // and amplitude are both integers, scale is integer). No drawImage
        // upscale means there's nothing left to ghost, in any browser.
        offscreenCtx.fillStyle = "white";
        for (let index = 0; index < binsInThisFrame; index++) {
          const x = startingBin + index;
          const y = bins[index];
          offscreenCtx.fillRect(x, y, 1, 1);
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
