import { describe, expect, it, vi } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import { createMemorySnapshot } from "../../src/flex/state/memory.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";

describe("MemorySnapshot parser", () => {
  it("parses all wire attributes on first creation", () => {
    const attributes: Record<string, string> = {
      owner: "KF0SMY",
      group: "HF",
      name: "40m SSB",
      freq: "7.250000",
      mode: "USB",
      step: "100",
      repeater: "SIMPLEX",
      repeater_offset: "0.000000",
      tone_mode: "off",
      tone_value: "67.0",
      squelch: "0",
      squelch_level: "22",
      rx_filter_low: "100",
      rx_filter_high: "2800",
      rtty_mark: "2125",
      rtty_shift: "170",
      digl_offset: "0",
      digu_offset: "0",
    };

    const { snapshot, diff } = createMemorySnapshot("0", attributes);

    expect(snapshot.id).toBe("0");
    expect(snapshot.owner).toBe("KF0SMY");
    expect(snapshot.group).toBe("HF");
    expect(snapshot.name).toBe("40m SSB");
    expect(snapshot.frequencyMHz).toBeCloseTo(7.25);
    expect(snapshot.mode).toBe("USB");
    expect(snapshot.stepHz).toBe(100);
    expect(snapshot.repeaterOffsetDirection).toBe("SIMPLEX");
    expect(snapshot.repeaterOffsetMHz).toBeCloseTo(0);
    expect(snapshot.fmToneMode).toBe("off");
    expect(snapshot.fmToneValue).toBe("67.0");
    expect(snapshot.squelchEnabled).toBe(false);
    expect(snapshot.squelchLevel).toBe(22);
    expect(snapshot.filterLowHz).toBe(100);
    expect(snapshot.filterHighHz).toBe(2800);
    expect(snapshot.rttyMarkHz).toBe(2125);
    expect(snapshot.rttyShiftHz).toBe(170);
    expect(snapshot.diglOffsetHz).toBe(0);
    expect(snapshot.diguOffsetHz).toBe(0);
    expect(diff.id).toBe("0");
    expect(snapshot.raw.owner).toBe("KF0SMY");
  });

  it("incrementally updates from a previous snapshot", () => {
    const { snapshot: previous } = createMemorySnapshot("1", {
      freq: "14.200000",
      mode: "USB",
      step: "100",
    });

    const { snapshot, diff } = createMemorySnapshot(
      "1",
      { freq: "7.050000", mode: "LSB" },
      previous,
    );

    expect(snapshot.frequencyMHz).toBeCloseTo(7.05);
    expect(snapshot.mode).toBe("LSB");
    expect(snapshot.stepHz).toBe(100);
    expect(diff.frequencyMHz).toBeCloseTo(7.05);
    expect(diff.mode).toBe("LSB");
    expect(diff.stepHz).toBeUndefined();
    expect(diff.id).toBeUndefined();
  });

  it("logs unknown attributes", () => {
    const warnSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    createMemorySnapshot("0", { foo: "100", bar: "1" });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it("logs parse errors for malformed values", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    createMemorySnapshot("0", { freq: "not-a-number", step: "bad" });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });
});

describe("Memory store integration", () => {
  it("handles memory status messages for create, update, and remove", () => {
    const store = createRadioStateStore();

    const createChanges = store.apply(
      makeStatus(
        "S1|memory 0 owner=Dave group=HF freq=7.250000 mode=USB step=100 " +
          "repeater=simplex repeater_offset=0.000000 tone_mode=off tone_value=100.0 " +
          "squelch=0 squelch_level=22 rx_filter_low=100 rx_filter_high=2800 " +
          "rtty_mark=2125 rtty_shift=170 digl_offset=0 digu_offset=0",
      ),
    );

    expect(store.getMemory("0")).toBeDefined();
    expect(store.getMemory("0")?.frequencyMHz).toBeCloseTo(7.25);
    expect(store.getMemory("0")?.mode).toBe("USB");
    expect(store.getMemories()).toHaveLength(1);
    expect(createChanges).toHaveLength(1);
    expect(createChanges[0]).toMatchObject({
      entity: "memory",
      id: "0",
      removed: false,
    });

    const updateChanges = store.apply(
      makeStatus("S2|memory 0 freq=14.200000 mode=LSB"),
    );
    expect(store.getMemory("0")?.frequencyMHz).toBeCloseTo(14.2);
    expect(store.getMemory("0")?.mode).toBe("LSB");
    expect(updateChanges[0]).toMatchObject({
      entity: "memory",
      id: "0",
      removed: false,
    });

    const removeChanges = store.apply(makeStatus("S3|memory 0 removed"));
    expect(store.getMemory("0")).toBeUndefined();
    expect(store.getMemories()).toHaveLength(0);
    expect(removeChanges[0]).toMatchObject({
      entity: "memory",
      id: "0",
      removed: true,
    });
  });

  it("patchMemory applies attributes optimistically", () => {
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|memory 0 freq=7.250000 mode=USB step=100"));

    const change = store.patchMemory("0", { freq: "14.200000" });

    expect(store.getMemory("0")?.frequencyMHz).toBeCloseTo(14.2);
    expect(change).toBeDefined();
    expect(change?.entity).toBe("memory");
  });

  it("removeMemory removes an existing memory", () => {
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|memory 0 freq=7.250000 mode=USB step=100"));

    const change = store.removeMemory("0");

    expect(store.getMemory("0")).toBeUndefined();
    expect(change).toMatchObject({ entity: "memory", id: "0", removed: true });
  });

  it("removeMemory returns undefined for unknown id", () => {
    const store = createRadioStateStore();
    expect(store.removeMemory("99")).toBeUndefined();
  });

  it("snapshot includes memories array", () => {
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|memory 0 freq=7.250000 mode=USB step=100"));
    store.apply(makeStatus("S2|memory 1 freq=14.200000 mode=LSB step=100"));

    const snap = store.snapshot();
    expect(snap.memories).toHaveLength(2);
  });

  it("reset clears all memories", () => {
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|memory 0 freq=7.250000 mode=USB step=100"));

    store.reset();

    expect(store.getMemories()).toHaveLength(0);
  });
});

describe("Memory controller", () => {
  it("tracks memory state and emits change events", async () => {
    const { radio, connection } = await createConnectedRadio();

    connection.emitStatus(
      "S1|memory 0 owner=Dave group=HF freq=7.250000 mode=USB step=100 " +
        "repeater=simplex repeater_offset=0.000000 tone_mode=off tone_value=100.0 " +
        "squelch=0 squelch_level=22 rx_filter_low=100 rx_filter_high=2800 " +
        "rtty_mark=2125 rtty_shift=170 digl_offset=0 digu_offset=0",
    );

    const controller = radio.memory("0");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("memory controller not created");

    expect(controller.frequencyMHz).toBeCloseTo(7.25);
    expect(controller.mode).toBe("USB");
    expect(controller.owner).toBe("Dave");
    expect(radio.memories()).toHaveLength(1);

    const changes: RadioStateChange[] = [];
    controller.on("change", (change) => changes.push(change));

    connection.emitStatus("S2|memory 0 freq=14.200000 mode=LSB");
    expect(controller.frequencyMHz).toBeCloseTo(14.2);
    expect(controller.mode).toBe("LSB");
    expect(changes).toHaveLength(1);

    connection.emitStatus("S3|memory 0 removed");
    expect(radio.memory("0")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });

  it("patches store optimistically before command response arrives", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|memory 0 freq=7.250000 mode=USB step=100 repeater=simplex " +
        "repeater_offset=0.000000 tone_mode=off squelch=0 squelch_level=0 " +
        "rx_filter_low=0 rx_filter_high=2800 rtty_mark=0 rtty_shift=0 " +
        "digl_offset=0 digu_offset=0",
    );
    const controller = radio.memory("0");
    if (!controller) throw new Error("expected memory controller");

    const promise = controller.setFrequency(14.2);
    expect(controller.frequencyMHz).toBeCloseTo(14.2);
    await promise;
  });

  it("re-subscribes when a set command fails", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|memory 0 freq=7.250000 mode=USB step=100 repeater=simplex " +
        "repeater_offset=0.000000 tone_mode=off squelch=0 squelch_level=0 " +
        "rx_filter_low=0 rx_filter_high=2800 rtty_mark=0 rtty_shift=0 " +
        "digl_offset=0 digu_offset=0",
    );
    const controller = radio.memory("0");
    if (!controller) throw new Error("expected memory controller");

    connection.prepareResponse("memory set", { code: 0x50000001 });
    await expect(controller.setFrequency(14.2)).rejects.toThrow();

    expect(connection.commands.some((c) => c === "sub memories 0")).toBe(true);
  });

  it("sends correct memory set commands for each setter", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|memory 0 freq=7.250000 mode=USB step=100 repeater=simplex " +
        "repeater_offset=0.000000 tone_mode=off squelch=0 squelch_level=0 " +
        "rx_filter_low=0 rx_filter_high=2800 rtty_mark=0 rtty_shift=0 " +
        "digl_offset=0 digu_offset=0",
    );
    const controller = radio.memory("0");
    if (!controller) throw new Error("expected memory controller");

    await controller.setFrequency(14.2);
    expect(connection.lastCommand()).toBe("memory set 0 freq=14.200000");

    await controller.setMode("LSB");
    expect(connection.lastCommand()).toBe("memory set 0 mode=LSB");

    await controller.setStep(500);
    expect(connection.lastCommand()).toBe("memory set 0 step=500");

    await controller.setOwner("John Doe");
    expect(connection.lastCommand()).toBe("memory set 0 owner=John\u007fDoe");

    await controller.setGroup("40 m");
    expect(connection.lastCommand()).toBe("memory set 0 group=40\u007fm");

    await controller.setName("40m SSB");
    expect(connection.lastCommand()).toBe("memory set 0 name=40m\u007fSSB");

    await controller.setRepeaterOffsetDirection("up");
    expect(connection.lastCommand()).toBe("memory set 0 repeater=up");

    await controller.setRepeaterOffset(0.6);
    expect(connection.lastCommand()).toBe(
      "memory set 0 repeater_offset=0.600000",
    );

    await controller.setFmToneMode("ctcss_tx");
    expect(connection.lastCommand()).toBe("memory set 0 tone_mode=ctcss_tx");

    await controller.setFmToneValue("100.0");
    expect(connection.lastCommand()).toBe("memory set 0 tone_value=100.0");

    await controller.setSquelchEnabled(true);
    expect(connection.lastCommand()).toBe("memory set 0 squelch=1");

    await controller.setSquelchLevel(50);
    expect(connection.lastCommand()).toBe("memory set 0 squelch_level=50");

    await controller.setFilterLow(200);
    expect(connection.lastCommand()).toBe("memory set 0 rx_filter_low=200");

    await controller.setFilterHigh(3000);
    expect(connection.lastCommand()).toBe("memory set 0 rx_filter_high=3000");

    await controller.setRttyMark(2125);
    expect(connection.lastCommand()).toBe("memory set 0 rtty_mark=2125");

    await controller.setRttyShift(170);
    expect(connection.lastCommand()).toBe("memory set 0 rtty_shift=170");

    await controller.setDiglOffset(-2210);
    expect(connection.lastCommand()).toBe("memory set 0 digl_offset=-2210");

    await controller.setDiguOffset(2210);
    expect(connection.lastCommand()).toBe("memory set 0 digu_offset=2210");
  });

  it("sends memory apply command without patching state", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|memory 0 freq=7.250000 mode=USB step=100 repeater=simplex " +
        "repeater_offset=0.000000 tone_mode=off squelch=0 squelch_level=0 " +
        "rx_filter_low=0 rx_filter_high=2800 rtty_mark=0 rtty_shift=0 " +
        "digl_offset=0 digu_offset=0",
    );
    const controller = radio.memory("0");
    if (!controller) throw new Error("expected memory controller");

    const changes: RadioStateChange[] = [];
    radio.on("change", (c) => changes.push(c));

    await controller.apply();

    expect(connection.lastCommand()).toBe("memory apply 0");
    expect(changes).toHaveLength(0);
  });

  it("sends memory remove command", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|memory 0 freq=7.250000 mode=USB step=100 repeater=simplex " +
        "repeater_offset=0.000000 tone_mode=off squelch=0 squelch_level=0 " +
        "rx_filter_low=0 rx_filter_high=2800 rtty_mark=0 rtty_shift=0 " +
        "digl_offset=0 digu_offset=0",
    );
    const controller = radio.memory("0");
    if (!controller) throw new Error("expected memory controller");

    await controller.remove();

    expect(connection.lastCommand()).toBe("memory remove 0");
    expect(radio.memory("0")).toBeUndefined();
  });
});
