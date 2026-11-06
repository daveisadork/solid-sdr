// Use this configuration when the server sends no "config" message (older servers).
export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  iceTransportPolicy: "all",
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function parseIceServer(value: unknown): RTCIceServer | null {
  if (typeof value !== "object" || value === null) return null;
  const { urls, username, credential } = value as Record<string, unknown>;
  if (typeof urls !== "string" && !isStringArray(urls)) return null;
  if (username !== undefined && typeof username !== "string") return null;
  if (credential !== undefined && typeof credential !== "string") return null;
  const server: RTCIceServer = { urls };
  if (username !== undefined) server.username = username;
  if (credential !== undefined) server.credential = credential;
  return server;
}

// Make an RTCConfiguration from a "config" message payload.
// Use the default configuration if the payload is not valid.
export function rtcConfigFromPayload(payload: unknown): RTCConfiguration {
  if (typeof payload !== "object" || payload === null) {
    return DEFAULT_RTC_CONFIG;
  }
  const { iceServers, iceTransportPolicy } = payload as Record<string, unknown>;
  if (!Array.isArray(iceServers)) return DEFAULT_RTC_CONFIG;
  const servers = iceServers.map(parseIceServer);
  if (servers.some((s) => s === null)) return DEFAULT_RTC_CONFIG;
  return {
    iceServers: servers as RTCIceServer[],
    iceTransportPolicy: iceTransportPolicy === "relay" ? "relay" : "all",
  };
}

// The URL flag "?relay=true" forces TURN. Use it to test a TURN server.
export function applyRelayOverride(
  config: RTCConfiguration,
  search: string,
): RTCConfiguration {
  if (new URLSearchParams(search).get("relay") !== "true") return config;
  return { ...config, iceTransportPolicy: "relay" };
}
