import { Key } from "@solid-primitives/keyed";
import { Show } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { SimpleMeter } from "../ui/simple-meter";

function MetersInner() {
  const { state } = useFlexRadio();

  return (
    <div class="flex flex-col gap-4">
      <Key each={Object.values(state.status.meter)} by="id">
        {(meter) => (
          <SimpleMeter
            meter={meter()}
            showTicks
            showTickLabels
            showDescription
            containTickLabels
          />
        )}
      </Key>
    </div>
  );
}

export function Meters() {
  const { state } = useFlexRadio();
  return (
    <DialogContent class="max-h-11/12">
      <DialogHeader>
        <DialogTitle>Meters</DialogTitle>
      </DialogHeader>
      <Show
        when={state.clientHandle}
        fallback={<div class="text-sm w-sm">Not Connected</div>}
      >
        <MetersInner />
      </Show>
    </DialogContent>
  );
}
