import { describe, expect, it } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import { createDisplayMarkerSnapshot } from "../../src/flex/state/display-marker.js";
import {
  createRadioStateStore,
  type RadioStateChange,
} from "../../src/flex/state/index.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";

describe("Display marker snapshot", () => {
  it("parses all wire attributes on first creation", () => {
    const attributes: Record<string, string> = {
      group: "IARU3",
      id: "58",
      label: "All Modes",
      start_freq: "29.100000",
      stop_freq: "29.300000",
      color: "gray",
      opacity: "30",
    };

    const { snapshot, diff } = createDisplayMarkerSnapshot(
      "IARU3",
      "58",
      attributes,
    );

    expect(snapshot.id).toBe("58");
    expect(snapshot.group).toBe("IARU3");
    expect(snapshot.label).toBe("All Modes");
    expect(snapshot.startFrequencyMHz).toBeCloseTo(29.1);
    expect(snapshot.stopFrequencyMHz).toBeCloseTo(29.3);
    expect(snapshot.colorName).toBe("gray");
    expect(snapshot.opacity).toBe(30);
    expect(diff.id).toBe("58");
  });

  it("incrementally updates from a previous snapshot", () => {
    const { snapshot: previous } = createDisplayMarkerSnapshot(
      "IARU3",
      "58",
      {
        group: "IARU3",
        id: "58",
        label: "All Modes",
        start_freq: "29.100000",
        stop_freq: "29.300000",
        color: "gray",
        opacity: "30",
      },
    );

    const { snapshot, diff } = createDisplayMarkerSnapshot(
      "IARU3",
      "58",
      { color: "Blue", opacity: "50" },
      previous,
    );

    expect(snapshot.group).toBe("IARU3");
    expect(snapshot.id).toBe("58");
    expect(snapshot.label).toBe("All Modes");
    expect(snapshot.colorName).toBe("Blue");
    expect(snapshot.opacity).toBe(50);
    expect(diff.colorName).toBe("Blue");
    expect(diff.opacity).toBe(50);
    expect(diff.label).toBeUndefined();
  });
});

describe("Display marker store integration", () => {
  it("handles display_marker status messages for create, update, and remove", () => {
    const store = createRadioStateStore();

    const createChanges = store.apply(
      makeStatus(
        'S10AF6D40|display_marker group=IARU3 id=58 label="All Modes" start_freq=29.100000 stop_freq=29.300000 color=gray opacity=30',
      ),
    );

    expect(store.getDisplayMarker("IARU3", "58")).toBeDefined();
    expect(store.getDisplayMarker("IARU3", "58")?.label).toBe("All Modes");
    expect(store.getDisplayMarkers()).toHaveLength(1);
    expect(createChanges[0]).toMatchObject({
      entity: "displayMarker",
      group: "IARU3",
      id: "58",
      removed: false,
    });

    const updateChanges = store.apply(
      makeStatus("S2|display_marker group=IARU3 id=58 color=Blue opacity=50"),
    );

    expect(store.getDisplayMarker("IARU3", "58")?.colorName).toBe("Blue");
    expect(store.getDisplayMarker("IARU3", "58")?.opacity).toBe(50);
    expect(updateChanges).toHaveLength(1);

    const removeChanges = store.apply(
      makeStatus("S3|display_marker group=IARU3 id=58 removed=1"),
    );

    expect(store.getDisplayMarker("IARU3", "58")).toBeUndefined();
    expect(store.getDisplayMarkers()).toHaveLength(0);
    expect(removeChanges[0]).toMatchObject({
      entity: "displayMarker",
      group: "IARU3",
      id: "58",
      removed: true,
    });
  });

  it("patchDisplayMarker applies attributes optimistically", () => {
    const store = createRadioStateStore();
    store.apply(
      makeStatus(
        'S10AF6D40|display_marker group=IARU3 id=58 label="All Modes" start_freq=29.100000 stop_freq=29.300000 color=gray opacity=30',
      ),
    );

    const change = store.patchDisplayMarker("IARU3", "58", {
      color: "Green",
    });

    expect(store.getDisplayMarker("IARU3", "58")?.colorName).toBe("Green");
    expect(change).toBeDefined();
    expect(change?.entity).toBe("displayMarker");
  });
});

describe("Display marker controller", () => {
  it("tracks marker state and emits change events", async () => {
    const { radio, connection } = await createConnectedRadio();

    expect(connection.commands).toContain("sub display_marker all");

    connection.emitStatus(
      'S10AF6D40|display_marker group=IARU3 id=58 label="All Modes" start_freq=29.100000 stop_freq=29.300000 color=gray opacity=30',
    );

    const controller = radio.displayMarker("IARU3", "58");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("display marker controller not created");

    expect(controller.group).toBe("IARU3");
    expect(controller.id).toBe("58");
    expect(controller.label).toBe("All Modes");
    expect(controller.startFrequencyMHz).toBeCloseTo(29.1);
    expect(controller.stopFrequencyMHz).toBeCloseTo(29.3);
    expect(controller.colorName).toBe("gray");
    expect(controller.opacity).toBe(30);
    expect(radio.displayMarkers()).toHaveLength(1);

    const changes: RadioStateChange[] = [];
    controller.on("change", (change) => {
      changes.push(change);
    });

    connection.emitStatus(
      "S2|display_marker group=IARU3 id=58 color=Blue opacity=50",
    );

    expect(controller.colorName).toBe("Blue");
    expect(controller.opacity).toBe(50);
    expect(changes).toHaveLength(1);

    connection.emitStatus("S3|display_marker group=IARU3 id=58 removed=1");

    expect(radio.displayMarker("IARU3", "58")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });
});
