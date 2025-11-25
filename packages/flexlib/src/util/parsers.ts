export function valueOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseBooleanFlag(
  value: string | undefined,
): boolean | undefined {
  const normalized = valueOrUndefined(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "1" || normalized === "true" || normalized === "on")
    return true;
  if (normalized === "0" || normalized === "false" || normalized === "off")
    return false;
  return undefined;
}

export function parseFloatSafe(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseIntegerHex(value: string | undefined): number | undefined {
  const trimmed = valueOrUndefined(value);
  if (!trimmed) return undefined;
  const normalized = trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? trimmed.slice(2)
    : trimmed;
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : undefined;
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

export function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}

export function parseCsvList(value: string | undefined): string[] {
  return parseCsv(value) ?? [];
}
