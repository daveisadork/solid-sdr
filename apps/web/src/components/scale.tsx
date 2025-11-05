import ResizablePrimitive, {
  DynamicProps,
  HandleProps,
} from "@corvu/resizable";
import { createElementSize } from "@solid-primitives/resize-observer";
import {
  createEffect,
  createSignal,
  For,
  splitProps,
  ValidComponent,
} from "solid-js";
import useFlexRadio from "~/context/flexradio";
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
  minPixelSpacing?: number;
}): FrequencyGridTick[] {
  const {
    centerFrequencyMHz,
    bandwidthMHz,
    width,
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
      unit = "K";
      fixedPrecision = Math.max(1, precision - 3);
    }

    const label = `${value.toFixed(fixedPrecision)}${unit}`;
    const offset = (freq - actualStart) / mhzPerPx - 2;
    ticks.push({ value: freq, label, offset });
  }

  return ticks;
}

type ResizableHandleProps<T extends ValidComponent = "button"> =
  HandleProps<T> & {
    class?: string;
    streamId: string;
    onGridChange?: (ticks: FrequencyGridTick[]) => void;
  };

export const Scale = <T extends ValidComponent = "button">(
  props: DynamicProps<T, ResizableHandleProps<T>>,
) => {
  const [local, rest] = splitProps(props as ResizableHandleProps, [
    "class",
    "streamId",
    "onGridChange",
  ]);
  const { state } = useFlexRadio();
  const [gridFreqs, setGridFreqs] = createSignal<FrequencyGridTick[]>([]);
  const [ref, setRef] = createSignal<HTMLDivElement>();
  const size = createElementSize(ref);

  createEffect(() => {
    if (!size.width) return;
    const { centerFrequencyMHz, bandwidthMHz } =
      state.status.display.pan[local.streamId];
    const ticks = buildFrequencyGrid({
      centerFrequencyMHz,
      bandwidthMHz,
      width: size.width,
    });
    setGridFreqs(ticks);
  });

  createEffect(() => {
    local.onGridChange?.(gridFreqs());
  });
  return (
    <ResizablePrimitive.Handle
      class={cn(
        "relative flex w-full h-4 justify-around select-none font-mono z-10 translate-x-[var(--drag-offset)]",
        local.class,
      )}
      ref={setRef}
      {...rest}
    >
      <For each={gridFreqs()}>
        {({ label, offset }) => (
          <div
            class="text-xs absolute top-0 left-[var(--offset)] -translate-x-1/2"
            style={{ "--offset": `${offset}px` }}
          >
            {label}
            {/* <span class="relative right-1/2">{label}</span> */}
          </div>
        )}
      </For>
    </ResizablePrimitive.Handle>
  );
};
