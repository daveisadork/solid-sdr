import { describe, expect, it } from "vitest";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import { makeStatus } from "../helpers.js";

function futureDate(): string {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
}

function pastDate(): string {
  return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
}

describe("FeatureLicense subscription expiration", () => {
  it("marks smartsdr+ active when expiration is in the future", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when an unexpired smartsdr+ subscription arrives
    store.apply(
      makeStatus(
        `S1|license subscription name=smartsdr+ expiration=${futureDate()}`,
      ),
    );

    // then the plus flag is active
    const license = store.getFeatureLicense();
    expect(license?.smartSdrPlusActive).toBe(true);
    expect(license?.smartSdrPlusExpiration).toBeDefined();
  });

  it("marks smartsdr+ inactive when expiration is in the past", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when an expired smartsdr+ subscription arrives
    store.apply(
      makeStatus(
        `S1|license subscription name=smartsdr+ expiration=${pastDate()}`,
      ),
    );

    // then the plus flag is inactive
    const license = store.getFeatureLicense();
    expect(license?.smartSdrPlusActive).toBe(false);
    expect(license?.smartSdrPlusExpiration).toBeDefined();
  });

  it("marks smartsdr+ early access active when expiration is in the future", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when an unexpired early access subscription arrives
    store.apply(
      makeStatus(
        `S1|license subscription name=smartsdr+_early_access expiration=${futureDate()}`,
      ),
    );

    // then the early access flag is active
    const license = store.getFeatureLicense();
    expect(license?.smartSdrPlusEarlyAccessActive).toBe(true);
    expect(license?.smartSdrPlusEarlyAccessExpiration).toBeDefined();
  });

  it("marks smartsdr+ early access inactive when expiration is in the past", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when an expired early access subscription arrives
    store.apply(
      makeStatus(
        `S1|license subscription name=smartsdr+_early_access expiration=${pastDate()}`,
      ),
    );

    // then the early access flag is inactive
    const license = store.getFeatureLicense();
    expect(license?.smartSdrPlusEarlyAccessActive).toBe(false);
    expect(license?.smartSdrPlusEarlyAccessExpiration).toBeDefined();
  });

  it("marks smartsdr+ inactive when expiration is missing", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a smartsdr+ subscription arrives without an expiration
    store.apply(makeStatus("S1|license subscription name=smartsdr+"));

    // then the plus flag is inactive
    const license = store.getFeatureLicense();
    expect(license?.smartSdrPlusActive).toBe(false);
    expect(license?.smartSdrPlusExpiration).toBeUndefined();
  });

  it("marks smartsdr+ inactive when expiration is unparseable", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a smartsdr+ subscription arrives with an unparseable expiration
    store.apply(
      makeStatus(
        "S1|license subscription name=smartsdr+ expiration=not-a-date",
      ),
    );

    // then the plus flag is inactive
    const license = store.getFeatureLicense();
    expect(license?.smartSdrPlusActive).toBe(false);
    expect(license?.smartSdrPlusExpiration).toBeUndefined();
  });
});
