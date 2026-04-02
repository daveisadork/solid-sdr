export type RtcSession = {
  pc: RTCPeerConnection;
  tcpData: RTCDataChannel;
  udpData: RTCDataChannel;
  audio: RTCRtpTransceiver;
  setTransmitTrack: (track: MediaStreamTrack) => Promise<void>;
  close: () => void;
};

export async function startRTC(
  sessionId: string,
  onTrack?: (ev: RTCTrackEvent) => void,
) {
  const pc = new RTCPeerConnection({
    // iceServers: [
    //   // keep your STUN for normal runs…
    //   { urls: "stun:stun.cloudflare.com:3478" },
    //   { urls: "stun:stun.l.google.com:19302" },
    //   // …and add your TURN (we’ll set up in step 2)
    //   // { urls: ["turns:turn.example.com:443?transport=tcp"], username, credential },
    // ],
    // iceTransportPolicy: "relay", // <— TEMP: force TURN to test
  });

  const renegotiate = async () => {
    const offer = await pc.createOffer();
    const sdp = forceStereoInSDP(offer.sdp!);
    await pc.setLocalDescription({ ...offer, sdp });

    await waitForIceComplete(pc);
    const res = await fetch("/rtc/offer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, sdp: pc.localDescription!.sdp }),
    });
    const { sdp: answer } = await res.json();
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    await waitForIceConnected(pc);
  };

  if (onTrack) pc.addEventListener("track", onTrack);
  pc.addEventListener("negotiationneeded", renegotiate);

  const audio = pc.addTransceiver("audio", { direction: "sendrecv" });
  const tcpData = pc.createDataChannel("tcp", {
    ordered: true,
  });
  const udpData = pc.createDataChannel("udp", {
    ordered: false, // no head-of-line blocking
    maxRetransmits: 0, // drop instead of retry
    // OR use maxPacketLifeTime: 100 for “soft” realtime
  });

  udpData.binaryType = "arraybuffer"; // important for Firefox
  udpData.onopen = () => console.log("[udp dc] open");
  udpData.onclosing = () => console.log("[udp dc] closing");
  udpData.onclose = () => console.log("[udp dc] closed");
  udpData.onerror = (e) => console.warn("[udp dc] error", e);

  tcpData.onopen = () => console.log("[tcp dc] open");
  tcpData.onclosing = () => console.log("[tcp dc] closing");
  tcpData.onclose = () => console.log("[tcp dc] closed");
  tcpData.onerror = (e) => console.warn("[tcp dc] error", e);

  return {
    pc,
    tcpData,
    udpData,
    audio,
    setTransmitTrack: audio.sender.replaceTrack.bind(audio.sender),
    close: () => {
      if (onTrack) pc.removeEventListener("track", onTrack);
      pc.removeEventListener("negotiationneeded", renegotiate);
      pc.close();
    },
  };
}

function waitForIceConnected(pc: RTCPeerConnection) {
  if (pc.iceConnectionState === "connected") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const listener = () => {
      console.log("[ice] state:", pc.iceConnectionState);
      switch (pc.iceConnectionState) {
        case "connected":
          pc.removeEventListener("iceconnectionstatechange", listener);
          resolve();
          break;
        case "failed":
        case "disconnected":
        case "closed":
          pc.removeEventListener("iceconnectionstatechange", listener);
          reject(new Error("Failed to connect: " + pc.iceConnectionState));
          break;
      }
    };
    pc.addEventListener("iceconnectionstatechange", listener);
    setTimeout(() => {
      reject(new Error("Timed out waiting for connection"));
    }, 15000);
  });
}

function waitForIceComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    // small safety timer to avoid hanging on environments with blocked STUN
    setTimeout(resolve, 1500);
  });
}

export type RtcSessionInfo = {
  sessionId: string;
  version: string;
  handle: string;
};

