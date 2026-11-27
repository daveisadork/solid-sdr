import { createPageVisibility } from "@solid-primitives/page-utilities";
import {
  createEffect,
  createSignal,
  createStore,
  onCleanup,
  type ParentComponent,
  reconcile,
} from "solid-js";
import {
  createInitialNetworkState,
  NetworkTelemetryAggregator,
  type ServerNetworkDiagnosticsPayload,
} from "~/lib/network-telemetry";
import useFlexRadio from "./flexradio";
import { usePreferences } from "./preferences";
import { useRtc } from "./rtc";
import { RuntimeContext, type RuntimeState } from "./runtime";

const RTC_STATS_INTERVAL_MS = 1_000;
const END_TO_END_PING_INTERVAL_MS = 2_000;

type SignalingDiagnosticsMessage = {
  type: "networkDiagnostics";
  payload: ServerNetworkDiagnosticsPayload;
};

export const RuntimeProvider: ParentComponent = (props) => {
  const { state, radio } = useFlexRadio();
  const { peerConnection, signalingWs } = useRtc();
  const { preferences } = usePreferences();
  const [runtime, setRuntime] = createStore<RuntimeState>({
    fps: {},
    split: {},
    network: createInitialNetworkState(),
    tuningPanelOpen: false,
  });

  const visible = createPageVisibility();
  const [wakeLock, setWakeLock] = createSignal<WakeLockSentinel>();
  const networkTelemetry = new NetworkTelemetryAggregator();
  let endToEndPingInFlight = false;

  const syncNetwork = () =>
    setRuntime((draft) => {
      reconcile(networkTelemetry.snapshot())(draft.network);
    });

  const resetNetwork = () => {
    endToEndPingInFlight = false;
    networkTelemetry.reset();
    syncNetwork();
  };

  // The connected radio, or null while disconnected.
  const connectedRadio = () => (state.clientHandle ? radio() : null);

  createEffect(
    () => ({
      isVisible: visible(),
      wanted: !!(preferences.preventScreenSleep && state.clientHandle),
      lock: wakeLock(),
    }),
    ({ isVisible, wanted, lock }) => {
      if (!wanted) {
        void lock?.release();
        return;
      }
      if (lock?.released !== false && isVisible) {
        navigator.wakeLock?.request("screen").then(setWakeLock);
      }
    },
  );

  createEffect(
    () => new Set(Object.keys(state.status.slice)),
    (slices) => {
      setRuntime((draft) => {
        for (const [key, value] of Object.entries(draft.split)) {
          const partner = value.child ?? value.parent;
          if (!(slices.has(key) && partner != null && slices.has(partner))) {
            delete draft.split[key];
          }
        }
      });
    },
  );

  createEffect(connectedRadio, (activeRadio) => {
    resetNetwork();
    if (!activeRadio) return;

    const interval = setInterval(() => {
      networkTelemetry.updateRadioLoss(
        activeRadio.networkDiagnosticsSnapshot(),
      );
      syncNetwork();
    }, RTC_STATS_INTERVAL_MS);

    return () => clearInterval(interval);
  });

  createEffect(
    () => (connectedRadio() ? peerConnection() : null),
    (pc) => {
      if (!pc) {
        networkTelemetry.reset();
        syncNetwork();
        return;
      }

      const sampleRtcStats = () => {
        pc.getStats()
          .then((report) => {
            networkTelemetry.updateRtcReport(report);
            syncNetwork();
          })
          .catch((error) => {
            console.warn("Failed to read RTC stats", error);
          });
      };

      sampleRtcStats();
      const interval = setInterval(sampleRtcStats, RTC_STATS_INTERVAL_MS);
      return () => clearInterval(interval);
    },
  );

  createEffect(connectedRadio, (activeRadio) => {
    if (!activeRadio) {
      endToEndPingInFlight = false;
      return;
    }

    const runPing = () => {
      if (endToEndPingInFlight) return;

      endToEndPingInFlight = true;
      const startedAt = performance.now();
      activeRadio
        .command("ping")
        .then(() => {
          networkTelemetry.updateEndToEndRtt(
            Math.round(performance.now() - startedAt),
          );
          syncNetwork();
        })
        .catch((error) => {
          console.warn("End-to-end ping failed", error);
        })
        .finally(() => {
          endToEndPingInFlight = false;
        });
    };

    runPing();
    const interval = setInterval(runPing, END_TO_END_PING_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      endToEndPingInFlight = false;
    };
  });

  const onSignalingMessage = (event: MessageEvent) => {
    if (!connectedRadio()) return;

    try {
      const parsed = JSON.parse(event.data) as SignalingDiagnosticsMessage;
      if (parsed.type !== "networkDiagnostics") return;

      networkTelemetry.updateServerDiagnostics(parsed.payload);
      syncNetwork();
    } catch {
      // Ignore non-JSON signaling messages here.
    }
  };
  signalingWs.addEventListener("message", onSignalingMessage);
  onCleanup(() =>
    signalingWs.removeEventListener("message", onSignalingMessage),
  );

  return (
    <RuntimeContext value={{ runtime, setRuntime }}>
      {props.children}
    </RuntimeContext>
  );
};
