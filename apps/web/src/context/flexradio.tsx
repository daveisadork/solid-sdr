import {
  Accessor,
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  ParentComponent,
  Show,
  useContext,
} from "solid-js";
import {
  createStore,
  produce,
  reconcile,
  SetStoreFunction,
} from "solid-js/store";
import { showToast } from "~/components/ui/toast";
import {
  FlexCommandRejectedError,
  FlexClient,
  Radio,
  type ApdSnapshot,
  type AudioStreamSnapshot,
  type ConnectionProgressDetail,
  type CwxSnapshot,
  type DvkSnapshot,
  type EqualizerSnapshot,
  type FeatureLicenseSnapshot,
  type FlexWireMessage,
  type GuiClientSnapshot,
  type MeterSnapshot,
  type PanadapterSnapshot,
  type RadioSnapshot,
  type RadioStateChange,
  type SliceSnapshot,
  type Subscription,
  type TxBandSettingSnapshot,
  type WaterfallSnapshot,
  type XvtrSnapshot,
  type SpotSnapshot,
} from "@repo/flexlib";
import { createFlexClient } from "@repo/flexlib/bridge";
import { useRtc } from "./rtc";
import { usePreferences } from "./preferences";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import MaterialSymbolsProgressActivity from "~icons/material-symbols/progress-activity";
import { Timeline } from "~/components/ui/timeline";
import { createWSState } from "@solid-primitives/websocket";
import { Button } from "~/components/ui/button";

export enum ConnectionState {
  disconnected,
  connecting,
  connected,
}

export enum ConnectionStage {
  TCP = 0,
  Data = 1,
  UDP = 2,
  Done = 3,
}

const withoutRaw = <T extends { raw?: unknown }>(
  obj: T,
): MutableProps<Omit<T, "raw">> => {
  const { raw: _, ...rest } = obj;
  return rest;
};

export interface Gradient {
  name: string;
  stops: { color: string; offset: number }[];
}

type MutableProps<T> = {
  -readonly [P in keyof T]: T[P];
};

export type RadioState = Omit<MutableProps<RadioSnapshot>, "raw">;
export type SliceState = Omit<MutableProps<SliceSnapshot>, "raw">;
export type PanadapterState = Omit<MutableProps<PanadapterSnapshot>, "raw">;
export type WaterfallState = Omit<MutableProps<WaterfallSnapshot>, "raw">;
export type AudioStreamState = Omit<MutableProps<AudioStreamSnapshot>, "raw">;
export type FeatureLicenseState = Omit<
  MutableProps<FeatureLicenseSnapshot>,
  "raw"
>;
export type GuiClientState = Omit<MutableProps<GuiClientSnapshot>, "raw">;
export type EqualizerState = Omit<MutableProps<EqualizerSnapshot>, "raw">;
export type APDState = Omit<MutableProps<ApdSnapshot>, "raw">;
export type TxBandSettingState = Omit<
  MutableProps<TxBandSettingSnapshot>,
  "raw"
>;
export type MeterState = Omit<MutableProps<MeterSnapshot>, "raw">;
export type XvtrState = Omit<MutableProps<XvtrSnapshot>, "raw">;
export type CwxState = Omit<MutableProps<CwxSnapshot>, "raw">;
export type DvkState = Omit<MutableProps<DvkSnapshot>, "raw">;
export type SpotState = Omit<MutableProps<SpotSnapshot>, "raw">;

export interface ConnectModalState {
  status: ConnectionState;
  selectedRadio: string | null;
  stage: ConnectionStage;
}

export interface StatusState {
  apd: APDState;
  meter: Record<string, MeterState>;
  equalizer: Record<string, EqualizerState>;
  slice: Record<string, SliceState>;
  panadapter: Record<string, PanadapterState>;
  waterfall: Record<string, WaterfallState>;
  radio: Radio;
  featureLicense: FeatureLicenseState;
  audioStream: Record<string, AudioStreamState>;
  spot: Record<string, SpotState>;
  guiClient: Record<string, GuiClientState>;
  txBandSetting: Record<string, TxBandSettingState>;
  xvtr: Record<string, XvtrState>;
  cwx: CwxState;
  dvk: DvkState;
}

