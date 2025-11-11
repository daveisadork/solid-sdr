export function formatMegahertz(value: number): string {
  return value.toFixed(6);
}

export function formatDbm(value: number): string {
  return value.toFixed(6);
}

export function formatBooleanFlag(value: boolean): string {
  return value ? "1" : "0";
}

export function formatInteger(value: number): string {
  return Math.round(value).toString(10);
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
