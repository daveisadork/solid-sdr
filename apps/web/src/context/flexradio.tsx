import {
  Accessor,
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
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
import { FlexCommandRejectedError, FlexClient, Radio } from "@repo/flexlib";
import type {
  ApdSnapshot,
  AudioStreamSnapshot,
  ConnectionProgressDetail,
  CwxSnapshot,
  DvkSnapshot,
  EqualizerSnapshot,
  FeatureLicenseSnapshot,
  FlexWireMessage,
  GuiClientSnapshot,
  MemorySnapshot,
  MeterSnapshot,
  PanadapterSnapshot,
  RadioSnapshot,
  RadioStateChange,
  SliceSnapshot,
  SpotSnapshot,
  SpotStateChange,
  Subscription,
  TnfSnapshot,
  TxBandSettingSnapshot,
  WaterfallSnapshot,
  XvtrSnapshot,
  DisplayMarkerSnapshot,
  DisplayMarkerStateChange,
  FilterPresetSnapshot,
  DisconnectedReason,
} from "@repo/flexlib";
import { createFlexClient } from "@repo/flexlib/bridge";
import { useRtc } from "./rtc";
import { usePreferences } from "./preferences";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Timeline } from "~/components/ui/timeline";
import { InfoItem } from "~/components/settings/common";
import { ReactiveMap } from "@solid-primitives/map";
import { FlexRadioDescriptor } from "@repo/flexlib";

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
export type TnfState = Omit<MutableProps<TnfSnapshot>, "raw">;
export type MemoryState = Omit<MutableProps<MemorySnapshot>, "raw">;
export type DisplayMarkerState = Omit<
  MutableProps<DisplayMarkerSnapshot>,
  "raw"
>;
export type FilterPresetState = Omit<MutableProps<FilterPresetSnapshot>, "raw">;

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
  radio: RadioState;
  featureLicense: FeatureLicenseState;
  audioStream: Record<string, AudioStreamState>;
  spot: Record<string, SpotState>;
  guiClient: Record<string, GuiClientState>;
  txBandSetting: Record<string, TxBandSettingState>;
  tnf: Record<string, TnfState>;
  memory: Record<string, MemoryState>;
  xvtr: Record<string, XvtrState>;
  cwx: CwxState;
  dvk: DvkState;
  displayMarker: Record<string, Record<string, DisplayMarkerState>>;
  filterPreset: FilterPresetState;
}

export interface AppState {
  clientHandle: string | null;
  clientHandleInt: number | null;
  clientId: string | null;
  selectedPanadapter: string | null;
  discoveredRadios: Record<string, FlexRadioDescriptor>;
  connectModal: ConnectModalState;
  status: StatusState;
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
    discoveredRadios: {},
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
      tnf: {},
      memory: {},
      displayMarker: {},
      filterPreset: {},
    },
  }) as AppState;

