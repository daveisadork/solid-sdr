import { describe, expect, it } from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createFlexClient } from "../../src/flex/session.js";
import { lineSpeedToDurationMs } from "../../src/flex/waterfall-line-speed.js";
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

describe("Waterfall controller", () => {
  it("reflects state updates and issues commands", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    

    channel.emit(
      makeStatus(
        "S1|display waterfall 0x50000000 client_handle=0x68AE2A9B x_pixels=1902 center=14.100000 bandwidth=0.002700 band_zoom=0 segment_zoom=0 line_duration=100 rfgain=10 rxant=ANT1 wide=0 loopa=1 loopb=0 band=20 daxiq_channel=2 panadapter=0x40000000 color_gain=40 auto_black=1 black_level=1200 gradient_index=3 xvtr=",
      ),
    );

    const snapshot = session.getWaterfall("0x50000000");
    expect(snapshot).toBeDefined();
    expect(snapshot?.centerFrequencyMHz).toBeCloseTo(14.1, 6);
    expect(snapshot?.bandwidthMHz).toBeCloseTo(0.0027, 6);
    expect(snapshot?.lineSpeed).toBe(100);
    expect(snapshot?.lineDurationMs).toBe(lineSpeedToDurationMs(100));

    const controller = session.waterfall("0x50000000");
    expect(controller).toBeDefined();

    await controller!.setLineSpeed(55);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 line_duration=55",
    );
    expect(controller!.lineSpeed).toBe(55);
    expect(controller!.lineDurationMs).toBe(lineSpeedToDurationMs(55));

    await controller!.setBlackLevel(1250);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 black_level=1250",
    );
    expect(controller!.blackLevel).toBe(1250);

    await controller!.setColorGain(45);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 color_gain=45",
    );
    expect(controller!.colorGain).toBe(45);

    await controller!.setAutoBlackLevelEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 auto_black=0",
    );
    expect(controller!.autoBlackLevelEnabled).toBe(false);

    await controller!.setGradientIndex(6);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 gradient_index=6",
    );
    expect(controller!.gradientIndex).toBe(6);

    await controller!.update({
      colorGain: 55,
      autoBlackLevelEnabled: true,
      gradientIndex: 4,
    });
    const updateCommand = channel.commands.at(-1)?.command;
    expect(updateCommand).toBeDefined();
    expect(updateCommand?.startsWith("display panafall set 0x50000000")).toBe(
      true,
    );
    expect(updateCommand).toContain("color_gain=55");
    expect(updateCommand).toContain("auto_black=1");
    expect(controller!.colorGain).toBe(55);
    expect(controller!.autoBlackLevelEnabled).toBe(true);
    expect(controller!.gradientIndex).toBe(4);

    await controller!.close();
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall remove 0x50000000",
    );

    channel.emit(makeStatus("S2|display waterfall 0x50000000 removed=1"));
    expect(session.waterfall("0x50000000")).toBeUndefined();
  });
});
