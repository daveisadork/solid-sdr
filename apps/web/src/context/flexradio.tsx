import { createReconnectingWS, makeWS } from "@solid-primitives/websocket";
import {
  batch,
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
import { showToast } from "~/components/ui/toast";
import {
  attachRtcDataChannel,
  createRadioStateStore,
  createRadioClient,
  createUdpSession,
  createVitaDiscoveryAdapter,
  FlexCommandRejectedError,
  scaleMeterRawValue,
  type AudioStreamSnapshot,
  type FlexConnectionProgress,
  type FlexDataPlaneFactory,
  type FlexWireMessage,
  type GuiClientSnapshot,
  type MeterSnapshot,
  type PanadapterSnapshot,
  type RadioSnapshot,
  type RadioHandle,
  type RadioStateChange,
  type SliceSnapshot,
  type Subscription,
  type UdpSession,
  type WaterfallSnapshot,
  type FeatureLicenseSnapshot,
  EqualizerSnapshot,
  ApdSnapshot,
  TxBandSettingSnapshot,
  RadioClient,
} from "@repo/flexlib";
import { createWebSocketFlexControlFactory } from "~/lib/flex-control";
import { useRtc } from "./rtc";

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

export type Meter = Omit<MutableProps<MeterSnapshot>, "raw"> & {
  value?: number;
};

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

export type Radio = Omit<MutableProps<RadioSnapshot>, "raw">;
export type Slice = Omit<MutableProps<SliceSnapshot>, "raw">;
export type Panadapter = Omit<MutableProps<PanadapterSnapshot>, "raw">;
export type Waterfall = Omit<MutableProps<WaterfallSnapshot>, "raw">;
export type AudioStream = Omit<MutableProps<AudioStreamSnapshot>, "raw">;
export type FeatureLicense = Omit<MutableProps<FeatureLicenseSnapshot>, "raw">;
export type GuiClient = Omit<MutableProps<GuiClientSnapshot>, "raw">;
export type Equalizer = Omit<MutableProps<EqualizerSnapshot>, "raw">;
export type APD = Omit<MutableProps<ApdSnapshot>, "raw">;
export type TxBandSetting = Omit<MutableProps<TxBandSettingSnapshot>, "raw">;

export interface DisplaySettings {
  scrollOffset: number;
  enableTransparencyEffects: boolean;
  peakStyle: "none" | "points" | "line";
  fillStyle: "none" | "solid" | "gradient";
}

export interface PaletteSettings {
  colorMin: number;
  colorMax: number;
  gradients: Gradient[];
}

export interface ConnectModalState {
  status: ConnectionState;
  selectedRadio: string | null;
  stage: ConnectionStage;
}

export interface StatusState {
  apd: APD;
  meter: Record<string, Meter>;
  equalizer: Record<string, Equalizer>;
  slice: Record<string, Slice>;
  panadapter: Record<string, Panadapter>;
  waterfall: Record<string, Waterfall>;
  radio: Radio;
  featureLicense: FeatureLicense;
  audioStream: Record<string, AudioStream>;
  guiClient: Record<string, GuiClient>;
  txBandSetting: Record<string, TxBandSetting>;
}

export interface SettingsState {
  showFps: boolean;
  sMeterEnabled: boolean;
}

export interface AppState {
  clientHandle: string | null;
  clientHandleInt: number | null;
  clientId: string | null;
  selectedPanadapter: string | null;
  display: DisplaySettings;
  palette: PaletteSettings;
  connectModal: ConnectModalState;
  status: StatusState;
  runtime: RuntimeState;
  settings: SettingsState;
}

interface RuntimeState {
  panSettledCenterMHz: Record<string, number | undefined>;
  panPendingCenterMHz: Record<string, number | undefined>;
}

export const initialState = () =>
  ({
    clientHandle: null,
    clientHandleInt: null,
    clientId: null,
    selectedPanadapter: null,
    display: {
      scrollOffset: 0,
      enableTransparencyEffects: true,
      peakStyle: "points",
      fillStyle: "solid",
    },
    palette: {
      colorMin: 0.0,
      colorMax: 1.0,
      gradients: [
        {
          name: "SmartSDR",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#0000ff", offset: 0.15 },
            { color: "#00ffff", offset: 0.25 },
            { color: "#00ff00", offset: 0.35 },
            { color: "#ffff00", offset: 0.55 },
            { color: "#ff0000", offset: 0.9 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "SmartSDR + Purple",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#0000ff", offset: 0.15 },
            { color: "#00ffff", offset: 0.225 },
            { color: "#00ff00", offset: 0.3 },
            { color: "#ffff00", offset: 0.45 },
            { color: "#ff0000", offset: 0.6 },
            { color: "#ff00ff", offset: 0.75 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },

        {
          name: "Dark",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#0000ff", offset: 0.65 },
            { color: "#00ff00", offset: 0.9 },
            { color: "#ff0000", offset: 0.95 },
            { color: "#ffb6c1", offset: 1.0 },
          ],
        },
        {
          name: "Grayscale",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "Deuteranopia",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#083c6b", offset: 0.15 },
            { color: "#84a2d6", offset: 0.5 },
            { color: "#a59673", offset: 0.65 },
            { color: "#ffff00", offset: 0.75 },
            { color: "#ffff00", offset: 0.95 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "Tritanopia",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#004552", offset: 0.15 },
            { color: "#6bbad6", offset: 0.45 },
            { color: "#4a0818", offset: 0.46 },
            { color: "#ff0000", offset: 0.9 },
            { color: "#d67984", offset: 0.99 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "Vintage Warm",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#1d4877", offset: 0.15 },
            { color: "#1ba4a1", offset: 0.25 },
            { color: "#1b8a5a", offset: 0.35 },
            { color: "#fbb021", offset: 0.55 },
            { color: "#ee3e32", offset: 0.6 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "Vintage Warm + Pink",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#1d4877", offset: 0.15 },
            { color: "#1ba4a1", offset: 0.225 },
            { color: "#1b8a5a", offset: 0.3 },
            { color: "#fbb021", offset: 0.45 },
            { color: "#f68838", offset: 0.525 },
            { color: "#ee3e32", offset: 0.6 },
            { color: "#f36a82", offset: 0.75 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "CMYK",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#00ffff", offset: 0.25 },
            { color: "#ffff00", offset: 0.5 },
            { color: "#ff00ff", offset: 0.75 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "RGB",
          stops: [
            { color: "#000000", offset: 0.0 },
            { color: "#0000ff", offset: 0.25 },
            { color: "#00ff00", offset: 0.5 },
            { color: "#ff0000", offset: 0.75 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "Solarized",
          stops: [
            { color: "#002b36", offset: 0.0 },
            { color: "#268bd2", offset: 0.15 },
            { color: "#2aa198", offset: 0.25 },
            { color: "#859900", offset: 0.35 },
            { color: "#b58900", offset: 0.55 },
            { color: "#dc322f", offset: 0.9 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
        {
          name: "Solarized + Pink",
          stops: [
            { color: "#002b36", offset: 0.0 },
            { color: "#268bd2", offset: 0.15 },
            { color: "#2aa198", offset: 0.225 },
            { color: "#859900", offset: 0.3 },
            { color: "#b58900", offset: 0.45 },
            { color: "#cb4b16", offset: 0.525 },
            { color: "#dc322f", offset: 0.6 },
            { color: "#d33682", offset: 0.75 },
            { color: "#ffffff", offset: 1.0 },
          ],
        },
      ],
    },
    connectModal: {
      status: ConnectionState.disconnected,
    },
    runtime: {
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
      radio: {
        // // slices: 4,
        // // panadapters: 4,
        // // lineout_gain: 60,
        // // lineout_mute: false,
        // // headphone_gain: 50,
        // // headphone_mute: false,
        // // remote_on_enabled: false,
        // // pll_done: 0,
        // // freq_error_ppb: 0,
        // // cal_freq: 15.0,
        // // tnf_enabled: true,
        // // nickname: "FLEX-8600",
        // // callsign: "KF0SMY",
        // // binaural_rx: false,
        // // full_duplex_enabled: false,
        // // band_persistence_enabled: true,
        // // rtty_mark_default: 2125,
        // // enforce_private_ip_connections: true,
        // // backlight: 50,
        // // mute_local_audio_when_remote: true,
        // // daxiq_capacity: 16,
        // // daxiq_available: 16,
        // // alpha: 0,
        // // low_latency_digital_modes: true,
        // // mf_enable: true,
        // // auto_save: true,
        // oscillator: {},
        // static_net_params: {},
        // filter_sharpness: {
        //   VOICE: {},
        //   CW: {},
        //   DIGITAL: {},
        // },
      },
      featureLicense: {},
      audioStream: {},
      txBandSetting: {},
    },
    settings: {
      showFps: false,
      sMeterEnabled: true,
    },
  }) as AppState;

const FlexRadioContext = createContext<{
  state: AppState;
  setState: SetStoreFunction<AppState>;
  radio: () => RadioHandle | null;
  client: RadioClient;
  connect: (addr: { host: string; port: number }) => void;
  disconnect: () => void;
  sendCommand: (command: string) => Promise<{
    response: number;
    message: string;
    debugOutput?: string;
  }>;
  events: UdpSession;
}>();

export const FlexRadioProvider: ParentComponent = (props) => {
  const [state, setState] = createStore(initialState());
  const { connect: connectRTC, disconnect: disconnectRTC } = useRtc();
  const [activeRadio, setActiveRadio] = createSignal<RadioHandle | null>(null);

  // const logger = {
  //   debug(message: string, meta?: Record<string, unknown>) {
  //     console.debug(message, meta);
  //   },
  //   info(message: string, meta?: Record<string, unknown>) {
  //     console.info(message, meta);
  //   },
  //   warn(message: string, meta?: Record<string, unknown>) {
  //     console.warn(message, meta);
  //   },
  //   error(message: string, meta?: Record<string, unknown>) {
  //     console.error(message, meta);
  //   },
  // };
  const logger = console;

  const udpSession = createUdpSession({ logger });
  const discoveryWs = createReconnectingWS("/ws/discovery");
  let radioSubscriptions: Subscription[] = [];
  let rtcUdpCleanup: (() => void) | undefined;
  let featureLicenseStore = createRadioStateStore({ logger });

  discoveryWs.addEventListener("open", ({ target }) => {
    (target as WebSocket).binaryType = "arraybuffer";
  });

  const discoveryAdapter = createVitaDiscoveryAdapter({
    transportFactory: {
      async start(handlers) {
        let closed = false;

        const handleMessage = (event: MessageEvent) => {
          if (closed) return;
          handlers.onMessage(new Uint8Array(event.data));
        };

        const handleError = (error: Event) => {
          if (closed) return;
          handlers.onError?.(error);
        };

        discoveryWs.addEventListener("message", handleMessage);
        discoveryWs.addEventListener("error", handleError);

        return {
          async close() {
            console.log("Closing discovery transport");
            if (closed) return;
            closed = true;
            discoveryWs.removeEventListener("message", handleMessage);
            discoveryWs.removeEventListener("error", handleError);
            discoveryWs.close();
          },
        };
      },
    },
    logger,
  });

  const controlFactory = createWebSocketFlexControlFactory({
    makeSocket(descriptor) {
      const ws = makeWS(
        `/ws/radio?host=${descriptor.host}&port=${descriptor.port}`,
      );
      ws.addEventListener("close", disconnect);
      return ws;
    },
    logger,
    udpSession,
  });

  const radioClient = createRadioClient(
    {
      discovery: discoveryAdapter,
      control: controlFactory,
      logger,
    },
    { defaultCommandTimeoutMs: 10_000 },
  );

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
    const centerFrequencyMHz =
      state.runtime.panSettledCenterMHz[key] ?? pendingCenterMHz;

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
      case "radio":
      case "featureLicense":
        setState("status", change.entity, change.diff);
        break;
      case "unknown":
        // console.warn("Unknown state change", change);
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

  const handleFlexMessage = ({ message }: { message: FlexWireMessage }) => {
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
      case "status":
        if (message.source === "license") {
          featureLicenseStore ??= createRadioStateStore({ logger });
          const changes = featureLicenseStore.apply(message);
          for (const change of changes) {
            if (change.entity === "featureLicense") {
              handleStateChange(change);
            }
          }
        }
        break;
    }
  };

  createEffect(() => {
    const { unsubscribe } = udpSession.on("meter", ({ packet }) => {
      const meterPacket = packet;
      setState(
        "status",
        "meter",
        produce((meters) => {
          const count = meterPacket.numMeters;
          for (let i = 0; i < count; i++) {
            const id = meterPacket.ids[i];
            if (id in meters) {
              meters[id].value = scaleMeterRawValue(
                meters[id].units,
                meterPacket.values[i],
              );
            }
          }
        }),
      );
    });
    onCleanup(unsubscribe);
  });

  const teardownRadioConnection = (options?: { resetState?: boolean }) => {
    const { resetState = true } = options ?? {};
    disconnectRTC();
    if (rtcUdpCleanup) {
      rtcUdpCleanup();
      rtcUdpCleanup = undefined;
    }
    cleanupRadioSubscriptions();
    const currentRadio = activeRadio();
    setActiveRadio(null);
    currentRadio
      ?.disconnect()
      .catch((error) =>
        console.error("Error closing flex radio session", error),
      );
    featureLicenseStore = createRadioStateStore({ logger });
    if (resetState) {
      setState(reconcile(initialState()));
    }
  };

  const disconnect = () => {
    teardownRadioConnection();
  };

  const attachRadioListeners = (
    radio: RadioHandle,
    handleProgress: (progress: FlexConnectionProgress) => void,
  ) => {
    cleanupRadioSubscriptions();
    radioSubscriptions = [
      radio.on("change", handleStateChange),
      radio.on("message", handleFlexMessage),
      radio.on("progress", handleProgress),
      radio.on("ready", () => handleProgress({ stage: "ready" })),
      radio.on("disconnected", disconnect),
    ];
  };

  const connect = (addr: { host: string; port: number }) => {
    console.log("Connecting to", addr);
    setState("connectModal", {
      status: ConnectionState.connecting,
      selectedRadio: addr.host,
      stage: ConnectionStage.TCP,
    });
    const radio = radioClient.radioByEndpoint(addr);
    const descriptor = radio?.descriptor;
    if (!descriptor) {
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

    const handleProgress = (progress: FlexConnectionProgress) => {
      switch (progress.stage) {
        case "control":
          setState("connectModal", "stage", ConnectionStage.TCP);
          break;
        case "sync":
          setState("connectModal", "stage", ConnectionStage.Data);
          break;
        case "data-plane":
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

    void (async () => {
      try {
        teardownRadioConnection({ resetState: false });
        featureLicenseStore = createRadioStateStore({ logger });

        const dataPlaneFactory: FlexDataPlaneFactory = {
          async connect({ handle, udp, logger }) {
            const rtc = await connectRTC(handle);
            rtcUdpCleanup?.();
            rtcUdpCleanup = attachRtcDataChannel(udp, rtc.data, {
              onError(error) {
                console.error("Error decoding UDP packet:", error);
                disconnect();
              },
            });
            return {
              async close() {
                if (rtcUdpCleanup) {
                  rtcUdpCleanup();
                  rtcUdpCleanup = undefined;
                }
                try {
                  rtc.close();
                } catch (error) {
                  logger?.warn?.("Failed to close RTC session", { error });
                }
                disconnectRTC();
              },
            };
          },
        };

        setActiveRadio(radio);
        attachRadioListeners(radio, handleProgress);
        await radio.connect({
          udpSession,
          dataPlane: dataPlaneFactory,
          onProgress: handleProgress,
          clientInfo: {
            isGui: true,
            program: "SolidSDR Web",
            guiClientId: "76806B36-7090-4958-A879-174BAB94DF11",
          },
        });
        setState({
          clientHandle: radio.clientHandle,
          clientHandleInt: radio.clientHandle
            ? parseInt(radio.clientHandle, 16)
            : null,
          clientId: radio.clientId,
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
        featureLicenseStore = createRadioStateStore({ logger });
        try {
          await radio.disconnect();
        } catch (closeError) {
          console.error("Error while closing failed session", closeError);
        }
        disconnectRTC();
        if (rtcUdpCleanup) {
          rtcUdpCleanup();
          rtcUdpCleanup = undefined;
        }
      }
    })();
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
        events: udpSession,
        state,
        setState,
        sendCommand,
        connect,
        disconnect,
        radio: activeRadio,
        client: radioClient,
      }}
    >
      {props.children}
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

export type { UdpPacketEvent } from "@repo/flexlib";
