/// <reference lib="webworker" />

import {
  CONTROL_BINS,
  CONTROL_BUF,
  CONTROL_BYTES,
  CONTROL_LENGTH,
  CONTROL_SEQ,
  DATA_LENGTH,
  MAX_BINS,
} from "./panadapter-protocol";

// Panadapter rendering worker. Owns the canvas transferred from the main
// thread and does all FFT rasterization off the main thread. The main thread
// writes bin data straight into a shared buffer and bumps a sequence counter;
// this worker waits on that counter (Atomics.waitAsync, so its event loop stays
// free for config messages), then draws the most recently completed frame from
// shared memory. No per-packet messaging or copying crosses the thread boundary.
//
// Sizing: the backing store is set from the *expected* panadapter dimensions
// (pan.width/height) times the integer device scale, so it stays stable across
// the radio's lag between requesting a resize and actually applying it. The
// horizontal draw scale is then derived per frame from the *actual* data
// (canvas.width / totalBins). In steady state that ratio equals the device
// scale (integer → bins land on whole device pixels, crisp); during the radio's
// catch-up window it goes fractional, so stale-size frames draw a touch blurry
// across the full canvas instead of leaving uncovered regions that flash.

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

type Stop = { offset: number; color: string };

interface Config {
  /** Expected bin count (pan.width). */
  width: number;
  /** Bin-space height (pan.height); also the palette lookup length. */
  height: number;
  /** Integer device scale (rounded devicePixelRatio). */
  scale: number;
  /** Per-amplitude colour lookup, length === height. */
  paletteCss: string[];
  fillStyle: "gradient" | "solid";
  peakStyle: "line" | "points";
  gradientStyle: string;
  gradientStops: Stop[];
  showFps: boolean;
}

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let config: Config | null = null;
let fillGradient: CanvasGradient | null = null;

let control: Int32Array | null = null;
let fftData: Uint16Array | null = null;
let lastSeq = 0;

// Draw-capacity measurement: accumulate time spent in drawFrame and report
// 1000 / average-draw-time once a second.
let drawAccumMs = 0;
let drawCount = 0;
let lastReport = performance.now();

function applyConfig(next: Config): void {
  config = next;
  if (!canvas || !ctx) return;
  const backingWidth = next.width * next.scale;
  const backingHeight = next.height * next.scale;
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
  ctx.imageSmoothingEnabled = false;
  rebuildGradient();
}

// Gradients can't cross the worker boundary, so rebuild from the stops. Built
// in bin-space coordinates (0..height) and mapped to device pixels by the
// transform set in drawFrame.
function rebuildGradient(): void {
  if (!ctx || !config) return;
  const gradient = ctx.createLinearGradient(0, config.height, 0, 0);
  if (config.gradientStyle === "classic") {
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 1)");
  } else {
    for (const { offset, color } of config.gradientStops) {
      gradient.addColorStop(offset, color);
    }
  }
  fillGradient = gradient;
}

function drawFrame(bins: Uint16Array, totalBins: number): void {
  if (!canvas || !ctx || !config) return;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h || totalBins <= 0) return;

  const binHeight = config.height;
  const scaleX = w / totalBins;
  const scaleY = h / binHeight;
  const colors = config.paletteCss;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.lineWidth = 1;

  const { peakStyle, fillStyle } = config;

  if (fillStyle === "gradient") {
    const gradient = fillGradient ?? "white";
    if (peakStyle === "points") {
      // Discrete columns under each point, gradient-filled — keeps the columns
      // pixel-aligned with the point markers drawn on top.
      ctx.fillStyle = gradient;
      for (let i = 0; i < totalBins; i++) {
        const y = bins[i];
        ctx.fillRect(i, y, 1, binHeight - y);
      }
    } else {
      // Outline the trace and fill it in one path.
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, binHeight);
      ctx.lineTo(0, bins[0]);
      for (let i = 0; i < totalBins; i++) {
        ctx.lineTo(i, bins[i]);
      }
      ctx.lineTo(totalBins - 1, binHeight);
      ctx.closePath();
      ctx.fill();
    }
  } else if (fillStyle === "solid") {
    // One scale-wide fillRect per bin (bar from its peak down to the floor).
    let currentColor = "";
    for (let i = 0; i < totalBins; i++) {
      const y = bins[i];
      const color = colors[y];
      if (!color) continue;
      if (color !== currentColor) {
        ctx.fillStyle = color;
        currentColor = color;
      }
      ctx.fillRect(i, y, 1, binHeight - y);
    }
  }

  if (peakStyle === "line") {
    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(0, bins[0]);
    for (let i = 0; i < totalBins; i++) {
      ctx.lineTo(i, bins[i]);
    }
    ctx.stroke();
  } else if (peakStyle === "points") {
    ctx.fillStyle = "white";
    for (let i = 0; i < totalBins; i++) {
      ctx.fillRect(i, bins[i], 1, 1);
    }
  }
}

// Draw the latest completed frame, if the sequence counter advanced. Reading
// the latest slot means that if the writer published several frames while we
// were busy, we naturally coalesce to the newest one and skip the stale ones.
function handleWake(): void {
  if (!control || !fftData) return;
  const seq = Atomics.load(control, CONTROL_SEQ);
  if (seq !== lastSeq) {
    lastSeq = seq;
    const buf = Atomics.load(control, CONTROL_BUF);
    const totalBins = Atomics.load(control, CONTROL_BINS);
    const base = buf * MAX_BINS;
    const t0 = performance.now();
    drawFrame(fftData.subarray(base, base + totalBins), totalBins);
    drawAccumMs += performance.now() - t0;
    drawCount++;
  }
  reportCapacity();
  waitForFrame();
}

// Report draw *capacity* — how many times per second drawFrame could run at its
// current per-call cost (1000 / average draw time). This is a headroom gauge,
// independent of the actual frame arrival rate: it shows how far we can exceed
// the display refresh and how expensive each panadapter style is. Measured in
// the worker so it reflects real raster cost, free of main-thread jitter.
function reportCapacity(): void {
  const now = performance.now();
  if (now - lastReport < 1000) return;
  if (drawCount > 0 && config?.showFps) {
    const avgMs = drawAccumMs / drawCount;
    workerScope.postMessage({ type: "fps", value: Math.round(1000 / avgMs) });
  }
  drawAccumMs = 0;
  drawCount = 0;
  lastReport = now;
}

function waitForFrame(): void {
  if (!control) return;
  const result = Atomics.waitAsync(control, CONTROL_SEQ, lastSeq);
  if (result.async) {
    result.value.then(handleWake);
  } else {
    // Counter already moved past lastSeq — draw immediately and re-arm.
    handleWake();
  }
}

type IncomingMessage =
  | { type: "init"; canvas: OffscreenCanvas; sab: SharedArrayBuffer }
  | { type: "config"; config: Config };

workerScope.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case "init": {
      canvas = msg.canvas;
      ctx = canvas.getContext("2d", { colorSpace: "display-p3" });
      control = new Int32Array(msg.sab, 0, CONTROL_LENGTH);
      fftData = new Uint16Array(msg.sab, CONTROL_BYTES, DATA_LENGTH);
      // Start from whatever has already been published so we don't replay old
      // frames, then arm the wait loop.
      lastSeq = Atomics.load(control, CONTROL_SEQ);
      if (config) applyConfig(config);
      waitForFrame();
      break;
    }
    case "config": {
      applyConfig(msg.config);
      break;
    }
  }
};
