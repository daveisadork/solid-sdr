import { describe, expect, it } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";
import { createTnfSnapshot } from "../../src/flex/state/tnf.js";

describe("TNF snapshot", () => {
  it("parses all wire attributes on first creation", () => {
    // given a set of wire attributes for a new TNF
    const attributes: Record<string, string> = {
      freq: "14.200000",
      depth: "2",
      width: "0.000100",
      permanent: "1",
    };

    // when we create a snapshot
    const { snapshot, diff } = createTnfSnapshot("1", attributes);

    // then all fields are populated
    expect(snapshot.id).toBe("1");
    expect(snapshot.frequencyMHz).toBeCloseTo(14.2);
    expect(snapshot.depth).toBe(2);
    expect(snapshot.bandwidthMHz).toBeCloseTo(0.0001);
    expect(snapshot.permanent).toBe(true);
    // and the diff includes the id (first creation)
    expect(diff.id).toBe("1");
  });

  it("incrementally updates from a previous snapshot", () => {
    // given an existing snapshot
    const { snapshot: previous } = createTnfSnapshot("1", {
      freq: "14.200000",
      depth: "1",
      width: "0.000100",
      permanent: "0",
    });

    // when an incremental update arrives with only changed fields
    const { snapshot, diff } = createTnfSnapshot(
      "1",
      { depth: "3", permanent: "1" },
      previous,
    );

    // then unchanged fields are preserved from previous
    expect(snapshot.frequencyMHz).toBeCloseTo(14.2);
    expect(snapshot.bandwidthMHz).toBeCloseTo(0.0001);
    // and changed fields are updated
    expect(snapshot.depth).toBe(3);
    expect(snapshot.permanent).toBe(true);
    // and diff only contains the changed fields
    expect(diff.depth).toBe(3);
    expect(diff.permanent).toBe(true);
    expect(diff.frequencyMHz).toBeUndefined();
    // and id is not in the diff for incremental updates
    expect(diff.id).toBeUndefined();
  });
});

describe("TNF store integration", () => {
  it("handles tnf status messages for create, update, and remove", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a new tnf status arrives
    const createChanges = store.apply(
      makeStatus("S1|tnf 1 freq=14.200000 depth=2 width=0.000100 permanent=0"),
    );

    // then the store contains the tnf
    expect(store.getTnf("1")).toBeDefined();
    expect(store.getTnf("1")?.frequencyMHz).toBeCloseTo(14.2);
    expect(store.getTnf("1")?.depth).toBe(2);
    expect(store.getTnfs()).toHaveLength(1);
    expect(createChanges).toHaveLength(1);
    expect(createChanges[0]).toMatchObject({
      entity: "tnf",
      id: "1",
      removed: false,
    });

    // when an update arrives
    const updateChanges = store.apply(
      makeStatus("S2|tnf 1 depth=3 permanent=1"),
    );

    // then the snapshot reflects the update
    expect(store.getTnf("1")?.depth).toBe(3);
    expect(store.getTnf("1")?.permanent).toBe(true);
    expect(updateChanges).toHaveLength(1);

    // when a removal status arrives
    const removeChanges = store.apply(makeStatus("S3|tnf 1 removed"));

    // then the tnf is gone
    expect(store.getTnf("1")).toBeUndefined();
    expect(store.getTnfs()).toHaveLength(0);
    expect(removeChanges[0]).toMatchObject({
      entity: "tnf",
      id: "1",
      removed: true,
    });
  });

  it("patchTnf applies attributes optimistically", () => {
    // given a store with an existing tnf
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|tnf 1 freq=14.200000 depth=2 width=0.000100"));

    // when we optimistically patch
    const change = store.patchTnf("1", { depth: "3" });

    // then the snapshot is updated and a change is returned
    expect(store.getTnf("1")?.depth).toBe(3);
    expect(change).toBeDefined();
    expect(change?.entity).toBe("tnf");
  });

  it("removeTnf removes an existing tnf", () => {
    // given a store with an existing tnf
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|tnf 1 freq=14.200000 depth=2 width=0.000100"));

    // when we remove it
    const change = store.removeTnf("1");

    // then it's gone and a change is returned
    expect(store.getTnf("1")).toBeUndefined();
    expect(change).toMatchObject({ entity: "tnf", id: "1", removed: true });
  });

  it("removeTnf returns undefined for unknown id", () => {
    // given an empty store
    const store = createRadioStateStore();

    // when we try to remove a nonexistent tnf
    const change = store.removeTnf("99");

    // then no change is returned
    expect(change).toBeUndefined();
  });

  it("snapshot includes tnfs array", () => {
    // given a store with tnfs
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|tnf 1 freq=14.200000 depth=1 width=0.000100"));
    store.apply(makeStatus("S2|tnf 2 freq=7.050000 depth=2 width=0.000200"));

    // when we take a snapshot
    const snap = store.snapshot();

    // then tnfs are included
    expect(snap.tnfs).toHaveLength(2);
  });
});

