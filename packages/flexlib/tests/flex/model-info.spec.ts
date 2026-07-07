import { describe, expect, it } from "vitest";
import {
  DEFAULT_RADIO_MODEL_INFO,
  getModelInfo,
  KNOWN_RADIO_MODEL_NAMES,
} from "../../src/flex/model-info.js";

describe("getModelInfo", () => {
  it("returns SmartSDR-style static capabilities for known models", () => {
    const info = getModelInfo("FLEX-6700");

    expect(info.modelName).toBe("FLEX-6700");
    expect(info.maxDaxIqChannels).toBe(4);
    expect(info.daxIqSampleRates).toEqual([24000, 48000, 96000, 192000]);
    expect(info.maxSliceCount).toBe(8);
    expect(info.sliceNames).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(info.imageName).toBe("6000-Cutout.png");
  });

  it("normalizes model names before lookup", () => {
    const info = getModelInfo("  au-520m  ");

    expect(info.modelName).toBe("AU-520M");
    expect(info.isMModel).toBe(true);
    expect(info.isDiversityAllowed).toBe(true);
    expect(info.maxDaxIqChannels).toBe(4);
    expect(info.daxIqSampleRates).toEqual([24000, 48000, 96000, 192000]);
    expect(info.imageName).toBe("A520M.png");
  });

  it("exposes per-model DAX IQ sample-rate support", () => {
    expect(getModelInfo("FLEX-6400").daxIqSampleRates).toEqual([
      24000, 48000, 96000,
    ]);
    expect(getModelInfo("RT-2122").daxIqSampleRates).toEqual([
      24000, 48000, 96000, 192000,
    ]);
    expect(DEFAULT_RADIO_MODEL_INFO.daxIqSampleRates).toEqual([]);
  });

  it("falls back to the DEFAULT model info for unknown radios", () => {
    expect(getModelInfo("not-a-real-model")).toBe(DEFAULT_RADIO_MODEL_INFO);
    expect(getModelInfo("")).toBe(DEFAULT_RADIO_MODEL_INFO);
    expect(getModelInfo(undefined)).toBe(DEFAULT_RADIO_MODEL_INFO);
  });

  it("exposes the canonical known model name list without DEFAULT", () => {
    expect(KNOWN_RADIO_MODEL_NAMES).toContain("FLEX-6600");
    expect(KNOWN_RADIO_MODEL_NAMES).toContain("AU-510");
    expect(KNOWN_RADIO_MODEL_NAMES).not.toContain("DEFAULT");
  });
});
