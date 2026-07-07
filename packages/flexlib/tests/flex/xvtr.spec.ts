import { describe, expect, it } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import { createXvtrSnapshot } from "../../src/flex/state/xvtr.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";

describe("XVTR snapshot", () => {
  it("parses all wire attributes on first creation", () => {
    // given a set of wire attributes for a new transverter
    const attributes: Record<string, string> = {
      name: "2M",
      rf_freq: "144.000000",
      if_freq: "28.000000",
      lo_error: "0.000100",
      rx_gain: "10.00",
      rx_only: "0",
      max_power: "5.00",
      order: "0",
      is_valid: "1",
    };

    // when we create a snapshot
    const { snapshot, diff } = createXvtrSnapshot("0", attributes);

    // then all fields are populated
    expect(snapshot.id).toBe("0");
    expect(snapshot.name).toBe("2M");
    expect(snapshot.rfFreqMHz).toBeCloseTo(144.0);
    expect(snapshot.ifFreqMHz).toBeCloseTo(28.0);
    expect(snapshot.loErrorMHz).toBeCloseTo(0.0001);
    expect(snapshot.rxGainDb).toBeCloseTo(10.0);
    expect(snapshot.rxOnly).toBe(false);
    expect(snapshot.maxPowerDbm).toBeCloseTo(5.0);
    expect(snapshot.order).toBe(0);
    expect(snapshot.valid).toBe(true);
    // and the diff includes the id (first creation)
    expect(diff.id).toBe("0");
  });

  it("incrementally updates from a previous snapshot", () => {
    // given an existing snapshot
    const { snapshot: previous } = createXvtrSnapshot("0", {
      name: "2M",
      rf_freq: "144.000000",
      if_freq: "28.000000",
      lo_error: "0.000000",
      rx_gain: "10.00",
      rx_only: "0",
      max_power: "5.00",
      order: "0",
      is_valid: "1",
    });

    // when an incremental update arrives with only changed fields
    const { snapshot, diff } = createXvtrSnapshot(
      "0",
      { rx_only: "1", max_power: "8.00" },
      previous,
    );

    // then unchanged fields are preserved from previous
    expect(snapshot.name).toBe("2M");
    expect(snapshot.rfFreqMHz).toBeCloseTo(144.0);
    // and changed fields are updated
    expect(snapshot.rxOnly).toBe(true);
    expect(snapshot.maxPowerDbm).toBeCloseTo(8.0);
    // and diff only contains the changed fields
    expect(diff.rxOnly).toBe(true);
    expect(diff.maxPowerDbm).toBeCloseTo(8.0);
    expect(diff.name).toBeUndefined();
    // and id is not in the diff for incremental updates
    expect(diff.id).toBeUndefined();
  });
});

