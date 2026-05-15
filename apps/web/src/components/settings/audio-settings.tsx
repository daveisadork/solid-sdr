import { usePreferences } from "../../context/preferences";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  Show,
  Switch,
} from "solid-js";
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
import { createMicrophones, createSpeakers } from "@solid-primitives/devices";
import {
  Switch as SwitchRoot,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "../ui/switch";
import { useRuntime } from "~/context/runtime";
import MaterialSymbolsMic from "~icons/material-symbols/mic";
import MaterialSymbolsSpeaker from "~icons/material-symbols/speaker";
import { Callout, CalloutContent, CalloutTitle } from "../ui/callout";
import { createPermission } from "~/lib/permission";
import { ToggleButton } from "@kobalte/core/toggle-button";
import { SimpleSlider } from "../ui/simple-slider";
import MdiSpeaker from "~icons/mdi/speaker";
import MdiSpeakerOff from "~icons/mdi/speaker-off";
import MdiHeadphones from "~icons/mdi/headphones";
import MdiHeadphonesOff from "~icons/mdi/headphones-off";
import { Dynamic } from "solid-js/web";

function InnerAudioSettings() {
  const { audioStreams } = useRuntime();
  const { preferences, setPreferences } = usePreferences();
  const { state } = useFlexRadio();
  const [caps, setCaps] = createSignal<string[]>([]);

  const outputs = createSpeakers();
  const inputs = createMicrophones();

  const remoteAudioTxDevice = createMemo(() =>
    inputs().find(
      (d) => d.deviceId === preferences.remoteAudio.tx.inputDeviceId,
    ),
  );

  const remoteAudioTxStream = createMemo(() => {
    return audioStreams.get(
      Object.values(state.status.audioStream).find(
        (s) =>
          s.clientHandle === state.clientHandleInt &&
          s.type === "remoteAudio_tx",
      )?.id,
    );
  });

  createEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: preferences.remoteAudio.tx.inputDeviceId,
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
    <Card class="bg-transparent">
      <CardHeader>
        <SwitchRoot
          class="flex"
          checked={preferences.remoteAudio.rx.enabled}
          onChange={(checked) =>
            setPreferences("remoteAudio", "rx", "enabled", checked)
          }
        >
          <SwitchLabel class="grow flex items-center">
            <CardTitle>Remote Audio</CardTitle>
          </SwitchLabel>
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </SwitchRoot>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <SimpleSwitch
          checked={!preferences.remoteAudio.tx.enabled}
          onChange={(checked) =>
            setPreferences("remoteAudio", "tx", "enabled", !checked)
          }
          label="RX Only"
        />
        <Select
          class="flex flex-col gap-2 grow shrink"
          value={preferences.remoteAudio.rx.outputDeviceId}
          onChange={(value: string) => {
            if (!value) return;
            setPreferences("remoteAudio", "rx", "outputDeviceId", value);
          }}
          options={outputs().map((d) => d.deviceId)}
          itemComponent={(props) => {
            return (
              <SelectItem item={props.item}>
                {
                  outputs().find((d) => d.deviceId === props.item.rawValue)
                    ?.label
                }
              </SelectItem>
            );
          }}
        >
          <SelectLabel class="flex items-center gap-1">
            <MaterialSymbolsSpeaker />
            Output Device
          </SelectLabel>
          <SelectTrigger>
            <SelectValue class="truncate">
              {(state) =>
                outputs().find((d) => d.deviceId === state.selectedOption())
                  ?.label || "Select Audio Output"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <Select
          class="flex flex-col gap-2 grow shrink"
          value={preferences.remoteAudio.tx.inputDeviceId}
          onChange={(value: string) => {
            if (!value) return;
            setPreferences("remoteAudio", "tx", "inputDeviceId", value);
          }}
          options={inputs().map((d) => d.deviceId)}
          itemComponent={(props) => (
            <SelectItem item={props.item}>
              {inputs().find((d) => d.deviceId === props.item.rawValue)
                ?.label ?? "Default"}
            </SelectItem>
          )}
        >
          <SelectLabel class="flex items-center gap-1">
            <MaterialSymbolsMic />
            Input Device
          </SelectLabel>
          <SelectTrigger>
            <SelectValue class="truncate">
              {(state) =>
                inputs().find((d) => d.deviceId === state.selectedOption())
                  ?.label || "Select Audio Input"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <Show when={caps().length} fallback="Checking capabilities...">
          <Show when={caps().includes("autoGainControl")}>
            <SimpleSwitch
              checked={preferences.remoteAudio.tx.autoGainControl}
              onChange={(checked) =>
                setPreferences("remoteAudio", "tx", "autoGainControl", checked)
              }
              label="Auto Gain Control"
            />
          </Show>
          <Show when={caps().includes("echoCancellation")}>
            <SimpleSwitch
              checked={preferences.remoteAudio.tx.echoCancellation}
              onChange={(checked) =>
                setPreferences("remoteAudio", "tx", "echoCancellation", checked)
              }
              label="Echo Cancellation"
            />
          </Show>
          <Show when={caps().includes("noiseSuppression")}>
            <SimpleSwitch
              checked={preferences.remoteAudio.tx.noiseSuppression}
              onChange={(checked) =>
                setPreferences("remoteAudio", "tx", "noiseSuppression", checked)
              }
              label="Noise Suppression"
            />
          </Show>
          <Show when={caps().includes("voiceIsolation")}>
            <SimpleSwitch
              checked={preferences.remoteAudio.tx.voiceIsolation}
              onChange={(checked) =>
                setPreferences("remoteAudio", "tx", "voiceIsolation", checked)
              }
              label="Voice Isolation"
            />
          </Show>
        </Show>
      </CardContent>
    </Card>
  );
}

export function AudioSettings() {
  const { radio, state } = useFlexRadio();
  const audioPermission = createPermission("microphone");

  createEffect(() => {
    if (audioPermission() === "unknown")
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
  });

  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
      <DialogHeader>
        <DialogTitle>Audio Settings</DialogTitle>
      </DialogHeader>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <Show when={radio()}>
          <Card class="bg-transparent">
            <CardHeader>
              <CardTitle>Radio Audio</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
              <div class="flex gap-1 items-center">
                <ToggleButton
                  class="aspect-square size-10 inline-flex items-center p-1 rounded-md transition-colors hover:bg-accent"
                  pressed={state.status.radio.lineoutMute}
                  onChange={(pressed) => radio().setLineoutMute(pressed)}
                >
                  <Dynamic
                    component={
                      state.status.radio.lineoutMute
                        ? MdiSpeakerOff
                        : MdiSpeaker
                    }
                    class="size-full"
                  />
                </ToggleButton>
                <SimpleSlider
                  value={[state.status.radio.lineoutGain]}
                  onChange={([value]) => radio().setLineoutGain(value)}
                  minValue={0}
                  maxValue={100}
                  label="Line-Out Level"
                  getValueLabel={({ values: [value] }) => `${value}%`}
                />
              </div>
              <div class="flex gap-1 items-center">
                <ToggleButton
                  class="aspect-square size-10 inline-flex items-center p-1 rounded-md transition-colors hover:bg-accent"
                  pressed={state.status.radio.headphoneMute}
                  onChange={(pressed) => radio().setHeadphoneMute(pressed)}
                >
                  <Dynamic
                    component={
                      state.status.radio.headphoneMute
                        ? MdiHeadphonesOff
                        : MdiHeadphones
                    }
                    class="size-full"
                  />
                </ToggleButton>
                <SimpleSlider
                  value={[state.status.radio.headphoneGain]}
                  onChange={([value]) => radio().setHeadphoneGain(value)}
                  minValue={0}
                  maxValue={100}
                  label="Headphone Level"
                  getValueLabel={({ values: [value] }) => `${value}%`}
                />
              </div>
            </CardContent>
          </Card>
        </Show>
        <Switch
          fallback={
            <Callout>
              <CalloutTitle>Audio Permissions Required</CalloutTitle>
              <CalloutContent>Waiting for Audio Permissions...</CalloutContent>
            </Callout>
          }
        >
          <Match when={audioPermission() === "granted"}>
            <InnerAudioSettings />
          </Match>
          <Match when={audioPermission() === "denied"}>
            <Callout variant="error">
              <CalloutTitle>Audio Permissions Denied</CalloutTitle>
              <CalloutContent>
                You must grant audio permissions to use audio features.
              </CalloutContent>
            </Callout>
          </Match>
        </Switch>
      </div>
    </DialogContent>
  );
}
