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
  const dpr = window.devicePixelRatio || 1;
  return Math.round(px * dpr) / dpr;
}
