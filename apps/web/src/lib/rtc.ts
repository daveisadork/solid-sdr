export type RtcSession = {
  pc: RTCPeerConnection;
  tcp?: RTCDataChannel;
  udp?: RTCDataChannel;
  discovery?: RTCDataChannel;
  audio: RTCRtpTransceiver;
  setTransmitTrack: (track: MediaStreamTrack) => Promise<void>;
  close: () => void;
};

// startRTC establishes a WebRTC session by exchanging offer/answer
// over the given signaling WebSocket (the same /ws/signal connection used for discovery).
// It sends the offer, handles trickle ICE candidates, and waits for the tcp data channel
// to open before returning the session and the radio handshake info.
export function startRTC(
  signalingWs: Pick<
    WebSocket,
    "addEventListener" | "removeEventListener" | "send"
  >,
  onTrack?: (ev: RTCTrackEvent) => void,
): RtcSession {
  const pc = new RTCPeerConnection({});

  const onIceCandidate = (ev: RTCPeerConnectionIceEvent) => {
    if (ev.candidate) {
      signalingWs.send(
        JSON.stringify({ type: "ice", payload: ev.candidate.toJSON() }),
      );
    }
  };

  const renegotiate = async () => {
    // Build and set local description.
    const offer = await pc.createOffer();
    const sdp = forceStereoInSDP(offer.sdp!);
    await pc.setLocalDescription({ ...offer, sdp });
    signalingWs.send(
      JSON.stringify({
        type: "offer",
        payload: pc.localDescription,
      }),
    );
  };

  // Persistent signaling listener — handles answer, trickle ICE, and error messages.
  // Stays active for the lifetime of the PC (trickle ICE arrives after the answer).
  const handleSignalingMsg = (ev: MessageEvent) => {
    let msg: {
      type: string;
      payload?:
        | RTCSessionDescriptionInit
        | RTCIceCandidateInit
        | { code: string; message: string };
    };
    try {
      msg = JSON.parse(ev.data as string) as typeof msg;
    } catch {
      return;
    }
    switch (msg.type) {
      case "answer": {
        const p = msg.payload as RTCSessionDescriptionInit;
        pc.setRemoteDescription(p);
        break;
      }
      case "ice": {
        const p = msg.payload as RTCIceCandidateInit;
        if (p.candidate) {
          pc.addIceCandidate(p).catch((e) =>
            console.warn("[ice] addIceCandidate:", e),
          );
        }
        break;
      }
      case "error": {
        const p = msg.payload as { code: string; message: string };
        console.error(new Error(`${p.code}: ${p.message}`));
        break;
      }
    }
  };

  const onConnectionStateChange = () => {
    if (pc.connectionState === "closed" || pc.connectionState === "failed") {
      cleanup();
    }
  };

  const cleanup = () => {
    signalingWs.removeEventListener("message", handleSignalingMsg);
    pc.removeEventListener("icecandidate", onIceCandidate);
    if (onTrack) pc.removeEventListener("track", onTrack);
    pc.removeEventListener("connectionstatechange", onConnectionStateChange);
    pc.removeEventListener("negotiationneeded", renegotiate);
    if (pc.connectionState !== "closed" && pc.connectionState !== "failed") {
      pc.close();
    }
  };

  pc.addEventListener("icecandidate", onIceCandidate);
  // Register onTrack BEFORE setLocalDescription so the track event (which fires
  // during setRemoteDescription processing) is never missed.
  if (onTrack) pc.addEventListener("track", onTrack);
  signalingWs.addEventListener("message", handleSignalingMsg);
  signalingWs.addEventListener("close", cleanup, { once: true });
  signalingWs.addEventListener("error", cleanup, { once: true });
  pc.addEventListener("connectionstatechange", onConnectionStateChange);
  pc.addEventListener("negotiationneeded", renegotiate);

  const audio = pc.addTransceiver("audio", { direction: "sendrecv" });
  return {
    pc,
    audio,
    setTransmitTrack: audio.sender.replaceTrack.bind(audio.sender),
    close: cleanup,
  };
}

export function waitForDataChannelOpen(dc: RTCDataChannel): Promise<void> {
  if (dc.readyState === "open") return Promise.resolve();
  if (dc.readyState === "closing" || dc.readyState === "closed") {
    return Promise.reject(new Error("Data channel is closed"));
  }
  return new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("Data channel closed before opening"));
    };
    const onError = () => {
      cleanup();
      reject(new Error("Data channel error before opening"));
    };
    const cleanup = () => {
      dc.removeEventListener("open", onOpen);
      dc.removeEventListener("close", onClose);
      dc.removeEventListener("error", onError);
    };
    dc.addEventListener("open", onOpen, { once: true });
    dc.addEventListener("close", onClose, { once: true });
    dc.addEventListener("error", onError, { once: true });
    setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for data channel to open"));
    }, 15_000);
  });
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
