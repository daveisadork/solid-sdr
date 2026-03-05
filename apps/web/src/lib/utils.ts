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
