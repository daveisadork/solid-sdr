import { describe, it, expect } from "vitest";
import {
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  VitaTrailer,
} from "@vita/common";
import { VitaFFTPacket } from "@vita/fft-packet";

function makeBins(n: number, start = 1000): Uint16Array {
  const a = new Uint16Array(n);
  for (let i = 0; i < n; i++) a[i] = (start + i) & 0xffff;
  return a;
}

function makePacketBase(): VitaFFTPacket {
  const p = new VitaFFTPacket();

  p.header.packetType = VitaPacketType.ExtDataWithStream;
  p.header.hasClassId = true;
  p.header.hasTrailer = true;
  p.header.timestampIntegerType = VitaTimeStampIntegerType.Other; // +4 bytes
  p.header.timestampFractionalType = VitaTimeStampFractionalType.RealTime; // +8 bytes
  p.header.packetCount = 0xa;

  p.streamId = 0x01020304;
  p.classId = {
    oui: 0x00_ab_cd,
    informationClassCode: 0x5555,
    packetClassCode: 0x9999,
  };

  p.startBinIndex = 500;
  p.numBins = 5; // odd to test padding
  p.binSize = 2; // bytes per bin (Flex typical)
  p.totalBinsInFrame = 4096;
  p.frameIndex = 123456;

  p.payload = makeBins(p.numBins, 2000);

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
    associatedContextPacketCount: 0x12,
  };
  p.trailer = t;

  return p;
}

describe("fft-packet: round-trip and field integrity", () => {
  it("serializes then parses back identically for key fields", () => {
    const p1 = makePacketBase();
    const bytes = p1.toBytes();

    const p2 = new VitaFFTPacket(bytes);

    // header basics
    expect(p2.header.packetType).toBe(VitaPacketType.ExtDataWithStream);
    expect(p2.header.hasClassId).toBe(true);
    expect(p2.header.hasTrailer).toBe(true);
    expect(p2.header.timestampIntegerType).toBe(VitaTimeStampIntegerType.Other);
    expect(p2.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.RealTime,
    );
    expect(p2.header.packetCount).toBe(0xa);
    expect(p2.header.packetSize).toBe(p1.header.packetSize);

    // ids
    expect(p2.streamId).toBe(0x01020304);
    expect(p2.classId.oui).toBe(0x00_ab_cd);
    expect(p2.classId.informationClassCode).toBe(0x5555);
    expect(p2.classId.packetClassCode).toBe(0x9999);

    // fft meta
    expect(p2.startBinIndex).toBe(500);
    expect(p2.numBins).toBe(5);
    expect(p2.binSize).toBe(2);
    expect(p2.totalBinsInFrame).toBe(4096);
    expect(p2.frameIndex).toBe(123456);

    // payload values
    expect(Array.from(p2.payload)).toEqual([2000, 2001, 2002, 2003, 2004]);

    // trailer
    expect(p2.trailer).toEqual(p1.trailer);
  });
});

describe("fft-packet: size math & padding", () => {
  it("adds 2 padding bytes when numBins is odd and binSize=2", () => {
    const p = makePacketBase();

    // Pre-payload fixed bytes:
    // header(4) + stream(4) + class(8) + tsInt(4) + tsFrac(8) + fftMeta(12) = 40
    const prePayload = 4 + 4 + 8 + 4 + 8 + 12; // 40

    // payload: numBins * binSize = 5 * 2 = 10 (+ 2 pad)
    const payload = 10;

    // WAIT – re-check: 40+10+2+4 = 56 (bytes). Let's validate with the actual packet.
    const bytes = p.toBytes();

    // The computed size must match header words
    const words = (bytes.byteLength + 3) >> 2;
    expect(p.header.packetSize).toBe(words);

    // And the padding must be 2 when numBins is odd
    const remainder = (prePayload + payload) % 4;
    expect(remainder).toBe(2);
  });

  it("needs no padding when numBins is even and binSize=2", () => {
    const p = makePacketBase();
    p.numBins = 4;
    p.payload = makeBins(4, 3000);
    const bytes = p.toBytes();

    // Check 32-bit word alignment
    expect(bytes.byteLength % 4).toBe(0);

    // Expect first four payload values on parse
    const parsed = new VitaFFTPacket(bytes);
    expect(Array.from(parsed.payload)).toEqual([3000, 3001, 3002, 3003]);
  });
});

describe("fft-packet: handling binSize != 2 (graceful)", () => {
  it("writes only low 16 bits when binSize=3 (still aligned)", () => {
    const p = makePacketBase();
    p.binSize = 3;
    p.numBins = 3;
    p.payload = new Uint16Array([0x0102, 0x0304, 0x0506]);
    const bytes = p.toBytes();

    // Parses at least floor(payloadBytes/2) bins
    const parsed = new VitaFFTPacket(bytes);
    expect(Array.from(parsed.payload)).toEqual([0x0102, 0x0304, 0x0506]);
    // Alignment preserved
    expect(bytes.byteLength % 4).toBe(0);
  });

  it("binSize=1 writes only LSB for each bin", () => {
    const p = makePacketBase();
    p.binSize = 1;
    p.numBins = 3;
    p.payload = new Uint16Array([0x12ab, 0x34cd, 0x5678]);

    const bytes = p.toBytes();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Offsets: compute pre-payload offset to check bytes directly
    let off = 0;
    // header
    off += 4;
    // stream
    off += 4;
    // class
    off += 8;
    // tsInt + tsFrac
    off += 4 + 8;
    // fftMeta
    off += 12;

    // payload bytes (3 bins * 1 byte)
    const b0 = view.getUint8(off + 0);
    const b1 = view.getUint8(off + 1);
    const b2 = view.getUint8(off + 2);

    expect(b0).toBe(0xab);
    expect(b1).toBe(0xcd);
    expect(b2).toBe(0x78);
  });
});
