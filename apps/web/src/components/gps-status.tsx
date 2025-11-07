import useFlexRadio from "~/context/flexradio";
import { Flex } from "./ui/flex";
import { Show } from "solid-js";
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

  return (
    <Flex class={cn("gap-4 cursor-default select-none", props.class)}>
      <Show when={state.status.radio.gpsGrid}>
        <HoverCard>
          <HoverCardTrigger as={"div"} class="flex items-center font-mono">
            <BaselineGpsFixed />
            {state.status.radio.gpsGrid}
          </HoverCardTrigger>
          <HoverCardContent class="w-80 bg-background/50 backdrop-blur-lg">
            <div class="flex justify-between space-x-4">
              <div class="space-y-1">
                <TextField
                  class="grid w-full max-w-sm items-center gap-1.5"
                  value={state.status.radio.gpsGrid}
                  readOnly
                >
                  <TextFieldLabel for="grid-square">Grid Square</TextFieldLabel>
                  <TextFieldInput />
                </TextField>
                <NumberField
                  class="grid w-full max-w-sm items-center gap-1.5"
                  value={state.status.radio.gpsLatitude}
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
                  value={state.status.radio.gpsLongitude}
                  step={0.000001}
                  format={false}
                  readOnly
                >
                  <NumberFieldLabel for="latitude">Longitude</NumberFieldLabel>
                  <NumberFieldGroup>
                    <NumberFieldInput />
                  </NumberFieldGroup>
                </NumberField>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        <Separator orientation="vertical" />
      </Show>
      <pre>{state.status.radio.gpsUtcTime}</pre>
    </Flex>
  );
}