describe("TNF controller", () => {
  it("tracks tnf state and emits change events", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // when a tnf status arrives
    connection.emitStatus(
      "S1|tnf 1 freq=14.200000 depth=2 width=0.000100 permanent=0",
    );

    // then the controller is accessible and has correct values
    const controller = radio.tnf("1");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("tnf controller not created");

    expect(controller.frequencyMHz).toBeCloseTo(14.2);
    expect(controller.depth).toBe(2);
    expect(controller.bandwidthMHz).toBeCloseTo(0.0001);
    expect(controller.permanent).toBe(false);
    expect(radio.tnfs()).toHaveLength(1);

    // given a change listener
    const changes: RadioStateChange[] = [];
    controller.on("change", (change) => {
      changes.push(change);
    });

    // when an update arrives
    connection.emitStatus("S2|tnf 1 depth=3 permanent=1");

    // then the controller reflects updates and the change event fired
    expect(controller.depth).toBe(3);
    expect(controller.permanent).toBe(true);
    expect(changes).toHaveLength(1);

    // when a removal status arrives
    connection.emitStatus("S3|tnf 1 removed");

    // then the controller is no longer accessible and snapshot throws
    expect(radio.tnf("1")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });

  it("sends tnf set commands for property changes", async () => {
    // given a connected radio with a tnf
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|tnf 1 freq=14.200000 depth=2 width=0.000100 permanent=0",
    );
    const controller = radio.tnf("1")!;

    // when we set properties
    await controller.setFrequency(7.05);
    expect(connection.lastCommand()).toBe("tnf set 1 freq=7.050000");

    await controller.setDepth(3);
    expect(connection.lastCommand()).toBe("tnf set 1 depth=3");

    await controller.setBandwidth(0.0002);
    expect(connection.lastCommand()).toBe("tnf set 1 width=0.000200");

    await controller.setPermanent(true);
    expect(connection.lastCommand()).toBe("tnf set 1 permanent=1");
  });

  it("clamps depth to 1-3 range", async () => {
    // given a connected radio with a tnf
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|tnf 1 freq=14.200000 depth=2 width=0.000100");
    const controller = radio.tnf("1")!;

    // when we set depth below minimum
    await controller.setDepth(0);
    expect(connection.lastCommand()).toBe("tnf set 1 depth=1");

    // when we set depth above maximum
    await controller.setDepth(5);
    expect(connection.lastCommand()).toBe("tnf set 1 depth=3");
  });

  it("sends tnf remove command", async () => {
    // given a connected radio with a tnf
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|tnf 1 freq=14.200000 depth=2 width=0.000100");
    const controller = radio.tnf("1")!;

    // when we remove the tnf
    await controller.remove();

    // then the remove command was sent
    expect(connection.lastCommand()).toBe("tnf remove 1");
    // and the tnf is removed from the store
    expect(radio.tnf("1")).toBeUndefined();
  });

  it("patches store optimistically before command response arrives", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|tnf 1 freq=14.200000 depth=2 width=0.000100 permanent=0",
    );
    const controller = radio.tnf("1")!;

    const promise = controller.setFrequency(7.05);

    // store updated synchronously before command response (via queueMicrotask)
    expect(controller.frequencyMHz).toBeCloseTo(7.05);

    await promise;
  });

  it("re-subscribes when a set command fails", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|tnf 1 freq=14.200000 depth=2 width=0.000100 permanent=0",
    );
    const controller = radio.tnf("1")!;

    connection.prepareResponse("tnf set", { code: 0x50000001 });
    await expect(controller.setFrequency(7.05)).rejects.toThrow();

    expect(connection.commands.some((c) => c === "sub tnf 1")).toBe(true);
  });

  it("creates a tnf", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // given the radio will not return the new TNF's ID
    connection.emitStatus(
      "S1|tnf 2 freq=14.200000 depth=2 width=0.000100 permanent=0",
    );
    connection.prepareResponse("tnf create", { code: 0, message: undefined });

    // when we create a new tnf
    const response = await radio.createTnf(14.2);

    // then the create command was sent and the controller is available
    expect(connection.lastCommand()).toBe("tnf create freq=14.200000");
    expect(response).toBeUndefined();
  });
});
