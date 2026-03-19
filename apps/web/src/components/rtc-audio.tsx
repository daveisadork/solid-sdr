import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
} from "solid-js";
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
import { AudioStreamController } from "@repo/flexlib";

export default function RtcAudio() {
  const { session, tracks } = useRtc();
  const { state, radio } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();
  const [remoteAudioRxStreamId, setRemoteAudioRxStreamId] = createSignal<
    string | undefined
  >();
  const [remoteAudioTxStreamId, setRemoteAudioTxStreamId] = createSignal<
    string | undefined
  >();
  const outputs = createSpeakers();
  const inputs = createMicrophones();

  const preferredInputDevice = createMemo(() =>
    inputs().find((d) => d.deviceId === preferences.inputDeviceId),
  );

  const [activeInputDeviceId, setActiveInputDeviceId] = createSignal<string>();

  createEffect(() => console.log(inputs()));

  createEffect(() =>
    batch(() => {
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
    }),
  );

  createEffect((promise?: Promise<AudioStreamController>) => {
    if (!state.clientHandle || !preferences.enableRemoteAudio) return;
    return remoteAudioRxStreamId()
      ? onCleanup(() =>
          promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
        )
      : radio()?.createRemoteAudioRxStream({
          compression: "OPUS",
        });
  });

  createEffect((promise?: Promise<AudioStreamController>) => {
    if (!state.clientHandle || !preferences.enableRemoteAudio) return;
    return remoteAudioTxStreamId()
      ? onCleanup(() =>
          promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
        )
      : radio()?.createRemoteAudioTxStream({
          compression: "OPUS",
        });
  });

  createEffect(() => {
    const rtc = session();
    if (!remoteAudioTxStreamId() || !rtc) return;

    const promise = navigator.mediaDevices.getUserMedia({
      audio: preferredInputDevice() ?? true,
    });

    promise
      .then((stream) => {
        rtc.setTransmitTrack(stream.getAudioTracks()[0] ?? null);
        setActiveInputDeviceId(
          stream.getAudioTracks()[0]?.getSettings().deviceId,
        );
      })
      .catch((error) => {
        console.error("[rtc audio] failed to get transmit stream", error);
      });

    onCleanup(() =>
      promise.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      ),
    );
  });

  return (
    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
      <div
        class="size-4 rounded-full border"
        classList={{
          "bg-foreground": Boolean(
            remoteAudioRxStreamId() && remoteAudioTxStreamId(),
          ),
          "bg-foreground/50":
            preferences.enableRemoteAudio &&
            !Boolean(remoteAudioRxStreamId() && remoteAudioTxStreamId()),
        }}
        onClick={() => setPreferences("enableRemoteAudio", (v) => !v)}
      />
      <Dialog modal={false}>
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
                    value={activeInputDeviceId() ?? preferences.inputDeviceId}
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
      <For each={tracks()}>
        {(track) => (
          <div class="sr-only" aria-hidden="true">
            <AudioSink
              stream={track.stream}
              output={preferences.outputDeviceId}
            />
          </div>
        )}
      </For>
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
