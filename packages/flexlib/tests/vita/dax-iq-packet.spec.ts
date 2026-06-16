import { describe, it, expect } from "vitest";
import {
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  writeHeaderBE,
  writeClassIdBE,
  VITA_FLEX_OUI,
  VITA_FLEX_INFO_CLASS,
} from "../../src/vita/common";
import {
  VitaDaxIqPacket,
  VITA_FLEX_DAX_IQ_24_CLASS,
  VITA_FLEX_DAX_IQ_48_CLASS,
  VITA_FLEX_DAX_IQ_96_CLASS,
  VITA_FLEX_DAX_IQ_192_CLASS,
  sampleRateForClass,
} from "../../src/vita/dax-iq-packet";
import { parseVitaPacket } from "../../src/vita/parser";

function buildIqPacket(
  classCode: number,
  streamId: number,
  packetCount: number,
  iSamples: number[],
  qSamples: number[],
): Uint8Array {
  if (iSamples.length !== qSamples.length) throw new Error("I/Q length mismatch");
  const frames = iSamples.length;
  const payloadBytes = frames * 8; // 4 bytes I + 4 bytes Q per frame
  const totalBytes = 28 + payloadBytes;
  const buf = new Uint8Array(totalBytes);
  const view = new DataView(buf.buffer);

  let off = writeHeaderBE(view, 0, {
    packetType: VitaPacketType.IFDataWithStream,
    hasClassId: true,
    hasTrailer: false,
    timestampIntegerType: VitaTimeStampIntegerType.Other,
    timestampFractionalType: VitaTimeStampFractionalType.SampleCount,
    packetCount,
    packetSize: totalBytes >>> 2,
  });
  view.setUint32(off, streamId >>> 0, false);
  off += 4;
  off = writeClassIdBE(view, off, true, {
    oui: VITA_FLEX_OUI,
    informationClassCode: VITA_FLEX_INFO_CLASS,
    packetClassCode: classCode,
  });
  view.setUint32(off, 0, false);
  off += 4;
  view.setBigUint64(off, 0n, false);
  off += 8;

  // Payload: LE float32 (radio's native order for IQ)
  for (let i = 0; i < frames; i++) {
    view.setFloat32(off, iSamples[i], true);
    off += 4;
    view.setFloat32(off, qSamples[i], true);
    off += 4;
  }

  return buf;
}

describe("sampleRateForClass", () => {
  it("maps class codes to sample rates", () => {
    expect(sampleRateForClass(VITA_FLEX_DAX_IQ_24_CLASS)).toBe(24_000);
    expect(sampleRateForClass(VITA_FLEX_DAX_IQ_48_CLASS)).toBe(48_000);
    expect(sampleRateForClass(VITA_FLEX_DAX_IQ_96_CLASS)).toBe(96_000);
    expect(sampleRateForClass(VITA_FLEX_DAX_IQ_192_CLASS)).toBe(192_000);
  });

  it("throws on unknown class code", () => {
    expect(() => sampleRateForClass(0x1234)).toThrow();
  });
});

describe.each([
  [VITA_FLEX_DAX_IQ_24_CLASS, 24_000],
  [VITA_FLEX_DAX_IQ_48_CLASS, 48_000],
  [VITA_FLEX_DAX_IQ_96_CLASS, 96_000],
  [VITA_FLEX_DAX_IQ_192_CLASS, 192_000],
])("VitaDaxIqPacket class=0x%s", (classCode, rate) => {
  it(`parses payload, scales by 1/32768, and reports sampleRate=${rate}`, () => {
    // Radio sends +/-32768 scale; verify we divide back into [-1, 1].
    const iWire = [32768, -32768, 16384, 0];
    const qWire = [0, 16384, -32768, 32768];
    const bytes = buildIqPacket(classCode, 0x42000001, 3, iWire, qWire);
    const p = new VitaDaxIqPacket(bytes);

    expect(p.classId.packetClassCode).toBe(classCode);
    expect(p.sampleRate).toBe(rate);
    expect(p.streamId).toBe(0x42000001);
    expect(p.header.packetCount).toBe(3);
    expect(p.numFrames).toBe(4);

    expect(Array.from(p.left)).toEqual([1, -1, 0.5, 0]);
    expect(Array.from(p.right)).toEqual([0, 0.5, -1, 1]);
  });
});

describe("VitaDaxIqPacket: rejects non-IQ class codes", () => {
  it("throws on DAX audio class", () => {
    const bytes = buildIqPacket(0x03e3, 0, 0, [0], [0]);
    expect(() => new VitaDaxIqPacket(bytes)).toThrow(/Not a DAX IQ/);
  });
});

describe.each([
  [VITA_FLEX_DAX_IQ_24_CLASS],
  [VITA_FLEX_DAX_IQ_48_CLASS],
  [VITA_FLEX_DAX_IQ_96_CLASS],
  [VITA_FLEX_DAX_IQ_192_CLASS],
])("parser dispatch for DAX IQ class=0x%s", (classCode) => {
  it("returns kind='daxIq' with a decoded VitaDaxIqPacket", () => {
    const bytes = buildIqPacket(classCode, 0x42000099, 0, [0], [0]);
    const parsed = parseVitaPacket(bytes);
    expect(parsed?.kind).toBe("daxIq");
    if (parsed?.kind === "daxIq") {
      expect(parsed.classId.packetClassCode).toBe(classCode);
      expect(parsed.streamId).toBe(0x42000099);
    }
  });
});
