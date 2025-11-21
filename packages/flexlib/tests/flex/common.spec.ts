import { describe, expect, it } from "vitest";
import { parseIntegerHex } from "../../src/flex/state/common.js";

describe("parseIntegerHex", () => {
  it("parses hex strings without 0x", () => {
    expect(parseIntegerHex("7F7C21E0")).toBe(0x7f7c21e0);
  });

  it("parses hex strings with 0x prefix", () => {
    expect(parseIntegerHex("0x7F7C21E0")).toBe(0x7f7c21e0);
  });

  it("returns undefined for invalid input", () => {
    expect(parseIntegerHex("not-a-number")).toBeUndefined();
  });
});
