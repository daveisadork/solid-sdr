import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import { useRtc } from "../context/rtc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { createSpeakers } from "@solid-primitives/devices";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";

export default function RtcAudio() {
  const { session, tracks } = useRtc();
  const { state, radio } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();
  const outputs = createSpeakers();
  const [remoteAudioRxStreamId, setRemoteAudioRxStreamId] = createSignal<
    string | undefined
  >();

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
      pc.addTransceiver("audio", { direction: "recvonly" });
    }
  });

  createEffect(() => {
    const streamId = Object.values(state.status.audioStream).find(
      (stream) =>
        stream.clientHandle === state.clientHandleInt &&
        stream.type === "remote_audio_rx",
    )?.streamId;
    setRemoteAudioRxStreamId(streamId);
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

  return (
    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
      <div
        class="size-4 rounded-full border"
        classList={{
          "bg-foreground": Boolean(remoteAudioRxStreamId()),
        }}
        onClick={() => setPreferences("enableRemoteAudio", (v) => !v)}
      />
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
            <AudioSink stream={t.stream} output={preferences.outputDeviceId} />
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
