import { describe, it, expect } from "vitest";
import { VitaFrequency } from "@util/vita-frequency";

describe("VitaFrequency: constructors and accessors", () => {
  it("fromHz -> raw -> freqHz round-trip", () => {
    const vf = VitaFrequency.fromHz(25); // 25 Hz
    // raw = 25 * 2^20
    const expectedRaw = 25n * (1n << 20n);
    expect(vf.raw).toBe(expectedRaw);
    expect(vf.freqHz).toBe(25);
    expect(vf.freqMhz).toBeCloseTo(0.000025, 12);
  });

  it("fromMHz uses truncation like the C# cast", () => {
    const mhz = 14.2;
    const vf = VitaFrequency.fromMHz(mhz);
    // raw = trunc(mhz * 1.048576e12)
    const expectedRaw = BigInt(Math.trunc(mhz * 1.048576e12));
    expect(vf.raw).toBe(expectedRaw);
    // Hz should be exactly 14,200,000
    expect(vf.freqHz).toBe(14_200_000);
    expect(vf.freqMhz).toBeCloseTo(14.2, 12);
  });

  it("fromRaw preserves exact value", () => {
    const raw = 123456789n << 20n; // exact Hz = 123456789
    const vf = VitaFrequency.fromRaw(raw);
    expect(vf.raw).toBe(raw);
    expect(vf.freqHz).toBe(123_456_789);
  });

  it("handles negative values (signed Q20)", () => {
    const vf = VitaFrequency.fromHz(-1000);
    expect(vf.freqHz).toBe(-1000);
    // raw should be -1000 * 2^20
    expect(vf.raw).toBe(-1000n * (1n << 20n));
  });
});

describe("VitaFrequency: setters and equality", () => {
  it("setHz and setMhz mutate and chain", () => {
    const vf = VitaFrequency.fromHz(0);
    vf.setHz(7_000_000).setMhz(14.2);
    expect(vf.freqHz).toBe(14_200_000);
  });

  it("equals compares raw values", () => {
    const a = VitaFrequency.fromMHz(14.2);
    const b = VitaFrequency.fromRaw(a.raw);
    const c = VitaFrequency.fromHz(14_200_001);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe("VitaFrequency: string/JSON helpers", () => {
  it("toString formats MHz with 6 decimals", () => {
    const vf = VitaFrequency.fromHz(10_000_000); // 10 MHz
    expect(vf.toString()).toBe("10.000000 MHz");
  });

  it("toJSON returns stringified bigint fields", () => {
    const vf = VitaFrequency.fromHz(1_234_567);
    const j = vf.toJSON();
    expect(j.hz).toBe("1234567");
    expect(typeof j.raw).toBe("string");
    // raw divided by 2^20 equals 1_234_567
    expect(BigInt(j.raw) >> 20n).toBe(1_234_567n);
  });
});

describe("VitaFrequency: large raw values remain safe as number Hz", () => {
  it("freqHz for max 64-bit signed raw stays finite", () => {
    const maxInt64 = (1n << 63n) - 1n;
    const vf = VitaFrequency.fromRaw(maxInt64);
    // Hz ≈ (2^63-1) / 2^20 ≈ 8.79e12 — well below Number.MAX_SAFE_INTEGER
    expect(Number.isFinite(vf.freqHz)).toBe(true);
    expect(vf.freqHz).toBeGreaterThan(8e12);
    expect(vf.freqHz).toBeLessThan(9e12);
  });
});
