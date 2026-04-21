import {
  createContext,
  useContext,
  ParentComponent,
  createSignal,
  onCleanup,
  createEffect,
  batch,
} from "solid-js";
import type { Accessor, Setter } from "solid-js";
import {
  createReconnectingWS,
  createWSState,
  makeHeartbeatWS,
  type ReconnectingWebSocket,
} from "@solid-primitives/websocket";
import { createStore } from "solid-js/store";

const RtcCtx = createContext<RtcContextValue>();

type RtcState = Partial<
  Pick<
    RTCPeerConnection,
    | "connectionState"
    | "signalingState"
    | "iceConnectionState"
    | "iceGatheringState"
  >
>;

type RtcContextValue = {
  peerConnection: Accessor<RTCPeerConnection | null>;
  rtcState: RtcState;
  remoteAudioRxStream: Accessor<MediaStream | null>;
  setRemoteAudioTxTrack: Setter<MediaStreamTrack>;
  signalingWs: ReconnectingWebSocket;
  signalingWsState: Accessor<0 | 1 | 2 | 3>;
};

type SignalingMessage =
  | { type: "answer"; payload: RTCSessionDescriptionInit }
  | { type: "ice"; payload: RTCIceCandidateInit }
  | { type: "error"; payload: { code: string; message: string } }
  | { type: "ping"; payload: null }
  | { type: "pong"; payload: null };

