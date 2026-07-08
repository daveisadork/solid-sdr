import { describe, expect, it } from "vitest";
import { createAudioStreamSnapshot } from "../../src/flex/state/audio-stream";

describe("createAudioStreamSnapshot: dax_iq", () => {
  it("parses all DAX IQ attributes", () => {
    const { snapshot } = createAudioStreamSnapshot("0x05000001", {
      type: "dax_iq",
      daxiq_channel: "2",
      daxiq_rate: "48000",
      active: "1",
      pan: "0x40000000",
      client_handle: "0x68AE2A9B",
      ip: "192.168.1.5",
      stream_id: "0x05000001",
    });

    expect(snapshot.type).toBe("dax_iq");
    expect(snapshot.daxIqChannel).toBe(2);
    expect(snapshot.daxIqRate).toBe(48_000);
    expect(snapshot.active).toBe(true);
    expect(snapshot.pan).toBe("0x40000000");
    expect(snapshot.clientHandle).toBe(0x68ae2a9b);
    expect(snapshot.ip).toBe("192.168.1.5");
    expect(snapshot.radioAck).toBe(true);
  });

  it("flips active=false on '0'", () => {
    const { snapshot } = createAudioStreamSnapshot("0x05000002", {
      type: "dax_iq",
      active: "0",
    });
    expect(snapshot.active).toBe(false);
  });
});
