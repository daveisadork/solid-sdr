import { roundToDecimals } from "./utils";

/**
 * Pure frequency<->pixel math for a panafall.
 *
 * All x values are cell-local pixels: offsets from the left edge of the
 * panadapter wrapper's content box.
 */
export interface PanScale {
  /** CSS pixel width of the panadapter wrapper. */
  width: number;
  /** Absolute center frequency in MHz. */
  centerMHz: number;
  /** Displayed bandwidth in MHz. */
  bandwidthMHz: number;
}

const FREQ_DECIMALS = 6;

export function isValidScale(scale: PanScale): boolean {
  return Boolean(scale.bandwidthMHz && scale.width);
}

export function pxPerMHz(scale: PanScale): number {
  if (!isValidScale(scale)) return 0;
  return scale.width / scale.bandwidthMHz;
}

export function mhzPerPx(scale: PanScale): number {
  if (!isValidScale(scale)) return 0;
  return scale.bandwidthMHz / scale.width;
}

export function mhzToPx(scale: PanScale, mhz: number): number {
  if (!isValidScale(scale)) return 0;
  return mhz * pxPerMHz(scale);
}

export function pxToMHz(scale: PanScale, px: number): number {
  if (!isValidScale(scale)) return 0;
  return roundToDecimals(px * mhzPerPx(scale), FREQ_DECIMALS);
}

export function xToFreq(scale: PanScale, x: number): number {
  if (!isValidScale(scale)) return 0;
  const offsetMHz = pxToMHz(scale, x - scale.width / 2);
  return roundToDecimals(scale.centerMHz + offsetMHz, FREQ_DECIMALS);
}

export function freqToX(scale: PanScale, freq: number): number {
  if (!isValidScale(scale)) return 0;
  const offsetMHz = freq - scale.centerMHz;
  return scale.width / 2 + mhzToPx(scale, offsetMHz);
}
