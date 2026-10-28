import { describe, expect, it } from "vitest";
import {
  applyRelayOverride,
  DEFAULT_RTC_CONFIG,
  rtcConfigFromPayload,
} from "./rtc-config";

describe("DEFAULT_RTC_CONFIG", () => {
  it("has the STUN list that the client used before", () => {
    expect(DEFAULT_RTC_CONFIG).toEqual({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
      iceTransportPolicy: "all",
    });
  });
});

describe("rtcConfigFromPayload", () => {
  it("uses a valid payload", () => {
    const payload = {
      iceServers: [
        { urls: ["stun:stun.example.com:3478"] },
        {
          urls: ["turn:turn.example.com:3478", "turns:turn.example.com:443"],
          username: "1767412800:solid-sdr",
          credential: "secret",
        },
      ],
      iceTransportPolicy: "relay",
    };
    expect(rtcConfigFromPayload(payload)).toStrictEqual({
      iceServers: [
        { urls: ["stun:stun.example.com:3478"] },
        {
          urls: ["turn:turn.example.com:3478", "turns:turn.example.com:443"],
          username: "1767412800:solid-sdr",
          credential: "secret",
        },
      ],
      iceTransportPolicy: "relay",
    });
  });

  it("accepts an empty server list", () => {
    expect(
      rtcConfigFromPayload({ iceServers: [], iceTransportPolicy: "all" }),
    ).toEqual({ iceServers: [], iceTransportPolicy: "all" });
  });

  it("uses policy all for a missing or unknown policy", () => {
    expect(rtcConfigFromPayload({ iceServers: [] }).iceTransportPolicy).toBe(
      "all",
    );
    expect(
      rtcConfigFromPayload({ iceServers: [], iceTransportPolicy: "x" })
        .iceTransportPolicy,
    ).toBe("all");
  });

  it("falls back to the default for invalid payloads", () => {
    for (const payload of [
      null,
      undefined,
      "config",
      {},
      { iceServers: "stun:stun.example.com" },
      { iceServers: [{}] },
      { iceServers: [{ urls: 1 }] },
      { iceServers: [{ urls: ["stun:a"], username: 1 }] },
    ]) {
      expect(rtcConfigFromPayload(payload)).toBe(DEFAULT_RTC_CONFIG);
    }
  });
});

describe("applyRelayOverride", () => {
  it("forces relay with ?relay=true", () => {
    expect(
      applyRelayOverride(DEFAULT_RTC_CONFIG, "?relay=true").iceTransportPolicy,
    ).toBe("relay");
    expect(
      applyRelayOverride(DEFAULT_RTC_CONFIG, "?debug=true&relay=true")
        .iceTransportPolicy,
    ).toBe("relay");
  });

  it("keeps the configuration otherwise", () => {
    for (const search of ["", "?relay=false", "?relay=1", "?debug=true"]) {
      expect(applyRelayOverride(DEFAULT_RTC_CONFIG, search)).toBe(
        DEFAULT_RTC_CONFIG,
      );
    }
  });
});
