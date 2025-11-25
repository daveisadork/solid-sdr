import { describe, expect, it } from "vitest";
import { parseFlexMessage } from "../../src/flex/protocol.js";

describe("parseFlexMessage", () => {
  it("parses slice status with attributes", () => {
    const now = Date.now();
    const message = parseFlexMessage(
      "S12|slice 0 freq=14.074000 mode=USB active=1",
      now,
    );
    expect(message).toBeDefined();
    if (!message || message.kind !== "status")
      throw new Error("expected status");
    expect(message.sequence).toBe(12);
    expect(message.source).toBe("slice");
    expect(message.identifier).toBe("0");
    expect(message.attributes["freq"]).toBe("14.074000");
    expect(message.timestamp).toBe(now);
  });

  it("parses replies with sequence and code", () => {
    const message = parseFlexMessage("R12|0|slice created", Date.now());
    expect(message).toBeDefined();
    if (!message || message.kind !== "reply") throw new Error("expected reply");
    expect(message.sequence).toBe(12);
    expect(message.code).toBe(0);
    expect(message.message).toBe("slice created");
  });

  it("parses notices and normalizes severity", () => {
    const message = parseFlexMessage(
      "M|warn|High SWR|ant=ANT1,vswr=3.2",
      Date.now(),
    );
    expect(message).toBeDefined();
    if (!message || message.kind !== "notice")
      throw new Error("expected notice");
    expect(message.severity).toBe("warning");
    expect(message.metadata?.vswr).toBe("3.2");
  });

  it("parses gps status with hash-delimited attributes", () => {
    const now = Date.now();
    const raw =
      "S0|gps lat=38.433865#lon=-90.454626667#grid=EM48sk#altitude=218 m#tracked=12#visible=26#speed=0 kts#freq_error=-1 ppb#status=Fine Lock#time=11:22:37Z#track=0.0";
    const message = parseFlexMessage(raw, now);
    expect(message).toBeDefined();
    if (!message || message.kind !== "status")
      throw new Error("expected status");
    expect(message.source).toBe("gps");
    expect(message.timestamp).toBe(now);
    expect(message.attributes["lat"]).toBe("38.433865");
    expect(message.attributes["lon"]).toBe("-90.454626667");
    expect(message.attributes["grid"]).toBe("EM48sk");
    expect(message.attributes["altitude"]).toBe("218 m");
    expect(message.attributes["tracked"]).toBe("12");
    expect(message.attributes["visible"]).toBe("26");
    expect(message.attributes["speed"]).toBe("0 kts");
    expect(message.attributes["freq_error"]).toBe("-1 ppb");
    expect(message.attributes["status"]).toBe("Fine Lock");
    expect(message.attributes["time"]).toBe("11:22:37Z");
    expect(message.attributes["track"]).toBe("0.0");
  });

  it("parses profile list values with embedded spaces", () => {
    const raw =
      "S42|profile mic list=Default^Default FHM-1^Default FHM-1 DX^";
    const message = parseFlexMessage(raw, Date.now());
    expect(message).toBeDefined();
    if (!message || message.kind !== "status")
      throw new Error("expected status");
    expect(message.source).toBe("profile");
    expect(message.identifier).toBe("mic");
    expect(message.attributes["list"]).toBe(
      "Default^Default FHM-1^Default FHM-1 DX^",
    );
  });
});
