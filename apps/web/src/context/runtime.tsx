import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  ParentComponent,
  useContext,
} from "solid-js";
import {
  createStore,
  produce,
  reconcile,
  SetStoreFunction,
} from "solid-js/store";
import useFlexRadio from "./flexradio";
import { usePreferences } from "./preferences";
import { useRtc } from "./rtc";
import { createPageVisibility } from "@solid-primitives/page-visibility";
import {
  createInitialNetworkState,
  NetworkTelemetryAggregator,
  type NetworkQuality,
  type RuntimeNetworkState,
  type ServerNetworkDiagnosticsPayload,
} from "~/lib/network-telemetry";

const RTC_STATS_INTERVAL_MS = 1_000;
const END_TO_END_PING_INTERVAL_MS = 2_000;

type SignalingDiagnosticsMessage = {
  type: "networkDiagnostics";
  payload: ServerNetworkDiagnosticsPayload;
};

export interface SliceSplitState {
  parent: string | null;
  child: string | null;
}

export interface RuntimeState {
  fps: Record<string, number>;
  split: Record<string, SliceSplitState>;
  network: RuntimeNetworkState;
  /** Whether the touch tuning panel is open. Targets the active slice. */
  tuningPanelOpen: boolean;
}

export type { NetworkQuality };

const RuntimeContext = createContext<{
  runtime: RuntimeState;
  setRuntime: SetStoreFunction<RuntimeState>;
}>();

export function useRuntime() {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("useRuntime must be used within <RuntimeProvider>");
  return ctx;
}

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
    setRuntime("network", reconcile(networkTelemetry.snapshot()));

  const resetNetwork = () => {
    endToEndPingInFlight = false;
    networkTelemetry.reset();
    syncNetwork();
  };

  createEffect(() => {
    const isVisible = visible();
    if (!(preferences.preventScreenSleep && state.clientHandle)) {
      return wakeLock()?.release();
    }
    if (wakeLock()?.released !== false && isVisible) {
      navigator.wakeLock?.request("screen").then(setWakeLock);
    }
  });

  createEffect(() => {
    const slices = new Set(Object.keys(state.status.slice));
    setRuntime(
      "split",
      produce((split) => {
        Object.entries(split).forEach(([key, value]) => {
          if (!(slices.has(key) && slices.has(value.child || value.parent))) {
            delete split[key];
          }
        });
      }),
    );
  });

  createEffect(() => {
    const activeRadio = radio();
    if (!activeRadio || !state.clientHandle) {
      resetNetwork();
      return;
    }

    resetNetwork();

    const interval = setInterval(() => {
      networkTelemetry.updateRadioLoss(
        activeRadio.networkDiagnosticsSnapshot(),
      );
      syncNetwork();
    }, RTC_STATS_INTERVAL_MS);

    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    const pc = peerConnection();
    if (!pc || !radio() || !state.clientHandle) {
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
    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    const activeRadio = radio();
    if (!activeRadio || !state.clientHandle) {
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
    onCleanup(() => {
      clearInterval(interval);
      endToEndPingInFlight = false;
    });
  });

  createEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!state.clientHandle || !radio()) return;

      try {
        const parsed = JSON.parse(event.data) as SignalingDiagnosticsMessage;
        if (parsed.type !== "networkDiagnostics") return;

        networkTelemetry.updateServerDiagnostics(parsed.payload);
        syncNetwork();
      } catch {
        // Ignore non-JSON signaling messages here.
      }
    };

    signalingWs.addEventListener("message", onMessage);
    onCleanup(() => signalingWs.removeEventListener("message", onMessage));
  });

  return (
    <RuntimeContext.Provider value={{ runtime, setRuntime }}>
      {props.children}
    </RuntimeContext.Provider>
  );
};
