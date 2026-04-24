import useFlexRadio from "~/context/flexradio";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import Connect from "./connect";
import { GpsStatus } from "./gps-status";
import { usePreferences } from "~/context/preferences";
import { FullscreenButton } from "./fullscreen-button";
import { Settings } from "./settings";
import MaterialSymbolsAddChartOutline from "~icons/material-symbols/add-chart-outline";
import { Button } from "@kobalte/core/button";

export function StatusBar() {
  const { state, radio } = useFlexRadio();
  const { preferences } = usePreferences();
  const [voltage, setVoltage] = createSignal<number>();
  const [temp, setTemp] = createSignal<number>();

  const voltageMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "+13.8A"),
  );
  const tempMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "PATEMP"),
  );

  createEffect(() => {
    const sub = radio()
      ?.meter(voltageMeter()?.id)
      ?.on("data", ({ value }) => setVoltage(value));
    onCleanup(() => {
      sub?.unsubscribe();
      setVoltage();
    });
  });

  createEffect(() => {
    const sub = radio()
      ?.meter(tempMeter()?.id)
      ?.on("data", ({ value }) => setTemp(value));
    onCleanup(() => {
      sub?.unsubscribe();
      setTemp();
    });
  });

  return (
    <div
      class="flex shrink-0 items-center w-full gap-4 py-2 px-3 text-sm font-mono select-none z-0 fancy-bg-background"
      classList={{
        "border-t": !preferences.enableTransparencyEffects,
      }}
    >
      <Connect />
      <Show when={radio()}>
        {(radio) => {
          return (
            <Button
              disabled={!state.status.radio?.availablePanadapters}
              onClick={() =>
                radio().createPanadapter({ x: 200 }).catch(console.log)
              }
              class="size-8 not-pointer-coarse:size-5 aspect-square"
            >
              <MaterialSymbolsAddChartOutline class="size-full" />
            </Button>
          );
        }}
      </Show>
      <Show when={voltage() !== undefined}>
        <span class="textbox-trim-both textbox-edge-cap-alphabetic">
          {voltage()?.toFixed(2)}V
        </span>
      </Show>
      <Show when={tempMeter() && temp() !== undefined}>
        <span class="textbox-trim-both textbox-edge-cap-alphabetic">{`${temp()?.toFixed(1)}${tempMeter().units?.replace("deg", "°")}`}</span>
      </Show>
      <div class="grow" />
      <Settings />
      <FullscreenButton />
      <GpsStatus class="justify-self-end justify-end" />
    </div>
  );
}
