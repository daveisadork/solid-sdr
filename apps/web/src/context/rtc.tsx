import {
  createContext,
  useContext,
  ParentComponent,
  createSignal,
  onCleanup,
  batch,
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

    ev.track.onended = () => {
      setTracks((t) => t.filter((x) => x.streamId !== streamId));
    };
  };

  function connect(sessionId: string) {
    // tear down any previous
    disconnect();
    return startRTC(sessionId, onTrack).then(setSession);
  }

  function disconnect() {
    session()?.close();
    batch(() => {
      setSession(null);
      setTracks([]);
    });
  }

  onCleanup(disconnect);

  return (
    <RtcCtx.Provider value={{ session, tracks, connect, disconnect }}>
      {props.children}
    </RtcCtx.Provider>
  );
};

export function useRtc() {
  const ctx = useContext(RtcCtx);
  if (!ctx) throw new Error("useRtc must be used within <RtcProvider>");
  return ctx;
}
