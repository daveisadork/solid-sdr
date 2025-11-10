/**
 * Shared types and utilities for radio-state snapshot parsing.
 */

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer U>
    ? U[]
    : T[P] extends Readonly<Record<string, infer V>>
      ? Record<string, V>
      : T[P];
};

type MutableProps<T> = {
  -readonly [P in keyof T]: T[P];
};

export type SnapshotDiff<TSnapshot> = Readonly<
  MutableProps<Partial<Omit<TSnapshot, "raw">>>
>;

export interface SnapshotUpdate<TSnapshot> {
  readonly snapshot: TSnapshot;
  readonly diff: SnapshotDiff<TSnapshot>;
  readonly rawDiff: Readonly<Record<string, string>>;
}

export const EMPTY_ATTRIBUTES: Readonly<Record<string, string>> = Object.freeze(
  {},
);

export function freezeArray<T>(
  input: readonly T[],
  previous?: readonly T[],
): readonly T[] {
  if (previous && arraysShallowEqual(previous, input)) {
    return previous;
  }
  if (!Object.isFrozen(input)) {
    Object.freeze(input as T[]);
  }
  return input;
}

export function freezeAttributes(
  attributes: Record<string, string>,
): Readonly<Record<string, string>> {
  if (Object.keys(attributes).length === 0) {
    return EMPTY_ATTRIBUTES;
  }
  return Object.freeze({ ...attributes });
}

export function arraysShallowEqual<T>(
  previous: readonly T[] | undefined,
  next: readonly T[],
): boolean {
  if (!previous) return false;
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index] !== next[index]) return false;
  }
  return true;
}

export function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "on" ||
    normalized === "yes"
  );
}

export function parseMegahertz(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function parseFloatSafe(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function parseIntegerMaybeHex(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  if (value.startsWith("0x")) {
    const parsed = Number.parseInt(value, 16);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  }
  return parseInteger(value);
}

export function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}

export function parseIntegerList(
  value: string | undefined,
): number[] | undefined {
  if (!value) return undefined;
  const result: number[] = [];
  for (const token of value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    const parsed = Number.parseInt(token, 10);
    if (!Number.isFinite(parsed)) return undefined;
    result.push(parsed);
  }
  return result;
}

export function logUnknownAttribute(
  entity: string,
  key: string,
  value: string,
): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(
      `[radio-state] Unhandled ${entity} attribute`,
      `${key}=${value}`,
    );
  }
}

export function logParseError(
  entity: string,
  key: string,
  value: string,
): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `[radio-state] Failed to parse ${entity} attribute`,
      `${key}=${value}`,
    );
  }
}