export interface AppState {
  clientHandle: string | null;
  clientHandleInt: number | null;
  clientId: string | null;
  selectedPanadapter: string | null;
  connectModal: ConnectModalState;
  status: StatusState;
  runtime: RuntimeState;
}

interface RuntimeState {
  colorMin: number;
  colorMax: number;
  panSettledCenterMHz: Record<string, number | undefined>;
  panPendingCenterMHz: Record<string, number | undefined>;
}

export const initialState = () =>
  ({
    clientHandle: null,
    clientHandleInt: null,
    clientId: null,
    selectedPanadapter: null,
    connectModal: {
      status: ConnectionState.disconnected,
    },
    runtime: {
      colorMin: 0.0,
      colorMax: 1.0,
      panSettledCenterMHz: {},
      panPendingCenterMHz: {},
    },
    status: {
      apd: {},
      meter: {},
      equalizer: {},
      slice: {},
      panadapter: {},
      waterfall: {},
      guiClient: {},
      radio: {},
      spot: {},
      featureLicense: {},
      audioStream: {},
      txBandSetting: {},
      xvtr: {},
      cwx: {},
      dvk: {},
    },
  }) as AppState;

const FlexRadioContext = createContext<{
  state: AppState;
  setState: SetStoreFunction<AppState>;
  radio: () => Radio | null;
  client: Accessor<FlexClient>;
  connect: (addr: { host: string; port: number }) => void;
  disconnect: () => void;
  sendCommand: (command: string) => Promise<{
    response: number;
    message: string;
    debugOutput?: string;
  }>;
}>();

const WS_STATES = ["Connecting...", "Established", "Closing...", "Closed"];

