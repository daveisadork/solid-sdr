import { createElementSize } from "@solid-primitives/resize-observer";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import useFlexRadio, { type UdpPacketEvent } from "~/context/flexradio";
import { LinearScale } from "./linear-scale";

export function Waterfall(props: { streamId: string }) {
  const streamId = () => props.streamId;
  const { radio, state, setState } = useFlexRadio();
  const waterfall = () => state.status.waterfall[streamId()];
  const pan = () => state.status.panadapter[waterfall().panadapterStreamId];

  const [canvasWidth, setCanvasWidth] = createSignal(1);
  const [widthMultiplier, setWidthMultiplier] = createSignal(1.0);
  const [binBandwidth, setBinBandwidth] = createSignal(1);
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  const [wrapper, setWrapper] = createSignal<HTMLDivElement>();
  const [lastCalculatedCenter, setLastCalculatedCenter] = createSignal(0);
  const [lastBandwidth, setLastBandwidth] = createSignal(0);
  const [autoBlackLevel, setAutoBlackLevel] = createSignal(0);
  const [black, setBlack] = createSignal("#000000");
  const [lineDurationMs, setLineDurationMs] = createSignal(
    waterfall().lineDurationMs ?? 0,
  );

  const waterfallController = () => radio()?.waterfall(streamId());

  // 4096 colors to stay under canvas size limits on iOS
  const paletteCanvas = new OffscreenCanvas(4096, 1);

  // NEW: packed 32-bit palette for fast strip writes
  const [palette32, setPalette32] = createSignal<Uint32Array>(
    new Uint32Array(4096),
  );
  const packRGBA = (r: number, g: number, b: number, a: number) =>
    (a << 24) | (b << 16) | (g << 8) | (r << 0);

  // Used to map the 16-bit waterfall value to the palette index
  const paletteDivisor = Math.round(0x10000 / paletteCanvas.width);

  const wrapperSize = createElementSize(wrapper);
  const canvasSize = createElementSize(canvasRef);

  const frameTimes: number[] = [];
  const [fps, setFps] = createSignal(0);

  createEffect(() => {
    // translate the configured color gain into a colorMax value
    const { colorMin } = state.palette;
    const range = 1 - colorMin;
    const gain = Math.pow(10, waterfall().colorGain / 50);
    const colorMax = colorMin + range / gain;
    setState("palette", "colorMax", colorMax);
  });

  createEffect(() => {
    const { autoBlackLevelEnabled, blackLevel } = waterfall();
    if (autoBlackLevelEnabled) {
      // Copy the auto black level to the waterfall black level,
      // so the display is consistent when toggling auto black off.
      waterfallController()?.setBlackLevel(
        Math.round((autoBlackLevel() / 0x4000) * 100),
      );
    }

    setState(
      "palette",
      "colorMin",
      autoBlackLevelEnabled ? autoBlackLevel() / 0xffff : blackLevel / 400,
    );
  });

  createEffect(() => {
    const paletteCtx = paletteCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!paletteCtx) return;
    const { gradients, colorMin, colorMax } = state.palette;
    const { stops } = gradients[waterfall().gradientIndex];
    setBlack(stops[0].color);
    const gradient = paletteCtx.createLinearGradient(
      0,
      0,
      paletteCanvas.width,
      paletteCanvas.height,
    );
    const range = colorMax - colorMin;
    stops.forEach(({ offset, color }) => {
      gradient.addColorStop(offset * range + colorMin, color);
    });

    paletteCtx.fillStyle = gradient;
    paletteCtx.fillRect(0, 0, paletteCanvas.width, paletteCanvas.height);
    const imageData = paletteCtx.getImageData(
      0,
      0,
      paletteCanvas.width,
      paletteCanvas.height,
    );

    // NEW: build packed 32-bit palette once per update
    const u32 = new Uint32Array(4096);
    for (let i = 0; i < 4096; i++) {
      const o = i * 4;
      u32[i] = packRGBA(
        imageData.data[o + 0] | 0,
        imageData.data[o + 1] | 0,
        imageData.data[o + 2] | 0,
        imageData.data[o + 3] | 0,
      );
    }
    setPalette32(u32);
  });

  createEffect(() => {
    setWidthMultiplier(
      (binBandwidth() * wrapperSize.width) / (pan().bandwidthMHz * 1_000_000),
    );
  });

  createEffect(() => {
    setLineDurationMs(waterfall().lineDurationMs ?? 0);
  });

  const totalSeconds = createMemo(() => {
    const { height } = canvasSize;
    const duration = lineDurationMs();
    if (!height || !duration) return 0;
    return (height * duration) / 1000;
  });

  const formatSeconds = (value: number) => {
    if (!Number.isFinite(value)) return "";
    if (value <= -10) return `${Math.round(value).toFixed(0)}s`;
    if (value <= -1) return `${value.toFixed(0)}s`;
    if (value >= 0) return "0s";
    return `${value.toFixed(2)}s`;
  };

  const onWaterfall = createMemo(() => {
    // console.log("Waterfall handler created");
    const canvas = canvasRef();
    if (!canvas) return;
    const screenCtx = canvas.getContext("2d");
    if (!screenCtx) return;
    screenCtx.imageSmoothingEnabled = false;

    const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
    if (!offscreen) return;
    const offscreenCtx = offscreen.getContext("2d");
    if (!offscreenCtx) return;
    offscreenCtx.imageSmoothingEnabled = false;

    let frameStartTime = performance.now();
    let expFrame = 0;
    let lastFrame = -1;

    // NEW: reusable strip buffer (avoid per-packet alloc)
    let stripImageData: ImageData | null = null;
    let strip32: Uint32Array | null = null;
    let stripRow: Uint32Array | null = null;
    let stripW = 0;
    let stripH = 0;
    const ensureStrip = (w: number, h: number) => {
      if (!stripImageData || stripW !== w || stripH !== h) {
        stripImageData = offscreenCtx.createImageData(w, h);
        strip32 = new Uint32Array(stripImageData.data.buffer);
        stripW = w;
        stripH = h;
      }
      if (!stripRow || stripRow.length !== w) {
        stripRow = new Uint32Array(w);
      }
    };

    let paintScheduled = false;
    const paint = () => {
      paintScheduled = false;
      screenCtx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    };

    return ({ packet }: UdpPacketEvent<"waterfall">) => {
      const tile = packet.tile;
      const binBandwidth = tile.binBandwidth.freqHz;
      const firstBinFreq = tile.frameLowFreq.freqHz;
      const autoBlackLevel = tile.autoBlackLevel;
      const binsInThisFrame = tile.width;
      const totalBins = tile.totalBinsInFrame;
      const startingBin = tile.firstBinIndex;
      const frame = tile.timecode;
      const height = tile.height;
      const bins = tile.data;
      if (tile.lineDurationMs > 0) {
        setLineDurationMs(tile.lineDurationMs);
      }

      if (startingBin === 0) {
        frameStartTime = performance.now();
      }

      if (expFrame > 0 && expFrame !== frame) {
        console.warn(
          `Received frame ${frame} does not match expected frame ${expFrame}.`,
        );
      }

      setAutoBlackLevel(autoBlackLevel);

      const bandwidth = totalBins * binBandwidth;
      const calculatedCenter = firstBinFreq + binBandwidth + bandwidth / 2;

      if (frame > lastFrame) {
        frameStartTime = performance.now();
        const scale = (lastBandwidth() || bandwidth) / bandwidth;
        setLastBandwidth(bandwidth);

        let src: CanvasImageSource =
          offscreen.width === totalBins ? offscreen : canvas;
        if (offscreen.width !== totalBins) {
          offscreen.width = totalBins;
        }

        const xOffset =
          (lastCalculatedCenter() - calculatedCenter) / binBandwidth;
        const scaleWidth = Math.max(1, Math.round(offscreen.width * scale));
        const scaleOffset = Math.round(
          xOffset * scale + (offscreen.width - scaleWidth) / 2,
        );

        offscreenCtx.fillStyle = black();
        if (scale < 1.0) {
          // shrink path: draw from last on-screen image to avoid smearing
          src = canvas;
          offscreenCtx.fillRect(0, 0, offscreen.width, offscreen.height);
        }

        const yOffset = (frame - lastFrame) * height;
        offscreenCtx.drawImage(
          src,
          scaleOffset,
          yOffset,
          scaleWidth,
          offscreen.height,
        );

        if (scaleOffset !== 0) {
          offscreenCtx.fillRect(
            scaleOffset > 0 ? 0 : offscreen.width + scaleOffset,
            yOffset,
            Math.abs(scaleOffset),
            offscreen.height,
          );
        }
      }

      // We got a packet out of order, so we compute the offset to draw it in the correct place.
      const yOffset = lastFrame > frame ? (lastFrame - frame) * height : 0;
      lastFrame = frame;

      // FAST PATH: write only the incoming strip, using packed Uint32 palette
      {
        const pal32 = palette32();
        const w = binsInThisFrame;
        const h = height;
        ensureStrip(w, h);

        // Fill the strip: replicate each bin color vertically for 'height' rows
        // line layout is row-major: [row][x]
        for (let x = 0; x < w; x++) {
          const idx = (bins[x] / paletteDivisor) | 0; // 0..4095
          stripRow![x] = pal32[idx];
        }
        strip32!.set(stripRow!, 0);
        let filled = w;
        const total = w * h;
        while (filled < total) {
          const copyCount = Math.min(filled, total - filled);
          strip32!.copyWithin(filled, 0, copyCount);
          filled += copyCount;
        }

        // Keep your working shim (-1) to maintain current visual alignment
        offscreenCtx.putImageData(stripImageData!, startingBin - 1, yOffset);
      }

      if (startingBin + binsInThisFrame >= totalBins) {
        if (canvas.width !== offscreen.width) {
          setCanvasWidth(offscreen.width);
        }

        // Coalesce to one paint per frame
        if (!paintScheduled) {
          paintScheduled = true;
          requestAnimationFrame(paint);
        }

        frameTimes.push(performance.now() - frameStartTime);
        if (frameTimes.length > 10) frameTimes.shift();
        const avgFrameTime =
          frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        setFps(Math.round(1000 / avgFrameTime));

        setBinBandwidth(binBandwidth);
        setLastCalculatedCenter(calculatedCenter);
        const panStreamId = waterfall().panadapterStreamId;
        if (panStreamId && state.status.panadapter[panStreamId]) {
          // Data packets reflect the new tuning; mark the panadapter center as settled.
          const centerMHz = Number((calculatedCenter / 1_000_000).toFixed(6));
          setState(
            "status",
            "panadapter",
            panStreamId,
            "centerFrequencyMHz",
            centerMHz,
          );
          setState(
            "runtime",
            ["panSettledCenterMHz", "panPendingCenterMHz"],
            panStreamId,
            centerMHz,
          );
        }
        expFrame = Math.max(frame + 1, expFrame);
      }
    };
  });

  createEffect(() => {
    const handler = onWaterfall();
    if (!handler) return;
    const subscription = waterfallController()?.on("data", handler);
    if (!subscription) return;
    onCleanup(subscription.unsubscribe);
  });

  return (
    <div
      ref={setWrapper}
      class="relative size-full flex justify-center overflow-visible select-none"
    >
      <canvas
        class="absolute shrink-0 select-none scale-x-[var(--width-multiplier)] translate-x-[var(--drag-offset)]"
        ref={setCanvasRef}
        width={canvasWidth()}
        height={window.screen.height}
        style={{
          "--width-multiplier": widthMultiplier(),
        }}
      />

      <Portal>
        <div class="fixed top-12 left-2 -z-50 text-lg font-bold text-emerald-400/50">
          {fps()}
        </div>
      </Portal>
      <Show when={totalSeconds() > 0}>
        <div class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-background/50">
          <div class="relative h-full px-1.5 flex items-center">
            <LinearScale
              min={-totalSeconds()}
              max={0}
              class="h-full"
              tickClass="pr-0.5"
              labelClass="text-[10px] font-semibold scale-text-shadow"
              lineClass="bg-primary/25"
              tickLength={9}
              tickSpacing={60}
              showTicks={false}
              showMin={false}
              showMax={false}
              format={formatSeconds}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
