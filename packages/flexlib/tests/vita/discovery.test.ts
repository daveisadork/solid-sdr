import { describe, it, expect } from "vitest";
import {
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  VitaTrailer,
} from "@vita/common";
import { VitaDiscoveryPacket } from "@vita/discovery";
import { hexToBytes } from "../helpers";

function makePacket(): VitaDiscoveryPacket {
  const p = new VitaDiscoveryPacket();
  p.header.packetType = VitaPacketType.ExtDataWithStream;
  p.header.hasClassId = true;
  p.header.hasTrailer = true;
  p.header.timestampIntegerType = VitaTimeStampIntegerType.None;
  p.header.timestampFractionalType = VitaTimeStampFractionalType.None;
  p.header.packetCount = 9;

  p.streamId = 0x01020304;
  p.classId = {
    oui: 0x00_abc_def, // 24-bit (0x00ABCDEF)
    informationClassCode: 0x1111,
    packetClassCode: 0x2222,
  };

  // payload will be padded to 4-byte boundary internally
  p.payload = "DISCOVERY";
  // set a trailer with a few bits on
  const t: VitaTrailer = {
    calibratedTimeEnable: true,
    validDataEnable: false,
    referenceLockEnable: true,
    agcMgcEnable: false,
    detectedSignalEnable: true,
    spectralInversionEnable: false,
    overrangeEnable: true,
    sampleLossEnable: false,

    calibratedTimeIndicator: true,
    validDataIndicator: false,
    referenceLockIndicator: false,
    agcMgcIndicator: false,
    detectedSignalIndicator: true,
    spectralInversionIndicator: false,
    overrangeIndicator: true,
    sampleLossIndicator: false,

    contextPacketCountEnabled: true,
    associatedContextPacketCount: 0x7f, // max 7-bit
  };
  p.trailer = t;

  return p;
}

describe("discovery: packet sizing and roundtrip", () => {
  it("computes packetSize correctly (no timestamps)", () => {
    const p = makePacket();

    // header(1) + stream(1) + classId(2) + trailer(1) + payloadWords
    const payloadBytes = new TextEncoder().encode(p.payload).length;
    const payloadWords = Math.ceil(payloadBytes / 4);
    const expected = 1 + 1 + 2 + 1 + payloadWords;

    expect(p.header.packetSize).toBe(expected);
  });

  it("roundtrips to bytes and back", () => {
    const p1 = makePacket();
    const bytes = p1.toBytes();

    const p2 = new VitaDiscoveryPacket(bytes);

    // header fields
    expect(p2.header.packetType).toBe(p1.header.packetType);
    expect(p2.header.hasClassId).toBe(true);
    expect(p2.header.hasTrailer).toBe(true);
    expect(p2.header.timestampIntegerType).toBe(VitaTimeStampIntegerType.None);
    expect(p2.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.None,
    );
    expect(p2.header.packetCount).toBe(9);
    expect(p2.header.packetSize).toBe(p1.header.packetSize);

    // stream & class
    expect(p2.streamId).toBe(0x01020304);
    expect(p2.classId.oui).toBe(0x00_abc_def);
    expect(p2.classId.informationClassCode).toBe(0x1111);
    expect(p2.classId.packetClassCode).toBe(0x2222);

    // payload (should include any padding spaces if present)
    expect(p2.payload).toBe(p1.payload);

    // trailer
    expect(p2.trailer).toEqual(p1.trailer);
  });
});

describe("discovery: setPayloadFromBytes path", () => {
  it("accepts raw bytes and pads to 4-byte alignment", () => {
    const p = makePacket();
    const raw = new TextEncoder().encode("xyz"); // 3 bytes
    p.setPayloadFromBytes(raw);

    // should pad by 1 space, then re-encode in toBytes
    const bytes = p.toBytes();
    const parsed = new VitaDiscoveryPacket(bytes);

    // payload must be 'xyz ' (one trailing space)
    expect(parsed.payload.endsWith(" ")).toBe(true);
    expect(parsed.payload.trim()).toBe("xyz");
  });
});

describe("discovery: trailer masking", () => {
  it("masks associatedContextPacketCount to 7 bits on serialize", () => {
    const p = makePacket();
    p.trailer.associatedContextPacketCount = 200; // 0b11001000 -> masked to 0b1001000 (72)

    const bytes = p.toBytes();
    const parsed = new VitaDiscoveryPacket(bytes);

    expect(parsed.trailer.associatedContextPacketCount).toBe(200 & 0x7f);
  });
});

describe("discovery: parse known-good binary (drop your real packet here)", () => {
  it("parses a real discovery frame without throwing (placeholder)", () => {
    // paste your hex dump (spaces/newlines ok), or leave empty to skip
    const realHex = ``;
    if (!realHex.trim()) {
      // nothing to check yet
      expect(true).toBe(true);
      return;
    }

    const bin = hexToBytes(realHex);
    const pkt = new VitaDiscoveryPacket(bin);

    // sanity checks; update as appropriate for your captures
    expect(pkt.header.packetSize).toBeGreaterThan(0);
    expect(
      pkt.header.packetType === VitaPacketType.ExtDataWithStream ||
        pkt.header.packetType === VitaPacketType.IFDataWithStream,
    ).toBe(true);
    // console.log(pkt); // for debugging
  });
});