export const FlexRadioProvider: ParentComponent = (props) => {
  const [state, setState] = createStore(initialState());
  const { preferences } = usePreferences();
  const { session: rtcSession, signalingWs } = useRtc();
  const [activeRadio, setActiveRadio] = createSignal<Radio | null>(null);

  const wsState = createWSState(signalingWs);
  const [rtcState, setRtcState] = createSignal<string | undefined>();

  const [ready, setReady] = createSignal(false);

  createEffect(() => {
    const pc = rtcSession()?.pc;

    const onConnectionStateChange = () => setRtcState(pc?.connectionState);

    pc?.addEventListener("connectionstatechange", onConnectionStateChange);
    onConnectionStateChange();
    onCleanup(() =>
      pc?.removeEventListener("connectionstatechange", onConnectionStateChange),
    );
  });

  createEffect(() => {
    if (rtcState() !== "connected") setReady(false);
  });

  let radioSubscriptions: Subscription[] = [];

  const flexClient = createMemo(() => {
    const pc = rtcSession()?.pc;
    return pc ? createFlexClient(pc) : undefined;
  });

  createEffect(() => {
    if (!rtcSession()) {
      teardownRadioConnection();
    }
  });

  const cleanupRadioSubscriptions = () => {
    for (const sub of radioSubscriptions) sub.unsubscribe();
    radioSubscriptions = [];
  };

  const applyPanadapterDiff = (diff: Partial<PanadapterSnapshot>) => {
    const key = diff.streamId || diff.id;
    // Keep the displayed center frequency pinned to the last settled value until
    // the data streams confirm the new frequency.
    const pan = withoutRaw(diff);
    const pendingCenterMHz = pan.centerFrequencyMHz;
    const centerFrequencyMHz = preferences.smoothScroll
      ? (state.runtime.panSettledCenterMHz[key] ?? pendingCenterMHz)
      : pendingCenterMHz;

    if (centerFrequencyMHz) {
      pan.centerFrequencyMHz = centerFrequencyMHz;
    }

    batch(() => {
      if (state.runtime.panSettledCenterMHz[key] === undefined) {
        setState("runtime", "panSettledCenterMHz", key, pendingCenterMHz);
      }
      setState("runtime", "panPendingCenterMHz", key, pendingCenterMHz);
      setState("status", "panadapter", key, pan);
    });
  };

  const handlePanadapterChange = (change: RadioStateChange) => {
    if (change.entity !== "panadapter") return;
    if (change.diff) {
      applyPanadapterDiff(change.diff);
    } else {
      const key = change.id;
      setState(
        "status",
        "panadapter",
        produce((pan) => {
          delete pan[key];
        }),
      );
      setState("runtime", "panSettledCenterMHz", key, undefined);
      setState("runtime", "panPendingCenterMHz", key, undefined);
      if (state.selectedPanadapter === key) {
        setState("selectedPanadapter", null);
      }
    }
  };

  const handleStateChange = (change: RadioStateChange) => {
    switch (change.entity) {
      case "panadapter":
        handlePanadapterChange(change);
        break;
      case "apd":
      case "cwx":
      case "dvk":
      case "radio":
      case "featureLicense":
        setState("status", change.entity, change.diff);
        break;
      case "unknown":
        console.warn("Unknown state change", change);
        break;
      default:
        if (change.removed) {
          setState(
            "status",
            change.entity,
            produce((items) => {
              delete items[change.id];
            }),
          );
        } else {
          setState("status", change.entity, change.id, change.diff);
        }
        break;
    }
  };

  createEffect(() => {
    if (state.connectModal.status !== ConnectionState.connecting) return;

    const handle = setTimeout(async () => {
      console.warn("Connection timed out");
      showToast({
        description: "Connection timed out",
        variant: "error",
      });
      disconnect();
    }, 15_000);
    onCleanup(() => clearTimeout(handle));
  });

  const sendCommand = async (command: string) => {
    const currentRadio = activeRadio();
    if (!currentRadio) {
      throw new Error("Not connected to a Flex radio");
    }
    try {
      const response = await currentRadio.command(command);
      return {
        response: response.code ?? (response.accepted ? 0 : 1),
        message: response.message ?? "",
        debugOutput: response.raw,
      };
    } catch (error) {
      if (error instanceof FlexCommandRejectedError) {
        showToast({
          description: error.message,
          variant: "error",
        });
      }
      throw error;
    }
  };

  createEffect(() => {
    if (!state.clientHandleInt) {
      return;
    }
    const selectedPanadapter = state.selectedPanadapter;
    const panadapter = selectedPanadapter
      ? state.status.panadapter[selectedPanadapter]
      : null;

    if (panadapter) {
      return;
    }

    const firstOwnPan =
      Object.keys(state.status.panadapter).filter(
        (streamId) =>
          state.status.panadapter[streamId]?.clientHandle ===
          state.clientHandleInt,
      )[0] || null;
    setState("selectedPanadapter", firstOwnPan ?? null);
  });

  const handleNoticePayload = (payload: string) => {
    const [, description] = payload.split("|");
    if (description) {
      showToast({ description, variant: "info" });
    }
  };

  const handleFlexMessage = (message: FlexWireMessage) => {
    switch (message.kind) {
      case "notice":
        handleNoticePayload(message.raw);
        break;
      case "reply":
        switch (message.level) {
          case "success":
            break;
          case "info":
            console.info("Command reply", message.raw);
            break;
          case "warning":
            console.warn("Command reply", message.raw);
            break;
          case "error":
          case "fatal":
            console.error("Command reply", message.raw);
            break;
        }
        break;
    }
  };

  const teardownRadioConnection = (options?: { resetState?: boolean }) => {
    const { resetState = true } = options ?? {};
    cleanupRadioSubscriptions();
    const currentRadio = activeRadio();
    setActiveRadio(null);
    currentRadio
      ?.disconnect()
      .then(() => console.log("disconnected"))
      .catch((error) =>
        console.error("Error closing flex radio session", error),
      );
    if (resetState) {
      setState(reconcile(initialState()));
    }
  };

  const disconnect = () => {
    teardownRadioConnection();
  };

  const attachRadioListeners = (
    radio: Radio,
    handleProgress: (progress: ConnectionProgressDetail) => void,
  ) => {
    cleanupRadioSubscriptions();
    radioSubscriptions = [
      radio.on("change", handleStateChange),
      radio.on("message", handleFlexMessage),
      radio.on("connectingProgress", handleProgress),
      radio.on("ready", () => handleProgress({ stage: "ready" })),
      radio.on("disconnected", disconnect),
    ];
  };

  const connect = async (addr: { host: string; port: number }) => {
    console.log("Connecting to", addr);
    setState("connectModal", {
      status: ConnectionState.connecting,
      selectedRadio: addr.host,
      stage: ConnectionStage.TCP,
    });
    const radio = flexClient().radioByEndpoint(addr);
    if (!radio?.serial) {
      showToast({
        description: "Selected radio is unavailable",
        variant: "error",
      });
      setState("connectModal", {
        status: ConnectionState.disconnected,
        selectedRadio: null,
        stage: ConnectionStage.TCP,
      });
      return;
    }
    if (!radio) {
      showToast({
        description: "Selected radio handle is unavailable",
        variant: "error",
      });
      setState("connectModal", {
        status: ConnectionState.disconnected,
        selectedRadio: null,
        stage: ConnectionStage.TCP,
      });
      return;
    }

    const handleProgress = (progress: ConnectionProgressDetail) => {
      switch (progress.stage) {
        case "tcp":
          setState("connectModal", "stage", ConnectionStage.TCP);
          break;
        case "sync":
          setState("connectModal", "stage", ConnectionStage.Data);
          break;
        case "udp":
          setState("connectModal", "stage", ConnectionStage.UDP);
          break;
        case "ready":
          setState("connectModal", {
            stage: ConnectionStage.Done,
            status: ConnectionState.connected,
          });
          break;
      }
    };

    attachRadioListeners(radio, handleProgress);
    setActiveRadio(radio);
    try {
      await radio.connect({
        clientInfo: {
          isGui: true,
          program: "SolidSDR Web",
          guiClientId: "76806B36-7090-4958-A879-174BAB94DF11",
        },
      });
    } catch (error) {
      console.error("Failed to connect to radio", error);
      showToast({
        description: "Failed to connect to radio",
        variant: "error",
      });
      setState("connectModal", "status", ConnectionState.disconnected);
      setState("connectModal", "selectedRadio", null);
      setState("connectModal", "stage", ConnectionStage.TCP);
      cleanupRadioSubscriptions();
      if (activeRadio() === radio) {
        setActiveRadio(null);
      }
      try {
        await radio.disconnect();
      } catch (closeError) {
        console.error("Error while closing failed session", closeError);
      }
    }
    setState({
      clientHandle: radio.clientHandle,
      clientHandleInt: radio.clientHandle
        ? parseInt(radio.clientHandle, 16)
        : null,
      clientId: radio.clientId,
    });
  };

  onCleanup(() => {
    teardownRadioConnection({ resetState: false });
  });

  createEffect(() => {
    globalThis.radio = activeRadio();
  });
  globalThis.state = state;
  globalThis.sendCommand = sendCommand; // Expose for debugging

  return (
    <FlexRadioContext.Provider
      value={{
        state,
        setState,
        sendCommand,
        connect,
        disconnect,
        radio: activeRadio,
        client: flexClient,
      }}
    >
      <Show
        when={ready()}
        fallback={
          <Card class="w-sm absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <CardHeader>
              <CardTitle>Initializing</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                items={[
                  {
                    title: "WebSocket",
                    description: WS_STATES[wsState()],
                  },
                  {
                    title: "WebRTC",
                    description: rtcState(),
                  },
                  {
                    title: "Client",
                    description: "This is the third event of the timeline.",
                  },
                ]}
                activeItem={[
                  true,
                  wsState() === 1,
                  rtcState() === "connected",
                ].lastIndexOf(true)}
              />
            </CardContent>
            <CardFooter>
              <Button
                disabled={rtcState() !== "connected"}
                onClick={() => setReady(true)}
              >
                Continue
              </Button>
            </CardFooter>
          </Card>
        }
      >
        {props.children}
      </Show>
    </FlexRadioContext.Provider>
  );
};

export default function useFlexRadio() {
  const context = useContext(FlexRadioContext);
  globalThis.flexradio = context; // Expose for debugging
  if (!context) {
    throw new Error(
      "useFlexRadioContext must be used within a FlexRadioProvider",
    );
  }

  return context;
}
