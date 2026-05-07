import {
  FillStyle,
  PanadapterSettingsStyle,
  PeakStyle,
  usePreferences,
} from "../../context/preferences";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "../ui/segmented-control";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  ValidComponent,
} from "solid-js";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/text-field";
import useFlexRadio from "~/context/flexradio";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectDescription,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { DaxChannelMode } from "~/lib/dax-audio-sink/types";
import { createMicrophones, createSpeakers } from "@solid-primitives/devices";
import { Dynamic } from "solid-js/web";
import Left from "~icons/qlementine-icons/stereo-left-16";
import Right from "~icons/qlementine-icons/stereo-right-16";
import Stereo from "~icons/qlementine-icons/stereo-16";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../ui/switch";
import { useRuntime } from "~/context/runtime";

const CHANNEL_MODE_ICONS = {
  left: Left,
  right: Right,
  both: Stereo,
};

export function DaxSettings() {
  const { audioStreams } = useRuntime();
  const { preferences, setPreferences } = usePreferences();
  const { state } = useFlexRadio();
  const [caps, setCaps] = createSignal<string[]>([]);

  const outputs = createSpeakers();
  const inputs = createMicrophones();

  const daxTxDevice = createMemo(() =>
    inputs().find((d) => d.deviceId === preferences.daxTxConfig.inputDeviceId),
  );

  const daxTxStream = createMemo(() => {
    return audioStreams.get(
      Object.values(state.status.audioStream).find(
        (s) => s.clientHandle === state.clientHandleInt && s.type === "dax_tx",
      )?.id,
    );
  });

  createEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: preferences.daxTxConfig.inputDeviceId,
        },
      })
      .then((stream) => {
        for (const track of stream.getTracks()) {
          setCaps(Object.keys(track.getCapabilities()));
          track.stop();
        }
      })
      .catch((reason) =>
        console.error("Failed get device capabilities:", reason),
      );
  });

  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
      <DialogHeader>
        <DialogTitle>DAX Settings</DialogTitle>
      </DialogHeader>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <Card class="bg-transparent">
          <CardHeader>
            <Switch
              class="flex"
              checked={preferences.daxTxConfig.enabled}
              onChange={(checked) =>
                setPreferences("daxTxConfig", "enabled", checked)
              }
            >
              <SwitchLabel class="grow">
                <CardTitle>DAX TX</CardTitle>
              </SwitchLabel>
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
            </Switch>
            {/* <For each={daxTxStream()?.getAudioTracks()}> */}
            {/*   {(track) => { */}
            {/*     const settings = track.getSettings(); */}
            {/*     return ( */}
            {/*       <CardDescription> */}
            {/*         {[ */}
            {/*           settings.sampleSize ? `${settings.sampleSize}-bit` : null, */}
            {/*           settings.sampleRate */}
            {/*             ? `${settings.sampleRate / 1_000}kHz` */}
            {/*             : null, */}
            {/*         ] */}
            {/*           .filter(Boolean) */}
            {/*           .join(" ")} */}
            {/*       </CardDescription> */}
            {/*     ); */}
            {/*   }} */}
            {/* </For> */}
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            {/* <Show when={daxTxInstance()}> */}
            {/*   <SimpleMeter */}
            {/*     value={Math.max(daxTxLevel(), DAX_LEVEL_METER.low)} */}
            {/*     peakValue={Math.max(daxTxPeak(), DAX_LEVEL_METER.low)} */}
            {/*     meter={DAX_LEVEL_METER} */}
            {/*     label="DAX TX Level" */}
            {/*     showTicks */}
            {/*     showTickLabels */}
            {/*     containTickLabels */}
            {/*     tickLabelFilter={({ index }) => index % 2 === 0} */}
            {/*   /> */}
            {/* </Show> */}
            <div class="flex gap-2">
              <Select
                class="flex flex-col gap-2 grow shrink overflow-hidden"
                value={preferences.daxTxConfig.inputDeviceId}
                onChange={(value: string) => {
                  if (!value) return;
                  setPreferences("daxTxConfig", "inputDeviceId", value);
                }}
                options={inputs().map((d) => d.deviceId)}
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {inputs().find((d) => d.deviceId === props.item.rawValue)
                      ?.label ?? "Default"}
                  </SelectItem>
                )}
              >
                <SelectLabel>Input Device</SelectLabel>
                <SelectTrigger>
                  <SelectValue class="overflow-hidden text-ellipsis whitespace-nowrap">
                    {(state) =>
                      inputs().find(
                        (d) => d.deviceId === state.selectedOption(),
                      )?.label || "Select Audio Input"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
              <Select<DaxChannelMode>
                class="flex flex-col gap-2"
                value={preferences.daxTxConfig.channelMode}
                onChange={(value) => {
                  if (!value) return;
                  setPreferences("daxTxConfig", "channelMode", value);
                }}
                options={["left", "both", "right"]}
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    <div class="flex items-center gap-2">
                      <Dynamic
                        component={CHANNEL_MODE_ICONS[props.item.rawValue]}
                      />
                      <span class="capitalize">{props.item.rawValue}</span>
                    </div>
                  </SelectItem>
                )}
              >
                <SelectLabel>Channel</SelectLabel>
                <SelectTrigger>
                  <SelectValue<DaxChannelMode> class="overflow-hidden text-ellipsis whitespace-nowrap">
                    {(state) => (
                      <Dynamic
                        component={CHANNEL_MODE_ICONS[state.selectedOption()]}
                      />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
            <SimpleSwitch
              checked={preferences.daxTxConfig.reducedBandwidth}
              onChange={(checked) =>
                setPreferences("daxTxConfig", "reducedBandwidth", checked)
              }
              label="Reduced Bandwidth"
            />
            <Show when={caps().length} fallback="Checking capabilities...">
              <Show when={caps().includes("autoGainControl")}>
                <SimpleSwitch
                  checked={preferences.daxTxConfig.autoGainControl}
                  onChange={(checked) =>
                    setPreferences("daxTxConfig", "autoGainControl", checked)
                  }
                  label="Auto Gain Control"
                />
              </Show>
              <Show when={caps().includes("echoCancellation")}>
                <SimpleSwitch
                  checked={preferences.daxTxConfig.echoCancellation}
                  onChange={(checked) =>
                    setPreferences("daxTxConfig", "echoCancellation", checked)
                  }
                  label="Echo Cancellation"
                />
              </Show>
              <Show when={caps().includes("noiseSuppression")}>
                <SimpleSwitch
                  checked={preferences.daxTxConfig.noiseSuppression}
                  onChange={(checked) =>
                    setPreferences("daxTxConfig", "noiseSuppression", checked)
                  }
                  label="Noise Suppression"
                />
              </Show>
              <Show when={caps().includes("voiceIsolation")}>
                <SimpleSwitch
                  checked={preferences.daxTxConfig.voiceIsolation}
                  onChange={(checked) =>
                    setPreferences("daxTxConfig", "voiceIsolation", checked)
                  }
                  label="Voice Isolation"
                />
              </Show>
            </Show>
          </CardContent>
        </Card>
        <For
          each={Array.from(
            { length: state.status.radio.sliceCount },
            (_, i) => i + 1,
          )}
        >
          {(channel) => (
            <Card class="bg-transparent">
              <CardHeader>
                <Switch
                  class="flex"
                  checked={preferences.daxRxConfig[channel].enabled}
                  onChange={(checked) =>
                    setPreferences("daxRxConfig", channel, "enabled", checked)
                  }
                >
                  <SwitchLabel class="grow">
                    <CardTitle>DAX RX {channel}</CardTitle>
                  </SwitchLabel>
                  <SwitchControl>
                    <SwitchThumb />
                  </SwitchControl>
                </Switch>
              </CardHeader>
              <CardContent class="flex flex-col gap-4">
                <div class="flex gap-2">
                  <Select
                    class="flex flex-col gap-2 grow shrink overflow-hidden"
                    value={preferences.daxRxConfig[channel].outputDeviceId}
                    onChange={(value: string) => {
                      if (!value) return;
                      setPreferences(
                        "daxRxConfig",
                        channel,
                        "outputDeviceId",
                        value,
                      );
                    }}
                    options={outputs().map((d) => d.deviceId)}
                    itemComponent={(props) => {
                      return (
                        <SelectItem item={props.item}>
                          {
                            outputs().find(
                              (d) => d.deviceId === props.item.rawValue,
                            )?.label
                          }
                        </SelectItem>
                      );
                    }}
                  >
                    <SelectLabel>Output Device</SelectLabel>
                    <SelectTrigger>
                      <SelectValue class="overflow-hidden text-ellipsis whitespace-nowrap">
                        {(state) =>
                          outputs().find(
                            (d) => d.deviceId === state.selectedOption(),
                          )?.label || "Select Audio Output"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  <Select<DaxChannelMode>
                    class="flex flex-col gap-2"
                    value={preferences.daxRxConfig[channel].channelMode}
                    onChange={(value) => {
                      if (!value) return;
                      setPreferences(
                        "daxRxConfig",
                        channel,
                        "channelMode",
                        value,
                      );
                    }}
                    options={["left", "both", "right"]}
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        <div class="flex items-center gap-2">
                          <Dynamic
                            component={CHANNEL_MODE_ICONS[props.item.rawValue]}
                          />
                          <span class="capitalize">{props.item.rawValue}</span>
                        </div>
                      </SelectItem>
                    )}
                  >
                    <SelectLabel>Channel</SelectLabel>
                    <SelectTrigger>
                      <SelectValue<DaxChannelMode> class="overflow-hidden text-ellipsis whitespace-nowrap">
                        {(state) => (
                          <Dynamic
                            component={
                              CHANNEL_MODE_ICONS[state.selectedOption()]
                            }
                          />
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
        </For>
      </div>
    </DialogContent>
  );
}
