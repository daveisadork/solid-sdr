import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeDiscoveryPayload } from "../../src/flex/discovery.js";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { parseVitaPacket } from "../../src/vita/parser.js";

function loadPacket(filename: string): Uint8Array {
  return new Uint8Array(
    readFileSync(
      new URL(`../fixtures/vita/discovery/${filename}`, import.meta.url),
    ),
  );
}

function parseDescriptorFromPacket(data: Uint8Array): FlexRadioDescriptor {
  const parsed = parseVitaPacket(data);
  if (!parsed || parsed.kind !== "discovery") {
    throw new Error("Not a discovery packet");
  }
  return decodeDiscoveryPayload(parsed.packet.payload, Date.now());
}

const SAMPLE_PACKET = loadPacket("flex-8600-available.bin");
const SAMPLE_PACKET_IN_USE = loadPacket(
  "flex-8600-in-use-multi-client.bin",
);
const SAMPLE_PACKET_ONE_CLIENT = loadPacket(
  "flex-8600-available-single-client.bin",
);

describe("decodeDiscoveryPayload", () => {
  it("parses descriptor fields from a discovery packet", () => {
    // given a raw VITA discovery packet from a FLEX-8600
    // when we parse it into a descriptor
    const descriptor = parseDescriptorFromPacket(SAMPLE_PACKET);

    // then the descriptor contains the radio's identity and network info
    expect(descriptor.serial).toBe("1225-1213-8600-7918");
    expect(descriptor.model).toBe("FLEX-8600");
    expect(descriptor.availableSlices).toBe(4);
    expect(descriptor.availablePanadapters).toBe(4);
    expect(descriptor.version).toBe("3.10.15.38923");
    expect(descriptor.host).toBe("10.16.83.234");
    expect(descriptor.port).toBe(4992);
    expect(descriptor.protocol).toBe("tcp");

    // and discovery-specific fields are typed directly on the descriptor
    expect(descriptor.wanConnected).toBe(true);
    expect(typeof descriptor.lastSeen).toBe("number");
    expect(descriptor.externalPortLink).toBe(true);
    expect(descriptor.availableClients).toBe(2);
    expect(descriptor.inUseHosts).toBeUndefined();
    expect(descriptor.guiClients).toBeUndefined();
  });

  it("rejects packets with missing required fields", () => {
    // given a packet with no port field
    const payload =
      "serial=9999-0000 model=FLEX-6400 version=3.9.10 ip=198.51.100.10 available_slices=2 available_panadapters=2";

    // it should throw an error about the missing port
    expect(() => decodeDiscoveryPayload(payload, Date.now())).toThrow("port");
  });

  it("parses GUI client info for a single-client radio", () => {
    // given a discovery packet from a radio with one connected client
    const descriptor = parseDescriptorFromPacket(SAMPLE_PACKET_ONE_CLIENT);

    // the descriptor should contain GUI client info
    expect(descriptor.guiClients).toHaveLength(1);
  });

  it("normalises metadata for radios with multiple GUI clients", () => {
    // given a discovery packet from a radio with multiple connected clients
    const descriptor = parseDescriptorFromPacket(SAMPLE_PACKET_IN_USE);

    // then all connected client info is available as typed fields
    expect(descriptor.availableClients).toBe(0);
    expect(descriptor.inUseHosts).toEqual([
      "MacBook-Pro.localdomain",
      "LAPTOP-9V8U8FDA.localdomain",
    ]);
    expect(descriptor.inUseIps).toEqual([
      "10.16.83.154",
      "10.16.83.60",
    ]);
    expect(descriptor.guiClientPrograms).toEqual([
      "SmartSDR-Mac",
      "SmartSDR-Win",
    ]);
    expect(descriptor.guiClientHosts).toEqual([
      "MacBook-Pro.localdomain",
      "LAPTOP-9V8U8FDA.localdomain",
    ]);
    expect(descriptor.guiClientStations).toEqual([
      "MacBook Pro",
      "LAPTOP-9V8U8FDA",
    ]);
    expect(descriptor.guiClientHandles).toEqual([
      "0x29DD2CDC",
      "0x7D2D0108",
    ]);

    // and parsed GUI client objects are available
    expect(descriptor.guiClients).toEqual([
      expect.objectContaining({
        clientHandle: 0x29dd2cdc,
        program: "SmartSDR-Mac",
        station: "MacBook Pro",
      }),
      expect.objectContaining({
        clientHandle: 0x7d2d0108,
        program: "SmartSDR-Win",
        station: "LAPTOP-9V8U8FDA",
      }),
    ]);
  });
});
