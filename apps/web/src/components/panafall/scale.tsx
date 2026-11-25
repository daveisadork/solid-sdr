import { createElementSize } from "@solid-primitives/resize-observer";
import type { ComponentProps } from "@solidjs/web";
import { ResizableHandle } from "@ui-sdk/solid/resizable";
import { createEffect, createMemo, createSignal, For, omit } from "solid-js";
import type { PanadapterState } from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import { cn } from "~/lib/utils";

const stepSizes = [
  1e-6, 5e-6, 1e-5, 2.5e-5, 5e-5, 0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005,
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100,
];

const stepPrecision = {
  2.5e-5: 6,
  5e-5: 5,
  0.0001: 4,
  0.00025: 5,
  0.0005: 4,
  0.001: 3,
  0.0025: 4,
  0.005: 3,
  0.01: 2,
  0.025: 3,
  0.05: 2,
  0.1: 1,
  0.25: 2,
  0.5: 1,
  1: 1,
  2.5: 1,
  5: 1,
  10: 1,
  25: 1,
  50: 1,
  100: 1,
};

export type FrequencyGridTick = {
  value: number;
  label: string;
  offset: number;
};

export function buildFrequencyGrid(params: {
  centerFrequencyMHz: number;
  bandwidthMHz: number;
  width: number;
  alignmentOffset: number;
  minPixelSpacing?: number;
}): FrequencyGridTick[] {
  const {
    centerFrequencyMHz,
    bandwidthMHz,
    width,
    alignmentOffset = 0,
    minPixelSpacing = 72,
  } = params;
  if (!width || width <= 0 || !Number.isFinite(bandwidthMHz)) return [];

  const start = centerFrequencyMHz - bandwidthMHz * 2;
  const end = centerFrequencyMHz + bandwidthMHz * 2;
  const mhzPerPx = bandwidthMHz / width;
  const minSpacing = minPixelSpacing * mhzPerPx;
  const stepSize =
    stepSizes.find((s) => s >= minSpacing) || stepSizes[stepSizes.length - 1];
  const precision = stepPrecision[stepSize as keyof typeof stepPrecision] || 1;
  const actualStart = centerFrequencyMHz - bandwidthMHz / 2;
  const ticks: FrequencyGridTick[] = [];

  for (let freq = Math.floor(start); freq <= end; freq += stepSize) {
    if (freq < start) continue;
    let value = freq;
    let unit = "M";
    let fixedPrecision = precision;
    if (value > 1000) {
      value = freq / 1000;
      unit = "G";
      fixedPrecision = Math.max(1, precision - 3);
    } else if (value < 1) {
      value = freq * 1_000;
      unit = "k";
      fixedPrecision = Math.max(1, precision - 3);
    }

    const label = `${value.toFixed(fixedPrecision)}${unit}`;
    const offset = (freq - actualStart) / mhzPerPx + alignmentOffset;
    ticks.push({ value: freq, label, offset });
  }

  return ticks;
}

type ScaleProps = Omit<ComponentProps<typeof ResizableHandle>, "class"> & {
  class?: string;
  pan: PanadapterState;
  onGridChange?: (ticks: FrequencyGridTick[]) => void;
};

export const Scale = (props: ScaleProps) => {
  const rest = omit(props, "class", "pan", "onGridChange");
  const [ref, setRef] = createSignal<HTMLDivElement>();
  const size = createElementSize(ref);
  const { preferences } = usePreferences();

  const gridFreqs = createMemo<FrequencyGridTick[]>((prev) => {
    const { width } = size;
    if (!width) return prev ?? [];
    const { centerFrequencyMHz, bandwidthMHz } = props.pan;
    return buildFrequencyGrid({
      bandwidthMHz,
      centerFrequencyMHz,
      width,
      alignmentOffset: preferences.panadapterOffset,
    });
  });

  createEffect(gridFreqs, (ticks) => {
    props.onGridChange?.(ticks);
  });

  return (
    <div class="relative overflow-visible w-full h-0">
      <ResizableHandle
        {...rest}
        class={cn(
          "fancy-bg-background flex items-center w-full h-freq-scale bottom-freq-scale justify-around select-none font-mono z-(--z-cell-overlays) translate-x-(--drag-offset)",
          props.class,
        )}
        ref={setRef}
      >
        <For each={gridFreqs()}>
          {({ label, offset }) => (
            <div
              class="text-xs absolute top-0 left-(--offset) -translate-x-1/2 textbox-edge-cap-alphabetic"
              style={{ "--offset": `${offset}px` }}
            >
              {label}
            </div>
          )}
        </For>
      </ResizableHandle>
    </div>
  );
};
