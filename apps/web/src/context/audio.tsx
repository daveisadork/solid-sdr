import type {
  AudioStreamController,
  AudioStreamTxController,
  DaxIqAudioStreamController,
  DaxRxAudioStreamController,
  RemoteAudioTxStreamController,
} from "@repo/flexlib";
import { createMicrophones } from "@solid-primitives/devices";
import { ReactiveMap } from "@solid-primitives/map";
import {
  type Accessor,
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type ParentComponent,
  untrack,
  useContext,
} from "solid-js";
import { showToast } from "~/components/ui/toast";
import { DaxAudioSink } from "~/lib/dax-audio-sink";
import { DaxAudioTx } from "~/lib/dax-audio-tx";
import { DaxIqAudioSink } from "~/lib/dax-iq-audio-sink";
import { createPermission } from "~/lib/permission";
import useFlexRadio from "./flexradio";
import { usePreferences } from "./preferences";
import { useRtc } from "./rtc";

interface AudioContextValue {
  daxSinks: ReactiveMap<number, DaxAudioSink>;
  daxIqSinks: ReactiveMap<number, DaxIqAudioSink>;
  daxTxStream: Accessor<MediaStream | undefined>;
  remoteAudioTxStream: Accessor<MediaStream | undefined>;
  remoteAudioRxStream: Accessor<MediaStream | undefined>;
}

const AudioContext = createContext<AudioContextValue>();

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within <AudioProvider>");
  return ctx;
}

