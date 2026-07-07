import { describe, expect, it } from "vitest";
import { FlexCommandRejectedError } from "../../src/flex/errors.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";
import { createConnectedRadio } from "../helpers.js";

describe("Radio", () => {
  it("connects and updates slice state", async () => {
    // given a connected radio
    const { radio, connection } = await createConnectedRadio();

    const changes: RadioStateChange[] = [];
    radio.on("change", (change) => {
      changes.push(change);
    });

    // when the radio sends a slice status message
    connection.emitStatus("S1|slice 0 freq=14.074000 mode=USB active=1");

    // a slice controller should be available
    const slice = radio.slice("0");
    expect(slice).toBeDefined();
    expect(slice?.frequencyMHz).toBeCloseTo(14.074);
    expect(slice?.mode).toBe("USB");
    expect(slice?.isActive).toBe(true);
    expect(changes.length).toBe(1);

    // when we tune the slice
    await slice?.setFrequency(14.075);
    expect(connection.lastCommand()).toBe("slice tune 0 14.075000 autopan=1");
    expect(slice?.frequencyMHz).toBeCloseTo(14.075);
    expect(changes.length).toBe(2);

    // when we change the mode
    await slice?.setMode("DIGU");
    expect(connection.lastCommand()).toBe("slice set 0 mode=DIGU");
    expect(slice?.mode).toBe("DIGU");

    // when we lock and unlock
    await slice?.setLocked(true);
    expect(connection.lastCommand()).toBe("slice lock 0");
    expect(slice?.isLocked).toBe(true);

    await slice?.setLocked(false);
    expect(connection.lastCommand()).toBe("slice unlock 0");
    expect(slice?.isLocked).toBe(false);

    // when we set various filter/noise reduction parameters
    await slice?.setRfGain(120);
    expect(connection.lastCommand()).toBe("slice set 0 rfgain=120");

    await slice?.setFilter(-300, 300);
    expect(connection.lastCommand()).toBe("filt 0 -300 300");
    expect(slice?.filterLowHz).toBe(-300);
    expect(slice?.filterHighHz).toBe(300);

    await slice?.setNrEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 nr=1");

    await slice?.setNrLevel(5);
    expect(connection.lastCommand()).toBe("slice set 0 nr_level=5");

    await slice?.setNrlEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 lms_nr=1");

    await slice?.setNrlLevel(15);
    expect(connection.lastCommand()).toBe("slice set 0 lms_nr_level=15");

    await slice?.setAnflEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 lms_anf=1");

    await slice?.setAnflLevel(25);
    expect(connection.lastCommand()).toBe("slice set 0 lms_anf_level=25");

    await slice?.setNrsEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 speex_nr=1");

    await slice?.setNrsLevel(18);
    expect(connection.lastCommand()).toBe("slice set 0 speex_nr_level=18");

    await slice?.setRnnEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 rnnoise=1");

    await slice?.setAnftEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 anft=1");

    await slice?.setNrfEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 nrf=1");

    await slice?.setNrfLevel(40);
    expect(connection.lastCommand()).toBe("slice set 0 nrf_level=40");

    await slice?.setEscEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 esc=on");

    await slice?.setEscGain(0.8);
    expect(connection.lastCommand()).toBe("slice set 0 esc_gain=0.8");

    await slice?.setEscPhaseShift(12.5);
    expect(connection.lastCommand()).toBe("slice set 0 esc_phase_shift=12.5");

    await slice?.setAgcMode("fast");
    expect(connection.lastCommand()).toBe("slice set 0 agc_mode=fast");

    await slice?.setRttyMark(1700);
    expect(connection.lastCommand()).toBe("slice set 0 rtty_mark=1700");

    await slice?.setRttyShift(170);
    expect(connection.lastCommand()).toBe("slice set 0 rtty_shift=170");

    await slice?.setFmToneValue(100.0);
    expect(connection.lastCommand()).toBe("slice set 0 fm_tone_value=100.0");

    await slice?.setFmPreDeEmphasisEnabled(true);
    expect(connection.lastCommand()).toBe("slice set 0 dfm_pre_de_emphasis=1");

    await slice?.setTuneStepList([10, 50, 100]);
    expect(connection.lastCommand()).toBe("slice set 0 step_list=10,50,100");
    expect(slice?.tuneStepListHz).toEqual([10, 50, 100]);

    await slice?.cwAutoTune({ intermittent: true });
    expect(connection.lastCommand()).toBe("slice auto_tune 0 int=1");

    // batch update
    await slice?.update({
      audioGain: 55,
      agcThreshold: 65,
      loopAEnabled: true,
      txOffsetFrequencyMHz: 0.0015,
    });
    expect(connection.lastCommand()).toBe(
      "slice set 0 audio_level=55 agc_threshold=65 loopa=1 tx_offset_freq=0.001500",
    );
    expect(slice?.audioGain).toBe(55);
    expect(slice?.agcThreshold).toBe(65);
    expect(slice?.loopAEnabled).toBe(true);
    expect(slice?.txOffsetFrequencyMHz).toBeCloseTo(0.0015);

    // feature license
    connection.emitStatus(
      "S1|license feature name=smartlink enabled=1 reason=license_file",
    );
    const featureLicense = radio.featureLicense();
    expect(featureLicense.getFeature("smartlink")?.reason).toBe("license_file");

    // slice removal
    connection.emitStatus("S2|slice 0 in_use=0");
    expect(radio.slice("0")).toBeUndefined();
  });

  it("creates remote audio stream controllers", async () => {
    const { radio, connection } = await createConnectedRadio();

    // when we create a remote audio rx stream
    connection.prepareResponse("stream create", { message: "4000008" });
    const creationPromise = radio.createRemoteAudioRxStream({
      compression: "opus",
    });
    expect(connection.lastCommand()).toBe(
      "stream create type=remote_audio_rx compression=OPUS",
    );

    // and the radio confirms the stream with a status message
    connection.emitStatus(
      "S1|stream 0x04000008 type=remote_audio_rx compression=OPUS client_handle=0x1234 ip=10.0.0.5",
    );

    const stream = await creationPromise;
    expect(stream.streamId).toBe("0x04000008");
    expect(stream.compression).toBe("OPUS");
    expect(stream.clientHandle).toBe(0x1234);
    expect(stream.radioAck).toBe(true);
    expect(stream.ip).toBe("10.0.0.5");

    // when the stream state is updated
    connection.emitStatus("S1|stream 0x04000008 ip=10.0.0.6 slice=1");
    expect(stream.ip).toBe("10.0.0.6");
    expect(stream.slice).toBe("1");

    // when we close the stream
    await stream.close();
    expect(connection.lastCommand()).toBe("stream remove 0x04000008");
  });

  it("creates remote audio tx stream controllers", async () => {
    const { radio, connection } = await createConnectedRadio();

    connection.prepareResponse("stream create", { message: "4000009" });
    const creationPromise = radio.createRemoteAudioTxStream();
    expect(connection.lastCommand()).toBe("stream create type=remote_audio_tx");

    connection.emitStatus(
      "S1|stream 0x04000009 type=remote_audio_tx compression=OPUS client_handle=0x5678",
    );

    const stream = await creationPromise;
    expect(stream.type).toBe("remote_audio_tx");
    expect(stream.clientHandle).toBe(0x5678);
    expect(stream.radioAck).toBe(true);
  });

  it("creates dax rx audio stream controllers", async () => {
    const { radio, connection } = await createConnectedRadio();

    connection.prepareResponse("stream create", { message: "2000002" });
    const creationPromise = radio.createDaxRxAudioStream({
      daxChannel: 3,
    });
    expect(connection.lastCommand()).toBe(
      "stream create type=dax_rx dax_channel=3",
    );

    connection.emitStatus(
      "S1|stream 0x02000002 type=dax_rx dax_channel=3 client_handle=0x9ABC",
    );

    const stream = await creationPromise;
    expect(stream.type).toBe("dax_rx");
    expect(stream.daxChannel).toBe(3);
    expect(stream.clientHandle).toBe(0x9abc);
    expect(stream.radioAck).toBe(true);
  });

  it.each([
    { input: 50, expected: 50 },
    { input: 150, expected: 100 },
    { input: -10, expected: 0 },
  ])("clamps dax rx gain and resolves slice letter to numeric id: setRxGain($input) → $expected", async ({
    input,
    expected,
  }) => {
    const { radio, connection } = await createConnectedRadio();
    // slice 1 has display letter B
    connection.emitStatus("S1|slice 1 index_letter=B");
    connection.prepareResponse("stream create", { message: "2000002" });
    const creationPromise = radio.createDaxRxAudioStream({ daxChannel: 3 });
    // stream status reports slice binding as the letter
    connection.emitStatus(
      "S1|stream 0x02000002 type=dax_rx dax_channel=3 slice=B client_handle=0x9ABC",
    );
    const stream = await creationPromise;

    await stream.setRxGain(input);

    // wire command sends the numeric slice id, not the letter
    expect(connection.lastCommand()).toBe(
      `audio stream 0x02000002 slice 1 gain ${expected}`,
    );
  });

  it("throws when setting dax rx gain on a stream with no slice bound", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("stream create", { message: "2000002" });
    const creationPromise = radio.createDaxRxAudioStream({ daxChannel: 3 });
    connection.emitStatus(
      "S1|stream 0x02000002 type=dax_rx dax_channel=3 client_handle=0x9ABC",
    );
    const stream = await creationPromise;

    await expect(stream.setRxGain(50)).rejects.toThrow(/no slice bound/);
  });

  it("creates dax tx audio stream controllers and requests tx ownership", async () => {
    const { radio, connection } = await createConnectedRadio();

    connection.prepareResponse("stream create", { message: "2000003" });
    const creationPromise = radio.createDaxTxAudioStream();
    expect(connection.lastCommand()).toBe("stream create type=dax_tx");

    connection.emitStatus(
      "S1|stream 0x02000003 type=dax_tx client_handle=0xC0FFEE tx=0",
    );

    const stream = await creationPromise;
    expect(stream.type).toBe("dax_tx");
    expect(stream.clientHandle).toBe(0xc0ffee);
    expect(stream.radioAck).toBe(true);
    expect(stream.tx).toBe(false);

    await stream.requestTx(true);
    expect(connection.lastCommand()).toBe("stream set 0x02000003 tx=1");

    connection.emitStatus("S1|stream 0x02000003 tx=1");
    expect(stream.tx).toBe(true);

    await stream.requestTx(false);
    expect(connection.lastCommand()).toBe("stream set 0x02000003 tx=0");
  });

  it("creates dax iq audio stream controllers", async () => {
    const { radio, connection } = await createConnectedRadio();

    connection.prepareResponse("stream create", { message: "5000001" });
    const creationPromise = radio.createDaxIqStream({ daxIqChannel: 2 });
    expect(connection.lastCommand()).toBe(
      "stream create type=dax_iq daxiq_channel=2",
    );

    connection.emitStatus(
      "S1|stream 0x05000001 type=dax_iq daxiq_channel=2 daxiq_rate=48000 active=1 client_handle=0x9ABC",
    );

    const stream = await creationPromise;
    expect(stream.type).toBe("dax_iq");
    expect(stream.daxIqChannel).toBe(2);
    expect(stream.daxIqRate).toBe(48_000);
    expect(stream.active).toBe(true);
    expect(stream.clientHandle).toBe(0x9abc);
    expect(stream.radioAck).toBe(true);
  });

  it("sends an additional daxiq_rate command when sampleRate is provided", async () => {
    const { radio, connection } = await createConnectedRadio();

    connection.prepareResponse("stream create", { message: "5000002" });
    const creationPromise = radio.createDaxIqStream({
      daxIqChannel: 1,
      sampleRate: 96000,
    });

    connection.emitStatus(
      "S1|stream 0x05000002 type=dax_iq daxiq_channel=1 daxiq_rate=24000 client_handle=0x9ABC",
    );

    await creationPromise;

    expect(connection.lastCommand()).toBe(
      "stream set 0x05000002 daxiq_rate=96000",
    );
  });

  it("surfaces command rejections with error details", async () => {
    const { radio, connection } = await createConnectedRadio();

    // given a slice exists
    connection.emitStatus("S1|slice 1 freq=14.100000");
    const slice = radio.slice("1");
    expect(slice).toBeDefined();

    // when the radio rejects a command
    connection.prepareResponse("slice set", {
      accepted: false,
      message: "Invalid mode",
      code: 0x50000001,
    });

    // the error should include the rejection reason
    await expect(slice?.setMode("INVALID")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(FlexCommandRejectedError);
        const flexError = error as FlexCommandRejectedError;
        expect(flexError.message).toContain(
          "reason=Unable to get foundation receiver assignment",
        );
        return true;
      },
    );
  });

  it("requests new slices", async () => {
    const { radio, connection } = await createConnectedRadio();

    // given the radio will return a new slice index and emit its status
    connection.emitStatus("S1|slice 0 mode=LSB");
    connection.prepareResponse("slice create", { message: "0" });

    // when we request a slice with no options
    const slice1 = await radio.requestSlice();
    expect(connection.lastCommand()).toBe("slice create");
    expect(slice1.id).toBe("0");

    // given the radio will return the next slice
    connection.emitStatus("S1|slice 1 mode=DIGU pan=0x40000000");
    connection.prepareResponse("slice create", { message: "1" });

    // when we request a slice with full options
    const slice2 = await radio.requestSlice({
      panadapterStreamId: "40000000",
      demodMode: "DIGU",
      frequencyMHz: 14.074,
      rxAntenna: "ANT2",
      loadPersistence: true,
    });
    expect(connection.lastCommand()).toBe(
      "slice create pan=0x40000000 freq=14.074000 rxant=ANT2 mode=DIGU load_from=PERSISTENCE",
    );
    expect(slice2.id).toBe("1");
  });

  it("clones a slice", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|slice 0 mode=LSB pan=0x40000000");

    const source = radio.slice("0")!;

    // given the radio will return the cloned slice index and emit its status
    connection.emitStatus("S1|slice 1 mode=LSB pan=0x40000000");
    connection.prepareResponse("slice create clone_slice", { message: "1" });

    const cloned = await source.clone();

    expect(connection.lastCommand()).toBe(
      "slice create clone_slice=0 pan=0x40000000 load_from=clone",
    );
    expect(cloned.id).toBe("1");
  });

  it("provides radio snapshots and gps convenience getters", async () => {
    const { radio, connection } = await createConnectedRadio();

    // when the radio sends GPS, radio status, ATU, and transmit status
    connection.emitStatus(
      "S0|gps lat=38.433731667#lon=-90.454651667#grid=EM48sk#altitude=235 m#tracked=10#visible=31#speed=0 kts#freq_error=0 ppb#status=Fine Lock#time=21:16:12Z#track=0.0",
    );
    connection.emitStatus(
      "S4E48881B|radio slices=4 panadapters=4 lineout_gain=49 lineout_mute=0 headphone_gain=50 headphone_mute=0 remote_on_enabled=0 pll_done=0 freq_error_ppb=0 cal_freq=15.000000 tnf_enabled=1 nickname=FLEX-8600 callsign=KF0SMY binaural_rx=0 full_duplex_enabled=1 band_persistence_enabled=1 rtty_mark_default=2125 enforce_private_ip_connections=1 backlight=50 mute_local_audio_when_remote=1 daxiq_capacity=16 daxiq_available=16 alpha=0 low_latency_digital_modes=0 mf_enable=1 auto_save=1 max_internal_pa_power=100 external_pa_allowed=1",
    );
    connection.emitStatus(
      "S0|atu status=TUNE_SUCCESSFUL atu_enabled=1 memories_enabled=1 using_mem=1",
    );
    connection.emitStatus(
      "S4E48881B|transmit mic_selection=MIC mic_level=40 pitch=500 speed=28 synccwx=1 iambic=1 iambic_mode=2 swap_paddles=0 break_in=1 sidetone=1 cwl_enabled=1 break_in_delay=200",
    );

    // the snapshot should contain all radio properties
    const snapshot = radio.snapshot();
    expect(snapshot?.gpsLatitude).toBeCloseTo(38.433731667, 9);
    expect(snapshot?.gpsStatus).toBe("Fine Lock");
    expect(snapshot?.lineoutGain).toBe(49);
    expect(snapshot?.fullDuplexEnabled).toBe(true);
    expect(snapshot?.atuTuneStatus).toBe("TUNE_SUCCESSFUL");

    // and radio-level Proxy properties should work directly
    expect(radio.gpsLatitude).toBeCloseTo(38.433731667, 9);
    expect(radio.gpsLongitude).toBeCloseTo(-90.454651667, 9);
    expect(radio.gpsAltitude).toBe("235 m");
    expect(radio.gpsSatellitesTracked).toBe(10);
    expect(radio.gpsStatus).toBe("Fine Lock");
    expect(radio.gpsUtcTime).toBe("21:16:12Z");
    expect(radio.lineoutGain).toBe(49);
    expect(radio.headphoneGain).toBe(50);
    expect(radio.fullDuplexEnabled).toBe(true);
    expect(radio.enforcePrivateIpConnections).toBe(true);
    expect(radio.tnfEnabled).toBe(true);
    expect(radio.maxInternalPaPower).toBe(100);
    expect(radio.atuEnabled).toBe(true);
    expect(radio.atuMemoriesEnabled).toBe(true);
    expect(radio.atuTuneStatus).toBe("TUNE_SUCCESSFUL");
    expect(radio.micSelection).toBe("MIC");
    expect(radio.cwPitchHz).toBe(500);
    expect(radio.cwSpeedWpm).toBe(28);
    expect(radio.cwIambicMode).toBe("strict_b");
    expect(radio.cwBreakInDelayMs).toBe(200);

    // when we call radio-level setters
    connection.prepareResponse("mic list", {
      message: "MIC,BAL,LINE,ACC,PC",
    });
    await radio.refreshMicList();
    expect(connection.lastCommand()).toBe("mic list");
    expect(radio.micInputList).toEqual(["MIC", "BAL", "LINE", "ACC", "PC"]);

    await radio.setMicSelection("PC");
    expect(connection.lastCommand()).toBe("mic input PC");

    await radio.setNickname("New Nick!");
    expect(connection.lastCommand()).toBe("radio name New Nick");

    await radio.setCallsign("kf0smy");
    expect(connection.lastCommand()).toBe("radio callsign KF0SMY");

    await radio.setFullDuplexEnabled(false);
    expect(connection.lastCommand()).toBe("radio set full_duplex_enabled=0");

    await radio.setNetworkMtu(1428);
    expect(connection.lastCommand()).toBe(
      "client set enforce_network_mtu=1 network_mtu=1428",
    );

    await radio.setLineoutGain(105);
    // should clamp to 100
    expect(connection.lastCommand()).toBe("mixer lineout gain 100");

    await radio.setCwPitchHz(50);
    // should clamp to 100
    expect(connection.lastCommand()).toBe("cw pitch 100");

    await radio.setCwSpeedWpm(3);
    // should clamp to 5
    expect(connection.lastCommand()).toBe("cw wpm 5");

    await radio.setCwIambicMode("bug");
    expect(connection.lastCommand()).toBe("cw mode 3");

    await radio.setCwBreakInDelayMs(2500);
    // should clamp to 2000
    expect(connection.lastCommand()).toBe("cw break_in_delay 2000");

    await radio.startAtuTune();
    expect(connection.lastCommand()).toBe("atu start");

    await radio.bypassAtu();
    expect(connection.lastCommand()).toBe("atu bypass");

    await radio.clearAtuMemories();
    expect(connection.lastCommand()).toBe("atu clear");
  });

  it("issues a radio reboot command", async () => {
    const { radio, connection } = await createConnectedRadio();

    await radio.rebootRadio();

    expect(connection.lastCommand()).toBe("radio reboot");
  });

  it("emits disconnected reason when another client forces us off", async () => {
    const { radio, connection } = await createConnectedRadio();
    const reasons: Array<string | undefined> = [];

    radio.on("disconnected", (reason) => {
      reasons.push(reason);
    });

    connection.emitStatus(
      "S54188496|client 0x12345678 disconnected forced=1 wan_validation_failed=0 duplicate_client_id=0",
    );
    connection.emitClose();

    expect(reasons).toEqual(["forced"]);
  });

  it("emits disconnected reason for duplicate client id disconnects", async () => {
    const { radio, connection } = await createConnectedRadio();
    const reasons: Array<string | undefined> = [];

    radio.on("disconnected", (reason) => {
      reasons.push(reason);
    });

    connection.emitStatus(
      "S597D5352|client 0x12345678 disconnected forced=0 wan_validation_failed=0 duplicate_client_id=1",
    );
    connection.emitClose();

    expect(reasons).toEqual(["duplicate_client_id"]);
  });
});
