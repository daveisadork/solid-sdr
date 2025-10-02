import ResizablePrimitive, {
  DynamicProps,
  HandleProps,
} from "@corvu/resizable";
import { createElementSize } from "@solid-primitives/resize-observer";
import {
  createEffect,
  createSignal,
  For,
  Show,
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

type ResizableHandleProps<T extends ValidComponent = "button"> =
  HandleProps<T> & {
    class?: string;
    streamId: string;
  };

export const Scale = <T extends ValidComponent = "button">(
  props: DynamicProps<T, ResizableHandleProps<T>>,
) => {
  const [, rest] = splitProps(props as ResizableHandleProps, ["class"]);
  const { state } = useFlexRadio();
  const [gridFreqs, setGridFreqs] = createSignal<
    Array<{ label: string; offset: number }>
  >([]);
  const [ref, setRef] = createSignal<HTMLDivElement>();
  const size = createElementSize(ref);

  createEffect(() => {
    if (!size.width) return;
    const { center, bandwidth } = state.status.display.pan[props.streamId];
    const start = center - bandwidth * 2;
    const end = center + bandwidth * 2;

    const mhzPerPx = bandwidth / size.width;
    const minSpacing = 72 * mhzPerPx;
    const stepSize =
      stepSizes.find((s) => s >= minSpacing) || stepSizes[stepSizes.length - 1];
    const precision =
      stepPrecision[stepSize as keyof typeof stepPrecision] || 1;
    const actualStart = center - bandwidth / 2;
    const freqs = [];
    for (let freq = Math.floor(start); freq <= end; freq += stepSize) {
      if (freq < start) continue;
      // const label = Math.round(freq * 1_000_000).toLocaleString("de-DE");
      let value = freq;
      let unit = "M";
      let fixedPrecision = precision;
      if (value > 1000) {
        value = freq / 1000;
        unit = "G";
        fixedPrecision = Math.max(1, precision - 3);
      } else if (1 > value) {
        value = freq * 1_000;
        unit = "K";
        fixedPrecision = Math.max(1, precision - 3);
      }

      const label = `${value.toFixed(fixedPrecision)}${unit}`;
      const offset = (freq - actualStart) / mhzPerPx;
      // convert to string with thousand separator
      freqs.push({ label, offset });
    }
    setGridFreqs(freqs);
  });
  return (
    <ResizablePrimitive.Handle
      class={cn(
        "relative flex w-full h-4 justify-around select-none font-mono z-10 translate-x-[var(--drag-offset)]",
        props.class,
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
