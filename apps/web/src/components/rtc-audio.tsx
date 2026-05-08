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
import { createMicrophones } from "@solid-primitives/devices";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import {
  type AudioStreamTxController,
  type RemoteAudioTxStreamController,
  type AudioStreamController,
} from "@repo/flexlib";
import { DaxAudioSink } from "~/lib/dax-audio-sink";
import { DaxAudioTx } from "~/lib/dax-audio-tx";
import type { DaxChannelMode } from "~/lib/dax-audio-sink/types";
import type { MeterState } from "~/context/flexradio";
import { showToast } from "./ui/toast";
import { useRuntime } from "~/context/runtime";
import { createPermission } from "~/lib/permission";

function DaxAudioChannel(props: {
  controller: AudioStreamController;
  output: MediaDeviceInfo["deviceId"];
  channelMode: DaxChannelMode;
  onMeter?: (level: number, peak: number) => void;
}) {
  const sink = new DaxAudioSink({ channelMode: props.channelMode });

  createEffect(() => {
    sink.init().catch(console.error);
    const subscription = props.controller?.on("data", (event) => {
      sink.play(event);
    });

    onCleanup(() => {
      subscription.unsubscribe();
      void sink.close().catch(console.error);
    });
  });

  createEffect(() => sink.setOutputDevice(props.output).catch(console.error));
  createEffect(() => sink.setChannelMode(props.channelMode));

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

const DAX_LEVEL_METER: MeterState = {
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

function InnerRtcAudio() {
  const { remoteAudioRxStream, setRemoteAudioTxTrack } = useRtc();
  const { state, radio } = useFlexRadio();
  const { preferences } = usePreferences();
  const { audioStreams } = useRuntime();
  const [remoteAudioRxStreamId, setRemoteAudioRxStreamId] = createSignal<
    string | undefined
  >();
  const [remoteAudioTxStreamId, setRemoteAudioTxStreamId] = createSignal<
    string | undefined
  >();
  const [daxRxMeters, setDaxRxMeters] = createStore<
    Record<number, { level: number; peak: number }>
  >({});
  const [daxTxLevel, setDaxTxLevel] = createSignal(-Infinity);
  const [daxTxPeak, setDaxTxPeak] = createSignal(-Infinity);
  const [daxTxInstance, setDaxTxInstance] = createSignal<
    DaxAudioTx | undefined
  >();

  const [daxTxController, setDaxTxController] =
    createSignal<AudioStreamTxController>();
  const inputs = createMicrophones();

  const preferredInputDevice = createMemo(() => {
    const constraints = {
      deviceId: preferences.remoteAudio.tx.inputDeviceId,
      autoGainControl: preferences.remoteAudio.tx.autoGainControl,
      echoCancellation: preferences.remoteAudio.tx.echoCancellation,
      noiseSuppression: preferences.remoteAudio.tx.noiseSuppression,
      voiceIsolation: preferences.remoteAudio.tx.voiceIsolation,
    } as MediaTrackConstraints;
    const device = inputs().find((d) => d.deviceId === constraints.deviceId);
    if (device) {
      constraints.deviceId = { exact: device.deviceId };
      constraints.groupId = { exact: device.groupId };
    }
    return constraints;
  });

  const preferredDaxInputDevice = createMemo(() => {
    const constraints = {
      deviceId: preferences.dax.tx.inputDeviceId,
      autoGainControl: preferences.dax.tx.autoGainControl,
      echoCancellation: preferences.dax.tx.echoCancellation,
      noiseSuppression: preferences.dax.tx.noiseSuppression,
      voiceIsolation: preferences.dax.tx.voiceIsolation,
      latency: 0,
      channelCount: 2,
    } as MediaTrackConstraints;
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
    }),
  );

  createEffect((promise?: Promise<AudioStreamController>) => {
    if (!state.clientHandle || !preferences.remoteAudio.rx.enabled) return;
    return remoteAudioRxStreamId()
      ? onCleanup(() =>
          promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
        )
      : radio()?.createRemoteAudioRxStream({
          compression: "OPUS",
        });
  });

  createEffect((promise?: Promise<RemoteAudioTxStreamController>) => {
    if (
      !state.clientHandle ||
      !preferences.remoteAudio.rx.enabled ||
      !preferences.remoteAudio.tx.enabled
    )
      return;
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
      if (!state.clientHandle || !preferences.dax.rx[daxChannel]?.enabled)
        return;
      const promise = radio()?.createDaxRxAudioStream({ daxChannel });
      onCleanup(() =>
        promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
      );
    });
  }

  createEffect(() => {
    if (!state.clientHandle || !preferences.dax.tx.enabled) return;
    const promise = radio()?.createDaxTxAudioStream();
    promise?.then(setDaxTxController);
    onCleanup(() => {
      setDaxTxController(undefined);
      promise?.then((controller) =>
        controller.close().catch(() => {
          // this throws an error if the radio is already disconnected
        }),
      );
    });
  });

  createEffect(() => {
    if (!remoteAudioTxStreamId()) return;

    const promise = navigator.mediaDevices.getUserMedia({
      audio: preferredInputDevice() ?? true,
    });

    promise
      .then((stream) =>
        setRemoteAudioTxTrack(stream.getAudioTracks()[0] ?? null),
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

  createEffect((lastCleanupPromise: Promise<void>) => {
    const controller = daxTxController();
    if (!controller) return Promise.resolve();
    const reducedBandwidth = preferences.dax.tx.reducedBandwidth;
    const constraints = {
      audio: { ...preferredDaxInputDevice() },
    };

    const streamPromise = lastCleanupPromise.then(() =>
      navigator.mediaDevices.getUserMedia(constraints),
    );

    const daxPromise = streamPromise.then(async (stream) => {
      audioStreams.set(controller.streamId, stream);

      const tx = new DaxAudioTx(
        controller,
        reducedBandwidth,
        stream,
        preferences.dax.tx.channelMode,
      );
      await tx.start();
      setDaxTxInstance(tx);
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

    const streamId = controller.streamId;
    const { promise: cleanupPromise, resolve } = Promise.withResolvers<void>();

    onCleanup(() => {
      setDaxTxInstance(undefined);
      daxPromise.then((tx) => tx?.close().catch(console.error));
      streamPromise.then((stream) => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        audioStreams.delete(streamId);
        resolve();
      });
    });

    return cleanupPromise;
  }, Promise.resolve());

  createEffect(() => {
    const tx = daxTxInstance();
    if (!tx) return;
    tx.setChannelMode(preferences.dax.tx.channelMode);
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
      <Show when={remoteAudioRxStream()}>
        <div class="sr-only" aria-hidden="true">
          <AudioSink
            stream={remoteAudioRxStream()}
            output={preferences.remoteAudio.rx.outputDeviceId}
          />
        </div>
      </Show>
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
                preferences.dax.rx[stream.daxChannel]?.outputDeviceId ??
                "default"
              }
              channelMode={
                preferences.dax.rx[stream.daxChannel]?.channelMode ?? "both"
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
  const { preferences } = usePreferences();
  const audioPermission = createPermission("microphone");

  const checkAudioPermission = () => {
    if (audioPermission() !== "unknown") return;
    console.log("Requesting audio...");
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
  };

  createEffect(() => {
    const audioEnabled =
      preferences.remoteAudio.rx.enabled ||
      preferences.dax.tx.enabled ||
      Object.values(preferences.dax.rx).some((config) => config.enabled);

    if (!audioEnabled) return;
    checkAudioPermission();
  });

  return (
    <Show when={audioPermission() === "granted"}>
      <InnerRtcAudio />
    </Show>
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

  createEffect(() =>
    ref()
      ?.setSinkId(props.output)
      .catch(() => {}),
  );

  return <audio ref={setRef} />;
}
