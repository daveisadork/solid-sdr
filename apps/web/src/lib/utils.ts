import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a frequency in MHz to a human-readable label.
 * @param {number} frequencyMHz - The frequency in MHz.
 * @returns {string} The formatted frequency label.
 */
export function frequencyToLabel(frequencyMHz: number): string {
  if (frequencyMHz >= 1000) {
    return `${(frequencyMHz / 1000).toFixed(2)} GHz`;
  } else if (frequencyMHz >= 1) {
    return `${frequencyMHz.toFixed(2)} MHz`;
  } else {
    return `${(frequencyMHz * 1000).toFixed(0)} kHz`;
  }
}

/**
 * Converts radians to degrees.
 * @param {number} rad - The angle in radians.
 * @returns {number} The angle in degrees.
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Converts degrees to radians.
 * @param {number} deg - The angle in degrees.
 * @returns {number} The angle in radians.
 */
export function degToRad(deg: number): number {
  return Number(((deg * Math.PI) / 180).toFixed(6));
}

export function roundToDevicePixels(px: number) {
  const dpr = Number(window.devicePixelRatio?.toFixed(2) || 1);
  return Math.round(px * dpr) / dpr;
}

export function roundToDecimals(num: number, decimals?: number) {
  if (decimals === undefined) return num;
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

const packRGBA = (r: number, g: number, b: number, a: number) =>
  (a << 24) | (b << 16) | (g << 8) | (r << 0);

export async function loadGradientPNG(
  url: string,
  colorMin: number,
  colorMax: number,
  width = 4096,
): Promise<Uint32Array> {
  console.log(
    `Loading gradient from ${url} with range [${colorMin}, ${colorMax}]`,
  );
  // 1. Load image
  const img = new Image();
  img.src = url;
  img.decoding = "async";

  await img.decode();

  if (img.width !== width || img.height !== 1) {
    throw new Error(
      `Expected ${width}x1 image, got ${img.width}x${img.height}`,
    );
  }

  // 2. Draw into canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 1;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");

  ctx.drawImage(img, colorMin * width, 0, (colorMax - colorMin) * width, 1);

  // 3. Read pixels
  const data = ctx.getImageData(0, 0, width, 1).data;

  // 4. Pack into Uint32
  const out = new Uint32Array(width);

  for (let i = 0; i < 4096; i++) {
    const o = i * 4;
    out[i] = packRGBA(
      data[o + 0] | 0,
      data[o + 1] | 0,
      data[o + 2] | 0,
      data[o + 3] | 0,
    );
  }

  return out;
}

export function dbmToWatts(dbm: number, decimalPlaces?: number) {
  const watts = Math.pow(10, (dbm - 30) / 10);
  return roundToDecimals(watts, decimalPlaces);
}

export function range(start: number, end?: number, step = 1): number[] {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  const length = Math.max(Math.ceil((end - start) / step), 0);
  return Array.from({ length }, (_, i) => start + i * step);
}

export const synchronizeMaps = <K, V>(
  target: Map<K, V>,
  source?: ReadonlyMap<K, V> | null,
): void => {
  if (!source) return target.clear();
  for (const key of target.keys()) {
    if (!source.has(key)) target.delete(key);
  }
  for (const [key, value] of source) {
    target.set(key, value);
  }
};

window.syncMaps = synchronizeMaps;

export interface SynchronizeMapsBenchmarkOptions {
  size?: number;
  iterations?: number;
  warmupIterations?: number;
  churn?: number;
}

export interface SynchronizeMapsBenchmarkResult {
  size: number;
  iterations: number;
  warmupIterations: number;
  churn: number;
  totalMs: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  opsPerSecond: number;
  finalSize: number;
}

const getNow = () => globalThis.performance?.now?.() ?? Date.now();

export const benchmarkSynchronizeMaps = ({
  size = 10_000,
  iterations = 100,
  warmupIterations = 10,
  churn = Math.max(1, Math.floor(size * 0.05)),
}: SynchronizeMapsBenchmarkOptions = {}): SynchronizeMapsBenchmarkResult => {
  const normalizedSize = Math.max(0, Math.trunc(size));
  const normalizedIterations = Math.max(1, Math.trunc(iterations));
  const normalizedWarmupIterations = Math.max(0, Math.trunc(warmupIterations));
  const normalizedChurn = Math.max(
    0,
    Math.min(normalizedSize, Math.trunc(churn)),
  );

  const source = new Map<number, number>();
  const target = new Map<number, number>();

  const prepareSource = (iteration: number) => {
    const start = normalizedChurn * iteration;
    source.clear();

    for (let i = 0; i < normalizedSize; i++) {
      const key = start + i;
      source.set(key, key);
    }
  };

  const runPass = (runIterations: number) => {
    let totalMs = 0;
    let minMs = Number.POSITIVE_INFINITY;
    let maxMs = 0;

    for (let iteration = 0; iteration < runIterations; iteration++) {
      prepareSource(iteration);

      const start = getNow();
      synchronizeMaps(target, source);
      const durationMs = getNow() - start;

      totalMs += durationMs;
      minMs = Math.min(minMs, durationMs);
      maxMs = Math.max(maxMs, durationMs);
    }

    return {
      totalMs,
      minMs: Number.isFinite(minMs) ? minMs : 0,
      maxMs,
    };
  };

  runPass(normalizedWarmupIterations);
  const { totalMs, minMs, maxMs } = runPass(normalizedIterations);
  const averageMs = totalMs / normalizedIterations;

  return {
    size: normalizedSize,
    iterations: normalizedIterations,
    warmupIterations: normalizedWarmupIterations,
    churn: normalizedChurn,
    totalMs,
    averageMs,
    minMs,
    maxMs,
    opsPerSecond: totalMs === 0 ? Number.POSITIVE_INFINITY : 1000 / averageMs,
    finalSize: target.size,
  };
};

window.benchmark = benchmarkSynchronizeMaps;
