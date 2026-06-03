import { usePreferences } from "../../context/preferences";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { SimpleSwitch } from "../ui/simple-switch";
import { createEffect, Match, Show, Switch } from "solid-js";
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
import { useAudio } from "~/context/audio";
import { AudioLevelMeter } from "../ui/audio-level-meter";
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

const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();

function InnerAudioSettings() {
  const { remoteAudioTxStream, remoteAudioRxStream } = useAudio();
  const { preferences, setPreferences } = usePreferences();

  const outputs = createSpeakers();
  const inputs = createMicrophones();

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
        <AudioLevelMeter stream={remoteAudioRxStream()} channelMode="both" />
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
        <AudioLevelMeter stream={remoteAudioTxStream()} channelMode="both" />
        <Show when={supportedConstraints?.autoGainControl}>
          <SimpleSwitch
            checked={preferences.remoteAudio.tx.autoGainControl}
            onChange={(checked) =>
              setPreferences("remoteAudio", "tx", "autoGainControl", checked)
            }
            label="Auto Gain Control"
          />
        </Show>
        <Show when={supportedConstraints?.echoCancellation}>
          <SimpleSwitch
            checked={preferences.remoteAudio.tx.echoCancellation}
            onChange={(checked) =>
              setPreferences("remoteAudio", "tx", "echoCancellation", checked)
            }
            label="Echo Cancellation"
          />
        </Show>
        <Show when={supportedConstraints?.noiseSuppression}>
          <SimpleSwitch
            checked={preferences.remoteAudio.tx.noiseSuppression}
            onChange={(checked) =>
              setPreferences("remoteAudio", "tx", "noiseSuppression", checked)
            }
            label="Noise Suppression"
          />
        </Show>
        <Show when={supportedConstraints?.voiceIsolation}>
          <SimpleSwitch
            checked={preferences.remoteAudio.tx.voiceIsolation}
            onChange={(checked) =>
              setPreferences("remoteAudio", "tx", "voiceIsolation", checked)
            }
            label="Voice Isolation"
          />
        </Show>
      </CardContent>
    </Card>
  );
}

export function AudioSettings() {
  const { radio, state } = useFlexRadio();
  const audioPermission = createPermission("microphone");

  createEffect(() => {
    if (audioPermission() === "prompt") {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
    }
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
