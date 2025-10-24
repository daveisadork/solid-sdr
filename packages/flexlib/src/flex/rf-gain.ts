export interface RfGainInfo {
  readonly low: number;
  readonly high: number;
  readonly step: number;
  readonly markers: readonly number[];
}

export function parseRfGainInfo(payload: string): RfGainInfo | undefined {
  const tokens = payload
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (tokens.length < 3) return undefined;

  const low = Number.parseInt(tokens[0], 10);
  const high = Number.parseInt(tokens[1], 10);
  const step = Number.parseInt(tokens[2], 10);
  if (
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    !Number.isFinite(step)
  ) {
    return undefined;
  }

  const markers: number[] = [];
  for (let index = 3; index < tokens.length; index += 1) {
    const marker = Number.parseInt(tokens[index], 10);
    if (!Number.isFinite(marker)) return undefined;
    markers.push(marker);
  }

  return {
    low,
    high,
    step,
    markers,
  };
}
