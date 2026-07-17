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

/**
 * Characterization of the legacy context/panafall.tsx implementations, both
 * enableTransparencyEffects branches. The unified implementation must match
 * the transparency-ON branch exactly (originLeft = 0), and reproduce the OFF
 * branch when the legacy bounds-left origin is passed explicitly.
 */
function legacyXToFreq(
  s: PanScale,
  x: number,
  transparency: boolean,
  boundsLeft: number,
): number {
  if (!s.bandwidthMHz || !s.width) return 0;
  const offsetPx = transparency ? x : x - boundsLeft;
  const offsetMHz = pxToMHz(s, offsetPx - s.width / 2);
  return Math.round((s.centerMHz + offsetMHz) * 1e6) / 1e6;
}

function legacyFreqToX(
  s: PanScale,
  freq: number,
  transparency: boolean,
  boundsLeft: number,
): number {
  if (!s.bandwidthMHz || !s.width) return 0;
  const offsetPx = transparency ? 0 : boundsLeft;
  return s.width / 2 + mhzToPx(s, freq - s.centerMHz) + offsetPx;
}

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

describe("legacy equivalence", () => {
  const xs = [0, 37.5, 400, 800, 1024.25, 1600];
  const freqs = [14.1, 14.180000123, 14.2, 14.29];

  it("matches the transparency-ON branch with default originLeft", () => {
    for (const x of xs) {
      expect(xToFreq(scale, x)).toBe(legacyXToFreq(scale, x, true, 999));
    }
    for (const f of freqs) {
      expect(freqToX(scale, f)).toBe(legacyFreqToX(scale, f, true, 999));
    }
  });

  it("matches the transparency-OFF branch when originLeft is the bounds left", () => {
    const boundsLeft = 256;
    for (const x of xs) {
      expect(xToFreq(scale, x, boundsLeft)).toBe(
        legacyXToFreq(scale, x, false, boundsLeft),
      );
    }
    for (const f of freqs) {
      expect(freqToX(scale, f, boundsLeft)).toBe(
        legacyFreqToX(scale, f, false, boundsLeft),
      );
    }
  });

  it("the two branches agree when boundsLeft is 0 (today's shipping geometry)", () => {
    for (const x of xs) {
      expect(legacyXToFreq(scale, x, true, 0)).toBe(
        legacyXToFreq(scale, x, false, 0),
      );
    }
  });
});
