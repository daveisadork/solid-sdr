const LINE_SPEED_MIN = 0;
const LINE_SPEED_MAX = 100;
const LINE_DURATION_OFFSET_MS = 40;

export function clampLineSpeed(value: number): number {
  if (!Number.isFinite(value)) return LINE_SPEED_MIN;
  if (value <= LINE_SPEED_MIN) return LINE_SPEED_MIN;
  if (value >= LINE_SPEED_MAX) return LINE_SPEED_MAX;
  return Math.round(value);
}

export function lineSpeedToDurationMs(speed: number): number {
  const clamped = clampLineSpeed(speed);
  const delta = 100 - clamped;
  return LINE_DURATION_OFFSET_MS + Math.floor((delta * delta * delta) / 200);
}