export const AudioProvider: ParentComponent = (props) => {
  const { remoteAudioRxStream: rtcRemoteAudioRxStream, setRemoteAudioTxTrack } =
    useRtc();
  const { state, radio } = useFlexRadio();
  const { preferences } = usePreferences();
  const inputs = createMicrophones();
  const audioPermission = createPermission("microphone");

  const daxSinks = new ReactiveMap<number, DaxAudioSink>();
  const daxIqSinks = new ReactiveMap<number, DaxIqAudioSink>();
  const [daxTxController, setDaxTxController] =
    createSignal<AudioStreamTxController>();
  const [daxTxStream, setDaxTxStream] = createSignal<MediaStream | undefined>();
  const [remoteAudioTxStream, setRemoteAudioTxStream] = createSignal<
    MediaStream | undefined
  >();
  const [remoteAudioElement, setRemoteAudioElement] = createSignal<
    HTMLAudioElement | undefined
  >();
  const [remoteAudioRxStreamId, setRemoteAudioRxStreamId] = createSignal<
    string | undefined
  >();
  const [remoteAudioTxStreamId, setRemoteAudioTxStreamId] = createSignal<
    string | undefined
  >();
  const daxRxControllers = new ReactiveMap<
    number,
    DaxRxAudioStreamController
  >();

  // Prompt for microphone permission when any audio feature is enabled
  createEffect(() => {
    if (audioPermission() === "granted") return;
    const audioEnabled =
      preferences.remoteAudio.rx.enabled ||
      preferences.dax.tx.enabled ||
      Object.values(preferences.dax.rx).some((c) => c.enabled);
    Object.values(preferences.dax.iq).some((c) => c.enabled);
    if (!audioEnabled) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => stream.getTracks().forEach((t) => t.stop()));
  });

  // Track which radio audio stream IDs belong to this client
  createEffect(() =>
    batch(() => {
      setRemoteAudioRxStreamId(
        Object.values(state.status.audioStream).find(
          (s) =>
            s.clientHandle === state.clientHandleInt &&
            s.type === "remote_audio_rx",
        )?.streamId,
      );
      setRemoteAudioTxStreamId(
        Object.values(state.status.audioStream).find(
          (s) =>
            s.clientHandle === state.clientHandleInt &&
            s.type === "remote_audio_tx",
        )?.streamId,
      );
    }),
  );

  // Play remote audio RX via programmatic Audio element (no JSX needed)
  createEffect(() => {
    const stream = rtcRemoteAudioRxStream();
    if (!stream) {
      setRemoteAudioElement(undefined);
      return;
    }
    const audio = new Audio();
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.srcObject = stream;
    setRemoteAudioElement(audio);
    window.addEventListener("click", () => audio.play().catch(console.error), {
      once: true,
    });
    onCleanup(() => {
      audio.srcObject = null;
      setRemoteAudioElement(undefined);
    });
  });

  // Update output device when preference changes
  createEffect(() => {
    const audio = remoteAudioElement() as
      | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
      | undefined;
    if (!audio?.setSinkId) return;
    audio.setSinkId(preferences.remoteAudio.rx.outputDeviceId).catch(() => {});
  });

  // Create/destroy remote audio RX radio stream
  createEffect((promise?: Promise<AudioStreamController>) => {
    if (!state.clientHandle || !preferences.remoteAudio.rx.enabled) return;
    return remoteAudioRxStreamId()
      ? onCleanup(() =>
          promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
        )
      : radio()?.createRemoteAudioRxStream({ compression: "OPUS" });
  });

  // Create/destroy remote audio TX radio stream
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
      : radio()?.createRemoteAudioTxStream({ compression: "OPUS" });
  });

  // getUserMedia constraints for remote audio TX
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

  // Capture microphone for remote audio TX and set it as the WebRTC track
  createEffect(() => {
    if (!remoteAudioTxStreamId()) return;
    const promise = navigator.mediaDevices.getUserMedia({
      audio: preferredInputDevice() ?? true,
    });
    promise
      .then((stream) => {
        setRemoteAudioTxStream(stream);
        setRemoteAudioTxTrack(stream.getAudioTracks()[0] ?? null);
      })
      .catch((err) =>
        console.error("[audio] failed to get remote tx stream", err),
      );
    onCleanup(() =>
      promise.then((stream) => {
        setRemoteAudioTxStream(undefined);
        stream.getTracks().forEach((t) => t.stop());
      }),
    );
  });

  // Create/destroy DAX RX radio streams for each channel
  for (let channel = 1; channel <= 16; channel++) {
    const daxChannel = channel;
    createEffect(() => {
      if (!state.clientHandle || !preferences.dax.rx[daxChannel]?.enabled)
        return;
      const promise = radio()?.createDaxRxAudioStream({ daxChannel });
      promise?.then((controller) =>
        daxRxControllers.set(daxChannel, controller),
      );
      onCleanup(() =>
        promise?.then((stream) => {
          // Use the captured daxChannel local, not stream.daxChannel: on
          // disconnect the store snapshot is already gone, so reading the
          // getter would throw FlexStateUnavailableError.
          daxRxControllers.delete(daxChannel);
          radio()?.audioStream(stream.id)?.close();
        }),
      );
    });
  }

  // Manage DaxAudioSink instances for active DAX RX streams
  for (let channel = 1; channel <= 16; channel++) {
    const daxChannel = channel;

    createEffect(() => {
      const activeStream = Object.values(state.status.audioStream).find(
        (s) =>
          s.clientHandle === state.clientHandleInt &&
          s.type === "dax_rx" &&
          s.daxChannel === daxChannel,
      );
      if (!activeStream) return;

      const sink = new DaxAudioSink();
      const controller = radio()?.audioStream(activeStream.id);
      sink.init().catch(console.error);
      const subscription = controller?.on("data", (event) => sink.play(event));
      daxSinks.set(daxChannel, sink);

      onCleanup(() => {
        subscription?.unsubscribe();
        daxSinks.delete(daxChannel);
        void sink.close().catch(console.error);
      });
    });

    createEffect(() => {
      const sink = daxSinks.get(daxChannel);
      if (!sink) return;
      sink
        .setOutputDevice(
          preferences.dax.rx[daxChannel]?.outputDeviceId ?? "default",
        )
        .catch(console.error);
    });

    createEffect(() => {
      const sink = daxSinks.get(daxChannel);
      if (!sink) return;
      sink.setChannelMode(
        preferences.dax.rx[daxChannel]?.channelMode ?? "both",
      );
    });
  }

  // Create/destroy DAX IQ radio streams + sinks per channel
  for (let channel = 1; channel <= 4; channel++) {
    const iqChannel = channel;

    // Stream lifecycle: preference enabled flag drives create/close.
    // Initial sampleRate is read without tracking so subsequent rate changes
    // go through setSampleRate (in the rate-sync effect below) instead of
    // tearing the stream down and recreating it.
    createEffect(() => {
      if (!state.clientHandle || !preferences.dax.iq[iqChannel]?.enabled)
        return;
      const initialRate = untrack(
        () => preferences.dax.iq[iqChannel].sampleRate,
      );
      const promise = radio()?.createDaxIqStream({
        daxIqChannel: iqChannel,
        sampleRate: initialRate,
      });
      onCleanup(() =>
        promise?.then((stream) => radio()?.audioStream(stream.id)?.close()),
      );
    });

    // Sink lifecycle: tied to the configured sample rate (changing rate
    // recreates the sink because AudioContext can't change rate post-construction).
    createEffect(() => {
      const rate = preferences.dax.iq[iqChannel]?.sampleRate;
      if (!rate) return;
      const activeStream = Object.values(state.status.audioStream).find(
        (s) =>
          s.clientHandle === state.clientHandleInt &&
          s.type === "dax_iq" &&
          s.daxIqChannel === iqChannel,
      );
      if (!activeStream) return;

      const sink = new DaxIqAudioSink({ sampleRate: rate });
      const controller = radio()?.audioStream(activeStream.id);
      sink.init().catch(console.error);
      const subscription = controller?.on("data", (event) => sink.play(event));
      daxIqSinks.set(iqChannel, sink);

      onCleanup(() => {
        subscription?.unsubscribe();
        daxIqSinks.delete(iqChannel);
        void sink.close().catch(console.error);
      });
    });

    // Output device sync
    createEffect(() => {
      const sink = daxIqSinks.get(iqChannel);
      if (!sink) return;
      sink
        .setOutputDevice(preferences.dax.iq[iqChannel].outputDeviceId)
        .catch(console.error);
    });

    // Sample rate sync — push the preference rate to the radio when it differs.
    createEffect(() => {
      const stream = Object.values(state.status.audioStream).find(
        (s) =>
          s.clientHandle === state.clientHandleInt &&
          s.type === "dax_iq" &&
          s.daxIqChannel === iqChannel,
      );
      if (!stream) return;
      const desired = preferences.dax.iq[iqChannel]?.sampleRate;
      if (!desired || stream.daxIqRate === desired) return;
      const controller = radio()?.audioStream(stream.id);
      if (controller && "setSampleRate" in controller) {
        (controller as DaxIqAudioStreamController)
          .setSampleRate(desired)
          .catch(console.error);
      }
    });
  }

  // getUserMedia constraints for DAX TX
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

  // Create/destroy DAX TX radio stream controller
  createEffect(() => {
    if (!state.clientHandle || !preferences.dax.tx.enabled) return;
    const promise = radio()?.createDaxTxAudioStream();
    promise?.then(setDaxTxController);
    onCleanup(() => {
      setDaxTxController(undefined);
      promise?.then((controller) => controller.close().catch(() => {}));
    });
  });

  // Capture microphone for DAX TX and start DaxAudioTx
  const [daxTxInstance, setDaxTxInstance] = createSignal<
    DaxAudioTx | undefined
  >();

  createEffect((lastCleanupPromise: Promise<void>) => {
    const controller = daxTxController();
    if (!controller) return Promise.resolve();

    const streamPromise = lastCleanupPromise.then(() =>
      navigator.mediaDevices.getUserMedia({
        audio: { ...preferredDaxInputDevice() },
      }),
    );

    const daxPromise = streamPromise.then(async (stream) => {
      setDaxTxStream(stream);
      const tx = new DaxAudioTx(
        controller,
        preferences.dax.tx.reducedBandwidth,
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

    const { promise: cleanupPromise, resolve } = Promise.withResolvers<void>();

    onCleanup(() => {
      setDaxTxInstance(undefined);
      daxPromise.then((tx) => tx?.close().catch(console.error));
      streamPromise.then((stream) => {
        setDaxTxStream(undefined);
        stream.getTracks().forEach((t) => t.stop());
        resolve();
      });
    });

    return cleanupPromise;
  }, Promise.resolve());

  // Sync channel mode to running DaxAudioTx instance
  createEffect(() => {
    daxTxInstance()?.setChannelMode(preferences.dax.tx.channelMode);
  });

  createEffect(() => {
    for (const [channel, config] of Object.entries(preferences.dax.rx)) {
      if (config.enabled)
        daxRxControllers.get(Number(channel))?.setRxGain(config.gain);
    }
  });

  return (
    <AudioContext.Provider
      value={{
        daxSinks,
        daxIqSinks,
        daxTxStream,
        remoteAudioTxStream,
        remoteAudioRxStream: rtcRemoteAudioRxStream,
      }}
    >
      {props.children}
    </AudioContext.Provider>
  );
};
