import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
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
import { SimpleMeter } from "~/components/ui/simple-meter";
import type { Meter } from "~/context/flexradio";
import { SimpleSwitch } from "./ui/simple-switch";
import { showToast } from "./ui/toast";

function DaxAudioChannel(props: {
  controller: AudioStreamController;
  output: MediaDeviceInfo["deviceId"];
  onMeter?: (level: number, peak: number) => void;
}) {
  const sink = new DaxAudioSink();

  createEffect(() => {
    sink.init().catch(console.error);
    const subscription = props.controller.on("data", (event) => {
      sink.play(event);
    });

    onCleanup(() => {
      subscription.unsubscribe();
      void sink.close().catch(console.error);
    });
  });

  createEffect(() => sink.setOutputDevice(props.output).catch(console.error));

  createEffect(() => {
    const onMeter = props.onMeter;
    if (!onMeter) return;
    let rafId: number;
    const tick = () => {
      onMeter(sink.getLevel(), sink.peak);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(rafId));
  });

  return <div class="sr-only" aria-hidden="true" />;
}

const DAX_LEVEL_METER: Meter = {
  id: "",
  low: -60,
  high: 0,
  fps: 20,
  units: "dBFS",
  name: "",
  source: "",
  sourceIndex: 0,
  description: "",
};

function InnerRtcAudio(props: { defaultOpen?: boolean }) {
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
  const [daxRxMeters, setDaxRxMeters] = createStore<
    Record<number, { level: number; peak: number }>
  >({});
  const [daxTxLevel, setDaxTxLevel] = createSignal(-Infinity);
  const [daxTxPeak, setDaxTxPeak] = createSignal(-Infinity);
  const [daxTxInstance, setDaxTxInstance] = createSignal<
    DaxAudioTx | undefined
  >();
  const outputs = createSpeakers();
  const inputs = createMicrophones();

  const preferredInputDevice = createMemo(() => {
    const device = inputs().find(
      (d) => d.deviceId === preferences.inputDeviceId,
    );
    if (!device) return true;
    return {
      deviceId: { exact: device.deviceId },
      groupId: { exact: device.groupId },
    } as MediaStreamConstraints["audio"];
  });

  const preferredDaxInputDevice = createMemo(() => {
    const constraints: MediaStreamConstraints["audio"] = {
      autoGainControl: { exact: false },
      echoCancellation: { exact: false },
      noiseSuppression: { exact: false },
      deviceId: preferences.daxTxConfig.inputDeviceId,
    };
    const device = inputs().find((d) => d.deviceId === constraints.deviceId);
    if (device) {
      constraints.deviceId = { exact: device.deviceId };
      constraints.groupId = { exact: device.groupId };
    }
    return constraints;
  });

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
    const daxChannel = channel; // capture for closure
    createEffect(() => {
      if (!state.clientHandle || !preferences.daxRxConfig[daxChannel].enabled)
        return;
      const promise = radio()?.createDaxRxAudioStream({ daxChannel });
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
    const streamId = daxTxStreamId();
    const currentRadio = radio();
    if (!currentRadio || !streamId) return;
    const controller = currentRadio.audioStream(streamId);
    if (!controller) return;
    const reducedBandwidth = preferences.daxTxConfig.reducedBandwidth;

    const streamPromise = navigator.mediaDevices.getUserMedia({
      audio: { ...preferredDaxInputDevice() },
    });

    const daxPromise = streamPromise.then(async (stream) => {
      stream.getAudioTracks().forEach((track) => {
        console.log("DAX TX ", track.getSettings());
      });
      const tx = new DaxAudioTx(controller, reducedBandwidth, stream);
      await tx.start();
      setDaxTxInstance(tx);
      const trackSettings = stream.getAudioTracks()[0].getSettings();
      const device = inputs().find(
        (d) => d.deviceId === trackSettings.deviceId,
      );
      showToast({
        title: "DAX TX Started",
        description: `Using device ${device?.label || trackSettings.deviceId}`,
        variant: "success",
      });
      return tx;
    });

    Promise.all([streamPromise, daxPromise]).catch((error) => {
      const description =
        error.name === "OverconstrainedError"
          ? `Constraint not satisfied: ${error.constraint}`
          : String(error);
      showToast({
        title: "Failed to start DAX TX",
        description,
        variant: "error",
      });
    });

    onCleanup(() => {
      setDaxTxInstance(undefined);
      daxPromise.then((tx) => tx?.close().catch(console.error));
      streamPromise.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
    });
  });

  createEffect(() => {
    const tx = daxTxInstance();
    if (!tx) {
      setDaxTxLevel(-Infinity);
      setDaxTxPeak(-Infinity);
      return;
    }
    let rafId: number;
    const tick = () => {
      setDaxTxLevel(tx.getLevel());
      setDaxTxPeak(tx.peak);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(rafId));
  });

  return (
    <>
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

      <Popover defaultOpen={props.defaultOpen}>
        <PopoverTrigger class="text-sm textbox-trim-both textbox-edge-cap-alphabetic">
          Audio Settings
        </PopoverTrigger>
        <PopoverContent class="shadow-black/75 shadow-lg p-0 fancy-bg-popover overflow-x-visible w-auto max-w-[90vw]">
          <PopoverArrow />
          <div class="p-4 flex flex-col space-y-4 max-h-(--kb-popper-content-available-height) overflow-y-auto">
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
              <Show when={daxTxInstance()}>
                <SimpleMeter
                  value={Math.max(daxTxLevel(), DAX_LEVEL_METER.low)}
                  peakValue={Math.max(daxTxPeak(), DAX_LEVEL_METER.low)}
                  meter={DAX_LEVEL_METER}
                  label="DAX TX Level"
                  showTicks
                  showTickLabels
                  containTickLabels
                  tickLabelFilter={({ index }) => index % 2 === 0}
                />
              </Show>
              <SimpleSwitch
                checked={preferences.daxTxConfig.reducedBandwidth}
                onChange={(checked) =>
                  setPreferences("daxTxConfig", "reducedBandwidth", checked)
                }
                label="Reduced Bandwidth"
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
                  <Show when={daxRxMeters[channel] !== undefined}>
                    <SimpleMeter
                      value={Math.max(
                        daxRxMeters[channel]!.level,
                        DAX_LEVEL_METER.low,
                      )}
                      peakValue={Math.max(
                        daxRxMeters[channel]!.peak,
                        DAX_LEVEL_METER.low,
                      )}
                      meter={DAX_LEVEL_METER}
                      label={`DAX RX ${channel} Level`}
                      showTicks
                      showTickLabels
                      containTickLabels
                      tickLabelFilter={({ index }) => index % 2 === 0}
                    />
                  </Show>
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
        {(stream) => {
          return (
            <DaxAudioChannel
              controller={radio()?.audioStream(stream.id)}
              output={
                preferences.daxRxConfig[stream.daxChannel]?.outputDeviceId ??
                "default"
              }
              onMeter={(level, peak) =>
                setDaxRxMeters(stream.daxChannel, { level, peak })
              }
            />
          );
        }}
      </For>
    </>
  );
}

