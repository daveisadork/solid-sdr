export function formatMegahertz(value: number): string {
  return value.toFixed(6);
}

export function formatDbm(value: number): string {
  return value.toFixed(6);
}

export function formatBooleanFlag(value: boolean): string {
  return value ? "1" : "0";
}

export function ensureFinite(value: number, label = "value"): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`);
  }
  return value;
}

export function toInteger(value: number, label = "value"): number {
  return Math.round(ensureFinite(value, label));
}

export function formatInteger(value: number, label = "value"): string {
  return toInteger(value, label).toString(10);
}

/**
 * Clamps a value within optional minimum and maximum bounds.
 */
export function clampNumber(
  value: number,
  min?: number,
  max?: number,
): number {
  let result = value;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

/**
 * Rounds a value to the nearest integer before clamping it into the range.
 */
export function clampInteger(
  value: number,
  min: number,
  max: number,
  label = "value",
): number {
  const rounded = toInteger(value, label);
  return clampNumber(rounded, min, max);
}

export function buildDisplaySetCommand(
  prefix: string,
  stream: string,
  entries: Record<string, string>,
  extras: readonly string[] = [],
): string {
  const parts = Object.entries(entries).map(
    ([key, value]) => `${key}=${value}`,
  );
  const entriesSegment = parts.length > 0 ? ` ${parts.join(" ")}` : "";
  const extrasSegment = extras.length > 0 ? ` ${extras.join(" ")}` : "";
  return `${prefix} ${stream}${entriesSegment}${extrasSegment}`;
}
