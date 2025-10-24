import { describe, expect, it } from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createFlexClient } from "../../src/flex/client.js";
import { FlexStateUnavailableError } from "../../src/flex/errors.js";
import { scaleMeterRawValue } from "../../src/flex/meter.js";
import { MockControlFactory, makeStatus } from "../helpers.js";

const descriptor: FlexRadioDescriptor = {
  serial: "1234-0001",
  model: "FLEX-6400",
  availableSlices: 2,
  availablePanadapters: 2,
  firmware: "3.10.10",
  host: "192.0.2.42",
  port: 4992,
  protocol: "tcp",
};

describe("Meter controller", () => {
  it("tracks meter state and emits change events", async () => {
    const factory = new MockControlFactory();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor);
    const channel = factory.channel;
    if (!channel) throw new Error("control channel not created");

    channel.emit(
      makeStatus(
        "S1|meter 10.src=TX-#10.num=3#10.nam=SWR#10.low=1.0#10.hi=999.0#10.desc=RF SWR#10.unit=SWR#10.fps=20#",
      ),
    );

    expect(session.getMeter("10")?.name).toBe("SWR");
    expect(session.getMeters()).toHaveLength(1);

    const controller = session.meter("10");
    expect(controller).toBeDefined();
    if (!controller) throw new Error("meter controller not created");

    expect(controller.source).toBe("TX-");
    expect(controller.sourceIndex).toBe(3);
    expect(controller.name).toBe("SWR");
    expect(controller.description).toBe("RF SWR");
    expect(controller.low).toBeCloseTo(1);
    expect(controller.high).toBeCloseTo(999);
    expect(controller.fps).toBeCloseTo(20);
    const changes: unknown[] = [];
    controller.on("change", (change) => {
      changes.push(change);
    });

    channel.emit(
      makeStatus(
        "S2|meter 10.src=TX-#10.num=3#10.nam=SWR#10.low=1.0#10.hi=999.0#10.desc=RF SWR#10.unit=dBm#10.fps=25#",
      ),
    );

    expect(controller.units).toBe("dBm");
    expect(controller.fps).toBeCloseTo(25);
    expect(changes).toHaveLength(1);

    channel.emit(makeStatus("S3|meter 10 removed=1"));

    expect(session.getMeter("10")).toBeUndefined();
    expect(session.meter("10")).toBeUndefined();
    expect(() => controller.snapshot()).toThrow(FlexStateUnavailableError);
  });

  it("scales raw meter samples using meter units", () => {
    expect(scaleMeterRawValue("dBm", 1280)).toBeCloseTo(10);
    expect(scaleMeterRawValue("Volts", 512)).toBeCloseTo(2);
    expect(scaleMeterRawValue("degC", 640)).toBeCloseTo(10);
    expect(scaleMeterRawValue("Percent", 42)).toBe(42);
    expect(scaleMeterRawValue("Volts", 512, { voltDenominator: 1024 })).toBe(
      0.5,
    );
  });
});