export default function RtcAudio() {
  const { preferences, setPreferences } = usePreferences();
  const [audioAllowed, setAudioAllowed] = createSignal(false);
  const [defaultOpen, setDefaultOpen] = createSignal(false);

  const checkAudioPermission = () => {
    if (audioAllowed()) {
      console.log("No audio enabled, skipping permissions");
      return;
    }
    console.log("Requesting audio...");
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        setAudioAllowed(true);
      })
      .catch(() => setAudioAllowed(false));
  };

  createEffect(() => {
    const audioEnabled =
      preferences.enableRemoteAudio ||
      preferences.daxTxConfig.enabled ||
      Object.values(preferences.daxRxConfig).some((config) => config.enabled);

    if (!audioEnabled || audioAllowed()) return;
    checkAudioPermission();
  });

  return (
    <div class="absolute not-pointer-fine:bottom-12 pointer-fine:bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2 not-pointer-fine:border rounded-md not-pointer-fine:fancy-bg-background h-10 px-3">
      <Show
        when={audioAllowed()}
        fallback={
          <>
            <div
              class="size-4 rounded-full border"
              classList={{
                "bg-foreground/50": preferences.enableRemoteAudio,
              }}
              onClick={() => setPreferences("enableRemoteAudio", (v) => !v)}
            />

            <button
              class="text-sm textbox-trim-both textbox-edge-cap-alphabetic"
              onClick={() => {
                setDefaultOpen(true);
                checkAudioPermission();
              }}
            >
              Audio Settings
            </button>
          </>
        }
      >
        <InnerRtcAudio defaultOpen={defaultOpen()} />
      </Show>
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

    // this ends up getting created on page load, so autoplay will be blocked until
    // the user interacts with the page. Once they do, we can play the audio.
    window.addEventListener(
      "click",
      () => {
        el.play().catch(console.error);
      },
      { once: true },
    );
  });

  createEffect(() => ref()?.setSinkId(props.output).catch(console.error));

  return <audio ref={setRef} />;
}
