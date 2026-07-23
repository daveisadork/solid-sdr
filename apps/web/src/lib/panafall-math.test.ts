import { describe, expect, it } from "vitest";
import {
  freqToX,
  mhzPerPx,
  mhzToPx,
  type PanScale,
  pxPerMHz,
  pxToMHz,
  xToFreq,
} from "./panafall-math";

const scale: PanScale = { width: 1600, centerMHz: 14.2, bandwidthMHz: 0.2 };

describe("scale factors", () => {
  it("pxPerMHz and mhzPerPx are reciprocal", () => {
    expect(pxPerMHz(scale)).toBeCloseTo(8000, 10);
    expect(mhzPerPx(scale)).toBeCloseTo(1 / 8000, 15);
    expect(pxPerMHz(scale) * mhzPerPx(scale)).toBeCloseTo(1, 12);
  });

  it("degenerate scales return 0 everywhere", () => {
    for (const bad of [
      { width: 0, centerMHz: 14.2, bandwidthMHz: 0.2 },
      { width: 1600, centerMHz: 14.2, bandwidthMHz: 0 },
    ]) {
      expect(pxPerMHz(bad)).toBe(0);
      expect(mhzPerPx(bad)).toBe(0);
      expect(mhzToPx(bad, 1)).toBe(0);
      expect(pxToMHz(bad, 100)).toBe(0);
      expect(xToFreq(bad, 100)).toBe(0);
      expect(freqToX(bad, 14.2)).toBe(0);
    }
  });
});

describe("center invariant", () => {
  it("center of the canvas is the center frequency", () => {
    expect(xToFreq(scale, scale.width / 2)).toBe(scale.centerMHz);
    expect(freqToX(scale, scale.centerMHz)).toBe(scale.width / 2);
  });
});

describe("round trips", () => {
  it("freqToX(xToFreq(x)) returns x within rounding", () => {
    for (const x of [0, 1, 123.4, 800, 1234.5, 1600]) {
      expect(freqToX(scale, xToFreq(scale, x))).toBeCloseTo(x, 2);
    }
  });

  it("xToFreq(freqToX(f)) returns f within 1e-6 MHz rounding", () => {
    for (const f of [14.1, 14.15, 14.2, 14.2500005, 14.3]) {
      expect(xToFreq(scale, freqToX(scale, f))).toBeCloseTo(f, 6);
    }
  });
});
