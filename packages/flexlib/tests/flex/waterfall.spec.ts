import { describe, expect, it } from "vitest";
import { lineSpeedToDurationMs } from "../../src/flex/waterfall-line-speed.js";
import { createConnectedRadio } from "../helpers.js";

describe("Waterfall controller", () => {
  it("reflects state updates and issues commands", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // when a waterfall status message arrives
    connection.emitStatus(
      "S1|display waterfall 0x50000000 client_handle=0x68AE2A9B x_pixels=1902 center=14.100000 bandwidth=0.002700 band_zoom=0 segment_zoom=0 line_duration=100 rfgain=10 rxant=ANT1 wide=0 loopa=1 loopb=0 band=20 daxiq_channel=2 panadapter=0x40000000 color_gain=40 auto_black=1 black_level=1200 gradient_index=3 xvtr=",
    );

    // then the snapshot reflects the parsed state
    const snapshot = radio.waterfall("0x50000000")?.snapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.centerFrequencyMHz).toBeCloseTo(14.1, 6);
    expect(snapshot?.bandwidthMHz).toBeCloseTo(0.0027, 6);
    expect(snapshot?.lineSpeed).toBe(100);
    expect(snapshot?.lineDurationMs).toBe(lineSpeedToDurationMs(100));

    const controller = radio.waterfall("0x50000000");
    expect(controller).toBeDefined();

    // when setLineSpeed is called
    await controller?.setLineSpeed(55);
    // then the correct command is sent and local state updates
    expect(connection.lastCommand()).toBe(
      "display panafall set 0x50000000 line_duration=55",
    );
    expect(controller?.lineSpeed).toBe(55);
    expect(controller?.lineDurationMs).toBe(lineSpeedToDurationMs(55));

    // when setBlackLevel is called
    await controller?.setBlackLevel(1250);
    expect(connection.lastCommand()).toBe(
      "display panafall set 0x50000000 black_level=1250",
    );
    expect(controller?.blackLevel).toBe(1250);

    // when setColorGain is called
    await controller?.setColorGain(45);
    expect(connection.lastCommand()).toBe(
      "display panafall set 0x50000000 color_gain=45",
    );
    expect(controller?.colorGain).toBe(45);

    // when setAutoBlackLevelEnabled is called
    await controller?.setAutoBlackLevelEnabled(false);
    expect(connection.lastCommand()).toBe(
      "display panafall set 0x50000000 auto_black=0",
    );
    expect(controller?.autoBlackLevelEnabled).toBe(false);

    // when setGradientIndex is called
    await controller?.setGradientIndex(6);
    expect(connection.lastCommand()).toBe(
      "display panafall set 0x50000000 gradient_index=6",
    );
    expect(controller?.gradientIndex).toBe(6);

    // when update() is called with multiple fields
    await controller?.update({
      colorGain: 55,
      autoBlackLevelEnabled: true,
      gradientIndex: 4,
    });
    const updateCommand = connection.lastCommand();
    expect(updateCommand).toBeDefined();
    expect(updateCommand?.startsWith("display panafall set 0x50000000")).toBe(
      true,
    );
    expect(updateCommand).toContain("color_gain=55");
    expect(updateCommand).toContain("auto_black=1");
    expect(controller?.colorGain).toBe(55);
    expect(controller?.autoBlackLevelEnabled).toBe(true);
    expect(controller?.gradientIndex).toBe(4);

    // when close() is called
    await controller?.close();
    expect(connection.lastCommand()).toBe("display panafall remove 0x50000000");

    // when a removal status arrives, the controller is gone
    connection.emitStatus("S2|display waterfall 0x50000000 removed");
    expect(radio.waterfall("0x50000000")).toBeUndefined();
  });
});
