import useFlexRadio from "~/context/flexradio";
import { For, Show } from "solid-js";
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
  const radio = () => state.status.radio;

  const formatNumber = (value: number | null | undefined, digits = 1) => {
    if (value === undefined || value === null) return undefined;
    if (!Number.isFinite(value)) return undefined;
    return value.toFixed(digits).replace(/\.?0+$/, "");
  };

  const extraDetails = () => {
    const current = radio();
    if (!current) return [];
    const entries: Array<{ label: string; value: string }> = [];
    if (current.gpsStatus)
      entries.push({ label: "Status", value: current.gpsStatus });
    if (current.gpsUtcTime)
      entries.push({ label: "UTC Time", value: current.gpsUtcTime });
    if (current.gpsAltitude)
      entries.push({ label: "Altitude", value: current.gpsAltitude });
    if (current.gpsSpeed)
      entries.push({ label: "Speed", value: current.gpsSpeed });
    if (current.gpsFreqError)
      entries.push({ label: "Freq. Error", value: current.gpsFreqError });
    const trackFormatted = formatNumber(current.gpsTrack, 1);
    if (trackFormatted)
      entries.push({ label: "Track", value: `${trackFormatted}°` });
    const tracked = current.gpsSatellitesTracked;
    const visible = current.gpsSatellitesVisible;
    if (tracked !== undefined || visible !== undefined) {
      entries.push({
        label: "Satellites",
        value: `${tracked ?? "–"}/${visible ?? "–"}`,
      });
    }
    if (typeof current.gpsGnssPoweredAntenna === "boolean") {
      entries.push({
        label: "GNSS Antenna",
        value: current.gpsGnssPoweredAntenna ? "Powered" : "Passive",
      });
    }
    return entries;
  };

  return (
    <div
      class={cn(
        "flex items-center w-full gap-4 cursor-default select-none",
        props.class,
      )}
    >
      <Show when={radio().gpsGrid}>
        <HoverCard>
          <HoverCardTrigger
            as={"div"}
            class="flex gap-1 items-center font-mono"
          >
            <BaselineGpsFixed />
            <span class="textbox-trim-both textbox-edge-cap-alphabetic">
              {radio().gpsGrid}
            </span>
          </HoverCardTrigger>
          <HoverCardContent class="w-80 fancy-bg-background">
            <div class="flex justify-between space-x-4">
              <div class="space-y-1">
                <TextField
                  class="grid w-full max-w-sm items-center gap-1.5"
                  value={radio().gpsGrid}
                  readOnly
                >
                  <TextFieldLabel for="grid-square">Grid Square</TextFieldLabel>
                  <TextFieldInput />
                </TextField>
                <NumberField
                  class="grid w-full max-w-sm items-center gap-1.5"
                  value={radio().gpsLatitude}
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
                  value={radio().gpsLongitude}
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
            <Show when={extraDetails().length > 0}>
              <Separator class="my-3" />
              <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <For each={extraDetails()}>
                  {(item) => (
                    <>
                      <dt class="font-medium text-foreground">{item.label}</dt>
                      <dd class="font-mono text-right text-foreground/80">
                        {item.value}
                      </dd>
                    </>
                  )}
                </For>
              </dl>
            </Show>
          </HoverCardContent>
        </HoverCard>
      </Show>
      <Show when={radio().gpsUtcTime}>
        <span class="font-mono textbox-trim-both textbox-edge-cap-alphabetic">
          {radio().gpsUtcTime}
        </span>
      </Show>
    </div>
  );
}
