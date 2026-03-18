import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { useRtc } from "../context/rtc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { createMicrophones, createSpeakers } from "@solid-primitives/devices";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import MaterialSymbolsMic from "~icons/material-symbols/mic";
import MaterialSymbolsSpeaker from "~icons/material-symbols/speaker";

export default function RtcAudio() {
  const { session, tracks } = useRtc();
  const { state, radio } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();
  const outputs = createSpeakers();
  const inputs = createMicrophones();
  const [remoteAudioRxStreamId, setRemoteAudioRxStreamId] = createSignal<
    string | undefined
  >();
  const [remoteAudioTxStreamId, setRemoteAudioTxStreamId] = createSignal<
    string | undefined
  >();

  createEffect(() => {
    console.log(tracks());
    console.log(remoteAudioTxStreamId());
  });

  onMount(() => {
    navigator.mediaDevices.getUserMedia({ audio: true });
  });

  createEffect(() => {
    const pc = session()?.pc;
    if (!pc) return;
    const desiredTransceiverCount = Object.values(
      state.status.audioStream,
    ).filter((s) => s.clientHandle === state.clientHandleInt).length;
    console.log(
      "[rtc audio] ensuring transceivers for remote streams:",
      desiredTransceiverCount,
    );
    while (pc.getTransceivers().length < desiredTransceiverCount) {
      pc.addTransceiver("audio", { direction: "sendrecv" });
    }
  });

  createEffect(() => {
    setRemoteAudioRxStreamId(
      Object.values(state.status.audioStream).find(
        (stream) =>
          stream.clientHandle === state.clientHandleInt &&
          stream.type === "remote_audio_rx",
      )?.streamId,
    );
    setRemoteAudioTxStreamId(
      Object.values(state.status.audioStream).find(
        (stream) =>
          stream.clientHandle === state.clientHandleInt &&
          stream.type === "remote_audio_tx",
      )?.streamId,
    );
  });

  createEffect(() => {
    if (!state.clientHandle) return;
    if (!preferences.enableRemoteAudio && remoteAudioRxStreamId()) {
      radio()?.audioStream(remoteAudioRxStreamId()!)?.close();
    }
    if (preferences.enableRemoteAudio && !remoteAudioRxStreamId()) {
      radio()?.createRemoteAudioRxStream({ compression: "OPUS" });
    }
  });

  createEffect(() => {
    if (!state.clientHandle) return;
    if (!preferences.enableRemoteAudio && remoteAudioTxStreamId()) {
      radio()?.audioStream(remoteAudioTxStreamId()!)?.close();
    }
    if (preferences.enableRemoteAudio && !remoteAudioTxStreamId()) {
      radio()?.createRemoteAudioTxStream({ compression: "OPUS" });
    }
  });

  return (
    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
      <div
        class="size-4 rounded-full border"
        classList={{
          "bg-foreground": Boolean(remoteAudioRxStreamId()),
          "bg-foreground/50":
            preferences.enableRemoteAudio && !Boolean(remoteAudioRxStreamId()),
        }}
        onClick={() => setPreferences("enableRemoteAudio", (v) => !v)}
      />
      <Dialog>
        <DialogTrigger>Audio Settings</DialogTrigger>
        <DialogContent class="max-h-[90vh] overflow-y-hidden pr-3">
          <DialogHeader>
            <DialogTitle>Audio</DialogTitle>
          </DialogHeader>
          <Card class="w-full">
            <CardHeader>
              <CardTitle>Radio Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="flex flex-col gap-4">
                <div class="flex gap-2 items-center w-full">
                  <MaterialSymbolsMic class="size-10" />
                  <Select
                    value={preferences.inputDeviceId}
                    onChange={(value: string) => {
                      if (!value) return;
                      setPreferences("inputDeviceId", value);
                    }}
                    options={inputs().map((d) => d.deviceId)}
                    itemComponent={(props) => {
                      return (
                        <SelectItem item={props.item}>
                          {
                            inputs().find(
                              (d) => d.deviceId === props.item.rawValue,
                            )?.label
                          }
                        </SelectItem>
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(state) =>
                          inputs().find(
                            (d) => d.deviceId === state.selectedOption(),
                          )?.label || "Select Audio Input"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>
                <div class="flex gap-2 items-center w-full">
                  <MaterialSymbolsSpeaker class="size-10" />
                  <Select
                    value={preferences.outputDeviceId}
                    onChange={(value: string) => {
                      if (!value) return;
                      setPreferences("outputDeviceId", value);
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
                    <SelectTrigger>
                      <SelectValue>
                        {(state) =>
                          outputs().find(
                            (d) => d.deviceId === state.selectedOption(),
                          )?.label || "Select Audio Output"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
      <Select
        value={preferences.outputDeviceId}
        onChange={(value: string) => {
          if (!value) return;
          setPreferences("outputDeviceId", value);
        }}
        options={outputs().map((d) => d.deviceId)}
        itemComponent={(props) => {
          return (
            <SelectItem item={props.item}>
              {outputs().find((d) => d.deviceId === props.item.rawValue)?.label}
            </SelectItem>
          );
        }}
      >
        <SelectTrigger class="h-6 px-2 py-0 text-xs">
          <SelectValue>
            {(state) =>
              outputs().find((d) => d.deviceId === state.selectedOption())
                ?.label || "Select Audio Output"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <div class="sr-only" aria-hidden="true">
        <For each={tracks()}>
          {(t) => (
            <Show
              when={
                state.status.audioStream[t.streamId]?.type === "remote_audio_rx"
              }
            >
              <AudioSink
                stream={t.stream}
                output={preferences.outputDeviceId}
              />
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

function AudioSink(props: {
  stream: MediaStream;
  output: MediaDeviceInfo["deviceId"];
}) {
  const [ref, setRef] = createSignal<HTMLAudioElement>();

  createEffect(() => {
    const el = ref();
    if (!el) return;
    el.srcObject = props.stream;
    el.autoplay = true;
  });

  createEffect(() => ref()?.setSinkId(props.output).catch(console.error));

  return <audio ref={setRef} />;
}
