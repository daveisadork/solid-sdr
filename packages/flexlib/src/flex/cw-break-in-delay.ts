import { clampNumber } from "./controller-helpers.js";

const BREAK_IN_DELAY_MAX_MS = 2000;
const CW_SPEED_MIN_WPM = 5;
const CW_SPEED_MAX_WPM = 100;
/** PARIS-standard dit length: 1200 ms divided by words per minute. */
const DIT_MS_NUMERATOR = 1200;

/**
 * Smallest `cw break_in_delay` the radio will accept at a given keying speed.
 *
 * The firmware requires the delay to exceed one dit length, comparing in whole
 * milliseconds — so the floor is the truncated dit plus one. Derived from the
 * radio's own rejections: 13 ms first becomes valid at exactly 93 wpm, and 5 wpm
 * needs 241 ms, both of which this reproduces and a plain ceiling does not.
 *
 * Note this constrains the `cw`/`transmit` delay only. The CWX delay is a
 * separate radio value whose range really is 0–2000 ms; when `synccwx` is on the
 * radio tries to mirror one onto the other and reports a range error if the cw
 * half fails, leaving the two legitimately out of step.
 */
export function minBreakInDelayMs(speedWpm: number): number {
  const speed = Number.isFinite(speedWpm)
    ? clampNumber(Math.floor(speedWpm), CW_SPEED_MIN_WPM, CW_SPEED_MAX_WPM)
    : CW_SPEED_MIN_WPM;
  return Math.floor(DIT_MS_NUMERATOR / speed) + 1;
}

/** Clamps a `cw break_in_delay` into the range valid at `speedWpm`. */
export function clampBreakInDelayMs(delayMs: number, speedWpm: number): number {
  const min = minBreakInDelayMs(speedWpm);
  const rounded = Number.isFinite(delayMs) ? Math.floor(delayMs) : min;
  return clampNumber(rounded, min, BREAK_IN_DELAY_MAX_MS);
}
