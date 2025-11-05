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

describe("Panadapter controller", () => {
  it("reflects state updates and issues commands", async () => {
    const factory = new MockControlFactory();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor);
    const channel = factory.channel;
    if (!channel) throw new Error("control channel not created");

    channel.emit(
      makeStatus(
        "S3A5E996B|display pan 0x40000000 client_handle=0x68AE2A9B wnb=1 wnb_level=90 wnb_updating=0 noise_floor_position=30 noise_floor_position_enable=1 band_zoom=0 segment_zoom=0 x_pixels=1902 y_pixels=201 center=14.999367 bandwidth=0.012634 min_dbm=-135.00 max_dbm=-40.00 fps=25 average=50 weighted_average=0 rfgain=8 rxant=ANT1 wide=1 loopa=0 loopb=0 band=33 daxiq_channel=0 waterfall=0x42000000 min_bw=0.001230 max_bw=14.745601 xvtr= pre=+8dB ant_list=ANT1,ANT2,RX_A,RX_B,XVTA,XVTB",
      ),
    );

    const snapshot = session.getPanadapter("0x40000000");
    expect(snapshot).toBeDefined();
    expect(snapshot?.bandwidthMHz).toBeCloseTo(0.012634, 6);
    expect(snapshot?.centerFrequencyMHz).toBeCloseTo(14.999367, 6);

    const controller = session.panadapter("0x40000000");
    expect(controller).toBeDefined();
    expect(controller!.autoCenterEnabled).toBe(false);
    expect(controller!.wnbUpdating).toBe(false);
    expect(controller!.noiseFloorPosition).toBe(30);
    expect(controller!.noiseFloorPositionEnabled).toBe(true);
    expect(controller!.wideEnabled).toBe(true);
    expect(controller!.clientHandle).toBe(0x68ae2a9b);
    expect(controller!.xvtr).toBe("");
    expect(controller!.preampSetting).toBe("+8dB");
    expect(controller!.attachedSlices).toEqual([]);
    expect(controller!.rfGainMarkers).toEqual([]);
    expect(controller!.rfGainLow).toBe(0);
    expect(controller!.rfGainHigh).toBe(0);
    expect(controller!.rfGainStep).toBe(0);

    await controller!.setCenterFrequency(14.1);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 center=14.100000",
    );
    expect(controller!.centerFrequencyMHz).toBeCloseTo(14.1, 6);

    await controller!.setBandwidth(5);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 bandwidth=5.000000",
    );
    expect(controller!.bandwidthMHz).toBeCloseTo(5, 6);

    await controller!.setBandwidth(0.002);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 bandwidth=0.002000",
    );
    expect(controller!.bandwidthMHz).toBeCloseTo(0.002, 6);

    const commandCountBeforeAutoCenter = channel.commands.length;
    await controller!.setAutoCenter(true);
    expect(channel.commands.length).toBe(commandCountBeforeAutoCenter);
    expect(controller!.autoCenterEnabled).toBe(true);

    await controller!.setBandwidth(7);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 bandwidth=7.000000 autocenter=1",
    );
    expect(controller!.bandwidthMHz).toBeCloseTo(7, 6);

    await controller!.setMinDbm(-400);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 min_dbm=-180.000000",
    );
    expect(controller!.lowDbm).toBeCloseTo(-180, 6);

    await controller!.setMaxDbm(40);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 max_dbm=20.000000",
    );
    expect(controller!.highDbm).toBeCloseTo(20, 6);

    await controller!.setWnbEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 wnb=1",
    );
    expect(controller!.wnbEnabled).toBe(true);

    await controller!.setWnbLevel(30);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 wnb_level=30",
    );
    expect(controller!.wnbLevel).toBe(30);

    await controller!.setWnbLevel(150);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 wnb_level=100",
    );
    expect(controller!.wnbLevel).toBe(100);

    await controller!.setNoiseFloorPosition(45);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 pan_position=45",
    );
    expect(controller!.noiseFloorPosition).toBe(45);

    await controller!.setNoiseFloorPositionEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 pan_position_enable=0",
    );
    expect(controller!.noiseFloorPositionEnabled).toBe(false);

    await controller!.setBandZoom(true);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 band_zoom=1",
    );
    expect(controller!.isBandZoomOn).toBe(true);

    await controller!.setSegmentZoom(true);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 segment_zoom=1",
    );
    expect(controller!.isSegmentZoomOn).toBe(true);

    channel.prepareResponse({ message: "0,90,5,10,20,30" });
    await controller!.refreshRfGainInfo();
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan rfgain_info 0x40000000",
    );
    expect(controller!.rfGainLow).toBe(0);
    expect(controller!.rfGainHigh).toBe(90);
    expect(controller!.rfGainStep).toBe(5);
    expect(controller!.rfGainMarkers).toEqual([10, 20, 30]);

    await controller!.clickTune(14.2);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice m 14.200000 pan=0x40000000",
    );

    await controller!.setWidth(1024);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 xpixels=1024",
    );
    expect(controller!.width).toBe(1024);

    await controller!.setHeight(512);
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 ypixels=512",
    );
    expect(controller!.height).toBe(512);

    await controller!.update({
      average: 50,
      weightedAverage: true,
      noiseFloorPosition: 25,
      noiseFloorPositionEnabled: true,
      loggerDisplayEnabled: true,
      autoCenterEnabled: false,
    });
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan set 0x40000000 average=50 weighted_average=1 pan_position=25 pan_position_enable=1 n1mm_spectrum_enable=1",
    );
    expect(controller!.autoCenterEnabled).toBe(false);
    expect(controller!.noiseFloorPosition).toBe(25);
    expect(controller!.noiseFloorPositionEnabled).toBe(true);

    await controller!.close();
    expect(channel.commands.at(-1)?.command).toBe(
      "display pan remove 0x40000000",
    );

    channel.emit(makeStatus("S2|display pan 0x40000000 removed=1"));
    expect(session.panadapter("0x40000000")).toBeUndefined();
  });

  it("creates a panadapter via createPanadapter", async () => {
    const factory = new MockControlFactory();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor);
    const channel = factory.channel;
    if (!channel) throw new Error("control channel not created");

    const creation = session.createPanadapter({
      x: 200,
      y: 150,
      waitTimeoutMs: 2000,
    });
    expect(channel.commands.at(-1)?.command).toBe(
      "display panafall create x=200 y=150",
    );

    channel.emit(
      makeStatus(
        "S3|display pan 0x50000000 stream_id=0x50000000 center=14.050000 bandwidth=0.002000 rxant=ANT2",
      ),
    );

    const controller = await creation;
    expect(controller.id).toBe("0x50000000");
    expect(session.getPanadapter("0x50000000")?.bandwidthMHz).toBeCloseTo(
      0.002,
      6,
    );
  });
});
