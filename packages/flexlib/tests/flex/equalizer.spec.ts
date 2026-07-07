import { describe, expect, it } from "vitest";
import { createConnectedRadio } from "../helpers.js";

describe("Equalizer controller", () => {
  it("reflects status updates and sends commands", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // when an equalizer status message arrives
    connection.emitStatus(
      "S1|eq txsc mode=1 63Hz=0 125Hz=-4 250Hz=-4 500Hz=1 1000Hz=4 2000Hz=6 4000Hz=5 8000Hz=2",
    );

    // then the equalizer controller reflects the parsed state
    const controller = radio.equalizer("tx");
    expect(controller.enabled).toBe(true);
    expect(controller.bands["125Hz"]).toBe(-4);
    expect(controller.bands["4000Hz"]).toBe(5);

    // when setEnabled(false) is called
    await controller.setEnabled(false);
    expect(connection.lastCommand()).toBe("eq txsc mode=0");
    expect(controller.enabled).toBe(false);

    // when setLevel is called
    await controller.setLevel("125Hz", 7.2);
    expect(connection.lastCommand()).toBe("eq txsc 125Hz=7");
    expect(controller.bands["125Hz"]).toBe(7);

    // when setLevels is called with multiple bands (values clamped to [-10, 10])
    await controller.setLevels({ "250Hz": -12, "4000Hz": 15 });
    expect(connection.lastCommand()).toBe("eq txsc 250Hz=-10 4000Hz=10");
    expect(controller.bands["250Hz"]).toBe(-10);
    expect(controller.bands["4000Hz"]).toBe(10);

    // when refresh is called
    await controller.refresh();
    expect(connection.lastCommand()).toBe("eq txsc info");
  });
});
