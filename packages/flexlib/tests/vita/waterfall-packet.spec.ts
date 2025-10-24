import { describe, it, expect } from "vitest";
import {
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  type VitaTrailer,
} from "../../src/vita/common";
import { VitaWaterfallPacket } from "../../src/vita/waterfall-packet";
import { VitaFrequency } from "../../src/util/vita-frequency";

function makeTileData(len: number, start = 1000): Uint16Array {
  const a = new Uint16Array(len);
  for (let i = 0; i < len; i++) a[i] = (start + i) & 0xffff;
  return a;
}

function makePacketBase(): VitaWaterfallPacket {
  const p = new VitaWaterfallPacket();

  // header defaults for waterfall
  p.header.packetType = VitaPacketType.ExtDataWithStream;
  p.header.hasClassId = true;
  p.header.hasTrailer = true;
  p.header.timestampIntegerType = VitaTimeStampIntegerType.Other;
  p.header.timestampFractionalType = VitaTimeStampFractionalType.RealTime;
  p.header.packetCount = 7; // arbitrary
  // packetSize is computed in toBytes()

  p.streamId = 0x11223344;
  p.classId = {
    oui: 0x00_12_34,
    informationClassCode: 0xabcd,
    packetClassCode: 0x6789,
  };

  // tile header
  p.tile.frameLowFreq = VitaFrequency.fromHz(14_200_000); // 14.2 MHz
  p.tile.binBandwidth = VitaFrequency.fromHz(25); // Hz/bin
  p.tile.lineDurationMs = 50;
  p.tile.width = 5; // choose odd*even combos to exercise alignment
  p.tile.height = 1; // 5 samples -> 10 bytes (will need 2 bytes pad with 36-byte header)
  p.tile.timecode = 1234;
  p.tile.autoBlackLevel = 0x0400;
  p.tile.totalBinsInFrame = 4096;
  p.tile.firstBinIndex = 0;

  p.tile.data = makeTileData(p.tile.width * p.tile.height, 2000);

  // trailer bits
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
    associatedContextPacketCount: 0x55,
  };
  p.trailer = t;

  return p;
}

describe("waterfall-packet: round-trip with trailer & timestamps", () => {
  it("serializes then parses back identically for key fields", () => {
    const p1 = makePacketBase();
    const bytes = p1.toBytes();

    const p2 = new VitaWaterfallPacket(bytes);

    // header
    expect(p2.header.packetType).toBe(VitaPacketType.ExtDataWithStream);
    expect(p2.header.hasClassId).toBe(true);
    expect(p2.header.hasTrailer).toBe(true);
    expect(p2.header.timestampIntegerType).toBe(VitaTimeStampIntegerType.Other);
    expect(p2.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.RealTime,
    );
    expect(p2.header.packetCount).toBe(7);
    expect(p2.header.packetSize).toBe(p1.header.packetSize);

    // ids
    expect(p2.streamId).toBe(0x11223344);
    expect(p2.classId.oui).toBe(0x001234);
    expect(p2.classId.informationClassCode).toBe(0xabcd);
    expect(p2.classId.packetClassCode).toBe(0x6789);

    // tile header
    expect(p2.tile.frameLowFreq.freqHz).toBe(14_200_000);
    expect(p2.tile.binBandwidth.freqHz).toBe(25);
    expect(p2.tile.lineDurationMs).toBe(50);
    expect(p2.tile.width).toBe(5);
    expect(p2.tile.height).toBe(1);
    expect(p2.tile.timecode).toBe(1234);
    expect(p2.tile.autoBlackLevel).toBe(0x0400);
    expect(p2.tile.totalBinsInFrame).toBe(4096);
    expect(p2.tile.firstBinIndex).toBe(0);

    // data
    expect(Array.from(p2.tile.data.slice(0, 5))).toEqual([
      2000, 2001, 2002, 2003, 2004,
    ]);

    // trailer
    expect(p2.trailer).toEqual(p1.trailer);
  });
});

