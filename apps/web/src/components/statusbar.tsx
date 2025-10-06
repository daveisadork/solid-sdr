import useFlexRadio from "~/context/flexradio";
import { Flex } from "./ui/flex";
import { createEffect, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";
import Connect from "./connect";
import { GpsStatus } from "./gps-status";

export function StatusBar() {
  const { state } = useFlexRadio();
  const [meters] = createStore(state.status.meters);

  const [voltageId, setVoltageId] = createSignal<number | string>();
  const [tempId, setTempId] = createSignal<number | string>();

  createEffect(() => {
    if (state.status.meters[voltageId()!]) return;
    for (const meterId in meters) {
      const { nam, value } = meters[meterId];
      if (nam === "+13.8A" && value !== undefined) {
        setVoltageId(meterId);
        return;
      }
    }
    setVoltageId(undefined);
  });

  createEffect(() => {
    if (state.status.meters[tempId()!]) return;
    for (const meterId in meters) {
      const { nam, value } = meters[meterId];
      if (nam === "PATEMP" && value !== undefined) {
        setTempId(meterId);
        return;
      }
    }
    setTempId(undefined);
  });

  return (
    <Flex
      class="shrink-0 h-10 w-full gap-4 py-2 px-3 text-sm font-mono select-none z-10"
      classList={{
        "bg-background/50 backdrop-blur-xl":
          state.display.enableTransparencyEffects,
        "bg-background": !state.display.enableTransparencyEffects,
      }}
    >
      <Connect />
      <Show when={state.clientHandle} keyed>
        <Show when={voltageId()} keyed>
          {(id) => <pre>{meters[id].value?.toFixed(2)}V</pre>}
        </Show>
        <Show when={tempId()} keyed>
          {(id) => {
            const { value, unit } = meters[id];
            return (
              <span>{`${value?.toPrecision(3)}${unit?.replace("deg", "°")}`}</span>
            );
          }}
        </Show>
        <GpsStatus class="justify-self-end justify-end" />
      </Show>
    </Flex>
  );
}
