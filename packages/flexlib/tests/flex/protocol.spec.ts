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
});
