import { describe, expect, it } from "vitest";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import { scaleMeterRawValue } from "../../src/flex/meter.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";
import { createConnectedRadio } from "../helpers.js";

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
    connection.emitStatus("S3|meter 10 removed");

    // then the meter is no longer accessible and snapshot throws
    expect(radio.meter("10")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });

  it("keeps only the newest amplifier meter when a name is registered twice", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|meter 5.src=AMP#5.num=0x80001234#5.nam=FWDPWR#5.unit=Watts#",
    );
    expect(radio.meter("5")).toBeDefined();

    // a re-registered meter with a higher number supersedes the first
    connection.emitStatus(
      "S2|meter 9.src=AMP#9.num=0x80001234#9.nam=FWDPWR#9.unit=Watts#",
    );
    expect(radio.meter("5")).toBeUndefined();
    expect(radio.meter("9")?.sourceIndex).toBe(0x80001234);

    // a late arrival with a lower number is dropped on arrival
    connection.emitStatus(
      "S3|meter 7.src=AMP#7.num=0x80001234#7.nam=FWDPWR#7.unit=Watts#",
    );
    expect(radio.meter("7")).toBeUndefined();
    expect(radio.meters().map((m) => m.snapshot().id)).toEqual(["9"]);

    // a different amplifier handle or a different name is untouched
    connection.emitStatus(
      "S4|meter 10.src=AMP#10.num=0x80005678#10.nam=FWDPWR#",
    );
    connection.emitStatus(
      "S5|meter 11.src=AMP#11.num=0x80001234#11.nam=REFPWR#",
    );
    expect(radio.meters()).toHaveLength(3);
  });

  it("keeps slice meters that share a name", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|meter 1.src=SLC#1.num=0#1.nam=LEVEL#");
    connection.emitStatus("S2|meter 2.src=SLC#2.num=1#2.nam=LEVEL#");
    expect(radio.meters()).toHaveLength(2);
    expect(radio.meter("1")?.sourceIndex).toBe(0);
  });

  it("treats a missing num as unset and ignores a later num once set", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|meter 3.src=SLC#3.nam=LEVEL#");
    expect(radio.meter("3")?.sourceIndex).toBeUndefined();

    connection.emitStatus("S2|meter 3.num=0#");
    expect(radio.meter("3")?.sourceIndex).toBe(0);

    connection.emitStatus("S3|meter 3.num=4#");
    expect(radio.meter("3")?.sourceIndex).toBe(0);
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
