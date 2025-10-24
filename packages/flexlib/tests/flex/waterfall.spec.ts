import { describe, expect, it } from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createFlexClient } from "../../src/flex/client.js";
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

describe("Waterfall controller", () => {
  it("reflects state updates and issues commands", async () => {
    const factory = new MockControlFactory();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor);
    const channel = factory.channel;
    if (!channel) throw new Error("control channel not created");

    channel.emit(
      makeStatus(
        "S1|display waterfall 0x50000000 client_handle=0x68AE2A9B x_pixels=1902 center=14.100000 bandwidth=0.002700 band_zoom=0 segment_zoom=0 line_duration=100 rfgain=10 rxant=ANT1 wide=0 loopa=1 loopb=0 band=20 daxiq_channel=2 panadapter=0x40000000 color_gain=40 auto_black=1 black_level=1200 gradient_index=3 xvtr=",
      ),
    );

    const snapshot = session.getWaterfall("0x50000000");
    expect(snapshot).toBeDefined();
    expect(snapshot?.centerFrequencyHz).toBeCloseTo(14_100_000, 4);
    expect(snapshot?.bandwidthHz).toBeCloseTo(2_700, 4);
    expect(snapshot?.lineDurationMs).toBe(100);

    const controller = session.waterfall("0x50000000");
    expect(controller).toBeDefined();
    expect(controller!.rfGain).toBe(10);

    await controller!.setLineDuration(150);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 line_duration=150",
    );
    expect(controller!.lineDurationMs).toBe(150);

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

    channel.prepareResponse({ message: "0,90,5,10,20,30" });
    await controller!.refreshRfGainInfo();
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall rfgain_info 0x50000000",
    );
    expect(controller!.rfGainLow).toBe(0);
    expect(controller!.rfGainHigh).toBe(90);
    expect(controller!.rfGainStep).toBe(5);
    expect(controller!.rfGainMarkers).toEqual([10, 20, 30]);

    await controller!.setRxAntenna("ANT2");
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 rxant=ANT2",
    );
    expect(controller!.rxAntenna).toBe("ANT2");

    await controller!.setRfGain(18);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 rfgain=18",
    );
    expect(controller!.rfGain).toBe(18);

    await controller!.setDaxIqChannel(3);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 daxiq_channel=3",
    );
    expect(controller!.daxIqChannel).toBe(3);

    await controller!.setDbmRange({ low: -140, high: -5 });
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 min_dbm=-140.000000 max_dbm=-5.000000",
    );
    expect(controller!.lowDbm).toBeCloseTo(-140);
    expect(controller!.highDbm).toBeCloseTo(-5);

    await controller!.setFps(60);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 fps=60",
    );
    expect(controller!.fps).toBe(60);

    await controller!.setAverage(25);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 average=25",
    );
    expect(controller!.average).toBe(25);

    await controller!.setWeightedAverage(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 weighted_average=0",
    );
    expect(controller!.weightedAverage).toBe(false);

    await controller!.setCenterFrequency(14_200_000);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 center=14.200000",
    );
    expect(controller!.centerFrequencyHz).toBeCloseTo(14_200_000, 4);

    await controller!.setBandwidth(4_500_000, { autoCenter: true });
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 bandwidth=4.500000 autocenter=1",
    );
    expect(controller!.bandwidthHz).toBeCloseTo(4_500_000, 4);

    await controller!.setBand("20m");
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 band=20m",
    );
    expect(controller!.band).toBe("20m");

    await controller!.setLoopAEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 loopa=0",
    );
    expect(controller!.loopAEnabled).toBe(false);

    await controller!.setLoopBEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall set 0x50000000 loopb=1",
    );
    expect(controller!.loopBEnabled).toBe(true);

    await controller!.update({
      colorGain: 55,
      autoBlackLevelEnabled: true,
      band: "17m",
    });
    const updateCommand = channel.commands.at(-1)?.command;
    expect(updateCommand).toBeDefined();
    expect(updateCommand?.startsWith("display panafall set 0x50000000")).toBe(
      true,
    );
    expect(updateCommand).toContain("color_gain=55");
    expect(updateCommand).toContain("auto_black=1");
    expect(updateCommand).toContain("band=17m");
    expect(controller!.colorGain).toBe(55);
    expect(controller!.autoBlackLevelEnabled).toBe(true);
    expect(controller!.band).toBe("17m");

    await controller!.close();
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall remove 0x50000000",
    );

    channel.emit(makeStatus("S2|display waterfall 0x50000000 removed=1"));
    expect(session.waterfall("0x50000000")).toBeUndefined();
  });
});
