import useFlexRadio, { Meter } from "~/context/flexradio";
import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  splitProps,
  ValidComponent,
} from "solid-js";

import * as MeterPrimitive from "@kobalte/core/meter";
import { cn } from "~/lib/utils";

const S9 = -73;
const STOPS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "+10",
  "+20",
  "+30",
  "+40",
  "+50",
  "",
];

type LevelMeterProps<T extends ValidComponent = "div"> =
  MeterPrimitive.MeterRootProps<T> & {
    class?: string | undefined;
    compressionThreshold?: number | undefined;
    compressionFactor?: number | undefined;
    hideValueLabel?: boolean | undefined;
    sliceIndex?: string | undefined;
  };

export const LevelMeter = <T extends ValidComponent = "div">(
  props: LevelMeterProps<T>,
) => {
  const [local, rest] = splitProps(props, [
    "class",
    "sliceIndex",
    "compressionThreshold",
    "compressionFactor",
    "hideValueLabel",
  ]);
  const { state, setState } = useFlexRadio();
  const [meterId, setMeterId] = createSignal<string>();

  createEffect(() => {
    const sliceIndex = Number(local.sliceIndex);
    if (state.status.slice[meterId()!]) {
      return;
    }
    for (const meterId in state.status.meter) {
      const meter: Meter = state.status.meter[meterId];
      if (
        meter &&
        meter.source === "SLC" &&
        meter.sourceIndex === sliceIndex &&
        meter.name === "LEVEL"
      ) {
        setMeterId(meterId);
        return;
      }
    }
    setMeterId(undefined);
  });

  const scaleMeterValue = createMemo(() => {
    const { compressionFactor, compressionThreshold } = local;
    if (
      compressionFactor === undefined ||
      compressionFactor === 1 ||
      compressionThreshold === undefined
    ) {
      return (value: number) => value;
    }
    return (value: number) =>
      value < compressionThreshold
        ? value
        : (value - compressionThreshold) * compressionFactor +
          compressionThreshold;
  });

  const unscaleMeterValue = createMemo(() => {
    const { compressionFactor, compressionThreshold } = local;
    if (
      compressionFactor === undefined ||
      compressionFactor === 1 ||
      compressionThreshold === undefined
    ) {
      return (value: number) => value;
    }
    return (value: number) =>
      value < compressionThreshold
        ? value
        : (value - compressionThreshold) / compressionFactor +
          compressionThreshold;
  });

  const getValueLabel = createMemo(
    (): MeterPrimitive.MeterRootOptions["getValueLabel"] => {
      const unscale = unscaleMeterValue();
      if (!state.settings.sMeterEnabled) {
        return (params) => `${Math.round(unscale(params.value))}dBm`;
      }
      return (params) => {
        const value = unscale(params.value);
        // This meter is in dBm. S9 is -73 dBm, and each S unit is 6 dB.
        // We start by subtracting -73 so S9 is 0. That way the rest of the math
        // is a little easier, we can divide by 6 and add 9 to get the S unit.
        // Anything above S9 is S9 + the number of dB over S9.
        const adjustedValue = Math.round(value - S9);
        // const overS9 =
        //   adjustedValue > 0
        //     ? `+${adjustedValue.toString().padStart(2, " ")}`
        //     : "";
        // return ` S${Math.min(9, Math.max(0, Math.floor(adjustedValue / 6) + 9))}\n${overS9.padEnd(3, " ")}`;
        const label =
          adjustedValue > 0
            ? `S9+${adjustedValue}`
            : `S${Math.max(Math.floor(adjustedValue / 6) + 9, 0)}`;
        return label.padEnd(5, " ");
      };
    },
  );

  return (
    <Show when={state.status.meter[meterId()]} keyed>
      {(meter) => (
        <MeterPrimitive.Root
          class={cn(
            "relative flex gap-1 w-full items-center select-none cursor-default",
            local.class,
          )}
          value={scaleMeterValue()(meter.value)}
          minValue={-133} // This would actually be 6dB below S0
          // The official app's signal meter is non-linear.
          // The actual range is from -133 dBm (6 dB below S0) to -13 dBm (S9 + 60 dB),
          // but the app compresses the range above S9.
          maxValue={scaleMeterValue()(-13)} // S9+60
          onClick={() => setState("settings", "sMeterEnabled", (v) => !v)}
          getValueLabel={getValueLabel()}
          {...rest}
        >
          <div class="relative flex flex-col w-full gap-0.5">
            <MeterPrimitive.Track class="relative w-full h-2.5">
              <div
                class="absolute inset-0 border border-transparent rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-50% to-red-500 to-70% bg-origin-border"
                style={{
                  mask: "linear-gradient(black 0 0) padding-box, linear-gradient(black 0 0)",
                  "mask-composite": "exclude",
                }}
              />
              <MeterPrimitive.Fill
                class="absolute inset-0 rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-50% to-red-500 to-70%"
                style={{
                  "will-change": "clip-path",
                  "clip-path":
                    "inset(0 calc(100% - var(--kb-meter-fill-width)) 0 0)",
                  transition: `clip-path ${1 / (meter.fps || 4)}s linear`,
                }}
              />
              <div class="absolute inset-px flex">
                <For each={STOPS.filter((_, i) => i % 2)}>
                  {(value) => (
                    <div class="size-full translate-x-1/2 flex flex-col items-center">
                      <Show when={value}>
                        <hr class="h-full w-px bg-foreground/50 border-none" />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </MeterPrimitive.Track>
            <div class="w-full border-x border-transparent text-[0.5rem] flex font-sans">
              <For each={STOPS.filter((_, i) => i % 2)}>
                {(value) => (
                  <div class="min-w-0 grow shrink basis-0 h-1.5 translate-x-1/2 flex flex-col items-center justify-center">
                    <Show when={value}>
                      <span class="textbox-edge-cap-alphabetic textbox-trim-both">
                        {value}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
          <Show when={!local.hideValueLabel}>
            <MeterPrimitive.ValueLabel class="font-medium text-xs/tight whitespace-pre textbox-edge-cap-alphabetic textbox-trim-both" />
          </Show>
        </MeterPrimitive.Root>
      )}
    </Show>
  );
};
