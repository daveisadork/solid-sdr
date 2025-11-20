import { createReconnectingWS, makeWS } from "@solid-primitives/websocket";
import {
  batch,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
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
  type FlexRadioDescriptor,
  type FlexWireMessage,
  type GuiClientSnapshot,
  type MeterSnapshot,
  type PanadapterSnapshot,
  type RadioSnapshot,
  type RadioHandle,
  type RadioStateChange,
  type RadioStateChangeWithSerial,
  type SliceSnapshot,
  type Subscription,
  type UdpSession,
  type WaterfallSnapshot,
  type FeatureLicenseSnapshot,
} from "@repo/flexlib";
import { createWebSocketFlexControlFactory } from "~/lib/flex-control";
import { useRtc } from "./rtc";

export interface DiscoveryRadio extends FlexRadioDescriptor {
  lastSeen: Date;
}

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
  clip?: string; // Optional, used for gradients that have a clipping color
  colors: string[];
}

export interface IterlockBand {
  acc_tx_enabled: boolean; // "0"
  acc_txreq_enable: boolean; //  "0"
  band_name: string; // "630"
  rca_txreq_enable: boolean; // "0"
  tx1_enabled: boolean; // "0"
  tx2_enabled: boolean; // "0"
  tx3_enabled: boolean; // "0"
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

export interface Gradient {
  name: string;
  clip?: string;
  colors: string[];
}

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
  radios: Record<string, DiscoveryRadio>;
  open: boolean;
  status: ConnectionState;
  selectedRadio: string | null;
  stage: ConnectionStage;
}

export interface StatusState {
  meter: Record<string, Meter>;
  eq: {
    rx: Record<string, unknown>;
    rxsc: Record<string, unknown>;
  };
  slice: Record<string, Slice>;
  panadapter: Record<string, Panadapter>;
  waterfall: Record<string, Waterfall>;
  interlock: {
    band: Record<string, IterlockBand>;
  };
  radio: Radio;
  featureLicense: FeatureLicense;
  audioStream: Record<string, AudioStream>;
  guiClient: Record<string, GuiClient>;
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
          clip: "#ffffff",
          colors: [
            "#000000",
            "#0000ff",
            "#00ffff",
            "#00ff00",
            "#ffff00",
            "#ff8000",
            "#ff0000",
          ],
        },
        {
          name: "SmartSDR + Purple",
          clip: "#ffffff",
          colors: [
            "#000000",
            "#0000ff",
            "#00ffff",
            "#00ff00",
            "#ffff00",
            "#ff8000",
            "#ff0000",
            "#ff00ff",
          ],
        },
        {
          name: "Vintage Warm",
          clip: "#ffffff",
          colors: [
            "#000000",
            "#1d4877",
            // "#1ba4a1",
            "#1b8a5a",
            "#fbb021",
            "#f68838",
            "#ee3e32",
          ],
        },
        {
          name: "Grayscale",
          colors: ["#000000", "#ffffff"],
        },
        {
          name: "CMYK",
          clip: "#ffffff",
          colors: ["#000000", "#00ffff", "#ffff00", "#ff00ff"],
        },
        {
          name: "RGB",
          clip: "#ffffff",
          colors: ["#000000", "#0000ff", "#00ff00", "#ff0000"],
        },
        {
          name: "Solarized",
          clip: "#ffffff",
          colors: [
            "#002b36",
            "#268bd2",
            // "#2aa198",
            "#859900",
            "#b58900",
            "#cb4b16",
            "#dc322f",
            // "#d33682",
          ],
        },
      ],
    },
    connectModal: {
      radios: {},
      open: true,
      status: ConnectionState.disconnected,
    },
    runtime: {
      panSettledCenterMHz: {},
      panPendingCenterMHz: {},
    },
    status: {
      meter: {},
      eq: {
        rx: {},
        rxsc: {},
      },
      slice: {},
      panadapter: {},
      waterfall: {},
      interlock: {
        band: {},
      },
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
    },
  }) as AppState;