describe("XVTR store integration", () => {
  it("handles xvtr status messages for create, update, and remove", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a new xvtr status arrives
    const createChanges = store.apply(
      makeStatus(
        "S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000 order=0 is_valid=1",
      ),
    );

    // then the store contains the xvtr
    expect(store.getXvtr("0")).toBeDefined();
    expect(store.getXvtr("0")?.name).toBe("2M");
    expect(store.getXvtrs()).toHaveLength(1);
    expect(createChanges).toHaveLength(1);
    expect(createChanges[0]).toMatchObject({
      entity: "xvtr",
      id: "0",
      removed: false,
    });

    // when an update arrives
    const updateChanges = store.apply(
      makeStatus("S2|xvtr 0 max_power=8.00 rx_only=1"),
    );

    // then the snapshot reflects the update
    expect(store.getXvtr("0")?.maxPowerDbm).toBeCloseTo(8.0);
    expect(store.getXvtr("0")?.rxOnly).toBe(true);
    expect(updateChanges).toHaveLength(1);

    // when a removal status arrives
    const removeChanges = store.apply(makeStatus("S3|xvtr 0 in_use=0"));

    // then the xvtr is gone
    expect(store.getXvtr("0")).toBeUndefined();
    expect(store.getXvtrs()).toHaveLength(0);
    expect(removeChanges[0]).toMatchObject({
      entity: "xvtr",
      id: "0",
      removed: true,
    });
  });

  it("patchXvtr applies attributes optimistically", () => {
    // given a store with an existing xvtr
    const store = createRadioStateStore();
    store.apply(
      makeStatus("S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000"),
    );

    // when we optimistically patch
    const change = store.patchXvtr("0", { name: "70cm" });

    // then the snapshot is updated and a change is returned
    expect(store.getXvtr("0")?.name).toBe("70cm");
    expect(change).toBeDefined();
    expect(change?.entity).toBe("xvtr");
  });

  it("removeXvtr removes an existing xvtr", () => {
    // given a store with an existing xvtr
    const store = createRadioStateStore();
    store.apply(
      makeStatus("S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000"),
    );

    // when we remove it
    const change = store.removeXvtr("0");

    // then it's gone and a change is returned
    expect(store.getXvtr("0")).toBeUndefined();
    expect(change).toMatchObject({ entity: "xvtr", id: "0", removed: true });
  });

  it("removeXvtr returns undefined for unknown id", () => {
    // given an empty store
    const store = createRadioStateStore();

    // when we try to remove a nonexistent xvtr
    const change = store.removeXvtr("99");

    // then no change is returned
    expect(change).toBeUndefined();
  });

  it("snapshot includes xvtrs array", () => {
    // given a store with an xvtr
    const store = createRadioStateStore();
    store.apply(
      makeStatus("S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000"),
    );
    store.apply(
      makeStatus("S2|xvtr 1 name=70cm rf_freq=432.000000 if_freq=28.000000"),
    );

    // when we take a snapshot
    const snap = store.snapshot();

    // then xvtrs are included
    expect(snap.xvtrs).toHaveLength(2);
    expect(snap.xvtrs.map((x) => x.name)).toContain("2M");
    expect(snap.xvtrs.map((x) => x.name)).toContain("70cm");
  });
});

