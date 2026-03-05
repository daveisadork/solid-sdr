import useFlexRadio from "~/context/flexradio";
import { createMemo, Show } from "solid-js";
import Connect from "./connect";
import { GpsStatus } from "./gps-status";

export function StatusBar() {
  const { state } = useFlexRadio();

  const voltageMeter = createMemo(() =>
    Object.values(state.status.meter).find(
      (meter) => meter.name === "+13.8A" && meter.value !== undefined,
    ),
  );
  const tempMeter = createMemo(() =>
    Object.values(state.status.meter).find(
      (meter) => meter.name === "PATEMP" && meter.value !== undefined,
    ),
  );

  return (
    <div class="flex shrink-0 items-center w-full gap-4 py-2 px-3 text-sm font-mono select-none z-0 fancy-bg-background">
      <Connect />
      <Show when={voltageMeter()}>
        {(meter) => (
          <span class="textbox-trim-both textbox-edge-cap-alphabetic">
            {meter().value?.toFixed(2)}V
          </span>
        )}
      </Show>
      <Show when={tempMeter()}>
        {(meter) => (
          <span class="textbox-trim-both textbox-edge-cap-alphabetic">{`${meter().value?.toPrecision(3)}${meter().units?.replace("deg", "°")}`}</span>
        )}
      </Show>
      <GpsStatus class="justify-self-end justify-end" />
    </div>
  );
}
