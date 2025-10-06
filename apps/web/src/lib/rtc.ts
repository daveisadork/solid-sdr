export type RtcSession = {
  pc: RTCPeerConnection;
  data: RTCDataChannel;
  close: () => void;
};

export async function startRTC(
  sessionId: string,
  onTrack: (ev: RTCTrackEvent) => void,
): Promise<RtcSession> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.addEventListener("track", onTrack);

  // offer recvonly audio so the server can send
  pc.addTransceiver("audio", { direction: "recvonly" });

  const data = pc.createDataChannel("udp");

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceComplete(pc);

  const res = await fetch("http://localhost:8080/rtc/offer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, sdp: pc.localDescription!.sdp }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(raw);
  const { sdp } = JSON.parse(raw);
  await pc.setRemoteDescription({ type: "answer", sdp });

  const close = () => pc.close();
  return { pc, data, close };
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