describe("XVTR controller", () => {
  it("tracks xvtr state and emits change events", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // when an xvtr status arrives
    connection.emitStatus(
      "S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000 lo_error=0.000000 rx_gain=10.00 rx_only=0 max_power=5.00 order=0 is_valid=1",
    );

    // then the controller is accessible and has correct values
    const controller = radio.xvtr("0");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("xvtr controller not created");

    expect(controller.name).toBe("2M");
    expect(controller.rfFreqMHz).toBeCloseTo(144.0);
    expect(controller.ifFreqMHz).toBeCloseTo(28.0);
    expect(controller.loErrorMHz).toBeCloseTo(0.0);
    expect(controller.rxGainDb).toBeCloseTo(10.0);
    expect(controller.rxOnly).toBe(false);
    expect(controller.maxPowerDbm).toBeCloseTo(5.0);
    expect(controller.order).toBe(0);
    expect(controller.valid).toBe(true);
    expect(radio.xvtrs()).toHaveLength(1);

    // given a change listener
    const changes: RadioStateChange[] = [];
    controller.on("change", (change) => {
      changes.push(change);
    });

    // when an update arrives
    connection.emitStatus("S2|xvtr 0 rx_only=1 max_power=8.00");

    // then the controller reflects updates and the change event fired
    expect(controller.rxOnly).toBe(true);
    expect(controller.maxPowerDbm).toBeCloseTo(8.0);
    expect(changes).toHaveLength(1);

    // when a removal status arrives
    connection.emitStatus("S3|xvtr 0 in_use=0");

    // then the controller is no longer accessible and snapshot throws
    expect(radio.xvtr("0")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });

  it("sends xvtr set commands for property changes", async () => {
    // given a connected radio with an xvtr
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000 lo_error=0.000000 rx_gain=10.00 rx_only=0 max_power=5.00 order=0 is_valid=1",
    );
    const controller = radio.xvtr("0");
    if (!controller) throw new Error("expected xvtr controller");

    // when we set properties
    await controller.setName("70cm");
    expect(connection.lastCommand()).toBe("xvtr set 0 name=70cm");

    await controller.setRfFreqMHz(432.1);
    expect(connection.lastCommand()).toBe("xvtr set 0 rf_freq=432.100000");

    await controller.setIfFreqMHz(28.5);
    expect(connection.lastCommand()).toBe("xvtr set 0 if_freq=28.500000");

    await controller.setLoErrorMHz(0.001);
    expect(connection.lastCommand()).toBe("xvtr set 0 lo_error=0.001000");

    await controller.setRxGainDb(15);
    expect(connection.lastCommand()).toBe("xvtr set 0 rx_gain=15.00");

    await controller.setRxOnly(true);
    expect(connection.lastCommand()).toBe("xvtr set 0 rx_only=1");

    await controller.setMaxPowerDbm(3.5);
    expect(connection.lastCommand()).toBe("xvtr set 0 max_power=3.50");

    await controller.setOrder(2);
    expect(connection.lastCommand()).toBe("xvtr set 0 order=2");
  });

  it("truncates names longer than 4 characters", async () => {
    // given a connected radio with an xvtr
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000",
    );
    const controller = radio.xvtr("0");
    if (!controller) throw new Error("expected xvtr controller");

    // when we set a name longer than 4 characters
    await controller.setName("LongName");

    // then only the first 4 characters are sent
    expect(connection.lastCommand()).toBe("xvtr set 0 name=Long");
  });

  it("sends xvtr remove command", async () => {
    // given a connected radio with an xvtr
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|xvtr 0 name=2M rf_freq=144.000000 if_freq=28.000000",
    );
    const controller = radio.xvtr("0");
    if (!controller) throw new Error("expected xvtr controller");

    // when we remove the xvtr
    await controller.remove();

    // then the remove command was sent
    expect(connection.lastCommand()).toBe("xvtr remove 0");
    // and the xvtr is removed from the store
    expect(radio.xvtr("0")).toBeUndefined();
  });

  it("creates an xvtr and returns the controller", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // given the radio will return the new XVTR's ID and emit its status
    connection.emitStatus(
      "S1|xvtr 1 name= rf_freq=0.000000 if_freq=0.000000 lo_error=0.000000 rx_gain=0.00 rx_only=0 max_power=-10.00 order=0 preferred=0 two_meter_int=0 is_valid=0",
    );
    connection.prepareResponse("xvtr create", { message: "1" });

    // when we create a new xvtr
    const controller = await radio.createXvtr();

    // then the create command was sent and the controller is available
    expect(connection.lastCommand()).toBe("xvtr create");
    expect(controller.id).toBe("1");
  });

  // setMaxPowerDbm matches the official lib's clamp matrix (Xvtr.cs:170-209):
  // the radio doesn't validate max_power so the client must clamp by model + IF freq.
  it.each([
    { model: "FLEX-6400", ifFreqMHz: 28, input: 20, expected: "10.00" },
    { model: "FLEX-6600M", ifFreqMHz: 28, input: 50, expected: "10.00" },
    { model: "FLEX-6500", ifFreqMHz: 28, input: 20, expected: "15.00" },
    { model: "FLEX-8600", ifFreqMHz: 28, input: 20, expected: "15.00" },
    { model: "FLEX-6400", ifFreqMHz: 100, input: 20, expected: "8.00" },
    { model: "FLEX-6400", ifFreqMHz: 28, input: 5, expected: "5.00" },
    { model: "FLEX-6400", ifFreqMHz: 28, input: -20, expected: "-10.00" },
  ])("clamps max power: $model + IF=$ifFreqMHz MHz, input=$input → $expected", async ({
    model,
    ifFreqMHz,
    input,
    expected,
  }) => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(`S1|radio model=${model}`);
    connection.emitStatus(
      `S2|xvtr 0 name=2M rf_freq=144.000000 if_freq=${ifFreqMHz}.000000 max_power=0.00`,
    );

    await radio.xvtr("0")?.setMaxPowerDbm(input);

    expect(connection.lastCommand()).toBe(`xvtr set 0 max_power=${expected}`);
  });
});
