import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import * as MeterPrimitive from "@kobalte/core/meter";

import useFlexRadio, { type MeterState } from "~/context/flexradio";
import { cn, dbmToWatts, range } from "~/lib/utils";
import { usePreferences } from "~/context/preferences";

type MeterProps = MeterPrimitive.MeterRootOptions & {
  class?: string | undefined;
  meter: MeterState;
  style?: JSX.CSSProperties;
  label?: JSX.Element;
  stops?: Array<string | number>;
  minStops?: number;
  containTickLabels?: boolean;
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

function Meter(props: MeterProps) {
  const { radio } = useFlexRadio();
  const [value, setValue] = createSignal(0);

  createEffect(() => {
    const sub = radio()
      ?.meter(props.meter?.id)
      ?.on("data", ({ value }) => setValue(value));
    onCleanup(() => sub?.unsubscribe());
  });

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

  const ticks = createMemo(() => [
    false,
    ...stops()
      .slice(1, -1)
      .map(() => true),
    false,
  ]);

  const tickLabels = createMemo(() =>
    stops().map((value, index, arr) => ({
      value,
      index,
      isEdge: index === 0 || index === arr.length - 1,
      isMax: index === arr.length - 1,
      isMin: index === 0,
    })),
  );

  return (
    <MeterPrimitive.Root
      value={props.value ?? value()}
      minValue={props.minValue ?? props.meter.low}
      maxValue={props.maxValue ?? props.meter.high}
      getValueLabel={
        props.getValueLabel ??
        (({ value }) => `${value.toFixed(1)} ${props.meter.units}`)
      }
      class="flex gap-1 w-full items-center"
    >
      <div class="relative flex flex-col w-full gap-0.5 items-center">
        <MeterPrimitive.Track class="relative w-full h-2.5 @container">
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
        </MeterPrimitive.Track>
        <div class="w-full border-x border-transparent text-[0.5rem] flex justify-between font-sans items-center">
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
                    props.tickLabelFilter ? props.tickLabelFilter(label) : true
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
      </div>
      <MeterPrimitive.ValueLabel class="font-medium text-xs/tight whitespace-pre textbox-edge-cap-alphabetic textbox-trim-both" />
    </MeterPrimitive.Root>
  );
}

export function TxMeter() {
  const { preferences } = usePreferences();
  const { radio, state } = useFlexRadio();
  const [fwdPwrWatts, setFwdPwrWatts] = createSignal(0);
  const [refPwrWatts, setRefPwrWatts] = createSignal(0);
  const fwdPwrMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "FWDPWR"),
  );

  const refPwrMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "REFPWR"),
  );

  createEffect(() => {
    const sub = radio()
      ?.meter(fwdPwrMeter()?.id)
      ?.on("data", (event) => setFwdPwrWatts(dbmToWatts(event.value, 1)));
    onCleanup(() => sub?.unsubscribe());
  });

  createEffect(() => {
    const sub = radio()
      ?.meter(refPwrMeter()?.id)
      ?.on("data", (event) => setRefPwrWatts(dbmToWatts(event.value, 1)));
    onCleanup(() => sub?.unsubscribe());
  });

  const swr = createMemo(() => {
    const fwdWatts = fwdPwrWatts();
    if (fwdWatts === 0) return 1;
    const x = Math.sqrt(refPwrWatts() / fwdWatts);
    return (1 + x) / (1 - x);
  });

  return (
    <Switch>
      <Match when={preferences.sliceTxMeter === "power"}>
        <Show when={fwdPwrMeter()}>
          {(acc) => {
            const meter = acc();
            return (
              <Meter
                meter={meter}
                maxValue={state.status.radio.maxInternalPaPowerWatts * 1.2}
                value={fwdPwrWatts()}
                containTickLabels
                tickLabelFilter={({ index, isEdge }) =>
                  index % 2 === 0 && !isEdge
                }
                getValueLabel={({ value }) =>
                  `${Math.round(value)}W`.padStart(5, " ")
                }
              />
            );
          }}
        </Show>
      </Match>
      <Match when={preferences.sliceTxMeter === "swr"}>
        <Show when={refPwrMeter()}>
          {(acc) => {
            const meter = acc();
            return (
              <Meter
                meter={meter}
                minValue={1}
                maxValue={3}
                value={swr()}
                containTickLabels
                tickLabelFilter={({ index }) => index % 2 === 0}
                getValueLabel={() => {
                  // We don't use the passed in value because it's clamped to the maxValue,
                  // and we want to show the actual SWR even if it exceeds the max.
                  return `${(Math.round(swr() * 10) / 10).toPrecision(2)}:1`.padStart(
                    5,
                    " ",
                  );
                }}
              />
            );
          }}
        </Show>
      </Match>
    </Switch>
  );
}