export const RtcProvider: ParentComponent = (props) => {
  const [rtcState, setRtcState] = createStore<RtcState>({});
  const [peerConnection, setPeerConnection] =
    createSignal<RTCPeerConnection | null>(null);
  const [audioTransceiver, setAudioTransceiver] =
    createSignal<RTCRtpTransceiver | null>(null);
  const [remoteAudioRxStream, setRemoteAudioRxStream] =
    createSignal<MediaStream | null>(null);
  const [remoteAudioTxTrack, setRemoteAudioTxTrack] =
    createSignal<MediaStreamTrack | null>(null);

  const signalingWs = makeHeartbeatWS(
    createReconnectingWS("/ws/signal", [], { delay: 3000 }),
    {
      message: JSON.stringify({ type: "ping", payload: null }),
      interval: 1000,
      wait: 5000,
    },
  );
  const signalingWsState = createWSState(signalingWs);

  function onIceCandidate(ev: RTCPeerConnectionIceEvent) {
    if (ev.candidate) {
      signalingWs.send(
        JSON.stringify({ type: "ice", payload: ev.candidate.toJSON() }),
      );
    }
  }

  async function onNegotiationNeeded(this: RTCPeerConnection) {
    const offer = await this.createOffer();
    const sdp = forceStereoInSDP(offer.sdp!);
    await this.setLocalDescription({ ...offer, sdp });
    signalingWs.send(
      JSON.stringify({
        type: "offer",
        payload: this.localDescription.toJSON(),
      }),
    );
  }

  function onTrack({ streams, track }: RTCTrackEvent) {
    const stream = streams[0] ?? new MediaStream([track]);
    track.addEventListener("ended", () => setRemoteAudioRxStream(null), {
      once: true,
    });
    setRemoteAudioRxStream(stream);
  }

  const onMessage = (ev: MessageEvent) => {
    const { type, payload } = JSON.parse(ev.data) as SignalingMessage;
    switch (type) {
      case "answer": {
        peerConnection()?.setRemoteDescription(payload);
        break;
      }
      case "ice": {
        if (payload.candidate) {
          peerConnection()
            ?.addIceCandidate(payload)
            .catch((e) => console.warn("[ice] addIceCandidate:", e));
        }
        break;
      }
      case "error": {
        console.error(new Error(`${payload.code}: ${payload.message}`));
        break;
      }
    }
  };

  function onRtcStateChange(this: RTCPeerConnection) {
    const {
      connectionState,
      signalingState,
      iceGatheringState,
      iceConnectionState,
    } = this;
    setRtcState({
      connectionState,
      signalingState,
      iceGatheringState,
      iceConnectionState,
    });
  }

  createEffect(() => {
    signalingWs.addEventListener("message", onMessage);
    onCleanup(() => {
      signalingWs.removeEventListener("message", onMessage);
    });
  });

  createEffect(() => {
    batch(() => {
      if (signalingWsState() !== WebSocket.OPEN) {
        setPeerConnection(null);
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" },
        ],
      });

      onRtcStateChange.apply(pc);
      pc.addEventListener("negotiationneeded", onNegotiationNeeded);
      pc.addEventListener("signalingstatechange", onRtcStateChange);
      pc.addEventListener("connectionstatechange", onRtcStateChange);
      pc.addEventListener("icegatheringstatechange", onRtcStateChange);
      pc.addEventListener("iceconnectionstatechange", onRtcStateChange);
      pc.addEventListener("icecandidate", onIceCandidate);
      pc.addEventListener("track", onTrack);

      setPeerConnection(pc);
      setAudioTransceiver(
        pc.addTransceiver("audio", { direction: "sendrecv" }),
      );

      onCleanup(() => {
        if (
          pc.connectionState !== "closed" &&
          pc.connectionState !== "failed"
        ) {
          pc.close();
        }
        pc.removeEventListener("negotiationneeded", onNegotiationNeeded);
        pc.removeEventListener("signalingstatechange", onRtcStateChange);
        pc.removeEventListener("connectionstatechange", onRtcStateChange);
        pc.removeEventListener("icegatheringstatechange", onRtcStateChange);
        pc.removeEventListener("iceconnectionstatechange", onRtcStateChange);
        pc.removeEventListener("icecandidate", onIceCandidate);
        pc.removeEventListener("track", onTrack);
        setAudioTransceiver(null);
      });
    });
  });

  createEffect(() => {
    if (["failed", "closed"].includes(rtcState.connectionState)) {
      signalingWs.reconnect();
    }
  });

  createEffect(() =>
    audioTransceiver()?.sender.replaceTrack(remoteAudioTxTrack()),
  );

  return (
    <RtcCtx.Provider
      value={{
        peerConnection,
        rtcState: rtcState,
        signalingWs,
        remoteAudioRxStream,
        setRemoteAudioTxTrack,
        signalingWsState,
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

function forceStereoInSDP(sdp: string): string {
  // Find the audio "m=" section
  const sections = sdp.split("\r\nm=");
  for (let i = 0; i < sections.length; i++) {
    const isFirst = i === 0;
    const sec = isFirst ? sections[i] : "m=" + sections[i];
    if (!sec.startsWith("m=audio")) continue;

    // Find opus payload type (rtpmap)
    const rtpmapRe = /a=rtpmap:(\d+)\s+opus\/48000\/2\r?\n/i;
    const m =
      sec.match(rtpmapRe) ||
      sec.match(/a=rtpmap:(\d+)\s+opus\/48000(?:\/\d+)?\r?\n/i);
    if (!m) continue;
    const pt = m[1];

    // Ensure/patch fmtp for that PT
    const fmtpLineRe = new RegExp(`a=fmtp:${pt}\\s+([^\r\\n]*)`, "i");
    if (fmtpLineRe.test(sec)) {
      // append stereo flags if not present
      const newSec = sec.replace(fmtpLineRe, (_all, params) => {
        let p = params || "";
        const add = (k: string) => {
          if (!new RegExp(`(^|;)\\s*${k}(=|;|$)`, "i").test(p)) {
            p = p ? p + `;${k}` : k;
          }
        };
        add("stereo=1");
        add("sprop-stereo=1");
        return `a=fmtp:${pt} ${p}`;
      });
      sections[i] = isFirst ? newSec : newSec.slice(2); // remove the re-added "m="
    } else {
      // insert a new fmtp line right after rtpmap
      const lines = sec.split("\r\n");
      const idx = lines.findIndex(
        (l) =>
          l.toLowerCase() === `a=rtpmap:${pt} opus/48000/2`.toLowerCase() ||
          l.toLowerCase() === `a=rtpmap:${pt} opus/48000`.toLowerCase(),
      );
      if (idx >= 0) {
        lines.splice(idx + 1, 0, `a=fmtp:${pt} stereo=1;sprop-stereo=1`);
        const newSec = lines.join("\r\n");
        sections[i] = isFirst ? newSec : newSec.slice(2);
      }
    }
  }
  return sections.join("\r\nm=");
}
