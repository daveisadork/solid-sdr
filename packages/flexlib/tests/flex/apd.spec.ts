import { describe, expect, it, vi } from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createFlexClient } from "../../src/flex/session.js";
import { createMockControl, makeStatus } from "../helpers.js";

const descriptor: FlexRadioDescriptor = {
  serial: "1234-0002",
  model: "FLEX-6600",
  availableSlices: 2,
  availablePanadapters: 2,
  version: "3.10.10",
  host: "192.0.2.50",
  port: 4992,
  protocol: "tcp",
  nickname: "",
  callsign: "",
};

const NO_HANDSHAKE = { handshake: async () => {} };

describe("APD controller", () => {
  it("reflects status and toggles enable state", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();

    channel.emit(makeStatus("S1|apd enable=1 configurable=1"));
    channel.emit(makeStatus("S1|apd freq=0.000000 tx_error_mHz=0.250000"));
    channel.emit(
      makeStatus(
        "S1|apd slice=0 mmx=0 client_handle=0x7F7C21E0 ant=ANT1 freq=14.100000 rx_error_mHz=0.125000 equalizer_active=1 configurable=1",
      ),
    );

    const controller = session.apd();
    expect(controller.enabled).toBe(true);
    expect(controller.configurable).toBe(true);
    expect(controller.equalizerActive).toBe(true);
    expect(controller.equalizerCalibrating).toBe(false);
    expect(controller.antenna).toBe("ANT1");
    expect(controller.frequencyMHz).toBeCloseTo(14.1, 6);
    expect(controller.sliceId).toBe("0");
    expect(controller.clientHandle).toBe(0x7f7c21e0);
    expect(controller.rxErrorMilliHz).toBeCloseTo(0.125, 6);
    expect(controller.txErrorMilliHz).toBeCloseTo(0.25, 6);

    const changeSpy = vi.fn();
    controller.on("change", changeSpy);
    await controller.setEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe("apd enable=0");
    expect(controller.enabled).toBe(false);
    expect(changeSpy).toHaveBeenCalled();
  });
});
