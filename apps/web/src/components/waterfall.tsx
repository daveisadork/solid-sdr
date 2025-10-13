import { createElementSize } from "@solid-primitives/resize-observer";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Portal } from "solid-js/web";
import useFlexRadio, { PacketEvent } from "~/context/flexradio";

export function Waterfall(props: { streamId: string }) {
  const streamId = () => props.streamId;
  const { events, state, setState } = useFlexRadio();
  const [waterfall, setWaterfall] = createStore(
    state.status.display.waterfall[streamId()],
  );
  const panadapter = () => waterfall.panadapter;
  const [pan, setPan] = createStore(state.status.display.pan[panadapter()]);

  const [canvasWidth, setCanvasWidth] = createSignal(1);
  const [widthMultiplier, setWidthMultiplier] = createSignal(1.0);
  const [binBandwidth, setBinBandwidth] = createSignal(1);
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  const [wrapper, setWrapper] = createSignal<HTMLDivElement>();
  const [lastCalculatedCenter, setLastCalculatedCenter] = createSignal(0);
  const [lastBandwidth, setLastBandwidth] = createSignal(0);
  const [autoBlackLevel, setAutoBlackLevel] = createSignal(0);
  const [black, setBlack] = createSignal("#000000");

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
    const { colorMin } = state.palette;
    const range = 1 - colorMin;
    const gain = Math.pow(10, waterfall.color_gain / 50);
    const colorMax = colorMin + range / gain;
    setState("palette", "colorMax", colorMax);
  });

  createEffect(() => {
    const { black_level, auto_black } = waterfall;

    if (auto_black) {
      // Copy the auto black level to the waterfall black level,
      // so the display is consistent when toggling auto black off.
      setWaterfall(
        "black_level",
        Math.round((autoBlackLevel() / 0x4000) * 100),
      );
    }

    setState(
      "palette",
      "colorMin",
      auto_black ? autoBlackLevel() / 0xffff : black_level / 400,
    );
  });

  createEffect(() => {
    const paletteCtx = paletteCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!paletteCtx) return;
    const { gradients, colorMin, colorMax } = state.palette;
    const { clip, colors } = gradients[waterfall.gradient_index];
    setBlack(colors[0]);
    const gradient = paletteCtx.createLinearGradient(
      0,
      0,
      paletteCanvas.width,
      paletteCanvas.height,
    );
    const stepSize = (colorMax - colorMin) / (colors.length - 1);
    colors.forEach((color, index) => {
      const stop = Math.min(index * stepSize + colorMin, 1.0);
      gradient.addColorStop(stop, color);
    });

    if (clip) {
      gradient.addColorStop(
        Math.min((colors.length - 1) * stepSize + colorMin, 1.0),
        clip,
      );
    }
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
    setWaterfall(
      produce((waterfall) => {
        waterfall.bandwidth = pan.bandwidth;
        waterfall.x_pixels = pan.x_pixels;
      }),
    );
  });

  createEffect(() => {
    const { width } = wrapperSize;
    const { height } = canvasSize;
    if (!width || !height) return;
    setWaterfall(
      produce((waterfall) => {
        waterfall.y_pixels = height;
        waterfall.x_pixels = width;
      }),
    );
  });

  createEffect(() => {
    setWidthMultiplier(
      (binBandwidth() * waterfall.x_pixels) / (pan.bandwidth * 1_000_000),
    );
  });

  createEffect(() => {
    setPan("center", lastCalculatedCenter() / 1_000_000);
  });

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
    let stripW = 0;
    let stripH = 0;
    const ensureStrip = (w: number, h: number) => {
      if (!stripImageData || stripW !== w || stripH !== h) {
        stripImageData = offscreenCtx.createImageData(w, h);
        strip32 = new Uint32Array(stripImageData.data.buffer);
        stripW = w;
        stripH = h;
      }
    };

    let paintScheduled = false;
    const paint = () => {
      paintScheduled = false;
      screenCtx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    };

    const streamIdInt = parseInt(streamId(), 16);

    return ({ packet }: PacketEvent<"waterfall">) => {
      if (packet.stream_id !== streamIdInt) return;
      const {
        payload: {
          binBandwidth,
          firstBinFreq,
          autoBlackLevel,
          binsInThisFrame,
          totalBins,
          startingBin,
          frame,
          height,
          bins,
        },
      } = packet;

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
          const color = pal32[idx];
          for (let r = 0; r < h; r++) {
            strip32![r * w + x] = color;
          }
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
        expFrame = Math.max(frame + 1, expFrame);
      }
    };
  });

  createEffect(() => {
    const handler = onWaterfall();
    if (!handler) return;
    events.addEventListener("waterfall", handler);
    onCleanup(() => {
      events.removeEventListener("waterfall", handler);
    });
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
        <div class="fixed top-12 left-2 z-50 text-lg font-bold text-emerald-400">
          {fps()}
        </div>
      </Portal>
    </div>
  );
}
