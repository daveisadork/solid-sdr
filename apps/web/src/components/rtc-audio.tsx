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
import MaterialSymbolsMic from "~icons/material-symbols/mic";
import MaterialSymbolsSpeaker from "~icons/material-symbols/speaker";
import { type AudioStreamController } from "@repo/flexlib";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverArrow,
} from "~/components/ui/popover";
import { DaxAudioSink } from "~/lib/dax-audio-sink";
import { DaxAudioTx } from "~/lib/dax-audio-tx";
import { SimpleSwitch } from "./ui/simple-switch";

function DaxAudioChannel(props: {
  controller: AudioStreamController;
  output: MediaDeviceInfo["deviceId"];
}) {
  createEffect(() => {
    const sink = new DaxAudioSink();
    void sink.setOutputDevice(props.output).catch(console.error);

    const subscription = props.controller.on("data", (event) => {
      sink.play(event);
    });

    onCleanup(() => {
      subscription.unsubscribe();
      void sink.close().catch(console.error);
    });
  });

  return (
    <div class="sr-only" aria-hidden="true">
      {/* <AudioSink stream={track.stream} output="default" /> */}
    </div>
  );
}

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
  const [daxTxStreamId, setDaxTxStreamId] = createSignal<string | undefined>();
  const outputs = createSpeakers();
  const inputs = createMicrophones();

  const preferredInputDevice = createMemo(() =>
    inputs().find((d) => d.deviceId === preferences.inputDeviceId),
  );
  const preferredDaxInputDevice = createMemo(() =>
    inputs().find((d) => d.deviceId === preferences.daxTxConfig.inputDeviceId),
  );

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
      setDaxTxStreamId(
        Object.values(state.status.audioStream).find(
          (stream) =>
            stream.clientHandle === state.clientHandleInt &&
            stream.type === "dax_tx",
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

  for (let channel = 1; channel <= 16; channel++) {
    const thisChannel = channel; // capture for closure
    createEffect(() => {
      if (!state.clientHandle || !preferences.daxRxConfig[thisChannel].enabled)
        return;
      const promise = radio()?.createDaxRxAudioStream({ daxChannel: 1 });
      onCleanup(() =>
        promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
      );
    });
  }

  createEffect((promise?: Promise<AudioStreamController>) => {
    if (!state.clientHandle || !preferences.daxTxConfig.enabled) return;
    return daxTxStreamId()
      ? onCleanup(() =>
          promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
        )
      : radio()?.createDaxTxAudioStream();
  });

  createEffect(() => {
    const rtc = session();
    if (!remoteAudioTxStreamId() || !rtc) return;

    const promise = navigator.mediaDevices.getUserMedia({
      audio: preferredInputDevice() ?? true,
    });

    promise
      .then((stream) =>
        rtc.setTransmitTrack(stream.getAudioTracks()[0] ?? null),
      )
      .catch((error) => {
        console.error("[rtc audio] failed to get transmit stream", error);
      });

    onCleanup(() =>
      promise.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      ),
    );
  });

  createEffect(() => {
    const rtc = session();
    const streamId = daxTxStreamId();
    if (!rtc || !streamId) return;

    let tx: DaxAudioTx | undefined;
    const promise = navigator.mediaDevices.getUserMedia({
      audio: preferredDaxInputDevice() ?? true,
    });

    promise
      .then(async (stream) => {
        tx = new DaxAudioTx(
          rtc.data,
          streamId,
          preferences.daxTxConfig.reducedBandwidth,
          stream,
        );
        await tx.start();
      })
      .catch((error) => {
        console.error("[dax tx] failed to get transmit stream", error);
      });

    onCleanup(() => {
      void tx?.close().catch(console.error);
      void promise.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
    });
  });

  createEffect(() => {});

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

      <Popover>
        <PopoverTrigger class="text-sm textbox-trim-both textbox-edge-cap-alphabetic">
          Audio Settings
        </PopoverTrigger>
        <PopoverContent class="shadow-black/75 shadow-lg p-0 fancy-bg-popover overflow-x-visible w-auto max-w-[90vw]">
          <PopoverArrow />
          <div class="p-4 flex flex-col space-y-4 max-h-(--kb-popper-content-available-height)">
            <div class="flex gap-2 items-center">
              <MaterialSymbolsMic class="size-10 shrink-0" />
              <Select
                class="shrink grow overflow-hidden p-1"
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
                        inputs().find((d) => d.deviceId === props.item.rawValue)
                          ?.label
                      }
                    </SelectItem>
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue class="overflow-hidden text-ellipsis whitespace-nowrap">
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
            <div class="flex gap-2 items-center">
              <MaterialSymbolsSpeaker class="size-10 shrink-0" />
              <div class="shrink grow overflow-hidden p-1">
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
                    <SelectValue class="overflow-hidden text-ellipsis whitespace-nowrap">
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

            <div>
              <SimpleSwitch
                checked={preferences.daxTxConfig.enabled}
                onChange={(checked) =>
                  setPreferences("daxTxConfig", "enabled", checked)
                }
                label="DAX TX"
              />
              <Select
                value={preferences.daxTxConfig.inputDeviceId}
                onChange={(value: string) => {
                  if (!value) return;
                  setPreferences("daxTxConfig", "inputDeviceId", value);
                }}
                options={inputs().map((d) => d.deviceId)}
                itemComponent={(props) => {
                  return (
                    <SelectItem item={props.item}>
                      {
                        inputs().find((d) => d.deviceId === props.item.rawValue)
                          ?.label
                      }
                    </SelectItem>
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue class="overflow-hidden text-ellipsis whitespace-nowrap">
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
            <For
              each={Array.from(
                { length: state.status.radio.sliceCount },
                (_, i) => i + 1,
              )}
            >
              {(channel) => (
                <div>
                  <SimpleSwitch
                    checked={preferences.daxRxConfig[channel].enabled}
                    onChange={(checked) =>
                      setPreferences("daxRxConfig", channel, "enabled", checked)
                    }
                    label={`DAX RX Channel ${channel}`}
                  />
                  <Select
                    value={preferences.daxRxConfig[channel].outputDeviceId}
                    onChange={(value: string) => {
                      if (!value) return;
                      setPreferences(
                        "daxRxConfig",
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
                    <SelectTrigger>
                      <SelectValue class="overflow-hidden text-ellipsis whitespace-nowrap">
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
              )}
            </For>
          </div>
        </PopoverContent>
      </Popover>
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
      <For
        each={Object.values(state.status.audioStream).filter(
          (s) =>
            s.clientHandle === state.clientHandleInt && s.type === "dax_rx",
        )}
      >
        {(stream) => (
          <DaxAudioChannel
            controller={radio()?.audioStream(stream.id)}
            output={
              preferences.daxRxConfig[stream.daxChannel]?.outputDeviceId ??
              "default"
            }
          />
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