describe("waterfall-packet: alignment/padding math", () => {
  it("adds 2 padding bytes when tile data length is odd (#uint16)", () => {
    const p = makePacketBase();
    // width*height = 5 -> 10 bytes data; header 36 → 46; pad 2 → 48
    const bytes = p.toBytes();

    // Recompute expected total bytes
    // Fixed pre-payload: header(4) + stream(4) + class(8) + tsInt(4) + tsFrac(8) = 28
    // Payload: tileHeader(36) + data(10) + pad(2) = 48
    // Trailer: 4
    // Total: 28 + 48 + 4 = 80
    expect(bytes.byteLength).toBe(80);

    // And words reported in header match
    const words = (bytes.byteLength + 3) >> 2;
    const parsed = new VitaWaterfallPacket(bytes);
    expect(parsed.header.packetSize).toBe(words);
  });

  it("has no padding when tile data length is even (#uint16)", () => {
    const p = makePacketBase();
    p.tile.width = 4; // 8 bytes data, 36+8 = 44 -> already 4-byte aligned
    p.tile.height = 1;
    p.tile.data = makeTileData(4, 3000);
    const bytes = p.toBytes();

    // Fixed pre-payload (28) + payload (36 + 8 + 0 pad = 44) + trailer(4) = 76
    expect(bytes.byteLength).toBe(76);

    const parsed = new VitaWaterfallPacket(bytes);
    expect(Array.from(parsed.tile.data.slice(0, 4))).toEqual([
      3000, 3001, 3002, 3003,
    ]);
  });
});

describe("waterfall-packet: packetSize math", () => {
  it("matches computed word count including optional fields", () => {
    const p = makePacketBase();

    // Manually compute expected words:
    // header(1) + stream(1) + class(2) + tsInt(1 if present) + tsFrac(2 if present)
    // + payloadWords + trailer(1 if present)

    const withStream = 1;
    const withClass = 2;
    const withTsFrac = 2; // RealTime → fractional present
    const prePayloadWords = 1 + withStream + withClass + 1 + withTsFrac;

    const tileHeaderBytes = 36;
    const tileDataBytes = p.tile.data.byteLength; // #uint16 * 2
    const payloadBytes = tileHeaderBytes + tileDataBytes;
    const pad = payloadBytes % 4 === 2 ? 2 : 0;
    const payloadWords = Math.ceil((payloadBytes + pad) / 4);

    const withTrailer = 1;

    const expectedWords = prePayloadWords + payloadWords + withTrailer;

    const bytes = p.toBytes();
    const parsed = new VitaWaterfallPacket(bytes);

    expect(parsed.header.packetSize).toBe(expectedWords);
  });
});

describe("waterfall-packet: without classId / trailer / timestamps", () => {
  it("handles minimal mode properly", () => {
    const p = new VitaWaterfallPacket();
    p.header.packetType = VitaPacketType.ExtDataWithStream;
    p.header.hasClassId = false;
    p.header.hasTrailer = false;
    p.header.timestampIntegerType = VitaTimeStampIntegerType.None;
    p.header.timestampFractionalType = VitaTimeStampFractionalType.None;
    p.header.packetCount = 1;
    p.streamId = 0x01020304;

    p.tile.frameLowFreq = VitaFrequency.fromHz(7_000_000);
    p.tile.binBandwidth = VitaFrequency.fromHz(50);
    p.tile.lineDurationMs = 100;
    p.tile.width = 2;
    p.tile.height = 2;
    p.tile.timecode = 42;
    p.tile.autoBlackLevel = 0x0300;
    p.tile.totalBinsInFrame = 4096;
    p.tile.firstBinIndex = 0;
    p.tile.data = makeTileData(4, 5000);

    const bytes = p.toBytes();
    const round = new VitaWaterfallPacket(bytes);

    expect(round.header.hasClassId).toBe(false);
    expect(round.header.hasTrailer).toBe(false);
    expect(round.header.timestampIntegerType).toBe(
      VitaTimeStampIntegerType.None,
    );
    expect(round.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.None,
    );
    expect(round.streamId).toBe(0x01020304);

    expect(round.tile.frameLowFreq.freqHz).toBe(7_000_000);
    expect(round.tile.binBandwidth.freqHz).toBe(50);
    expect(round.tile.lineDurationMs).toBe(100);
    expect(round.tile.width).toBe(2);
    expect(round.tile.height).toBe(2);
    expect(Array.from(round.tile.data)).toEqual([5000, 5001, 5002, 5003]);
  });
});
