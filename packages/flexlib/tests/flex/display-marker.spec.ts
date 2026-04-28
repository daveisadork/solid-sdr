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
      group: "IARU1",
      id: "1",
      label: '"160m\u007fCW"',
      start_freq: "1.810000",
      stop_freq: "1.838000",
      color: "Orange",
      opacity: "35",
    };

    const { snapshot, diff } = createDisplayMarkerSnapshot(
      "IARU1",
      "1",
      attributes,
    );

    expect(snapshot.id).toBe("1");
    expect(snapshot.group).toBe("IARU1");
    expect(snapshot.label).toBe("160m CW");
    expect(snapshot.startFrequencyMHz).toBeCloseTo(1.81);
    expect(snapshot.stopFrequencyMHz).toBeCloseTo(1.838);
    expect(snapshot.colorName).toBe("Orange");
    expect(snapshot.opacity).toBe(35);
    expect(diff.id).toBe("1");
  });

  it("incrementally updates from a previous snapshot", () => {
    const { snapshot: previous } = createDisplayMarkerSnapshot(
      "IARU1",
      "1",
      {
        group: "IARU1",
        id: "1",
        label: "160m\u007fCW",
        start_freq: "1.810000",
        stop_freq: "1.838000",
        color: "Orange",
        opacity: "35",
      },
    );

    const { snapshot, diff } = createDisplayMarkerSnapshot(
      "IARU1",
      "1",
      { color: "Blue", opacity: "50" },
      previous,
    );

    expect(snapshot.group).toBe("IARU1");
    expect(snapshot.id).toBe("1");
    expect(snapshot.label).toBe("160m CW");
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
        "S1|display_marker group=IARU1 id=1 label=160m\u007fCW start_freq=1.810000 stop_freq=1.838000 color=Orange opacity=35",
      ),
    );

    expect(store.getDisplayMarker("IARU1", "1")).toBeDefined();
    expect(store.getDisplayMarker("IARU1", "1")?.label).toBe("160m CW");
    expect(store.getDisplayMarkers()).toHaveLength(1);
    expect(createChanges[0]).toMatchObject({
      entity: "displayMarker",
      group: "IARU1",
      id: "1",
      removed: false,
    });

    const updateChanges = store.apply(
      makeStatus("S2|display_marker group=IARU1 id=1 color=Blue opacity=50"),
    );

    expect(store.getDisplayMarker("IARU1", "1")?.colorName).toBe("Blue");
    expect(store.getDisplayMarker("IARU1", "1")?.opacity).toBe(50);
    expect(updateChanges).toHaveLength(1);

    const removeChanges = store.apply(
      makeStatus("S3|display_marker group=IARU1 id=1 removed=1"),
    );

    expect(store.getDisplayMarker("IARU1", "1")).toBeUndefined();
    expect(store.getDisplayMarkers()).toHaveLength(0);
    expect(removeChanges[0]).toMatchObject({
      entity: "displayMarker",
      group: "IARU1",
      id: "1",
      removed: true,
    });
  });

  it("patchDisplayMarker applies attributes optimistically", () => {
    const store = createRadioStateStore();
    store.apply(
      makeStatus(
        "S1|display_marker group=IARU1 id=1 label=160m\u007fCW start_freq=1.810000 stop_freq=1.838000 color=Orange opacity=35",
      ),
    );

    const change = store.patchDisplayMarker("IARU1", "1", {
      color: "Green",
    });

    expect(store.getDisplayMarker("IARU1", "1")?.colorName).toBe("Green");
    expect(change).toBeDefined();
    expect(change?.entity).toBe("displayMarker");
  });
});

describe("Display marker controller", () => {
  it("tracks marker state and emits change events", async () => {
    const { radio, connection } = await createConnectedRadio();

    expect(connection.commands).toContain("sub display_marker all");

    connection.emitStatus(
      "S1|display_marker group=IARU1 id=1 label=160m\u007fCW start_freq=1.810000 stop_freq=1.838000 color=Orange opacity=35",
    );

    const controller = radio.displayMarker("IARU1", "1");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("display marker controller not created");

    expect(controller.group).toBe("IARU1");
    expect(controller.id).toBe("1");
    expect(controller.label).toBe("160m CW");
    expect(controller.startFrequencyMHz).toBeCloseTo(1.81);
    expect(controller.stopFrequencyMHz).toBeCloseTo(1.838);
    expect(controller.colorName).toBe("Orange");
    expect(controller.opacity).toBe(35);
    expect(radio.displayMarkers()).toHaveLength(1);

    const changes: RadioStateChange[] = [];
    controller.on("change", (change) => {
      changes.push(change);
    });

    connection.emitStatus(
      "S2|display_marker group=IARU1 id=1 color=Blue opacity=50",
    );

    expect(controller.colorName).toBe("Blue");
    expect(controller.opacity).toBe(50);
    expect(changes).toHaveLength(1);

    connection.emitStatus("S3|display_marker group=IARU1 id=1 removed=1");

    expect(radio.displayMarker("IARU1", "1")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });
});
