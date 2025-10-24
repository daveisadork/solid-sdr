import { describe, it, expect } from "vitest";
import {
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  type VitaTrailer,
} from "../../src/vita/common";
import { VitaMeterPacket } from "../../src/vita/meter-packet";

function makePacketBase(): VitaMeterPacket {
  const p = new VitaMeterPacket();
  p.header.packetType = VitaPacketType.ExtDataWithStream;
  p.header.hasClassId = true;
  p.header.hasTrailer = true;
  p.header.timestampIntegerType = VitaTimeStampIntegerType.Other; // +4
  p.header.timestampFractionalType = VitaTimeStampFractionalType.RealTime; // +8
  p.header.packetCount = 3;

  p.streamId = 0x11223344;
  p.classId = {
    oui: 0x00_ab_cd,
    informationClassCode: 0x1234,
    packetClassCode: 0x5678,
  };

  // three meters
  p.ids = new Uint16Array([10, 20, 30]);
  p.values = new Int16Array([-10, 0, 32767]);

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
    associatedContextPacketCount: 0x2a,
  };
  p.trailer = t;

  return p;
}

describe("meter-packet: round-trip", () => {
  it("serializes and parses with correct ids/values and trailer flags", () => {
    const p1 = makePacketBase();
    const bytes = p1.toBytes();

    const p2 = new VitaMeterPacket(bytes);

    // header
    expect(p2.header.packetType).toBe(VitaPacketType.ExtDataWithStream);
    expect(p2.header.hasClassId).toBe(true);
    expect(p2.header.hasTrailer).toBe(true);
    expect(p2.header.timestampIntegerType).toBe(VitaTimeStampIntegerType.Other);
    expect(p2.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.RealTime,
    );
    expect(p2.header.packetCount).toBe(3);
    expect(p2.header.packetSize).toBe(p1.header.packetSize);

    // ids/values
    expect(Array.from(p2.ids)).toEqual([10, 20, 30]);
    expect(Array.from(p2.values)).toEqual([-10, 0, 32767]);

    // trailer
    expect(p2.trailer).toEqual(p1.trailer);
  });
});

describe("meter-packet: zero-alloc parse using reusable arrays", () => {
  it("fills provided arrays and uses subarray views", () => {
    const p1 = makePacketBase();
    const bytes = p1.toBytes();

    const idsReuse = new Uint16Array(16);
    const valsReuse = new Int16Array(16);

    const pkt = new VitaMeterPacket();
    pkt.parse(bytes, { ids: idsReuse, values: valsReuse });

    expect(pkt.numMeters).toBe(3);
    expect(pkt.ids.buffer).toBe(idsReuse.buffer); // no new alloc, view into provided
    expect(pkt.values.buffer).toBe(valsReuse.buffer); // no new alloc, view into provided
    expect(Array.from(pkt.ids)).toEqual([10, 20, 30]);
    expect(Array.from(pkt.values)).toEqual([-10, 0, 32767]);
  });
});

describe("meter-packet: size math", () => {
  it("computes packetSize correctly", () => {
    const p = makePacketBase();

    // Pre-payload bytes:
    // header(4) + stream(4) + class(8) + tsInt(4) + tsFrac(8) = 28
    const pre = 28;

    // payload = meters * 4 = 3 * 4 = 12
    const payload = 12;

    // trailer = 4
    const total = pre + payload + 4; // 44
    const bytes = p.toBytes();
    expect(bytes.byteLength).toBe(total);

    const words = (total + 3) >> 2;
    const parsed = new VitaMeterPacket(bytes);
    expect(parsed.header.packetSize).toBe(words);
  });
});
