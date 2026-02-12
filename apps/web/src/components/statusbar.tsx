import useFlexRadio from "~/context/flexradio";
import { createEffect, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";
import Connect from "./connect";
import { GpsStatus } from "./gps-status";

export function StatusBar() {
  const { state } = useFlexRadio();
  const [meters] = createStore(state.status.meter);

  const [voltageId, setVoltageId] = createSignal<number | string>();
  const [tempId, setTempId] = createSignal<number | string>();

  createEffect(() => {
    if (state.status.meter[voltageId()!]) return;
    for (const meterId in meters) {
      const { name, value } = meters[meterId];
      if (name === "+13.8A" && value !== undefined) {
        setVoltageId(meterId);
        return;
      }
    }
    setVoltageId(undefined);
  });

  createEffect(() => {
    if (state.status.meter[tempId()!]) return;
    for (const meterId in meters) {
      const { name, value } = meters[meterId];
      if (name === "PATEMP" && value !== undefined) {
        setTempId(meterId);
        return;
      }
    }
    setTempId(undefined);
  });

  return (
    <div
      class="flex shrink-0 items-center w-full gap-4 py-2 px-3 text-sm font-mono select-none"
      classList={{
        "bg-background/50 backdrop-blur-xl":
          state.display.enableTransparencyEffects,
        "bg-background": !state.display.enableTransparencyEffects,
      }}
    >
      <Connect />
      <Show when={state.clientHandle} keyed>
        <Show when={voltageId()} keyed>
          {(id) => (
            <span class="textbox-trim-both textbox-edge-cap-alphabetic">
              {meters[id].value?.toFixed(2)}V
            </span>
          )}
        </Show>
        <Show when={tempId()} keyed>
          {(id) => {
            const { value, units } = meters[id];
            return (
              <span class="textbox-trim-both textbox-edge-cap-alphabetic">{`${value?.toPrecision(3)}${units?.replace("deg", "°")}`}</span>
            );
          }}
        </Show>
        <GpsStatus class="justify-self-end justify-end" />
      </Show>
    </div>
  );
}
