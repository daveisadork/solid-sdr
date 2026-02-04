import { createEffect, createSignal, For, onMount } from "solid-js";
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

export default function RtcAudio() {
  const { session, tracks } = useRtc();
  const { state } = useFlexRadio();
  const outputs = createSpeakers();
  const [outputDeviceId, setOutputDeviceId] = createSignal<string>("default");

  onMount(() => {
    navigator.mediaDevices.getUserMedia({ audio: true });
  });

  createEffect(() => {
    const pc = session()?.pc;
    if (!pc) return;
    const desiredTransceiverCount = Object.values(
      state.status.audioStream,
    ).filter((s) => s.clientHandle !== state.clientHandleInt).length;
    while (pc.getTransceivers().length < desiredTransceiverCount) {
      pc.addTransceiver("audio", { direction: "recvonly" });
    }
  });

  return (
    <div class="absolute top-3 left-3">
      <Select
        value={outputDeviceId()}
        onChange={(value: string) => {
          if (!value) return;
          setOutputDeviceId(value);
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
        <SelectTrigger>
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
          {(t) => <AudioSink stream={t.stream} output={outputDeviceId()} />}
        </For>
      </div>
    </div>
  );
}

function AudioSink(props: {
  stream: MediaStream;
  output: MediaDeviceInfo["deviceId"];
}) {
  let el!: HTMLAudioElement;
  onMount(() => {
    el.srcObject = props.stream;
    el.autoplay = true;
  });
  createEffect(() => el.setSinkId(props.output).catch(console.error));
  return <audio ref={el} />;
}
