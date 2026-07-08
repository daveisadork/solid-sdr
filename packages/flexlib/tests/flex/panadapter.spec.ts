import { describe, expect, it } from "vitest";
import { FlexClientClosedError } from "../../src/flex/errors.js";
import { createConnectedRadio } from "../helpers.js";

describe("Panadapter controller", () => {
  it("reflects state updates and issues commands", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // when a panadapter status message arrives
    connection.emitStatus(
      "S3A5E996B|display pan 0x40000000 client_handle=0x68AE2A9B wnb=1 wnb_level=90 wnb_updating=0 noise_floor_position=30 noise_floor_position_enable=1 band_zoom=0 segment_zoom=0 x_pixels=1902 y_pixels=201 center=14.999367 bandwidth=0.012634 min_dbm=-135.00 max_dbm=-40.00 fps=25 average=50 weighted_average=0 rfgain=8 rxant=ANT1 wide=1 loopa=0 loopb=0 band=33 daxiq_channel=0 waterfall=0x42000000 min_bw=0.001230 max_bw=14.745601 xvtr= pre=+8dB ant_list=ANT1,ANT2,RX_A,RX_B,XVTA,XVTB",
    );

    // then snapshot reflects parsed state
    const snapshot = radio.panadapter("0x40000000")?.snapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.bandwidthMHz).toBeCloseTo(0.012634, 6);
    expect(snapshot?.centerFrequencyMHz).toBeCloseTo(14.999367, 6);

    const controller = radio.panadapter("0x40000000");
    expect(controller).toBeDefined();
    expect(controller?.autoCenterEnabled).toBe(false);
    expect(controller?.wnbUpdating).toBe(false);
    expect(controller?.noiseFloorPosition).toBe(30);
    expect(controller?.noiseFloorPositionEnabled).toBe(true);
    expect(controller?.wideEnabled).toBe(true);
    expect(controller?.clientHandle).toBe(0x68ae2a9b);
    expect(controller?.xvtr).toBe("");
    expect(controller?.preampSetting).toBe("+8dB");
    expect(controller?.attachedSlices).toEqual([]);
    expect(controller?.rfGainMarkers).toEqual([]);
    expect(controller?.rfGainLow).toBe(0);
    expect(controller?.rfGainHigh).toBe(0);
    expect(controller?.rfGainStep).toBe(0);

    // when setCenterFrequency is called
    await controller?.setCenterFrequency(14.1);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 center=14.100000",
    );
    expect(controller?.centerFrequencyMHz).toBeCloseTo(14.1, 6);

    // when setBandwidth is called
    await controller?.setBandwidth(5);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 bandwidth=5.000000",
    );
    expect(controller?.bandwidthMHz).toBeCloseTo(5, 6);

    await controller?.setBandwidth(0.002);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 bandwidth=0.002000",
    );
    expect(controller?.bandwidthMHz).toBeCloseTo(0.002, 6);

    // when autoCenter is enabled, no command is sent immediately
    const commandCountBeforeAutoCenter = connection.commands.length;
    await controller?.setAutoCenter(true);
    expect(connection.commands.length).toBe(commandCountBeforeAutoCenter);
    expect(controller?.autoCenterEnabled).toBe(true);

    // when setBandwidth is called with autoCenter on, autocenter=1 is appended
    await controller?.setBandwidth(7);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 bandwidth=7.000000 autocenter=1",
    );
    expect(controller?.bandwidthMHz).toBeCloseTo(7, 6);

    // when setMinDbm is called with an out-of-range value, it clamps
    await controller?.setMinDbm(-400);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 min_dbm=-180.000000",
    );
    expect(controller?.lowDbm).toBeCloseTo(-180, 6);

    // when setMaxDbm is called with an out-of-range value, it clamps
    await controller?.setMaxDbm(40);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 max_dbm=20.000000",
    );
    expect(controller?.highDbm).toBeCloseTo(20, 6);

    // when WNB controls are used
    await controller?.setWnbEnabled(true);
    expect(connection.lastCommand()).toBe("display pan set 0x40000000 wnb=1");
    expect(controller?.wnbEnabled).toBe(true);

    await controller?.setWnbLevel(30);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 wnb_level=30",
    );
    expect(controller?.wnbLevel).toBe(30);

    // when wnb level exceeds max, it clamps to 100
    await controller?.setWnbLevel(150);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 wnb_level=100",
    );
    expect(controller?.wnbLevel).toBe(100);

    // when noise floor position controls are used
    await controller?.setNoiseFloorPosition(45);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 pan_position=45",
    );
    expect(controller?.noiseFloorPosition).toBe(45);

    await controller?.setNoiseFloorPositionEnabled(false);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 pan_position_enable=0",
    );
    expect(controller?.noiseFloorPositionEnabled).toBe(false);

    // when zoom controls are used
    await controller?.setBandZoom(true);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 band_zoom=1",
    );
    expect(controller?.isBandZoomOn).toBe(true);

    await controller?.setSegmentZoom(true);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 segment_zoom=1",
    );
    expect(controller?.isSegmentZoomOn).toBe(true);

    // when refreshRfGainInfo is called with a prepared response
    connection.prepareResponse("display pan rfgain_info", {
      message: "0,90,5,10,20,30",
    });
    await controller?.refreshRfGainInfo();
    expect(connection.lastCommand()).toBe("display pan rfgain_info 0x40000000");
    expect(controller?.rfGainLow).toBe(0);
    expect(controller?.rfGainHigh).toBe(90);
    expect(controller?.rfGainStep).toBe(5);
    expect(controller?.rfGainMarkers).toEqual([10, 20, 30]);

    // when clickTune is called
    await controller?.clickTune(14.2);
    expect(connection.lastCommand()).toBe("slice m 14.200000 pan=0x40000000");

    // when setWidth/setHeight are called
    await controller?.setWidth(1024);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 xpixels=1024",
    );
    expect(controller?.width).toBe(1024);

    await controller?.setHeight(512);
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 ypixels=512",
    );
    expect(controller?.height).toBe(512);

    // when update() is called with multiple fields
    await controller?.update({
      average: 50,
      weightedAverage: true,
      noiseFloorPosition: 25,
      noiseFloorPositionEnabled: true,
      loggerDisplayEnabled: true,
      autoCenterEnabled: false,
    });
    expect(connection.lastCommand()).toBe(
      "display pan set 0x40000000 average=50 weighted_average=1 pan_position=25 pan_position_enable=1 n1mm_spectrum_enable=1",
    );
    expect(controller?.autoCenterEnabled).toBe(false);
    expect(controller?.noiseFloorPosition).toBe(25);
    expect(controller?.noiseFloorPositionEnabled).toBe(true);

    // when close() is called
    await controller?.close();
    expect(connection.lastCommand()).toBe("display pan remove 0x40000000");

    // when a removal status arrives, the controller is gone
    connection.emitStatus("S2|display pan 0x40000000 removed");
    expect(radio.panadapter("0x40000000")).toBeUndefined();
  });

  it("creates a panadapter via createPanadapter", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // given the radio will respond with pan+waterfall IDs and status is pre-emitted
    connection.emitStatus(
      "S3|display pan 0x50000000 stream_id=0x50000000 center=14.050000 bandwidth=0.002000 rxant=ANT2",
    );
    connection.prepareResponse("display panafall create", {
      message: "0x50000000,0x52000000",
    });

    // when createPanadapter is called
    const controller = await radio.createPanadapter({
      x: 200,
      y: 150,
    });

    // then the correct command was sent and the controller is available
    expect(connection.commands).toContain(
      "display panafall create x=200 y=150",
    );
    expect(controller.id).toBe("0x50000000");
    expect(
      radio.panadapter("0x50000000")?.snapshot()?.bandwidthMHz,
    ).toBeCloseTo(0.002, 6);
  });

  it("rejects pending panadapter creation when the session closes", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    // given a custom response is prepared but no status will arrive
    connection.prepareResponse("display panafall create", {
      message: "0x50000001,0x52000001",
    });

    // when createPanadapter is called and the radio disconnects before status arrives
    const creation = radio.createPanadapter();

    // Disconnect immediately to reject pending commands
    await radio.disconnect();

    // then the creation promise rejects with a closed error
    await expect(creation).rejects.toBeInstanceOf(FlexClientClosedError);
  });
});
