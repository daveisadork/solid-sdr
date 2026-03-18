import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { useRtc } from "../context/rtc";
import type { RtcSession } from "../lib/rtc";
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
  const transmitStreams = new Map<string, MediaStream>();
  let transmitRequestToken = 0;
  let lastReceiveRenegotiateSession: RtcSession | null = null;
  let lastReceiveStreamSetKey = "";

  createEffect(() => {
    console.log(tracks());
    console.log(remoteAudioTxStreamId());
  });

  onMount(() => {
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch(console.error);
  });

  createEffect(() => {
    const rtc = session();
    if (!rtc) {
      lastReceiveRenegotiateSession = null;
      lastReceiveStreamSetKey = "";
      return;
    }
    if (rtc !== lastReceiveRenegotiateSession) {
      lastReceiveRenegotiateSession = rtc;
      lastReceiveStreamSetKey = "";
    }

    const pc = rtc.pc;
    const desiredReceiveStreamIds = Object.values(state.status.audioStream)
      .filter((s) => s.clientHandle === state.clientHandleInt)
      .filter((s) => s.type === "remote_audio_rx")
      .map((s) => s.streamId)
      .sort();
    const desiredTransceiverCount = desiredReceiveStreamIds.length;
    let placeholderTransceiverCount = pc
      .getTransceivers()
      .filter(
        (transceiver) =>
          transceiver.receiver.track?.kind === "audio" &&
          !transceiver.sender.track,
      ).length;
    console.log(
      "[rtc audio] ensuring transceivers for remote streams:",
      desiredTransceiverCount,
    );
    while (placeholderTransceiverCount < desiredTransceiverCount) {
      pc.addTransceiver("audio", { direction: "recvonly" });
      placeholderTransceiverCount += 1;
    }

    const nextReceiveStreamSetKey = desiredReceiveStreamIds.join(",");
    if (nextReceiveStreamSetKey === lastReceiveStreamSetKey) return;

    lastReceiveStreamSetKey = nextReceiveStreamSetKey;
    void rtc
      .renegotiate()
      .catch((error) =>
        console.error(
          "[rtc audio] failed to renegotiate receive streams",
          error,
        ),
      );
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

  createEffect(() => {
    const rtc = session();
    const streamId = remoteAudioTxStreamId();
    const enabled = preferences.enableRemoteAudio;
    const inputDeviceId = preferences.inputDeviceId;
    const requestToken = ++transmitRequestToken;

    for (const activeStreamId of Array.from(transmitStreams.keys())) {
      if (!rtc || !enabled || activeStreamId !== streamId) {
        void clearTransmitStream(activeStreamId, rtc);
      }
    }

    if (!rtc || !enabled || !streamId) return;

    void syncTransmitStream(rtc, streamId, inputDeviceId, requestToken);
  });

  onCleanup(() => {
    for (const streamId of Array.from(transmitStreams.keys())) {
      void clearTransmitStream(streamId, session());
    }
  });

  async function syncTransmitStream(
    rtc: RtcSession,
    streamId: string,
    inputDeviceId: string,
    requestToken: number,
  ) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:
          inputDeviceId && inputDeviceId !== "default"
            ? { deviceId: { exact: inputDeviceId } }
            : true,
      });

      if (
        requestToken !== transmitRequestToken ||
        session() !== rtc ||
        remoteAudioTxStreamId() !== streamId ||
        !preferences.enableRemoteAudio
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const [track] = stream.getAudioTracks();
      if (!track) {
        stream.getTracks().forEach((nextTrack) => nextTrack.stop());
        return;
      }

      const previousStream = transmitStreams.get(streamId);
      transmitStreams.set(streamId, stream);
      await rtc.setTransmitTrack(streamId, track, stream);
      previousStream?.getTracks().forEach((nextTrack) => nextTrack.stop());
    } catch (error) {
      console.error("[rtc audio] failed to sync transmit stream", error);
    }
  }

  async function clearTransmitStream(streamId: string, rtc: RtcSession | null) {
    const stream = transmitStreams.get(streamId);
    transmitStreams.delete(streamId);
    await rtc?.clearTransmitTrack(streamId);
    stream?.getTracks().forEach((track) => track.stop());
  }

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
