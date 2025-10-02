import useFlexRadio, { PacketEvent } from "~/context/flexradio";
import { Flex } from "./ui/flex";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { createStore } from "solid-js/store";
import Connect from "./connect";
import { GpsStatus } from "./gps-status";
import { PcmSink } from "~/lib/pcm-sink";

function RadioAudio() {
  const { events, state, sendCommand } = useFlexRadio();
  const [streams] = createStore(state.status.stream);
  const [streamId, setStreamId] = createSignal<number>();
  const stream = () => (streamId() ? streams[streamId()!] : undefined);
  const player = new PcmSink({
    contextRate: 48000,
    channels: 2,
    ringFrames: 16384, // ~170 ms @48k headroom
    targetLeadSec: 0.005, // start at 60 ms
    maxLeadSec: 0.25, // cap at 250 ms
    scheduleAheadSec: 0.005, // fallback path
  });

  createEffect(() => {
    const pcmHandler = ({
      packet: {
        stream_id,
        integer_timestamp,
        payload: { data },
      },
    }: PacketEvent<"daxAudio">) => {
      if (stream_id != streamId()) return;
      player.pushPcm(data, 24_000, integer_timestamp);
    };

    const opusHandler = ({
      packet: { stream_id, integer_timestamp, payload },
    }: PacketEvent<"opus">) => {
      if (stream_id != streamId()) return;
      player.pushOpus(payload, integer_timestamp);
    };

    events.addEventListener("daxAudio", pcmHandler);
    onCleanup(() => {
      events.removeEventListener("daxAudio", pcmHandler);
    });
    events.addEventListener("opus", opusHandler);
    onCleanup(() => {
      events.removeEventListener("opus", opusHandler);
    });
  });

  createEffect((clientHandle) => {
    if (state.clientHandle && !clientHandle) {
      player
        .init()
        .then(async () => {
          const compression = (await PcmSink.supportsOpus()) ? "opus" : "none";
          // const compression = "none";
          console.log(
            `Creating audio stream, compression: ${compression}, SAB: ${PcmSink.supportsSAB()}`,
          );
          const { message } = await sendCommand(
            `stream create type=remote_audio_rx compression=${compression}`,
          );
          setStreamId(parseInt(message, 16));
        })
        .catch(console.error);
    } else {
      setStreamId(undefined);
    }
    return state.clientHandle;
  }, state.clientHandle);

  return <span class="shrink-0">Now Playing: {streamId()}</span>;
}

export function StatusBar() {
  const { state } = useFlexRadio();
  const [meters] = createStore(state.status.meters);

  const [voltageId, setVoltageId] = createSignal<number | string>();
  const [tempId, setTempId] = createSignal<number | string>();

  createEffect(() => {
    if (state.status.meters[voltageId()!]) return;
    for (const meterId in meters) {
      const { nam, value } = meters[meterId];
      if (nam === "+13.8A" && value !== undefined) {
        setVoltageId(meterId);
        return;
      }
    }
    setVoltageId(undefined);
  });

  createEffect(() => {
    if (state.status.meters[tempId()!]) return;
    for (const meterId in meters) {
      const { nam, value } = meters[meterId];
      if (nam === "PATEMP" && value !== undefined) {
        setTempId(meterId);
        return;
      }
    }
    setTempId(undefined);
  });

  return (
    <Flex
      class="shrink-0 h-10 w-full gap-4 py-2 px-3 text-sm font-mono select-none z-10"
      classList={{
        "bg-background/50 backdrop-blur-xl":
          state.display.enableTransparencyEffects,
        "bg-background": !state.display.enableTransparencyEffects,
      }}
    >
      <Connect />
      <RadioAudio />
      <Show when={state.clientHandle} keyed>
        <Show when={voltageId()} keyed>
          {(id) => <pre>{meters[id].value?.toFixed(2)}V</pre>}
        </Show>
        <Show when={tempId()} keyed>
          {(id) => {
            const { value, unit } = meters[id];
            return (
              <span>{`${value?.toPrecision(3)}${unit?.replace("deg", "°")}`}</span>
            );
          }}
        </Show>
        <GpsStatus class="justify-self-end justify-end" />
      </Show>
    </Flex>
  );
}
