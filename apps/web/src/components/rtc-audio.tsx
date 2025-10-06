import { createEffect, For, onMount } from "solid-js";
import { useRtc } from "../context/rtc";

export default function RtcAudio() {
  const { tracks } = useRtc();

  // (Optional) pre-prompt for mic so enumerateDevices works well:
  onMount(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {}
  });

  createEffect(() => {
    console.log("Audio tracks", tracks());
  });

  return (
    <div class="sr-only" aria-hidden="true">
      <For each={tracks()}>{(t) => <AudioSink stream={t.stream} />}</For>
    </div>
  );
}

function AudioSink(props: { stream: MediaStream }) {
  let el!: HTMLAudioElement;
  onMount(() => {
    el.srcObject = props.stream;
    el.autoplay = true;
  });
  return <audio ref={el} />;
}