// startRTCViaSignaling establishes a WebRTC session by exchanging offer/answer
// over the given signaling WebSocket (the same /ws/signal connection used for discovery).
// It sends the offer, handles trickle ICE candidates, and waits for the tcp data channel
// to open before returning the session and the radio handshake info.
export async function startRTCViaSignaling(opts: {
  host: string;
  port: number;
  signalingWs: Pick<
    WebSocket,
    "addEventListener" | "removeEventListener" | "send"
  >;
  onTrack?: (ev: RTCTrackEvent) => void;
}): Promise<{ session: RtcSession; info: RtcSessionInfo }> {
  const { host, port, signalingWs, onTrack } = opts;

  const pc = new RTCPeerConnection({});

  // Register onTrack BEFORE setLocalDescription so the track event (which fires
  // during setRemoteDescription processing) is never missed.
  if (onTrack) pc.addEventListener("track", onTrack);

  const renegotiate = async () => {
    console.log("[negotiationneeded] Renegotiating...");
    // Build and set local description.
    const offer = await pc.createOffer();
    const sdp = forceStereoInSDP(offer.sdp!);
    await pc.setLocalDescription({ ...offer, sdp });

    signalingWs.send(
      JSON.stringify({
        type: "offer",
        payload: { host, port, sdp: pc.localDescription!.sdp },
      }),
    );
  };

  // Promise that resolves once we receive the answer payload.
  let resolveInfo!: (info: RtcSessionInfo) => void;
  let rejectInfo!: (err: Error) => void;
  const infoPromise = new Promise<RtcSessionInfo>((resolve, reject) => {
    resolveInfo = resolve;
    rejectInfo = reject;
  });

  // Persistent signaling listener — handles answer, trickle ICE, and error messages.
  // Stays active for the lifetime of the PC (trickle ICE arrives after the answer).
  const handleSignalingMsg = (ev: MessageEvent) => {
    let msg: { type: string; payload?: Record<string, unknown> };
    try {
      msg = JSON.parse(ev.data as string) as typeof msg;
    } catch {
      return;
    }
    switch (msg.type) {
      case "answer": {
        const p = msg.payload as {
          sessionId: string;
          sdp: string;
          version: string;
          handle: string;
        };
        pc.setRemoteDescription({ type: "answer", sdp: p.sdp })
          .then(() =>
            resolveInfo({
              sessionId: p.sessionId,
              version: p.version,
              handle: p.handle,
            }),
          )
          .catch((e: unknown) =>
            rejectInfo(e instanceof Error ? e : new Error(String(e))),
          );
        break;
      }
      case "ice": {
        const p = msg.payload as {
          candidate: RTCIceCandidateInit | null;
        };
        if (p.candidate) {
          pc.addIceCandidate(p.candidate).catch((e) =>
            console.warn("[ice] addIceCandidate:", e),
          );
        }
        break;
      }
      case "error": {
        const p = msg.payload as { code: string; message: string };
        rejectInfo(new Error(`${p.code}: ${p.message}`));
        break;
      }
    }
  };

  signalingWs.addEventListener("message", handleSignalingMsg);
  const removeSignalingListener = () =>
    signalingWs.removeEventListener("message", handleSignalingMsg);

  // Remove listener automatically when PC closes.
  pc.addEventListener("connectionstatechange", () => {
    window.pc = pc; // for debugging
    if (pc.connectionState === "closed" || pc.connectionState === "failed") {
      removeSignalingListener();
    }
  });

  const answerTimeout = setTimeout(
    () => rejectInfo(new Error("Timed out waiting for WebRTC answer")),
    15_000,
  );

  pc.addEventListener("negotiationneeded", renegotiate);

  const audio = pc.addTransceiver("audio", { direction: "sendrecv" });
  const tcpData = pc.createDataChannel("tcp", { ordered: true });
  const udpData = pc.createDataChannel("udp", {
    ordered: false,
    maxRetransmits: 0,
  });

  udpData.binaryType = "arraybuffer";
  udpData.onopen = () => console.log("[udp dc] open");
  udpData.onclosing = () => console.log("[udp dc] closing");
  udpData.onclose = () => console.log("[udp dc] closed");
  udpData.onerror = (e) => console.warn("[udp dc] error", e);

  tcpData.onopen = () => console.log("[tcp dc] open");
  tcpData.onclosing = () => console.log("[tcp dc] closing");
  tcpData.onclose = () => console.log("[tcp dc] closed");
  tcpData.onerror = (e) => console.warn("[tcp dc] error", e);

  let info: RtcSessionInfo;
  try {
    info = await infoPromise;
  } finally {
    clearTimeout(answerTimeout);
  }

  // Waiting for tcp data channel open implies ICE connected + SCTP negotiated.
  await waitForDataChannelOpen(tcpData);

  return {
    session: {
      pc,
      tcpData,
      udpData,
      audio,
      setTransmitTrack: audio.sender.replaceTrack.bind(audio.sender),
      close: () => {
        removeSignalingListener();
        if (onTrack) pc.removeEventListener("track", onTrack);
        pc.close();
      },
    },
    info,
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
