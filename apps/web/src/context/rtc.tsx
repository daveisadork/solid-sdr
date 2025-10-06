import {
  createContext,
  useContext,
  ParentComponent,
  createSignal,
  onCleanup,
} from "solid-js";
import type { Accessor } from "solid-js";
import { startRTC, type RtcSession } from "../lib/rtc";

type RemoteTrack = { id: string; stream: MediaStream };

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
    const id = stream.id || `${ev.track.kind}-${crypto.randomUUID()}`;
    setTracks((t) => [...t.filter((x) => x.id !== id), { id, stream }]);
    ev.track.addEventListener("unmute", () =>
      console.log("[rtc] remote track unmuted"),
    );

    ev.track.onended = () => {
      setTracks((t) => t.filter((x) => x.id !== id));
    };
  };

  async function connect(sessionId: string) {
    // tear down any previous
    disconnect();

    const s = await startRTC(sessionId, onTrack);

    // Clean listener on close
    const oldClose = s.close;
    s.close = () => {
      s.pc.removeEventListener("track", onTrack);
      oldClose();
    };

    setSession(s);
    return s;
  }

  function disconnect() {
    const s = session();
    if (s) {
      try {
        s.close();
      } catch {}
    }
    setSession(null);
    setTracks([]);
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
