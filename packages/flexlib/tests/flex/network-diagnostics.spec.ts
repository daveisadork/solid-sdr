import { describe, expect, it } from "vitest";
import { RadioNetworkDiagnosticsTracker } from "../../src/flex/network-diagnostics.js";

describe("RadioNetworkDiagnosticsTracker", () => {
  it("tracks in-order packets without loss", () => {
    const tracker = new RadioNetworkDiagnosticsTracker();

    tracker.recordStreamPacket(0x40000000, 0, 1_000);
    tracker.recordStreamPacket(0x40000000, 1, 1_001);
    tracker.recordStreamPacket(0x40000000, 2, 1_002);

    expect(tracker.snapshot()).toEqual({
      totalPackets: 3,
      lostPackets: 0,
      lossPercent: 0,
      updatedAt: 1_002,
    });
  });

  it("accepts modulo-16 packet-count wraparound", () => {
    const tracker = new RadioNetworkDiagnosticsTracker();

    tracker.recordStreamPacket(0x40000000, 14, 1_000);
    tracker.recordStreamPacket(0x40000000, 15, 1_001);
    tracker.recordStreamPacket(0x40000000, 0, 1_002);

    expect(tracker.snapshot().lostPackets).toBe(0);
  });

  it("counts one error for a discontinuity", () => {
    const tracker = new RadioNetworkDiagnosticsTracker();

    tracker.recordStreamPacket(0x40000000, 0, 1_000);
    tracker.recordStreamPacket(0x40000000, 2, 1_001);

    expect(tracker.snapshot()).toEqual({
      totalPackets: 2,
      lostPackets: 1,
      lossPercent: 50,
      updatedAt: 1_001,
    });
  });

  it("keeps streams independent", () => {
    const tracker = new RadioNetworkDiagnosticsTracker();

    tracker.recordStreamPacket(0x40000000, 0, 1_000);
    tracker.recordStreamPacket(0x50000000, 7, 1_001);
    tracker.recordStreamPacket(0x40000000, 1, 1_002);
    tracker.recordStreamPacket(0x50000000, 8, 1_003);

    expect(tracker.snapshot().lostPackets).toBe(0);
    expect(tracker.snapshot().totalPackets).toBe(4);
  });

  it("tracks meter packets as a shared source", () => {
    const tracker = new RadioNetworkDiagnosticsTracker();

    tracker.recordMeterPacket(0, 1_000);
    tracker.recordMeterPacket(1, 1_001);
    tracker.recordMeterPacket(3, 1_002);

    expect(tracker.snapshot().lostPackets).toBe(1);
  });

  it("treats duplicates and reversals as packet errors", () => {
    const tracker = new RadioNetworkDiagnosticsTracker();

    tracker.recordStreamPacket(0x40000000, 0, 1_000);
    tracker.recordStreamPacket(0x40000000, 0, 1_001);
    tracker.recordStreamPacket(0x40000000, 15, 1_002);

    expect(tracker.snapshot().lostPackets).toBe(2);
  });

  it("resets state cleanly", () => {
    const tracker = new RadioNetworkDiagnosticsTracker();

    tracker.recordStreamPacket(0x40000000, 0, 1_000);
    tracker.recordStreamPacket(0x40000000, 2, 1_001);
    tracker.reset();

    expect(tracker.snapshot()).toEqual({
      totalPackets: 0,
      lostPackets: 0,
      lossPercent: 0,
      updatedAt: null,
    });
  });
});
