import useFlexRadio from "~/context/flexradio";
import { Flex } from "./ui/flex";
import { Show } from "solid-js";
import { createStore } from "solid-js/store";
import { Separator } from "./ui/separator";
import { cn } from "~/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { TextField, TextFieldInput, TextFieldLabel } from "./ui/text-field";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldLabel,
  NumberFieldInput,
} from "./ui/number-field";
import BaselineGpsFixed from "~icons/ic/baseline-gps-fixed";

export function GpsStatus(props: { class?: string }) {
  const { state } = useFlexRadio();
  const [gps] = createStore(state.status.gps);

  return (
    <Flex class={cn("gap-4 cursor-default select-none", props.class)}>
      <Show when={gps.grid}>
        <HoverCard defaultOpen={true}>
          <HoverCardTrigger as={"div"} class="flex items-center font-mono">
            <BaselineGpsFixed />
            {gps.grid}
          </HoverCardTrigger>
          <HoverCardContent class="w-80 bg-background/50 backdrop-blur-lg">
            <div class="flex justify-between space-x-4">
              <div class="space-y-1">
                <TextField
                  class="grid w-full max-w-sm items-center gap-1.5"
                  value={gps.grid}
                  readOnly
                >
                  <TextFieldLabel for="grid-square">Grid Square</TextFieldLabel>
                  <TextFieldInput />
                </TextField>
                <NumberField
                  class="grid w-full max-w-sm items-center gap-1.5"
                  value={gps.lat}
                  format={false}
                  step={0.000001}
                  readOnly
                >
                  <NumberFieldLabel for="latitude">Latitude</NumberFieldLabel>
                  <NumberFieldGroup>
                    <NumberFieldInput />
                  </NumberFieldGroup>
                </NumberField>
                <NumberField
                  class="grid w-full max-w-sm items-center gap-1.5"
                  value={gps.lon}
                  step={0.000001}
                  format={false}
                  readOnly
                >
                  <NumberFieldLabel for="latitude">Longitude</NumberFieldLabel>
                  <NumberFieldGroup>
                    <NumberFieldInput />
                  </NumberFieldGroup>
                </NumberField>
                <pre class="text-xs">{JSON.stringify(gps, null, 2)}</pre>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        <Separator orientation="vertical" />
      </Show>
      <pre>{gps.time}</pre>
    </Flex>
  );
}
