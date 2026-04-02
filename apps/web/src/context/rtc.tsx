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

type RemoteTrack = {
  streamId: string;
  stream: MediaStream;
};

type RtcContextValue = {
  session: Accessor<RtcSession | null>;
  tracks: Accessor<RemoteTrack[]>;
  connect: (sessionId: string) => Promise<RtcSession>;
  register: (session: RtcSession) => void;
  onTrackHandler: (ev: RTCTrackEvent) => void;
  disconnect: () => void;
};

const RtcCtx = createContext<RtcContextValue>();

export const RtcProvider: ParentComponent = (props) => {
  const [session, setSession] = createSignal<RtcSession | null>(null);
  const [tracks, setTracks] = createSignal<RemoteTrack[]>([]);

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

  function connect(sessionId: string) {
    // tear down any previous
    disconnect();
    return startRTC(sessionId, onTrack).then(setSession);
  }

  // register sets an already-created RtcSession (e.g. from startRTCViaSignaling)
  // as the current session and wires up the track handler.
  createEffect(() => {
    const s = session();
    if (!s) return;
    s.pc.addEventListener("track", onTrack);
    onCleanup(() => {
      s.pc.removeEventListener("track", onTrack);
      s.close();
    });
  });

  function disconnect() {
    setSession(null);
  }

  onCleanup(disconnect);

  return (
    <RtcCtx.Provider
      value={{
        session,
        tracks,
        connect,
        register: setSession,
        onTrackHandler: onTrack,
        disconnect,
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
