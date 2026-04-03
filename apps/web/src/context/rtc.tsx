import {
  createContext,
  useContext,
  ParentComponent,
  createSignal,
  onCleanup,
  createEffect,
} from "solid-js";
import type { Accessor } from "solid-js";
import { startRTC, type RtcSession } from "../lib/rtc";
import {
  createReconnectingWS,
  type ReconnectingWebSocket,
} from "@solid-primitives/websocket";

type RemoteTrack = {
  streamId: string;
  stream: MediaStream;
};

type RtcContextValue = {
  session: Accessor<RtcSession | null>;
  tracks: Accessor<RemoteTrack[]>;
  signalingWs: ReconnectingWebSocket;
};

const RtcCtx = createContext<RtcContextValue>();

export const RtcProvider: ParentComponent = (props) => {
  const [session, setSession] = createSignal<RtcSession | null>(null);
  const [tracks, setTracks] = createSignal<RemoteTrack[]>([]);
  const signalingWs = createReconnectingWS("/ws/signal");

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
    if (session()) return;
    setSession(startRTC(signalingWs, onTrack));
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