const FlexRadioContext = createContext<{
  state: AppState;
  setState: SetStoreFunction<AppState>;
  session: () => RadioHandle | null;
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

  const logger = {
    warn(message: string, meta?: Record<string, unknown>) {
      console.warn(message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
      console.error(message, meta);
    },
  };
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
          const { data } = event;
          if (typeof data === "string") return;

          if (data instanceof ArrayBuffer) {
            handlers.onMessage(new Uint8Array(data));
            return;
          }

          if (data instanceof Blob) {
            data
              .arrayBuffer()
              .then((buffer) => {
                if (!closed) handlers.onMessage(new Uint8Array(buffer));
              })
              .catch((error) => handlers.onError?.(error));
            return;
          }

          if (data instanceof Uint8Array) {
            handlers.onMessage(data);
            return;
          }

          handlers.onError?.(
            new Error(`Unsupported discovery payload type: ${typeof data}`),
          );
        };

        const handleError = (error: Event) => {
          if (closed) return;
          handlers.onError?.(error);
        };

        discoveryWs.addEventListener("message", handleMessage);
        discoveryWs.addEventListener("error", handleError);

        return {
          async close() {
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
      return makeWS(
        `/ws/radio?host=${descriptor.host}&port=${descriptor.port}`,
      );
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
  const clientSubscriptions: Subscription[] = [];

  const updateDiscoveryEntry = (
    descriptor: FlexRadioDescriptor,
    lastSeen: Date,
  ) => {
    setState("connectModal", "radios", descriptor.host, {
      ...descriptor,
      lastSeen,
    });
  };

  const handleRadioDiscovered = (handle: RadioHandle) => {
    const descriptor = handle.descriptor;
    if (!descriptor) return;
    updateDiscoveryEntry(descriptor, handle.lastSeen ?? new Date());
  };

  const handleRadioChangeForDiscovery = (
    change: RadioStateChangeWithSerial,
  ) => {
    if (change.entity !== "radio") return;
    const handle = radioClient.radio(change.radioSerial);
    const descriptor = handle?.descriptor;
    if (!descriptor) return;
    updateDiscoveryEntry(descriptor, handle.lastSeen ?? new Date());
  };

  const handleRadioLost = (serial: string, host?: string) => {
    setState("connectModal", "radios", (radios) => {
      const next = { ...radios };
      const removalKey =
        host ??
        Object.keys(next).find(
          (existingHost) => next[existingHost]?.serial === serial,
        );
      if (removalKey) {
        delete next[removalKey];
      }
      return next;
    });
  };

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
      case "radio":
      case "featureLicense":
        setState("status", change.entity, change.diff);
        break;
      case "waterfall":
      case "slice":
      case "meter":
      case "audioStream":
      case "guiClient":
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

  onMount(() => {
    let disposed = false;

    clientSubscriptions.push(
      radioClient.on("radioDiscovered", (handle) => {
        if (disposed) return;
        handleRadioDiscovered(handle);
      }),
    );
    clientSubscriptions.push(
      radioClient.on("radioChange", (change) => {
        if (disposed) return;
        handleRadioChangeForDiscovery(change);
      }),
    );
    clientSubscriptions.push(
      radioClient.on("radioLost", ({ serial, endpoint }) => {
        if (disposed) return;
        handleRadioLost(serial, endpoint?.host);
      }),
    );

    radioClient.startDiscovery().catch((error) => {
      console.error("Failed to start discovery session", error);
    });

    onCleanup(() => {
      disposed = true;
      while (clientSubscriptions.length > 0) {
        clientSubscriptions.pop()?.unsubscribe();
      }
      radioClient
        .stopDiscovery()
        .catch((error) =>
          console.error("Failed to stop discovery session", error),
        );
    });
  });

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

  window.state = state;
  window.sendCommand = sendCommand; // Expose for debugging

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
        if (message.code !== 0) {
          console.warn("Command reply", message.raw);
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
    if (currentRadio) {
      currentRadio
        .disconnect()
        .catch((error) =>
          console.error("Error closing flex radio session", error),
        );
    }
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
      radio.on("message", ({ message }) => handleFlexMessage(message)),
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
    const descriptor = state.connectModal.radios[addr.host];
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
    const radio = radioClient.radio(descriptor.serial);
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

  return (
    <FlexRadioContext.Provider
      value={{
        events: udpSession,
        state,
        setState,
        sendCommand,
        connect,
        disconnect,
        session: activeRadio,
      }}
    >
      {props.children}
    </FlexRadioContext.Provider>
  );
};

export default function useFlexRadio() {
  const context = useContext(FlexRadioContext);
  if (!context) {
    throw new Error(
      "useFlexRadioContext must be used within a FlexRadioProvider",
    );
  }

  return context;
}

export type { UdpPacketEvent } from "@repo/flexlib";
