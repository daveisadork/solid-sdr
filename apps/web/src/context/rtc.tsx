import type { ReconnectingWebSocket } from "@solid-primitives/websocket";
import type { Accessor, Setter } from "solid-js";
import { createContext, useContext } from "solid-js";

export type RtcState = Partial<
  Pick<
    RTCPeerConnection,
    | "connectionState"
    | "signalingState"
    | "iceConnectionState"
    | "iceGatheringState"
  >
>;

export type RtcContextValue = {
  peerConnection: Accessor<RTCPeerConnection | null>;
  rtcState: RtcState;
  remoteAudioRxStream: Accessor<MediaStream | null>;
  setRemoteAudioTxTrack: Setter<MediaStreamTrack | null>;
  signalingWs: ReconnectingWebSocket;
  signalingWsState: Accessor<0 | 1 | 2 | 3>;
  serverVersion: Accessor<string | null>;
};

export const RtcCtx = createContext<RtcContextValue>();

export function useRtc() {
  const ctx = useContext(RtcCtx);
  if (!ctx) throw new Error("useRtc must be used within <RtcProvider>");
  return ctx;
}
