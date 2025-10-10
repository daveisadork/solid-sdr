export type RtcSession = {
  pc: RTCPeerConnection;
  data: RTCDataChannel;
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

  const data = pc.createDataChannel("udp", {
    ordered: false, // no head-of-line blocking
    maxRetransmits: 0, // drop instead of retry
    // OR use maxPacketLifeTime: 100 for “soft” realtime
  });

  data.binaryType = "arraybuffer"; // important for Firefox
  data.onopen = () => console.log("[dc] open");
  data.onclosing = () => console.log("[dc] closing");
  data.onclose = () => console.log("[dc] closed");
  data.onerror = (e) => console.warn("[dc] error", e);

  pc.addTransceiver("audio", { direction: "recvonly" });
  if (onTrack) pc.addEventListener("track", onTrack);

  // Create the offer, then MUNGE it to force opus stereo.
  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  const mungedSDP = forceStereoInSDP(offer.sdp!);
  await pc.setLocalDescription({ type: "offer", sdp: mungedSDP });

  // Wait for ICE, post to server, set remote description as usual
  await waitForIceComplete(pc);
  const res = await fetch("/rtc/offer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, sdp: pc.localDescription!.sdp }),
  });
  const { sdp: answer } = await res.json();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  await waitForIceConnected(pc);

  async function logSelected() {
    const stats = await pc.getStats();
    for (const r of stats.values()) {
      if (r.type === "transport" && r.selectedCandidatePairId) {
        const pair = stats.get(r.selectedCandidatePairId);
        const local = stats.get(pair.localCandidateId);
        const remote = stats.get(pair.remoteCandidateId);
        console.log("[ice selected]", {
          pairState: pair.state,
          localType: local.candidateType,
          remoteType: remote.candidateType,
          proto: local.protocol,
        });
      }
    }
  }
  // setInterval(logSelected, 2000);
  return {
    pc,
    data,
    close: () => pc.close(),
  };
}

function waitForIceConnected(pc: RTCPeerConnection) {
  if (pc.iceConnectionState === "connected") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    pc.addEventListener(
      "iceconnectionstatechange",
      () => {
        if (pc.iceConnectionState === "connected") {
          resolve();
        } else {
          reject(new Error("Failed to connect: " + pc.iceConnectionState));
        }
      },
      { once: true },
    );
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
