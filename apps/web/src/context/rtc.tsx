import {
  createContext,
  useContext,
  ParentComponent,
  createSignal,
  onCleanup,
  createEffect,
  onMount,
} from "solid-js";
import type { Accessor } from "solid-js";
import { startRTC, type RtcSession } from "../lib/rtc";
import {
  createReconnectingWS,
  createWSState,
  makeHeartbeatWS,
  type ReconnectingWebSocket,
} from "@solid-primitives/websocket";
import { createStore } from "solid-js/store";

type RemoteTrack = {
  streamId: string;
  stream: MediaStream;
};

const RtcCtx = createContext<RtcContextValue>();

type RtcState = {
  connectionState?: RTCPeerConnectionState | undefined;
  iceConnectionState?: RTCIceConnectionState | undefined;
  iceGatheringState?: RTCIceGatheringState | undefined;
  signalingState?: RTCSignalingState | undefined;
};

type RtcContextValue = {
  peerConnection: Accessor<RTCPeerConnection | null>;
  rtcState: RtcState;
  signalingWsState: Accessor<0 | 1 | 2 | 3>;
  session: Accessor<RtcSession | null>;
  tracks: Accessor<RemoteTrack[]>;
  signalingWs: ReconnectingWebSocket;
};

export const RtcProvider: ParentComponent = (props) => {
  const [session, setSession] = createSignal<RtcSession | null>(null);
  const [tracks, setTracks] = createSignal<RemoteTrack[]>([]);
  const signalingWs = makeHeartbeatWS(
    createReconnectingWS("/ws/signal", undefined, { delay: 1000 }),
    {
      message: JSON.stringify({ type: "ping" }),
    },
  );
  const wsState = createWSState(signalingWs);
  const [rtcState, setRtcState] = createStore<RtcState>({});

  createEffect(() => {
    const state = ["connecting", "open", "closing", "closed"][wsState()];
    console.log("[rtc] signaling WS state change", state);
  });

  const onTrack = (ev: RTCTrackEvent) => {
    const stream = ev.streams[0] ?? new MediaStream([ev.track]);
    const streamId = stream.id;
    setTracks((t) => [
      ...t.filter((x) => x.streamId !== streamId),
      { streamId, stream },
    ]);
    ev.track.addEventListener("unmute", () =>
      console.log("[rtc] remote track unmuted"),
    );
    ev.track.addEventListener(
      "ended",
      () => setTracks((t) => t.filter((x) => x.streamId !== streamId)),
      { once: true },
    );
  };

  const onOpen = () => {
    console.log("[rtc] signaling WS connected, starting RTC session");
    setSession(startRTC(signalingWs, onTrack));
  };
  const onClose = (event: Event) => {
    console.log("[rtc] signaling WS closed", event);
    setSession(null);
  };

  createEffect(() => {
    console.log("[rtc] setting up signaling WS event listeners");

    signalingWs.addEventListener("open", onOpen);
    signalingWs.addEventListener("close", onClose);
    signalingWs.addEventListener("error", onClose);

    onCleanup(() => {
      signalingWs.removeEventListener("open", onOpen);
      signalingWs.removeEventListener("close", onClose);
      signalingWs.removeEventListener("error", onClose);
    });
  });

  createEffect(() => {
    const pc = session()?.pc;
    if (!pc) return;
    const onConnectionStateChange = () => {
      const state = pc.connectionState;
      console.log("[rtc] connection state change", state);
      if (state === "disconnected" || state === "failed") {
        setSession(null);
      }
    };
    pc.addEventListener("connectionstatechange", onConnectionStateChange);
    onCleanup(() => {
      pc.removeEventListener("connectionstatechange", onConnectionStateChange);
    });
  });

  createEffect(() => {
    const currentSession = session();
    onCleanup(() => currentSession?.close());
  });

  return (
    <RtcCtx.Provider
      value={{
        signalingWs,
        session,
        tracks,
      }}
    >
      {props.children}
    </RtcCtx.Provider>
  );
};

export function useRtc() {
  const ctx = useContext(RtcCtx);
  if (!ctx) throw new Error("useRtc must be used within <RtcProvider>");
  return ctx;
}
