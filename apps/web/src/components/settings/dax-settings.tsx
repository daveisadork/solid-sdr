import { usePreferences } from "../../context/preferences";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
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
import { DaxChannelMode } from "~/lib/dax-audio-sink/types";
import { createMicrophones, createSpeakers } from "@solid-primitives/devices";
import { Dynamic } from "solid-js/web";
import Left from "~icons/qlementine-icons/stereo-left-16";
import Right from "~icons/qlementine-icons/stereo-right-16";
import Stereo from "~icons/qlementine-icons/stereo-16";
import {
  Switch as SwitchRoot,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "../ui/switch";
import { useAudio } from "~/context/audio";
import { DaxDiagnostics } from "./dax-diagnostics";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import { Callout, CalloutContent, CalloutTitle } from "../ui/callout";
import { createPermission } from "~/lib/permission";
import { SimpleSlider } from "../ui/simple-slider";

const CHANNEL_MODE_ICONS = {
  left: Left,
  right: Right,
  both: Stereo,
};

const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();

function InnerDaxSettings() {
  const { daxSinks, daxTxStream } = useAudio();
  const { preferences, setPreferences } = usePreferences();
  const { state } = useFlexRadio();

  const outputs = createSpeakers();
  const inputs = createMicrophones();

  const activeRxChannels = createMemo(() =>
    Array.from(
      { length: state.status.radio.sliceCount },
      (_, i) => i + 1,
    ).filter((ch) => preferences.dax.rx[ch]?.enabled),
  );

  const [diagOpen, setDiagOpen] = createSignal<string[]>([]);
  const diagIsOpen = () => diagOpen().includes("diag");

  return (
    <div
      class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
      style={{ "scrollbar-width": "thin" }}
    >
      <Card class="bg-transparent">
        <CardHeader>
          <SwitchRoot
            class="flex"
            checked={preferences.dax.tx.enabled}
            onChange={(checked) =>
              setPreferences("dax", "tx", "enabled", checked)
            }
          >
            <SwitchLabel class="grow flex items-center">
              <CardTitle>DAX TX</CardTitle>
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
              value={preferences.dax.tx.inputDeviceId}
              onChange={(value: string) => {
                if (!value) return;
                setPreferences("dax", "tx", "inputDeviceId", value);
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
              <div class="relative h-10">
                <SelectTrigger class="absolute">
                  <SelectValue class="shrink truncate">
                    {(state) =>
                      inputs().find(
                        (d) => d.deviceId === state.selectedOption(),
                      )?.label || "Select Audio Input"
                    }
                  </SelectValue>
                </SelectTrigger>
              </div>
              <SelectContent />
            </Select>
            <Select<DaxChannelMode>
              class="flex flex-col gap-2"
              value={preferences.dax.tx.channelMode}
              onChange={(value) => {
                if (!value) return;
                setPreferences("dax", "tx", "channelMode", value);
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
                <SelectValue<DaxChannelMode> class="truncate">
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
          <AudioLevelMeter
            stream={daxTxStream()}
            channelMode={preferences.dax.tx.channelMode}
          />
          <SimpleSwitch
            checked={preferences.dax.tx.reducedBandwidth}
            onChange={(checked) =>
              setPreferences("dax", "tx", "reducedBandwidth", checked)
            }
            label="Reduced Bandwidth"
          />
          <Show when={supportedConstraints?.autoGainControl}>
            <SimpleSwitch
              checked={preferences.dax.tx.autoGainControl}
              onChange={(checked) =>
                setPreferences("dax", "tx", "autoGainControl", checked)
              }
              label="Auto Gain Control"
            />
          </Show>
          <Show when={supportedConstraints?.echoCancellation}>
            <SimpleSwitch
              checked={preferences.dax.tx.echoCancellation}
              onChange={(checked) =>
                setPreferences("dax", "tx", "echoCancellation", checked)
              }
              label="Echo Cancellation"
            />
          </Show>
          <Show when={supportedConstraints?.noiseSuppression}>
            <SimpleSwitch
              checked={preferences.dax.tx.noiseSuppression}
              onChange={(checked) =>
                setPreferences("dax", "tx", "noiseSuppression", checked)
              }
              label="Noise Suppression"
            />
          </Show>
          <Show when={supportedConstraints?.voiceIsolation}>
            <SimpleSwitch
              checked={preferences.dax.tx.voiceIsolation}
              onChange={(checked) =>
                setPreferences("dax", "tx", "voiceIsolation", checked)
              }
              label="Voice Isolation"
            />
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
              <SwitchRoot
                class="flex"
                checked={preferences.dax.rx[channel].enabled}
                onChange={(checked) =>
                  setPreferences("dax", "rx", channel, "enabled", checked)
                }
              >
                <SwitchLabel class="grow flex items-center">
                  <CardTitle>DAX RX {channel}</CardTitle>
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
                  value={preferences.dax.rx[channel].outputDeviceId}
                  onChange={(value: string) => {
                    if (!value) return;
                    setPreferences(
                      "dax",
                      "rx",
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
                  <div class="w-full h-10 relative">
                    <SelectTrigger class="absolute">
                      <SelectValue class="truncate">
                        {(state) =>
                          outputs().find(
                            (d) => d.deviceId === state.selectedOption(),
                          )?.label || "Select Audio Output"
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </div>
                  <SelectContent />
                </Select>
                <Select<DaxChannelMode>
                  class="flex flex-col gap-2"
                  value={preferences.dax.rx[channel].channelMode}
                  onChange={(value: DaxChannelMode) => {
                    if (!value) return;
                    setPreferences("dax", "rx", channel, "channelMode", value);
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
                    <SelectValue<DaxChannelMode> class="truncate">
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
              <AudioLevelMeter
                stream={daxSinks.get(channel)?.stream}
                channelMode={preferences.dax.rx[channel].channelMode}
              />

              <SimpleSlider
                minValue={0}
                maxValue={100}
                step={1}
                value={[preferences.dax.rx[channel].gain]}
                onChange={([value]) =>
                  setPreferences("dax", "rx", channel, "gain", value)
                }
                getValueLabel={({ values }) => `${values[0]}%`}
                label="Gain"
              />
            </CardContent>
          </Card>
        )}
      </For>
      <Accordion multiple value={diagOpen()} onChange={setDiagOpen}>
        <AccordionItem value="diag" class="border rounded-lg">
          <AccordionTrigger>Diagnostics</AccordionTrigger>
          <AccordionContent>
            <Show when={diagIsOpen()}>
              <DaxDiagnostics
                rxChannels={activeRxChannels()}
                showTx={preferences.dax.tx.enabled}
              />
            </Show>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function DaxSettings() {
  const audioPermission = createPermission("microphone");

  createEffect(() => {
    if (audioPermission() === "prompt")
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
  });

  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
      <DialogHeader>
        <DialogTitle>DAX Settings</DialogTitle>
      </DialogHeader>
      <Switch
        fallback={
          <Callout>
            <CalloutTitle>Audio Permissions Required</CalloutTitle>
            <CalloutContent>Waiting for Audio Permissions...</CalloutContent>
          </Callout>
        }
      >
        <Match when={audioPermission() === "granted"}>
          <InnerDaxSettings />
        </Match>
        <Match when={audioPermission() === "denied"}>
          <Callout variant="error">
            <CalloutTitle>Audio Permissions Denied</CalloutTitle>
            <CalloutContent>
              You must grant audio permissions to use DAX features.
            </CalloutContent>
          </Callout>
        </Match>
      </Switch>
    </DialogContent>
  );
}
