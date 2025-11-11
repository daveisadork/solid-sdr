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
  createFlexClient,
  createFlexUdpSession,
  createVitaDiscoveryAdapter,
  attachRtcDataChannelToFlexUdp,
  FlexCommandRejectedError,
  scaleMeterRawValue,
  type AudioStreamSnapshot,
  type DiscoverySession,
  type FlexRadioDescriptor,
  type FlexRadioSession,
  type FlexUdpPacketEvent,
  type FlexUdpSession,
  type FlexWireMessage,
  type MeterSnapshot,
  type PanadapterSnapshot,
  type RadioProperties,
  type RadioStateChange,
  type SliceSnapshot,
  type Subscription,
  type WaterfallSnapshot,
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

export type Radio = Omit<MutableProps<RadioProperties>, "raw">;
export type Slice = Omit<MutableProps<SliceSnapshot>, "raw">;
export type Panadapter = Omit<MutableProps<PanadapterSnapshot>, "raw">;
export type Waterfall = Omit<MutableProps<WaterfallSnapshot>, "raw">;
export type AudioStream = Omit<MutableProps<AudioStreamSnapshot>, "raw">;

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
  meters: Record<string, Meter>;
  eq: {
    rx: Record<string, unknown>;
    rxsc: Record<string, unknown>;
  };
  slice: Record<string, Slice>;
  display: {
    pan: Record<string, Panadapter>;
    waterfall: Record<string, Waterfall>;
  };
  interlock: {
    band: Record<string, IterlockBand>;
  };
  radio: Radio;
  stream: Record<string, AudioStream>;
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
      meters: {},
      eq: {
        rx: {},
        rxsc: {},
      },
      slice: {},
      display: {
        pan: {},
        waterfall: {},
      },
      interlock: {
        band: {},
      },
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
      stream: {},
    },
  }) as AppState;

const FlexRadioContext = createContext<{
  state: AppState;
  setState: SetStoreFunction<AppState>;
  session: () => FlexRadioSession | null;
  connect: (addr: { host: string; port: number }) => void;
  disconnect: () => void;
  sendCommand: (command: string) => Promise<{
    response: number;
    message: string;
    debugOutput?: string;
  }>;
  events: FlexUdpSession;
}>();