const FlexRadioContext = createContext<{
  state: AppState;
  setState: SetStoreFunction<AppState>;
  spots: ReactiveMap<string, SpotState>;
  bands: ReactiveMap<string, string>;
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
  const { preferences, setPreferences } = usePreferences();
  const { peerConnection, rtcState, signalingWsState } = useRtc();
  const [activeRadio, setActiveRadio] = createSignal<Radio | null>(null);

  const spots = new ReactiveMap<string, SpotState>();

  let radioSubscriptions: Subscription[] = [];

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

  const flexClient = createMemo(() => {
    const pc = peerConnection();
    return pc && rtcState.connectionState === "connected"
      ? createFlexClient(pc)
      : null;
  });

  const updateDiscoveryRadio = (descriptor?: FlexRadioDescriptor) => {
    if (descriptor) {
      setState("discoveredRadios", descriptor.host, { ...descriptor });
    }
  };

  createEffect(() => {
    const client = flexClient();
    if (!client) return;

    const clientSubscriptions = [
      client.on("radioDiscovered", (radio) =>
        updateDiscoveryRadio(radio.descriptor),
      ),
      client.on("radioUpdated", (radio) =>
        updateDiscoveryRadio(radio.descriptor),
      ),
      client.on("radioLost", (radio) =>
        setState(
          "discoveredRadios",
          produce((radios) => {
            delete radios[radio.endpoint?.host];
          }),
        ),
      ),
    ];

    onCleanup(() => {
      console.debug("Cleaning up discovery subscriptions and session");
      for (const sub of clientSubscriptions) sub.unsubscribe();
      client
        .stopDiscovery()
        .catch((error) =>
          console.error("Failed to stop discovery session", error),
        );
    });

    client.startDiscovery().catch((error) => {
      console.error("Failed to start discovery session", error);
    });
  });

  const cleanupRadioSubscriptions = () => {
    for (const sub of radioSubscriptions) sub.unsubscribe();
    radioSubscriptions = [];
  };

  const handleSpotChange = (change: SpotStateChange) => {
    if (change.removed) {
      const callsign = state.status.spot[change.id].callsign;
      setState(
        "status",
        "spot",
        produce((items) => {
          delete items[change.id];
        }),
      );
      if (spots.get(callsign)?.id === change.id) {
        spots.delete(callsign);
      }
    } else {
      setState("status", change.entity, change.id, change.diff);
      const callsign = state.status.spot[change.id].callsign;
      if (spots.get(callsign)?.id !== change.id) {
        spots.set(callsign, state.status.spot[change.id]);
      }
    }
  };

  const handleDisplayMarkerChange = (change: DisplayMarkerStateChange) => {
    if (change.removed) {
      setState(
        "status",
        change.entity,
        change.group,
        produce((items) => {
          delete items[change.id];
        }),
      );
    } else {
      batch(() => {
        setState("status", change.entity, change.group, {});
        setState("status", change.entity, change.group, change.id, change.diff);
      });
    }
  };

  const handleStateChange = (change: RadioStateChange) => {
    switch (change.entity) {
      case "spot":
        handleSpotChange(change);
        break;
      case "displayMarker":
        handleDisplayMarkerChange(change);
        break;
      case "apd":
      case "cwx":
      case "dvk":
      case "radio":
      case "featureLicense":
      case "filterPreset":
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

  const disconnect = (reason: DisconnectedReason | undefined) => {
    if (reason) {
      showToast({
        title: "Disconnected by another client",
        description: `Reason: ${reason.replaceAll("_", " ")}`,
        variant: "warning",
      });
    }
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
          guiClientId: preferences.guiClientId,
          station: preferences.stationName.replaceAll(/ /g, "\u007f"),
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
    setPreferences("guiClientId", radio.clientId);
  };

  onCleanup(() => {
    teardownRadioConnection({ resetState: false });
  });

  createEffect(() => {
    globalThis.radio = activeRadio();
  });
  globalThis.state = state;
  globalThis.sendCommand = sendCommand; // Expose for debugging

  const bands = new ReactiveMap<string, string>([
    ["160", "160m"],
    ["80", "80m"],
    ["60", "60m"],
    ["40", "40m"],
    ["30", "30m"],
    ["20", "20m"],
    ["17", "17m"],
    ["15", "15m"],
    ["12", "12m"],
    ["10", "10m"],
    ["6", "6m"],
    ["33", "WWV"],
    ["34", "GEN"],
    ["2200", "2200m"],
    ["630", "630m"],
  ]);

  createEffect(() => {
    const xvrtBands = new Map<string, string>(
      Object.values(state.status.xvtr)
        .filter(({ valid }) => valid)
        .toSorted((a, b) => a.order - b.order)
        .map(({ id, name }) => [`x${id}`, name]),
    );
    for (const band of bands.keys()) {
      if (band.startsWith("x") && !xvrtBands.has(band)) bands.delete(band);
    }
    for (const [key, value] of xvrtBands) {
      bands.set(key, value);
    }
  });

  return (
    <FlexRadioContext.Provider
      value={{
        spots,
        state,
        setState,
        sendCommand,
        connect,
        disconnect,
        bands,
        radio: activeRadio,
        client: flexClient,
      }}
    >
      <Show
        when={flexClient()}
        fallback={
          <Card class="w-sm max-w-[95%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <CardHeader>
              <CardTitle>Initializing</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                items={[
                  {
                    title: "WebSocket",
                    description: WS_STATES[signalingWsState()],
                  },
                  {
                    title: "WebRTC",
                    description: (
                      <>
                        <InfoItem
                          label="Connection State"
                          value={rtcState.connectionState}
                        />
                        <InfoItem
                          label="Signaling State"
                          value={rtcState.signalingState}
                        />
                        <InfoItem
                          label="ICE Gathering State"
                          value={rtcState.iceGatheringState}
                        />
                        <InfoItem
                          label="ICE Conn State"
                          value={rtcState.iceConnectionState}
                        />
                      </>
                    ),
                  },
                ]}
                activeItem={[
                  true,
                  signalingWsState() === 1,
                  rtcState.connectionState === "connected",
                ].lastIndexOf(true)}
              />
            </CardContent>
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
