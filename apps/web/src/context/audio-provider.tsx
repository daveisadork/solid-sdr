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
  createEffect,
  createMemo,
  createSignal,
  type ParentComponent,
} from "solid-js";
import { showToast } from "~/components/ui/toast";
import { DaxAudioSink } from "~/lib/dax-audio-sink";
import { DaxAudioTx } from "~/lib/dax-audio-tx";
import { DaxIqAudioSink } from "~/lib/dax-iq-audio-sink";
import { createPermission } from "~/lib/permission";
import { RemoteTxGain } from "~/lib/remote-tx-gain";
import { synchronizeMaps } from "~/lib/utils";
import { AudioContext } from "./audio";
import useFlexRadio from "./flexradio";
import { usePreferences } from "./preferences";
import { useRtc } from "./rtc";

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
  const daxRxControllers = new ReactiveMap<
    number,
    DaxRxAudioStreamController
  >();
  const daxIqControllers = new ReactiveMap<
    number,
    DaxIqAudioStreamController
  >();

  const daxRxStreamIdsByChannel = new ReactiveMap<number, string>();
  const daxIqStreamIdsByChannel = new ReactiveMap<number, string>();

  const ownDaxChannels = (type: "dax_rx" | "dax_iq") => {
    const channels = new Map<number, string>();
    for (const stream of Object.values(state.status.audioStream)) {
      if (
        stream.clientHandle === state.clientHandleInt &&
        stream.type === type &&
        stream.daxChannel !== undefined
      ) {
        channels.set(stream.daxChannel, stream.id);
      }
    }
    return channels;
  };

  createEffect(
    () => ownDaxChannels("dax_rx"),
    (channels) => synchronizeMaps(daxRxStreamIdsByChannel, channels),
  );

  createEffect(
    () => ownDaxChannels("dax_iq"),
    (channels) => synchronizeMaps(daxIqStreamIdsByChannel, channels),
  );

  // Prompt for microphone permission when any audio feature is enabled
  createEffect(
    () =>
      audioPermission() !== "granted" &&
      (preferences.remoteAudio.rx.enabled ||
        preferences.dax.tx.enabled ||
        Object.values(preferences.dax.rx).some((c) => c.enabled) ||
        Object.values(preferences.dax.iq).some((c) => c.enabled)),
    (needsPrompt) => {
      if (!needsPrompt) return;
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        for (const t of stream.getTracks()) t.stop();
      });
    },
  );

  // Track which radio audio stream IDs belong to this client
  const ownStreamId = (type: "remote_audio_rx" | "remote_audio_tx") =>
    Object.values(state.status.audioStream).find(
      (s) => s.clientHandle === state.clientHandleInt && s.type === type,
    )?.streamId;
  const remoteAudioRxStreamId = createMemo(() =>
    ownStreamId("remote_audio_rx"),
  );
  const remoteAudioTxStreamId = createMemo(() =>
    ownStreamId("remote_audio_tx"),
  );

  // Play remote audio RX via programmatic Audio element (no JSX needed)
  createEffect(rtcRemoteAudioRxStream, (stream) => {
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
    return () => {
      audio.srcObject = null;
      setRemoteAudioElement(undefined);
    };
  });

  // Update output device when preference changes
  createEffect(
    () => ({
      audio: remoteAudioElement() as
        | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
        | undefined,
      deviceId: preferences.remoteAudio.rx.outputDeviceId,
    }),
    ({ audio, deviceId }) => {
      if (!audio?.setSinkId) return;
      audio.setSinkId(deviceId).catch(() => {});
    },
  );

  // Create/destroy a remote audio radio stream. Compute yields `undefined`
  // when disabled, `null` when enabled with no stream yet (create one, or
  // re-create after the radio drops it), or the live stream id (close it on
  // the next change).
  const manageRemoteStream = <T extends AudioStreamController>(
    streamId: () => string | null | undefined,
    create: () => Promise<T> | undefined,
  ) => {
    let pending: Promise<T> | undefined;
    createEffect(streamId, (id) => {
      if (id === undefined) {
        pending = undefined;
        return;
      }
      if (id === null) {
        pending = create();
        return;
      }
      const promise = pending;
      return () => {
        promise?.then((stream) => radio()?.audioStream(stream.id)?.close());
      };
    });
  };

  manageRemoteStream<AudioStreamController>(
    () =>
      state.clientHandle && preferences.remoteAudio.rx.enabled
        ? (remoteAudioRxStreamId() ?? null)
        : undefined,
    () => radio()?.createRemoteAudioRxStream({ compression: "OPUS" }),
  );

  manageRemoteStream<RemoteAudioTxStreamController>(
    () =>
      state.clientHandle &&
      preferences.remoteAudio.rx.enabled &&
      preferences.remoteAudio.tx.enabled
        ? (remoteAudioTxStreamId() ?? null)
        : undefined,
    () => radio()?.createRemoteAudioTxStream({ compression: "OPUS" }),
  );

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

  const [remoteTxGain, setRemoteTxGain] = createSignal<RemoteTxGain>();

  createEffect(
    () => !!remoteAudioTxStreamId(),
    (hasStream) => {
      if (!hasStream) return;
      const graph = new RemoteTxGain(state.status.radio.micLevel);
      setRemoteTxGain(graph);
      setRemoteAudioTxStream(graph.stream);
      setRemoteAudioTxTrack(graph.stream.getAudioTracks()[0] ?? null);
      return () => {
        setRemoteTxGain(undefined);
        setRemoteAudioTxStream(undefined);
        setRemoteAudioTxTrack(null);
        void graph.close();
      };
    },
  );

  createEffect(
    () => ({ graph: remoteTxGain(), audio: preferredInputDevice() }),
    ({ graph, audio }) => {
      if (!graph) return;
      let active = true;
      navigator.mediaDevices
        .getUserMedia({ audio: audio ?? true })
        .then((input) => {
          if (!active) {
            for (const track of input.getTracks()) track.stop();
            return;
          }
          return graph.setInput(input);
        })
        .catch((err) =>
          console.error("[audio] failed to get remote tx stream", err),
        );
      return () => {
        active = false;
      };
    },
  );

  createEffect(
    () => ({ micLevel: state.status.radio.micLevel, graph: remoteTxGain() }),
    ({ micLevel, graph }) => {
      if (!Number.isFinite(micLevel)) return;
      graph?.setMicLevel(micLevel);
    },
  );

  // Create/destroy DAX RX radio streams for each channel
  for (let channel = 1; channel <= 16; channel++) {
    const daxChannel = channel;

    createEffect(
      () =>
        state.clientHandle && preferences.dax.rx[daxChannel]?.enabled
          ? radio()
          : null,
      (activeRadio) => {
        if (!activeRadio) return;
        const promise = activeRadio.createDaxRxAudioStream({ daxChannel });
        promise.then((controller) =>
          daxRxControllers.set(daxChannel, controller),
        );
        return () => {
          promise.then((stream) => {
            // Use the captured daxChannel local, not stream.daxChannel: on
            // disconnect the store snapshot is already gone, so reading the
            // getter would throw FlexStateUnavailableError.
            daxRxControllers.delete(daxChannel);
            radio()?.audioStream(stream.id)?.close();
          });
        };
      },
    );

    createEffect(
      () => daxRxControllers.get(daxChannel),
      (controller) => {
        if (!controller) return;
        const sink = new DaxAudioSink();
        sink.init().catch(console.error);
        const subscription = controller.on("data", (event) => sink.play(event));
        daxSinks.set(daxChannel, sink);
        return () => {
          subscription.unsubscribe();
          daxSinks.delete(daxChannel);
          void sink.close().catch(console.error);
        };
      },
    );

    createEffect(
      () => ({
        sink: daxSinks.get(daxChannel),
        deviceId: preferences.dax.rx[daxChannel]?.outputDeviceId ?? "default",
      }),
      ({ sink, deviceId }) => {
        sink?.setOutputDevice(deviceId).catch(console.error);
      },
    );

    createEffect(
      () => ({
        sink: daxSinks.get(daxChannel),
        mode: preferences.dax.rx[daxChannel]?.channelMode ?? "both",
      }),
      ({ sink, mode }) => {
        sink?.setChannelMode(mode);
      },
    );

    createEffect(
      () => ({
        controller: daxRxControllers.get(daxChannel),
        gain: preferences.dax.rx[daxChannel].gain,
      }),
      ({ controller, gain }) => {
        controller?.setRxGain(gain);
      },
    );
  }

  // Create/destroy DAX IQ radio streams + sinks per channel
  for (let channel = 1; channel <= 4; channel++) {
    const iqChannel = channel;

    // Stream lifecycle: preference enabled flag drives create/close.
    // Initial sampleRate is read without tracking so subsequent rate changes
    // go through setSampleRate (in the rate-sync effect below) instead of
    // tearing the stream down and recreating it.
    // The sample rate is read in apply (untracked), so rate changes go through
    // setSampleRate below instead of recreating the stream.
    createEffect(
      () =>
        state.clientHandle && preferences.dax.iq[iqChannel]?.enabled
          ? radio()
          : null,
      (activeRadio) => {
        if (!activeRadio) return;
        const promise = activeRadio.createDaxIqStream({
          daxIqChannel: iqChannel,
          sampleRate: preferences.dax.iq[iqChannel].sampleRate,
        });
        promise.then((controller) =>
          daxIqControllers.set(iqChannel, controller),
        );
        return () => {
          promise.then((stream) => {
            // Use the captured daxChannel local, not stream.daxChannel: on
            // disconnect the store snapshot is already gone, so reading the
            // getter would throw FlexStateUnavailableError.
            daxIqControllers.delete(iqChannel);
            radio()?.audioStream(stream.id)?.close();
          });
        };
      },
    );

    // Sink lifecycle: tied to the configured sample rate (changing rate
    // recreates the sink because AudioContext can't change rate post-construction).
    createEffect(
      () => ({
        rate: preferences.dax.iq[iqChannel]?.sampleRate,
        controller: daxIqControllers.get(iqChannel),
      }),
      ({ rate, controller }) => {
        if (!rate || !controller) return;
        const sink = new DaxIqAudioSink({ sampleRate: rate });
        sink.init().catch(console.error);
        const subscription = controller.on("data", (event) => sink.play(event));
        daxIqSinks.set(iqChannel, sink);
        return () => {
          subscription.unsubscribe();
          daxIqSinks.delete(iqChannel);
          void sink.close().catch(console.error);
        };
      },
    );

    // Output device sync
    createEffect(
      () => ({
        sink: daxIqSinks.get(iqChannel),
        deviceId: preferences.dax.iq[iqChannel].outputDeviceId,
      }),
      ({ sink, deviceId }) => {
        sink?.setOutputDevice(deviceId).catch(console.error);
      },
    );

    // Sample rate sync — push the preference rate to the radio when it differs.
    createEffect(
      () => {
        const streamId = daxIqStreamIdsByChannel.get(iqChannel);
        const stream = streamId
          ? state.status.audioStream[streamId]
          : undefined;
        const desired = preferences.dax.iq[iqChannel]?.sampleRate;
        if (!stream || !desired || stream.daxIqRate === desired) return null;
        const controller = daxIqControllers.get(iqChannel);
        return controller ? { controller, desired } : null;
      },
      (pending) => {
        pending?.controller.setSampleRate(pending.desired).catch(console.error);
      },
    );
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
  createEffect(
    () => (state.clientHandle && preferences.dax.tx.enabled ? radio() : null),
    (activeRadio) => {
      if (!activeRadio) return;
      const promise = activeRadio.createDaxTxAudioStream();
      promise.then(setDaxTxController);
      return () => {
        setDaxTxController(undefined);
        promise.then((controller) => controller.close().catch(() => {}));
      };
    },
  );

  // Capture microphone for DAX TX and start DaxAudioTx
  const [daxTxInstance, setDaxTxInstance] = createSignal<
    DaxAudioTx | undefined
  >();

  // Each capture waits for the previous one to release the microphone.
  let lastDaxTxCleanup = Promise.resolve();
  createEffect(
    () => ({ controller: daxTxController(), audio: preferredDaxInputDevice() }),
    ({ controller, audio }) => {
      if (!controller) return;

      const constraints = { audio: { ...audio } };
      const streamPromise = lastDaxTxCleanup.then(() =>
        navigator.mediaDevices.getUserMedia(constraints),
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

      const { promise: cleanupPromise, resolve } =
        Promise.withResolvers<void>();
      lastDaxTxCleanup = cleanupPromise;

      return () => {
        setDaxTxInstance(undefined);
        daxPromise.then((tx) => tx?.close().catch(console.error));
        streamPromise.then((stream) => {
          setDaxTxStream(undefined);
          for (const t of stream.getTracks()) t.stop();
          resolve();
        });
      };
    },
  );

  // Sync channel mode to running DaxAudioTx instance
  createEffect(
    () => ({ tx: daxTxInstance(), mode: preferences.dax.tx.channelMode }),
    ({ tx, mode }) => {
      tx?.setChannelMode(mode);
    },
  );

  return (
    <AudioContext
      value={{
        daxSinks,
        daxIqSinks,
        daxTxStream,
        remoteAudioTxStream,
        remoteAudioRxStream: () => rtcRemoteAudioRxStream() ?? undefined,
      }}
    >
      {props.children}
    </AudioContext>
  );
};
