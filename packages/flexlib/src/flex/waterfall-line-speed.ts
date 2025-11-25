import { clampNumber } from "./controller-helpers.js";

const LINE_SPEED_MIN = 0;
const LINE_SPEED_MAX = 100;
const LINE_DURATION_OFFSET_MS = 40;

export function clampLineSpeed(value: number): number {
  const normalized = Number.isFinite(value) ? Math.floor(value) : LINE_SPEED_MIN;
  return clampNumber(normalized, LINE_SPEED_MIN, LINE_SPEED_MAX);
}

export function lineSpeedToDurationMs(speed: number): number {
  const clamped = clampLineSpeed(speed);
  const delta = 100 - clamped;
  return LINE_DURATION_OFFSET_MS + Math.floor((delta * delta * delta) / 200);
}
