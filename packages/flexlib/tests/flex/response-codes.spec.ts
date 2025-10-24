import { describe, expect, it } from "vitest";
import {
  describeResponseCode,
  isKnownResponseCode,
} from "../../src/flex/response-codes.js";

describe("response codes", () => {
  it("maps known error codes to descriptions", () => {
    expect(describeResponseCode(0x50000001)).toBe(
      "Unable to get foundation receiver assignment",
    );
    expect(isKnownResponseCode(0x50000001)).toBe(true);
  });

  it("returns undefined for unknown codes", () => {
    expect(describeResponseCode(123456)).toBeUndefined();
    expect(isKnownResponseCode(123456)).toBe(false);
  });
});
