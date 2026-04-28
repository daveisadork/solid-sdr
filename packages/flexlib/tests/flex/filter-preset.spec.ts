import { describe, expect, it, vi } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import {
  createFilterPresetSnapshot,
  filterPresetModeGroupFromSliceMode,
} from "../../src/flex/state/filter-preset.js";
import {
  createRadioStateStore,
  type RadioStateChange,
} from "../../src/flex/state/index.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";

describe("Filter preset snapshot", () => {
  it("parses a single preset update into the fixed group layout", () => {
    const { snapshot, diff } = createFilterPresetSnapshot("ssb", 0, {
      name: "2.7k",
      low: "100",
      high: "2800",
    });

    expect(snapshot.ssb).toHaveLength(6);
    expect(snapshot.cw).toHaveLength(6);
    expect(snapshot.ssb[0]).toEqual({
      index: 0,
      name: "2.7k",
      filterLowHz: 100,
      filterHighHz: 2800,
    });
    expect(snapshot.ssb[1]).toEqual({
      index: 1,
      name: "N/A",
      filterLowHz: 0,
      filterHighHz: 0,
    });
    expect(diff.ssb?.[0]?.name).toBe("2.7k");
  });

  it("maps slice modes onto filter preset mode groups", () => {
    expect(filterPresetModeGroupFromSliceMode("USB")).toBe("ssb");
    expect(filterPresetModeGroupFromSliceMode("DIGU")).toBe("digital");
    expect(filterPresetModeGroupFromSliceMode("SAM")).toBe("am");
    expect(filterPresetModeGroupFromSliceMode("RTTY")).toBe("rtty");
    expect(filterPresetModeGroupFromSliceMode("FM")).toBeUndefined();
  });
});

describe("Filter preset store integration", () => {
  it("handles filt_preset status messages and optimistic patches", () => {
    const store = createRadioStateStore();

    const createChanges = store.apply(
      makeStatus("S1|filt_preset ssb 0 name=2.7k low=100 high=2800"),
    );

    expect(store.getFilterPresets()?.ssb[0]).toEqual({
      index: 0,
      name: "2.7k",
      filterLowHz: 100,
      filterHighHz: 2800,
    });
    expect(createChanges[0]).toMatchObject({
      entity: "filterPreset",
      removed: false,
    });

    const patchChange = store.patchFilterPreset("ssb", 0, {
      name: "2.9k",
      low: "150",
      high: "2950",
    });

    expect(store.getFilterPresets()?.ssb[0]).toEqual({
      index: 0,
      name: "2.9k",
      filterLowHz: 150,
      filterHighHz: 2950,
    });
    expect(patchChange).toMatchObject({
      entity: "filterPreset",
      removed: false,
    });
  });
});

describe("Filter preset controller", () => {
  it("tracks radio state and sends save/reset commands", async () => {
    const { radio, connection } = await createConnectedRadio();

    expect(connection.commands).toContain("sub filt_preset all");

    const controller = radio.filterPresets();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);

    connection.emitStatus("S1|filt_preset ssb 0 name=2.7k low=100 high=2800");
    connection.emitStatus("S1|filt_preset cw 1 name=400 low=-200 high=200");

    expect(controller.ssb[0]).toEqual({
      index: 0,
      name: "2.7k",
      filterLowHz: 100,
      filterHighHz: 2800,
    });
    expect(controller.preset("cw", 1)).toEqual({
      index: 1,
      name: "400",
      filterLowHz: -200,
      filterHighHz: 200,
    });

    const changes: RadioStateChange[] = [];
    controller.on("change", (change) => {
      changes.push(change);
    });

    await controller.save("ssb", 0, {
      name: "2.9k",
      filterLowHz: 150,
      filterHighHz: 2950,
    });

    expect(connection.lastCommand()).toBe(
      "filt_preset save group=ssb num=0 low=150 high=2950 name=2.9k",
    );
    expect(controller.ssb[0]).toEqual({
      index: 0,
      name: "2.9k",
      filterLowHz: 150,
      filterHighHz: 2950,
    });
    expect(changes).toHaveLength(1);

    await controller.reset("cw");
    expect(connection.lastCommand()).toBe("filt_preset reset group=cw");
  });

  it("resubscribes on save failure after optimistic patch", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|filt_preset ssb 0 name=2.7k low=100 high=2800");
    connection.prepareResponse("filt_preset save", {
      accepted: false,
      code: 0x50000015,
    });

    await expect(
      radio.filterPresets().save("ssb", 0, {
        name: "3.0k",
        filterLowHz: 200,
        filterHighHz: 3000,
      }),
    ).rejects.toThrow();

    expect(connection.commands.at(-1)).toBe("sub filt_preset all");
  });

  it("emits change events from inbound status updates", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|filt_preset ssb 0 name=2.7k low=100 high=2800");

    const controller = radio.filterPresets();
    const changeSpy = vi.fn();
    controller.on("change", changeSpy);

    connection.emitStatus("S2|filt_preset ssb 0 low=150 high=2900");

    expect(controller.ssb[0].filterLowHz).toBe(150);
    expect(controller.ssb[0].filterHighHz).toBe(2900);
    expect(changeSpy).toHaveBeenCalledTimes(1);
  });
});
