import { createElementSize } from "@solid-primitives/resize-observer";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import useFlexRadio, { PacketEvent } from "~/context/flexradio";

export function Waterfall({ streamId }: { streamId: string }) {
  const { events, state, setState } = useFlexRadio();
  const [waterfall, setWaterfall] = createStore(
    state.status.display.waterfall[streamId],
  );
  const [pan, setPan] = createStore(
    state.status.display.pan[waterfall.panadapter],
  );
  const [canvasWidth, setCanvasWidth] = createSignal(waterfall.x_pixels);
  const [widthMultiplier, setWidthMultiplier] = createSignal(1.0);
  const [binBandwidth, setBinBandwidth] = createSignal(1);
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  const [wrapper, setWrapper] = createSignal<HTMLDivElement>();
  const [lastCalculatedCenter, setLastCalculatedCenter] = createSignal(0);
  const [expectedFrame, setExpectedFrame] = createSignal(0);
  const [lastBandwidth, setLastBandwidth] = createSignal(0);
  const [autoBlackLevel, setAutoBlackLevel] = createSignal(0);
  const [black, setBlack] = createSignal("#000000");

  // 4096 colors to stay under canvas size limits on iOS
  const paletteCanvas = new OffscreenCanvas(4096, 1);
  const [palette, setPalette] = createSignal(
    new Uint8ClampedArray(paletteCanvas.width * 4),
  );

  // Used to map the 16-bit waterfall value to the palette index
  const paletteDivisor = Math.round(0x10000 / paletteCanvas.width);

  const wrapperSize = createElementSize(wrapper);
  const canvasSize = createElementSize(canvasRef);
  const streamIdInt = parseInt(streamId, 16);

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
      colorSpace: "display-p3",
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
    setPalette(imageData.data);
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
      (binBandwidth() * waterfall.x_pixels) / 1_000_000 / pan.bandwidth,
    );
  });

  createEffect(() => {
    setPan("center", lastCalculatedCenter() / 1_000_000);
  });

  const onWaterfall = createMemo(() => {
    const canvas = canvasRef();
    if (!canvas) return;
    const screenCtx = canvas.getContext("2d", {
      colorSpace: "display-p3",
    });
    if (!screenCtx) return;
    const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
    if (!offscreen) return;
    const context = offscreen.getContext("2d", {
      colorSpace: "display-p3",
    });
    if (!context) return;
    context.fillStyle = "oklch(0.145 0 0)";

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

      const expFrame = expectedFrame();
      const droppedFrameOffset = frame - expFrame;
      if (expFrame > 0 && expFrame !== frame) {
        console.warn(
          `Received frame ${frame} does not match expected frame ${expFrame}.`,
        );
      }

      setAutoBlackLevel(autoBlackLevel);

      const bandwidth = totalBins * binBandwidth;
      const calculatedCenter = firstBinFreq + binBandwidth + bandwidth / 2;
      if (startingBin === 0) {
        context.fillStyle = black();
        const scale = lastBandwidth() / bandwidth;
        setLastBandwidth(bandwidth);
        let src = offscreen.width === totalBins ? offscreen : canvas;
        if (offscreen.width !== totalBins) {
          offscreen.width = totalBins;
        }
        const offset = Math.round(
          (lastCalculatedCenter() - calculatedCenter) / binBandwidth,
        );
        const scaleWidth = Math.round(offscreen.width * scale);
        const scaleOffset = Math.round(
          offset * scale + (offscreen.width - scaleWidth) / 2,
        );
        if (scale < 1.0) {
          src = canvas;
          context.fillRect(0, 0, offscreen.width, offscreen.height);
        }
        context.drawImage(
          src,
          scaleOffset,
          height + droppedFrameOffset,
          scaleWidth,
          offscreen.height,
        );
        if (offset !== 0) {
          context.fillRect(
            offset > 0 ? 0 : offscreen.width + scaleOffset,
            height + droppedFrameOffset,
            Math.abs(scaleOffset),
            offscreen.height,
          );
        }
      }

      const p = palette();
      const imageData = context.createImageData(totalBins, height);
      for (let index = 0; index < totalBins; index++) {
        const y = (bins[index] / paletteDivisor) | 0; // 0-4095 to index into palette
        imageData.data.set(p.subarray(y * 4, y * 4 + 4), index * 4); // Copy first 4 bytes (RGBA)
      }
      context.putImageData(imageData, startingBin - 1, 0);

      if (startingBin + binsInThisFrame >= totalBins) {
        if (canvas.width !== offscreen.width) {
          setCanvasWidth(offscreen.width);
        }
        screenCtx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
        setBinBandwidth(binBandwidth);
        setLastCalculatedCenter(calculatedCenter);
        setExpectedFrame(frame + 1);
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
      class="relative size-full flex justify-center margin-auto overflow-visible select-none"
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
    </div>
  );
}
