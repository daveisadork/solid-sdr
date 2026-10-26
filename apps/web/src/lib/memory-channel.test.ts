import { describe, expect, it } from "vitest";
import {
  formatMemoryChannelLabel,
  memoryChannelsByFrequency,
  stepMemoryChannel,
} from "./memory-channel";

const channels = [
  { id: "2", frequencyMHz: 14.074 },
  { id: "1", frequencyMHz: 7.074 },
  { id: "3", frequencyMHz: 21.074 },
  { id: "4", frequencyMHz: 14.074 },
  { id: "bad", frequencyMHz: Number.NaN },
];

describe("memoryChannelsByFrequency", () => {
  it("sorts by frequency and then by channel id", () => {
    expect(
      memoryChannelsByFrequency(channels).map((channel) => channel.id),
    ).toEqual(["1", "2", "4", "3"]);
  });
});

describe("stepMemoryChannel", () => {
  it("moves to the nearest channel above or below the slice", () => {
    expect(stepMemoryChannel(channels, 10, 1)?.id).toBe("2");
    expect(stepMemoryChannel(channels, 10, -1)?.id).toBe("1");
    expect(stepMemoryChannel(channels, 18, 1)?.id).toBe("3");
    // Two channels share 14.074 MHz. Down visits the higher id first.
    expect(stepMemoryChannel(channels, 18, -1)?.id).toBe("4");
    expect(stepMemoryChannel(channels, 18, -2)?.id).toBe("2");
  });

  it("skips a channel on the same hertz as the slice", () => {
    expect(stepMemoryChannel(channels, 14.074, 1)?.id).toBe("3");
    expect(stepMemoryChannel(channels, 14.074, -1)?.id).toBe("1");
  });

  it("wraps past either end of the list", () => {
    expect(stepMemoryChannel(channels, 10, 2)?.id).toBe("4");
    expect(stepMemoryChannel(channels, 10, 3)?.id).toBe("3");
    expect(stepMemoryChannel(channels, 10, 4)?.id).toBe("1");
    expect(stepMemoryChannel(channels, 21.074, 1)?.id).toBe("1");
    expect(stepMemoryChannel(channels, 7.074, -1)?.id).toBe("3");
    expect(stepMemoryChannel(channels, 30, 1)?.id).toBe("1");
    expect(stepMemoryChannel(channels, 3, -1)?.id).toBe("3");
  });

  it("ignores an empty step, a bad frequency, and an empty list", () => {
    expect(stepMemoryChannel(channels, 10, 0)).toBeUndefined();
    expect(stepMemoryChannel(channels, 10, 0.4)).toBeUndefined();
    expect(stepMemoryChannel(channels, Number.NaN, 1)).toBeUndefined();
    expect(stepMemoryChannel([], 10, 1)).toBeUndefined();
  });

  it("treats frequencies within the same hertz as the current channel", () => {
    const same = [{ id: "a", frequencyMHz: 14 }];
    expect(stepMemoryChannel(same, 14.0000004, 1)?.id).toBe("a");
    expect(stepMemoryChannel(same, 14.0000004, -1)?.id).toBe("a");
  });
});

describe("formatMemoryChannelLabel", () => {
  it("joins the name, frequency, and mode", () => {
    expect(
      formatMemoryChannelLabel({
        name: "FT8",
        frequencyMHz: 14.074,
        mode: "USB",
      }),
    ).toBe("FT8 14.074000 MHz USB");
  });

  it("omits a blank name", () => {
    expect(
      formatMemoryChannelLabel({
        name: "  ",
        frequencyMHz: 146.52,
        mode: "FM",
      }),
    ).toBe("146.520000 MHz FM");
  });

  it("returns nothing when the channel has no frequency", () => {
    expect(formatMemoryChannelLabel(undefined)).toBeUndefined();
    expect(
      formatMemoryChannelLabel({ frequencyMHz: Number.NaN }),
    ).toBeUndefined();
  });
});
