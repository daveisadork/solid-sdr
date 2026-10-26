const HZ_PER_MHZ = 1_000_000;

export type MemoryChannelRef = {
  id: string;
  frequencyMHz: number;
};

/** Nearest hertz. Memory steps compare this, not raw megahertz. */
export function frequencyHz(frequencyMHz: number): number {
  return Math.round(frequencyMHz * HZ_PER_MHZ);
}

function compareIds(a: string, b: string): number {
  const aId = Number(a);
  const bId = Number(b);
  if (Number.isInteger(aId) && Number.isInteger(bId) && aId !== bId) {
    return aId - bId;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareMemoryChannels(
  a: MemoryChannelRef,
  b: MemoryChannelRef,
): number {
  const frequency = frequencyHz(a.frequencyMHz) - frequencyHz(b.frequencyMHz);
  if (frequency !== 0) return frequency;
  return compareIds(a.id, b.id);
}

export function memoryChannelsByFrequency<T extends MemoryChannelRef>(
  channels: readonly T[],
): T[] {
  return channels
    .filter(
      (channel) =>
        typeof channel.id === "string" &&
        channel.id.length > 0 &&
        Number.isFinite(channel.frequencyMHz),
    )
    .toSorted(compareMemoryChannels);
}

/**
 * Step from a slice frequency through memory channels.
 *
 * Positive `delta` moves to higher frequencies. Negative `delta` moves to
 * lower frequencies. A channel at the same hertz as the slice is the current
 * channel, so the step skips it. Past either end, the step wraps.
 */
export function stepMemoryChannel<T extends MemoryChannelRef>(
  channels: readonly T[],
  frequencyMHz: number,
  delta: number,
): T | undefined {
  if (!Number.isFinite(frequencyMHz) || !Number.isFinite(delta)) {
    return undefined;
  }
  const steps = Math.trunc(Math.abs(delta));
  if (steps < 1) return undefined;

  const sorted = memoryChannelsByFrequency(channels);
  const count = sorted.length;
  if (count === 0) return undefined;

  const hz = frequencyHz(frequencyMHz);
  const offset = (steps - 1) % count;
  if (delta > 0) {
    const higherStart = sorted.findIndex(
      (channel) => frequencyHz(channel.frequencyMHz) > hz,
    );
    const start = higherStart === -1 ? 0 : higherStart;
    return sorted[(start + offset) % count];
  }

  let lowerEnd = -1;
  for (let index = 0; index < count; index += 1) {
    if (frequencyHz(sorted[index].frequencyMHz) < hz) lowerEnd = index;
  }
  const start = lowerEnd === -1 ? count - 1 : lowerEnd;
  return sorted[(start - offset + count) % count];
}

/** Picker text for one memory channel. Radio name and mode stay unchanged. */
export function formatMemoryChannelLabel(
  channel:
    | {
        name?: string;
        mode?: string;
        frequencyMHz?: number;
      }
    | undefined,
): string | undefined {
  if (!channel) return undefined;
  const { frequencyMHz, name, mode } = channel;
  if (frequencyMHz === undefined || !Number.isFinite(frequencyMHz)) {
    return undefined;
  }
  const frequency = `${frequencyMHz.toFixed(6)} MHz`;
  return [name?.trim(), frequency, mode?.trim()]
    .filter((part) => part)
    .join(" ");
}
