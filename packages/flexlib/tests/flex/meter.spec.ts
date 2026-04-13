import { describe, expect, it } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import { scaleMeterRawValue } from "../../src/flex/meter.js";
import { createConnectedRadio } from "../helpers.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";

describe("Meter controller", () => {
  it("tracks meter state and emits change events", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // when a meter status message arrives
    connection.emitStatus(
      "S1|meter 10.src=TX-#10.num=3#10.nam=SWR#10.low=1.0#10.hi=999.0#10.desc=RF SWR#10.unit=SWR#10.fps=20#",
    );

    // then the meter is visible via snapshot and controller
    expect(radio.meter("10")?.snapshot()?.name).toBe("SWR");
    expect(radio.meters()).toHaveLength(1);

    const controller = radio.meter("10");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("meter controller not created");

    expect(controller.source).toBe("TX-");
    expect(controller.sourceIndex).toBe(3);
    expect(controller.name).toBe("SWR");
    expect(controller.description).toBe("RF SWR");
    expect(controller.low).toBeCloseTo(1);
    expect(controller.high).toBeCloseTo(999);
    expect(controller.fps).toBeCloseTo(20);

    // given a change listener is attached
    const changes: RadioStateChange[] = [];
    controller.on("change", (change) => {
      changes.push(change);
    });

    // when an updated meter status arrives
    connection.emitStatus(
      "S2|meter 10.src=TX-#10.num=3#10.nam=SWR#10.low=1.0#10.hi=999.0#10.desc=RF SWR#10.unit=dBm#10.fps=25#",
    );

    // then the controller reflects updates and the change event fired
    expect(controller.units).toBe("dBm");
    expect(controller.fps).toBeCloseTo(25);
    expect(changes).toHaveLength(1);

    // when a meter removal status arrives
    connection.emitStatus("S3|meter 10 removed=1");

    // then the meter is no longer accessible and snapshot throws
    expect(radio.meter("10")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });

  it("scales raw meter samples using meter units", () => {
    // given/when various raw values with different unit types
    // then they are scaled correctly
    expect(scaleMeterRawValue("dBm", 1280)).toBeCloseTo(10);
    expect(scaleMeterRawValue("Volts", 512)).toBeCloseTo(2);
    expect(scaleMeterRawValue("degC", 640)).toBeCloseTo(10);
    expect(scaleMeterRawValue("Percent", 42)).toBe(42);
    expect(scaleMeterRawValue("Volts", 512, { voltDenominator: 1024 })).toBe(
      0.5,
    );
  });
});
