import * as ToastPrimitive from "@kobalte/core/toast";
import type {
  ConnectionProgressDetail,
  DisconnectedReason,
  DisplayMarkerStateChange,
  FlexWireMessage,
  RadioStateChange,
  SpotStateChange,
  Subscription,
} from "@repo/flexlib";
import {
  FlexClient,
  FlexCommandRejectedError,
  type FlexRadioDescriptor,
  type Radio,
} from "@repo/flexlib";
import { BridgeTransport } from "@repo/flexlib/bridge";
import { ReactiveMap } from "@solid-primitives/map";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type ParentComponent,
  Show,
} from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { InfoItem } from "~/components/settings/common";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Timeline } from "~/components/ui/timeline";
import { showToast } from "~/components/ui/toast";
import { useDebugMode } from "./debug-mode";
import {
  ConnectionStage,
  ConnectionState,
  FlexRadioContext,
  initialState,
  type LicensedFeature,
  type SpotState,
} from "./flexradio";
import { usePreferences } from "./preferences";
import { useRtc } from "./rtc";

const WS_STATES = ["Connecting...", "Established", "Closing...", "Closed"];

export const FlexRadioProvider: ParentComponent = (props) => {
  const [state, setState] = createStore(initialState());

  const isLicensed = (feature: LicensedFeature) =>
    state.status.featureLicense?.features?.[feature]?.enabled === true;
  const { preferences, setPreferences } = usePreferences();
  const { peerConnection, rtcState, signalingWsState } = useRtc();
  const [activeRadio, setActiveRadio] = createSignal<Radio | null>(null);
  const [showAlert, setShowAlert] = createSignal(false);
  const [alertMessage, setAlertMessage] = createSignal("");

  const spots = new ReactiveMap<string, SpotState>();

  createEffect(() => setShowAlert(Boolean(alertMessage())));

  let radioSubscriptions: Subscription[] = [];

  const teardownRadioConnection = (options?: { resetState?: boolean }) => {
    const { resetState = true } = options ?? {};
    cleanupRadioSubscriptions();
    const currentRadio = activeRadio();
    // Reset state BEFORE nulling the radio accessor: components resolve
    // controllers from state-held ids, so state must unmount them while the
    // radio can still satisfy the lookups.
    if (resetState) {
      setState(reconcile(initialState()));
      spots.clear();
    }
    setActiveRadio(null);
    currentRadio
      ?.disconnect()
      .then(() => console.log("disconnected"))
      .catch((error) =>
        console.error("Error closing flex radio session", error),
      );
  };

  const debug = useDebugMode();
  const flexClient = createMemo(() => {
    const pc = peerConnection();
    if (!pc || rtcState.connectionState !== "connected") return null;
    const transport = debug.wrapTransportIfEnabled(new BridgeTransport(pc));
    return new FlexClient({ transport });
  });

  const updateDiscoveryRadio = (descriptor?: FlexRadioDescriptor) => {
    if (!descriptor) return;
    if (state.discoveredRadios[descriptor.host]) {
      // Each discovery packet is a complete snapshot: reconcile so fields the
      // radio stopped reporting (e.g. guiClients after the last client
      // disconnects) are removed instead of merged over.
      setState(
        "discoveredRadios",
        descriptor.host,
        reconcile({ ...descriptor }),
      );
    } else {
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
            delete radios[radio.endpoint.host];
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
    try {
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
        case "featureLicense":
        case "filterPreset":
        case "radio":
          // singleton entities are never removed
          if (!change.removed) setState("status", change.entity, change.diff);
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
    } catch (err) {
      console.error("Failed to update state", change, err);
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

  const previousToasts: Record<string, number> = {};

  const handleFlexMessage = (message: FlexWireMessage) => {
    switch (message.kind) {
      case "notice":
        // this keeps us from spamming duplicate messages
        if (message.text in previousToasts) {
          ToastPrimitive.toaster.dismiss(previousToasts[message.text]);
        }
        switch (message.severity) {
          case "info":
            console.info(message.text);
            previousToasts[message.text] = showToast({
              description: message.text,
              variant: message.severity,
            });
            break;
          case "warning":
            console.warn(message.text);
            previousToasts[message.text] = showToast({
              description: message.text,
              variant: message.severity,
            });
            break;
          case "error": {
            console.error(message.text);
            previousToasts[message.text] = showToast({
              description: message.text,
              variant: message.severity,
            });
            break;
          }
          case "fatal": {
            console.error(message.text);
            setAlertMessage(message.text);
            break;
          }
          default:
            console.log(message.text);
            previousToasts[message.text] = showToast({
              description: message.text,
            });
        }
        break;
      case "reply":
        switch (message.level) {
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

  const disconnect = (reason?: DisconnectedReason) => {
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
    const client = flexClient();
    if (!client) return;
    const radio = client.radioByEndpoint(addr);
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
          program: "SolidSDR",
          guiClientId: preferences.guiClientId,
          station: preferences.stationName,
        },
        networkMtu: preferences.networkMtu,
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
      setState({ clientHandle: null, clientHandleInt: null });
      cleanupRadioSubscriptions();
      if (activeRadio() === radio) {
        setActiveRadio(null);
      }
      try {
        await radio.disconnect();
      } catch (closeError) {
        console.error("Error while closing failed session", closeError);
      }
      return;
    }
    setState({
      clientHandle: radio.clientHandle,
      clientHandleInt: radio.clientHandle
        ? parseInt(radio.clientHandle, 16)
        : null,
    });
    // Tearing down a connection clears radio.clientId. Persisting that null
    // would make the next connect send a bare "client gui", and the radio
    // answers that by minting a new id with an all-default settings record.
    if (radio.clientId) {
      setPreferences("guiClientId", radio.clientId);
    }
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
    <>
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
        {(client) => (
          <FlexRadioContext.Provider
            value={{
              spots,
              state,
              setState,
              sendCommand,
              connect,
              disconnect,
              bands,
              isLicensed,
              radio: activeRadio,
              client,
            }}
          >
            {props.children}
          </FlexRadioContext.Provider>
        )}
      </Show>
      <AlertDialog
        open={showAlert()}
        onOpenChange={(isOpen) => {
          if (!isOpen) setAlertMessage("");
        }}
      >
        <AlertDialogContent class="border-error-foreground">
          <AlertDialogTitle>Fatal Error</AlertDialogTitle>
          <AlertDialogDescription>{alertMessage()}</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
