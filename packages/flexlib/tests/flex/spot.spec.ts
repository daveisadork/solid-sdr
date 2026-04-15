import { describe, expect, it } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";

describe("Spot store integration", () => {
  it("handles spot create, update, and remove", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a spot status arrives
    store.apply(
      makeStatus(
        "S1|spot 42 callsign=W1AW rx_freq=14.076000 tx_freq=0.000000 mode=FT8 color=#FF0091FF priority=3 trigger_action=tune",
      ),
    );

    // then the spot is tracked
    const spot = store.getSpot("42");
    expect(spot).toBeDefined();
    expect(spot?.callsign).toBe("W1AW");
    expect(spot?.rxFreqMHz).toBeCloseTo(14.076);
    expect(spot?.txFreqMHz).toBeCloseTo(0);
    expect(spot?.mode).toBe("FT8");
    expect(spot?.color).toBe("#FF0091FF");
    expect(spot?.priority).toBe(3);
    expect(spot?.triggerAction).toBe("tune");
    expect(store.getSpots()).toHaveLength(1);

    // when an update arrives
    store.apply(makeStatus("S2|spot 42 mode=CW priority=1"));
    expect(store.getSpot("42")?.mode).toBe("CW");
    expect(store.getSpot("42")?.priority).toBe(1);
    // unchanged fields preserved
    expect(store.getSpot("42")?.callsign).toBe("W1AW");

    // when removal arrives
    store.apply(makeStatus("S3|spot 42 removed=1"));
    expect(store.getSpot("42")).toBeUndefined();
    expect(store.getSpots()).toHaveLength(0);
  });

  it("decodes 0x7F as spaces in callsign and comment", () => {
    // given a store
    const store = createRadioStateStore();

    // when a spot with encoded spaces arrives
    store.apply(
      makeStatus(
        "S1|spot 1 callsign=DX\u007fPedition rx_freq=7.074000 tx_freq=0.000000 mode=FT8 comment=CQ\u007ffrom\u007fIsland",
      ),
    );

    // then 0x7F is decoded to spaces
    expect(store.getSpot("1")?.callsign).toBe("DX Pedition");
    expect(store.getSpot("1")?.comment).toBe("CQ from Island");
  });
});

describe("Spot controller", () => {
  it("provides getters and sends commands", async () => {
    // given a connected radio with a spot
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|spot 10 callsign=F4JJA rx_freq=14.076358 tx_freq=0.000000 mode=FT8 color=#FF0091FF priority=5 trigger_action=tune",
    );

    // then the controller is accessible
    const controller = radio.spot("10");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("spot controller not created");

    expect(controller.callsign).toBe("F4JJA");
    expect(controller.rxFreqMHz).toBeCloseTo(14.076358);
    expect(controller.mode).toBe("FT8");
    expect(radio.spots()).toHaveLength(1);

    // given a change listener
    const changes: RadioStateChange[] = [];
    controller.on("change", (c) => changes.push(c));

    // when an update arrives
    connection.emitStatus("S2|spot 10 priority=2");
    expect(controller.priority).toBe(2);
    expect(changes).toHaveLength(1);

    // when we trigger the spot
    await controller.trigger();
    expect(connection.lastCommand()).toBe("spot trigger 10");

    // when we trigger with a panadapter
    await controller.trigger("0x40000000");
    expect(connection.lastCommand()).toBe("spot trigger 10 pan=0x40000000");

    // when we remove the spot
    await controller.remove();
    expect(connection.lastCommand()).toBe("spot remove 10");
    expect(radio.spot("10")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });
});
