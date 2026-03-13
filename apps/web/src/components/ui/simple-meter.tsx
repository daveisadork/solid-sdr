import { createMemo, For, JSX, Show } from "solid-js";
import * as MeterPrimitive from "@kobalte/core/meter";

import { type Meter } from "~/context/flexradio";
import { cn, range } from "~/lib/utils";

type MeterProps = MeterPrimitive.MeterRootOptions & {
  class?: string | undefined;
  meter: Meter;
  style?: JSX.CSSProperties;
  label?: JSX.Element;
  stops?: Array<string | number>;
  minStops?: number;
  showTicks?: boolean;
  showTickLabels?: boolean;
  containTickLabels?: boolean;
  description?: JSX.Element;
  showDescription?: boolean;
  peakValue?: number;
  tickLabelFilter?: (label: {
    value: string | number;
    index: number;
    isEdge: boolean;
    isMax: boolean;
    isMin: boolean;
  }) => boolean;
};

const STEP_SIZES = [
  ...range(1024, 0, -1),
  0.1,
  0.2,
  0.25,
  0.5,
  1,
  2,
  3,
  5,
  6,
  10,
  15,
  20,
  25,
  30,
  32,
  50,
  60,
  64,
  100,
  120,
  128,
  150,
  200,
  250,
  256,
  300,
  500,
  512,
  1000,
  1024,
].toReversed();

export function SimpleMeter(props: MeterProps) {
  const stops = createMemo(() => {
    if (Array.isArray(props.stops)) return props.stops;
    const min = props.minValue ?? props.meter.low;
    const max = props.maxValue ?? props.meter.high;
    const valRange = max - min;
    const minStops = props.minStops ?? 9;
    const maxStops = 16;
    const step =
      STEP_SIZES.find(
        (step) =>
          valRange % step === 0 &&
          valRange / step >= minStops &&
          valRange / step <= maxStops,
      ) ?? valRange / 8;

    if (!step) return [min, max];
    return range(min, max + step, step);
  });

  const ticks = createMemo(() =>
    props.showTicks
      ? [
          false,
          ...stops()
            .slice(1, -1)
            .map(() => true),
          false,
        ]
      : [],
  );

  const tickLabels = createMemo(() =>
    props.showTickLabels
      ? stops().map((value, index, arr) => ({
          value,
          index,
          isEdge: index === 0 || index === arr.length - 1,
          isMax: index === arr.length - 1,
          isMin: index === 0,
        }))
      : [],
  );

  const calculatePeakOffset = createMemo(() => {
    const minValue = props.minValue ?? props.meter.low;
    const maxValue = props.maxValue ?? props.meter.high;

    return (value: number) =>
      `${((value - minValue) / (maxValue - minValue)) * 100}cqw`;
  });

  return (
    <MeterPrimitive.Root
      value={props.value ?? props.meter.value}
      minValue={props.minValue ?? props.meter.low}
      maxValue={props.maxValue ?? props.meter.high}
      getValueLabel={
        props.getValueLabel ??
        (({ value }) => `${value.toFixed(1)} ${props.meter.units}`)
      }
      class="flex flex-col gap-0.5 w-full items-center"
    >
      <div class="relative flex flex-col w-full gap-0.5 items-center">
        <div class="flex w-full items-baseline font-medium">
          <MeterPrimitive.Label>
            {props.label ??
              `${props.meter.name} ${props.meter.source} ${props.meter.sourceIndex}`}
          </MeterPrimitive.Label>
          <div class="grow" />
          <MeterPrimitive.ValueLabel class="font-mono" />
        </div>
        <MeterPrimitive.Track class="relative w-full h-3 @container">
          <div
            class={cn(
              "absolute inset-0 border border-transparent rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-75% to-red-500 bg-origin-border",
              props.class,
            )}
            style={{
              mask: "linear-gradient(#000d 0 0) padding-box, linear-gradient(black 0 0)",
              "mask-composite": "exclude",
            }}
          />
          <MeterPrimitive.Fill
            class={cn(
              "absolute inset-0 rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-75% to-red-500",
              props.class,
            )}
            style={{
              "will-change": "clip-path",
              "clip-path":
                "inset(0 calc(100% - var(--kb-meter-fill-width)) 0 0)",
              transition: `clip-path ${1 / (props.meter.fps || 4)}s linear`,
              ...props.style,
            }}
          />
          <Show when={props.peakValue !== undefined}>
            <div class="absolute inset-0 rounded-xl overflow-hidden">
              <div
                class="absolute inset-y-px w-px bg-foreground translate-x-(--peak-position) will-change-transform"
                style={{
                  transition: `transform ${1 / (props.meter?.fps || 4)}s linear`,
                  "--peak-position": calculatePeakOffset()(props.peakValue!),
                }}
              />
            </div>
          </Show>
          <Show when={props.showTicks}>
            <div class="absolute inset-px flex justify-between">
              <For each={ticks()}>
                {(tick) => (
                  <div class="h-full w-0 flex flex-col items-center">
                    <Show when={tick}>
                      <hr class="h-full w-px bg-border border-none" />
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </MeterPrimitive.Track>
        <Show when={props.showTickLabels}>
          <div class="w-full pt-0.5 border-x border-transparent text-[0.5rem] flex justify-between font-sans items-center">
            <For each={tickLabels()}>
              {(label) => (
                <div
                  class="w-0 basis-0 flex flex-col"
                  classList={{
                    "items-center": !(label.isEdge && props.containTickLabels),
                    "items-start": label.isMin && props.containTickLabels,
                    "items-end": label.isMax && props.containTickLabels,
                  }}
                >
                  <Show
                    when={
                      props.tickLabelFilter
                        ? props.tickLabelFilter(label)
                        : true
                    }
                  >
                    <div class="textbox-edge-cap-alphabetic textbox-trim-both select-none">
                      {label.value}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={props.showDescription}>
          <div class="w-full justify-self-start text-xs text-muted-foreground">
            {props.description ?? props.meter.description}
          </div>
        </Show>
      </div>
    </MeterPrimitive.Root>
  );
}
