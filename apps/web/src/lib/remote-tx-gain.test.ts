import { describe, expect, it } from "vitest";
import { micLevelToGain } from "./remote-tx-gain";

describe("micLevelToGain", () => {
  it("is mute at 0 and below", () => {
    expect(micLevelToGain(0)).toBe(0);
    expect(micLevelToGain(-5)).toBe(0);
  });

  it("is linear from mute to unity", () => {
    expect(micLevelToGain(25)).toBe(0.5);
    expect(micLevelToGain(50)).toBe(1);
  });

  it("is +10 dB at 75 and +20 dB at 100", () => {
    expect(micLevelToGain(75)).toBeCloseTo(10 ** 0.5);
    expect(micLevelToGain(100)).toBe(10);
    expect(micLevelToGain(140)).toBe(10);
  });
});
