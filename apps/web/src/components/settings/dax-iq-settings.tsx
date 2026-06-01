import { usePreferences } from "../../context/preferences";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { For, Show } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { createSpeakers } from "@solid-primitives/devices";
import {
  Switch as SwitchRoot,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "../ui/switch";

export function DaxIqSettings() {
  const { preferences, setPreferences } = usePreferences();
  const { radio } = useFlexRadio();
  const outputs = createSpeakers();

  const maxChannels = () => radio()?.modelInfo.maxDaxIqChannels ?? 0;
  const sampleRates = () => radio()?.modelInfo.daxIqSampleRates ?? [];

  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
      <DialogHeader>
        <DialogTitle>DAX IQ Settings</DialogTitle>
      </DialogHeader>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <Show
          when={maxChannels() > 0}
          fallback={
            <div class="text-muted-foreground">
              This radio does not support DAX IQ.
            </div>
          }
        >
          <For each={Array.from({ length: maxChannels() }, (_, i) => i + 1)}>
            {(channel) => {
              return (
                <Card class="bg-transparent">
                  <CardHeader>
                    <SwitchRoot
                      class="flex"
                      checked={preferences.dax.iq[channel]?.enabled ?? false}
                      onChange={(checked) =>
                        setPreferences("dax", "iq", channel, "enabled", checked)
                      }
                    >
                      <SwitchLabel class="grow flex items-center">
                        <CardTitle>DAX IQ {channel}</CardTitle>
                      </SwitchLabel>
                      <SwitchControl>
                        <SwitchThumb />
                      </SwitchControl>
                    </SwitchRoot>
                  </CardHeader>
                  <CardContent class="flex flex-col gap-4">
                    <div class="flex gap-2">
                      <Select
                        class="flex flex-col gap-2 grow shrink"
                        value={preferences.dax.iq[channel]?.outputDeviceId}
                        onChange={(value: string) => {
                          if (!value) return;
                          setPreferences(
                            "dax",
                            "iq",
                            channel,
                            "outputDeviceId",
                            value,
                          );
                        }}
                        options={outputs().map((d) => d.deviceId)}
                        itemComponent={(props) => (
                          <SelectItem item={props.item}>
                            {
                              outputs().find(
                                (d) => d.deviceId === props.item.rawValue,
                              )?.label
                            }
                          </SelectItem>
                        )}
                      >
                        <SelectLabel>Output Device</SelectLabel>
                        <div class="w-full h-10 relative">
                          <SelectTrigger class="absolute">
                            <SelectValue class="truncate">
                              {(s) =>
                                outputs().find(
                                  (d) => d.deviceId === s.selectedOption(),
                                )?.label || "Select Audio Output"
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </div>
                        <SelectContent />
                      </Select>
                      <Select<number>
                        class="flex flex-col gap-2"
                        value={preferences.dax.iq[channel]?.sampleRate}
                        onChange={(value: number | null) => {
                          if (!value) return;
                          setPreferences(
                            "dax",
                            "iq",
                            channel,
                            "sampleRate",
                            value,
                          );
                        }}
                        options={[...sampleRates()]}
                        itemComponent={(props) => (
                          <SelectItem item={props.item}>
                            {(props.item.rawValue / 1000).toString()} kHz
                          </SelectItem>
                        )}
                      >
                        <SelectLabel>Sample Rate</SelectLabel>
                        <SelectTrigger>
                          <SelectValue<number> class="truncate">
                            {(s) =>
                              `${(s.selectedOption() / 1000).toString()} kHz`
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            }}
          </For>
        </Show>
      </div>
    </DialogContent>
  );
}
