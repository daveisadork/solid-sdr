import { describe, expect, it } from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createFlexClient } from "../../src/flex/session.js";
import { createMockControl, makeStatus } from "../helpers.js";

const descriptor: FlexRadioDescriptor = {
  serial: "1234-0001",
  model: "FLEX-6400",
  availableSlices: 2,
  availablePanadapters: 2,
  version: "3.10.10",
  host: "192.0.2.42",
  port: 4992,
  protocol: "tcp",
  nickname: "",
  callsign: "",
};

const NO_HANDSHAKE = { handshake: async () => {} };

describe("Equalizer controller", () => {
  it("reflects status updates and sends commands", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();

    channel.emit(
      makeStatus(
        "S1|eq txsc mode=1 63Hz=0 125Hz=-4 250Hz=-4 500Hz=1 1000Hz=4 2000Hz=6 4000Hz=5 8000Hz=2",
      ),
    );
    const controller = session.equalizer("tx");
    expect(controller.enabled).toBe(true);
    expect(controller.levels["125Hz"]).toBe(-4);
    expect(controller.levels["4000Hz"]).toBe(5);

    await controller.setEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe("eq txsc mode=0");
    expect(controller.enabled).toBe(false);

    await controller.setLevel("125Hz", 7.2);
    expect(channel.commands.at(-1)?.command).toBe("eq txsc 125Hz=7");
    expect(controller.levels["125Hz"]).toBe(7);

    await controller.setLevels({ "250Hz": -12, "4000Hz": 15 });
    expect(channel.commands.at(-1)?.command).toBe(
      "eq txsc 250Hz=-10 4000Hz=10",
    );
    expect(controller.levels["250Hz"]).toBe(-10);
    expect(controller.levels["4000Hz"]).toBe(10);

    await controller.refresh();
    expect(channel.commands.at(-1)?.command).toBe("eq txsc info");
  });
});