export const FlexRadioProvider: ParentComponent = (props) => {
  const [state, setState] = createStore(initialState());
  const { connect: connectRTC, session: sessionRTC } = useRtc();
  const [flexSession, setFlexSession] = createSignal<FlexRadioSession | null>(
    null,
  );

  const logger = {
    warn(message: string, meta?: Record<string, unknown>) {
      console.warn(message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
      console.error(message, meta);
    },
  };
  const udpSession = createFlexUdpSession({ logger });
  const serialToHost = new Map<string, string>();
  const discoveryWs = createReconnectingWS("/ws/discovery");
  let discoverySession: DiscoverySession | null = null;
  let flexSessionSubscriptions: Subscription[] = [];
  let pendingHandleLine: string | null = null;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let rtcUdpCleanup: (() => void) | undefined;

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
  const flexClient = createFlexClient(
    {
      discovery: discoveryAdapter,
      control: controlFactory,
      logger,
    },
    { defaultCommandTimeoutMs: 10_000 },
  );

  const applyPanadapterDiff = (diff: Partial<PanadapterSnapshot>) => {
    const key = diff.streamId || diff.id;
    // Keep the displayed center frequency pinned to the last settled value until
    // the data streams confirm the new frequency.
    const { raw: _, ...pan } = diff;
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
      setState("status", "display", "pan", key, pan);
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
        "display",
        "pan",
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

  const handleWaterfallChange = (change: RadioStateChange) => {
    if (change.entity !== "waterfall") return;
    const key = change.id;
    if (change.diff) {
      setState("status", "display", "waterfall", key, change.diff);
    } else {
      setState(
        "status",
        "display",
        "waterfall",
        produce((waterfalls) => {
          delete waterfalls[key];
        }),
      );
    }
  };

  const handleMeterChange = (change: RadioStateChange) => {
    if (change.entity !== "meter") return;
    const key = change.id;
    if (change.diff) {
      setState("status", "meters", key, change.diff);
    } else {
      setState(
        "status",
        "meters",
        produce((meters) => {
          delete meters[key];
        }),
      );
    }
  };

  const handleSliceChange = (change: RadioStateChange) => {
    if (change.entity !== "slice") return;
    const key = change.id;
    if (change.diff) {
      setState("status", "slice", key, change.diff);
    } else {
      if (!key) return;
      setState(
        "status",
        "slice",
        produce((slices) => {
          delete slices[key];
        }),
      );
    }
  };

  const handleRadioChange = (change: RadioStateChange) => {
    if (change.entity !== "radio") return;
    if (change.diff) {
      setState("status", "radio", change.diff);
    }
  };

  const handleStreamChange = (change: RadioStateChange) => {
    if (change.entity !== "audioStream") return;
    const key = change.id;
    if (change.diff) {
      setState("status", "stream", key, change.diff);
    } else {
      if (!key) return;
      setState(
        "status",
        "stream",
        produce((streams) => {
          delete streams[key];
        }),
      );
    }
  };

  const handleStateChange = (change: RadioStateChange) => {
    switch (change.entity) {
      case "radio":
        handleRadioChange(change);
        break;
      case "slice":
        handleSliceChange(change);
        break;
      case "panadapter":
        handlePanadapterChange(change);
        break;
      case "waterfall":
        handleWaterfallChange(change);
        break;
      case "meter":
        handleMeterChange(change);
        break;
      case "audioStream":
        handleStreamChange(change);
        break;
      default:
        break;
    }
  };

  onMount(() => {
    let disposed = false;

    discoveryAdapter
      .start({
        onOnline(descriptor) {
          if (disposed) return;
          const lastSeenRaw = descriptor.discoveryMeta?.lastSeen;
          const lastSeen =
            typeof lastSeenRaw === "number"
              ? new Date(lastSeenRaw)
              : new Date();
          const previousHost = serialToHost.get(descriptor.serial);
          if (previousHost && previousHost !== descriptor.host) {
            setState("connectModal", "radios", (radios) => {
              const next = { ...radios };
              delete next[previousHost];
              return next;
            });
          }
          serialToHost.set(descriptor.serial, descriptor.host);
          setState("connectModal", "radios", descriptor.host, {
            ...descriptor,
            lastSeen,
          });
        },
        onOffline(serial) {
          if (disposed) return;
          const host = serialToHost.get(serial);
          if (!host) return;
          serialToHost.delete(serial);
          setState("connectModal", "radios", (radios) => {
            const next = { ...radios };
            delete next[host];
            return next;
          });
        },
        onError(error) {
          console.warn("Discovery adapter error", error);
        },
      })
      .then((session) => {
        if (disposed) {
          return session.stop().catch((error) => {
            console.error("Failed to stop discovery session", error);
          });
        }
        discoverySession = session;
      })
      .catch((error) => {
        console.error("Failed to start discovery session", error);
      });

    onCleanup(() => {
      disposed = true;
      if (discoverySession) {
        discoverySession
          .stop()
          .catch((error) =>
            console.error("Failed to stop discovery session", error),
          );
        discoverySession = null;
      }
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

  createEffect(() => {
    setState(
      "clientHandleInt",
      state.clientHandle === null ? null : parseInt(state.clientHandle, 16),
    );
  });

  const sendCommand = async (command: string) => {
    const currentSession = flexSession();
    if (!currentSession) {
      throw new Error("Not connected to a Flex radio");
    }
    try {
      const response = await currentSession.command(command);
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
    if (!state.clientHandle) {
      return;
    }
    const clientHandle = parseInt(state.clientHandle, 16);
    const selectedPanadapter = state.selectedPanadapter;
    const panadapter = selectedPanadapter
      ? state.status.display.pan[selectedPanadapter]
      : null;

    if (panadapter) {
      return;
    }

    const firstOwnPan =
      Object.keys(state.status.display.pan).filter(
        (streamId) =>
          state.status.display.pan[streamId]?.clientHandle === clientHandle,
      )[0] || null;
    console.log("Setting first owned panadapter:", firstOwnPan);
    setState("selectedPanadapter", firstOwnPan ?? null);
  });

  const handleControlLine = async (payload: string) => {
    switch (payload[0]) {
      case "V": {
        // Version preamble
        const version = payload.slice(1);
        console.log("Version:", version);
        break;
      }
      case "H": {
        // Handle preamble
        if (!flexSession()) {
          pendingHandleLine = payload;
          return;
        }
        const radio = flexSession()!.radio();
        const handle = payload.slice(1);
        console.log("Handle:", handle);
        setState("connectModal", "stage", ConnectionStage.Data);
        console.log("Requesting initial data...");
        // setState("clientHandle", handle);
        try {
          // await sendCommand("client program SolidFlexRadio");
          await Promise.all([
            radio.refreshInfo(),
            radio.refreshVersions(),
            radio.refreshRxAntennaList(),
            radio.refreshMicList(),
            sendCommand("profile global info"),
            sendCommand("profile tx info"),
            sendCommand("profile mic info"),
            sendCommand("profile display info"),
            sendCommand("sub client all"),
            sendCommand("sub tx all"),
            sendCommand("sub atu all"),
            sendCommand("sub amplifier all"),
            sendCommand("sub meter all"),
            sendCommand("sub pan all"),
            sendCommand("sub slice all"),
            sendCommand("sub gps all"),
            sendCommand("sub audio_stream all"),
            sendCommand("sub cwx all"),
            sendCommand("sub xvtr all"),
            sendCommand("sub memories all"),
            sendCommand("sub daxiq all"),
            sendCommand("sub dax all"),
            sendCommand("sub usb_cable all"),
            sendCommand("sub tnf all"),
            sendCommand("sub spot all"),
            sendCommand("sub rapidm all"),
            sendCommand("sub ale all"),
            sendCommand("sub log_manager"),
            sendCommand("sub radio all"),
            // sendCommand("sub codec all"),
            sendCommand("sub apd all"),
            sendCommand("keepalive enable"),
        ]);
        console.log("Connecting RTC with handle:", handle);
        setState("connectModal", "stage", ConnectionStage.UDP);
        const rtc = await connectRTC(handle);
        rtcUdpCleanup?.();
        rtcUdpCleanup = attachRtcDataChannelToFlexUdp(udpSession, rtc.data, {
          onError(error) {
            console.error("Error decoding UDP packet:", error);
            disconnect();
          },
        });
        const { message: clientId } = await sendCommand("client gui");
        await flexSession()?.createRemoteAudioRxStream({
          compression: "OPUS",
        });
          setState("connectModal", "stage", ConnectionStage.Done);
          batch(() => {
            setState("clientHandle", handle);
            setState("clientId", clientId);
          });
          setTimeout(
            () => setState("connectModal", "status", ConnectionState.connected),
            300,
          );
        } catch (error) {
          console.error("Failed to subscribe to initial data:", error);
          showToast({
            description: "Failed to subscribe to initial data",
            variant: "error",
          });
          disconnect();
        }
        break;
      }
      case "R": {
        const [, responseCode, message] = payload.split("|");
        if (responseCode && responseCode !== "0") {
          console.warn("Command reply", payload);
        }
        break;
      }
      case "M": {
        // Message
        const [, description] = payload.split("|");
        showToast({ description, variant: "info" });
        break;
      }
      case "S": {
        // Status message
        const [prefix, message] = payload.split("|");
        const handle = parseInt(prefix.slice(1), 16);
        if (
          handle &&
          state.clientHandleInt &&
          state.clientHandleInt !== handle
        ) {
          // Message not for us
          console.log(
            "Ignoring message for handle",
            handle,
            state.clientHandleInt,
          );
          return;
        }

        const [key, ...rest] = message.split(" ");
        switch (key) {
          case "stream":
          case "meter":
          case "display":
          case "slice":
          case "radio":
          case "gps":
            return;
        }

        const split = message.split(" ").filter((part) => part.length);
        const parts = split.filter((part) => !part.includes("="));

        const current = state.status;
        const currentPath = ["status"];
        for (const part of parts) {
          currentPath.push(part);
          if (!(part in current)) {
            try {
              setState(...currentPath, {});
            } catch (error) {
              console.error(
                "Failed to create status path:",
                currentPath,
                error,
              );
            }
          }
        }
        const data = Object.fromEntries(
          split
            .filter((part) => part.includes("="))
            .map((part) => part.split("=")),
        );
        try {
          setState(...currentPath, (prev) => ({ ...prev, ...data }));
        } catch (error) {
          console.error("Failed to update status:", error);
        }
        // console.log(JSON.stringify(state.status, null, 2));
        break;
      }
      default: {
        console.warn("Unhandled TCP message:", payload);
      }
    }
  };

  createEffect(() => {
    const subscription = udpSession.on("meter", ({ packet }) => {
      const meterPacket = packet;
      setState(
        "status",
        "meters",
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
    onCleanup(() => subscription.unsubscribe());
  });

  const teardownFlexSession = (options?: { resetState?: boolean }) => {
    const { resetState = true } = options ?? {};
    const rtcSession = sessionRTC();
    if (rtcSession) {
      try {
        rtcSession.close();
      } catch (error) {
        console.error("Error closing RTC session", error);
      }
    }
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = undefined;
    }
    if (rtcUdpCleanup) {
      rtcUdpCleanup();
      rtcUdpCleanup = undefined;
    }
    const currentSession = flexSession();
    setFlexSession(null);
    pendingHandleLine = null;
    for (const sub of flexSessionSubscriptions) sub.unsubscribe();
    flexSessionSubscriptions = [];
    if (currentSession) {
      currentSession
        .close()
        .catch((error) => console.error("Error closing flex session", error));
    }
    if (resetState) {
      setState(reconcile(initialState()));
      serialToHost.clear();
    }
  };

  const disconnect = () => {
    teardownFlexSession();
  };

  const connect = (addr: { host: string; port: number }) => {
    console.log("Connecting to", addr);
    setState("connectModal", "status", ConnectionState.connecting);
    setState("connectModal", "selectedRadio", addr.host);
    setState("connectModal", "stage", ConnectionStage.TCP);
    const descriptor = state.connectModal.radios[addr.host];
    if (!descriptor) {
      showToast({
        description: "Selected radio is unavailable",
        variant: "error",
      });
      setState("connectModal", "status", ConnectionState.disconnected);
      setState("connectModal", "selectedRadio", null);
      return;
    }

    void (async () => {
      try {
        const currentSession = flexSession();
        if (currentSession) {
          setFlexSession(null);
          for (const sub of flexSessionSubscriptions) sub.unsubscribe();
          flexSessionSubscriptions = [];
          try {
            await currentSession.close();
          } catch (error) {
            console.error("Failed to close previous session", error);
          }
        }
        if (rtcUdpCleanup) {
          rtcUdpCleanup();
          rtcUdpCleanup = undefined;
        }

        const newSession = await flexClient.connect(descriptor, {
          connectionParams: {
            onControlLine: (line: string) => {
              handleControlLine(line).catch((error) =>
                console.error("Control line handler error", error),
              );
            },
          },
          udpSession,
        });
        setFlexSession(newSession);
        const changeSubscription = newSession.on("change", handleStateChange);
        const messageSubscription = newSession.on(
          "message",
          (message: FlexWireMessage) => {
            if (
              message.kind === "status" ||
              message.kind === "reply" ||
              message.kind === "notice"
            ) {
              handleControlLine(message.raw).catch((error) =>
                console.error("Failed to handle control message", error),
              );
            }
          },
        );
        const disconnectedSubscription = newSession.on("disconnected", () => {
          disconnect();
        });
        flexSessionSubscriptions = [
          changeSubscription,
          messageSubscription,
          disconnectedSubscription,
        ];
        const initial = newSession.snapshot();
        batch(() => {
          initial.slices.forEach((slice) =>
            setState("status", "slice", slice.id, slice),
          );
          initial.panadapters.forEach((pan) => applyPanadapterDiff(pan));
          initial.waterfalls.forEach((waterfall) =>
            setState("status", "display", "waterfall", waterfall.id, waterfall),
          );
          initial.meters.forEach((meter) => {
            setState("status", "meters", meter.id, meter);
          });
        });
        if (pendingHandleLine) {
          const line = pendingHandleLine;
          pendingHandleLine = null;
          await handleControlLine(line);
        }
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          sendCommand("ping").catch((error) => {
            console.warn("Ping command failed", error);
          });
        }, 1_000);
      } catch (error) {
        console.error("Failed to connect to radio", error);
        showToast({
          description: "Failed to connect to radio",
          variant: "error",
        });
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = undefined;
        }
        pendingHandleLine = null;
        setState("connectModal", "status", ConnectionState.disconnected);
        setState("connectModal", "selectedRadio", null);
        setState("connectModal", "stage", ConnectionStage.TCP);
        const existing = flexSession();
        if (existing) {
          setFlexSession(null);
          try {
            await existing.close();
          } catch (closeError) {
            console.error("Error while closing failed session", closeError);
          }
        }
      }
    })();
  };

  onCleanup(() => {
    teardownFlexSession({ resetState: false });
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
        session: flexSession,
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

export type { FlexUdpPacketEvent } from "@repo/flexlib";
