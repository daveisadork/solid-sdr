import { describe, it, expect } from "vitest";
import { convertVitaToDb, padToWordBoundary, emptyTrailer } from "@vita/common";

const enc = new TextEncoder();

describe("common: convertVitaToDb", () => {
  // raw is a 32-bit number whose low 16 bits represent a signed 16-bit value
  it("handles zero", () => {
    expect(convertVitaToDb(0x0000)).toBe(0);
  });

  it("handles positive values", () => {
    // +127 -> 127 / 128
    expect(convertVitaToDb(0x007f)).toBeCloseTo(127 / 128, 6);
    // +128 -> 1.0
    expect(convertVitaToDb(0x0080)).toBeCloseTo(1.0, 6);
  });

  it("handles negative values", () => {
    // -128 => 0xFF80 -> -1.0
    expect(convertVitaToDb(0xff80)).toBeCloseTo(-1.0, 6);
    // -32768 => 0x8000 -> -256.0
    expect(convertVitaToDb(0x8000)).toBeCloseTo(-256.0, 6);
  });
});

describe("common: padToWordBoundary", () => {
  function byteLen(s: string) {
    return enc.encode(s).length;
  }

  it("returns original if already 4-byte aligned", () => {
    const s = "ABCD"; // 4 bytes
    const out = padToWordBoundary(s);
    expect(out).toBe(s);
    expect(byteLen(out) % 4).toBe(0);
  });

  it("pads ASCII strings to 4-byte alignment", () => {
    const s = "ABC"; // 3 bytes
    const out = padToWordBoundary(s);
    expect(byteLen(out) % 4).toBe(0);
    expect(out.startsWith("ABC")).toBe(true);
  });

  it("pads multibyte UTF-8 correctly (é is 2 bytes)", () => {
    const s = "é"; // 2 bytes
    const out = padToWordBoundary(s);
    expect(byteLen(out) % 4).toBe(0);
  });

  it("pads 3-byte chars correctly (猫 is 3 bytes)", () => {
    const s = "猫"; // 3 bytes
    const out = padToWordBoundary(s);
    expect(byteLen(out) % 4).toBe(0);
  });
});

describe("common: emptyTrailer", () => {
  it("produces an all-false trailer with zero count", () => {
    const t = emptyTrailer();
    expect(Object.values(t).includes(true)).toBe(false);
    expect(t.associatedContextPacketCount).toBe(0);
  });
});
