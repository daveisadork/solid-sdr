import { describe, expect, it } from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createFlexClient } from "../../src/flex/session.js";
import {
  FlexClientClosedError,
  FlexCommandRejectedError,
} from "../../src/flex/errors.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";
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

describe("FlexClient", () => {
  it("connects and updates slice state", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    expect(channel).toBeDefined();
    

    const changes: RadioStateChange[] = [];
    session.on("change", (change) => {
      changes.push(change);
    });

    channel.emit(makeStatus("S1|slice 0 freq=14.074000 mode=USB active=1"));

    const slice = session.slice("0");
    expect(slice).toBeDefined();
    expect(slice?.frequencyMHz).toBeCloseTo(14.074);
    expect(slice?.mode).toBe("USB");
    expect(slice?.isActive).toBe(true);
    expect(changes.length).toBe(1);

    await slice?.setFrequency(14.075);
    expect(channel.commands.at(-1)?.command).toBe("slice tune 0 14.075000");
    expect(slice?.frequencyMHz).toBeCloseTo(14.075);
    expect(changes.length).toBe(2);

    await slice?.setMode("DIGU");
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 mode=DIGU");
    expect(slice?.mode).toBe("DIGU");

    await slice?.setLocked(true);
    expect(channel.commands.at(-1)?.command).toBe("slice lock 0");
    expect(slice?.isLocked).toBe(true);

    await slice?.setLocked(false);
    expect(channel.commands.at(-1)?.command).toBe("slice unlock 0");
    expect(slice?.isLocked).toBe(false);

    await slice?.setRfGain(120);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 rfgain=120");
    expect(slice?.rfGain).toBe(120);

    await slice?.setFilter(-300, 300);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 filter_lo=-300 filter_hi=300",
    );
    expect(slice?.filterLowHz).toBe(-300);
    expect(slice?.filterHighHz).toBe(300);

    await slice?.setNrEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 nr=1");
    expect(slice?.nrEnabled).toBe(true);

    await slice?.setNrLevel(5);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 nr_level=5");
    expect(slice?.nrLevel).toBe(5);

    await slice?.setNrlEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 lms_nr=1");
    expect(slice?.nrlEnabled).toBe(true);

    await slice?.setNrlLevel(15);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 lms_nr_level=15",
    );
    expect(slice?.nrlLevel).toBe(15);

    await slice?.setAnflEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 lms_anf=1");
    expect(slice?.anflEnabled).toBe(true);

    await slice?.setAnflLevel(25);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 lms_anf_level=25",
    );
    expect(slice?.anflLevel).toBe(25);

    await slice?.setNrsEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 speex_nr=1");
    expect(slice?.nrsEnabled).toBe(true);

    await slice?.setNrsLevel(18);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 speex_nr_level=18",
    );
    expect(slice?.nrsLevel).toBe(18);

    await slice?.setRnnEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 rnnoise=1");
    expect(slice?.rnnEnabled).toBe(true);

    await slice?.setAnftEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 anft=1");
    expect(slice?.anftEnabled).toBe(true);

    await slice?.setNrfEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 nrf=1");
    expect(slice?.nrfEnabled).toBe(true);

    await slice?.setNrfLevel(40);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 nrf_level=40");
    expect(slice?.nrfLevel).toBe(40);

    await slice?.setEscEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 esc=on");
    expect(slice?.escEnabled).toBe(true);

    await slice?.setEscGain(0.8);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 esc_gain=0.8");
    expect(slice?.escGain).toBeCloseTo(0.8);

    await slice?.setEscPhaseShift(12.5);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 esc_phase_shift=12.5",
    );
    expect(slice?.escPhaseShift).toBeCloseTo(12.5);

    await slice?.setAgcMode("fast");
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 agc_mode=fast");
    expect(slice?.agcMode).toBe("fast");

    await slice?.setRttyMark(1700);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 rtty_mark=1700");
    expect(slice?.rttyMarkHz).toBe(1700);

    await slice?.setRttyShift(170);
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 rtty_shift=170");
    expect(slice?.rttyShiftHz).toBe(170);

    await slice?.setFmToneValue(100.0);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 fm_tone_value=100.000000",
    );
    expect(slice?.fmToneValue).toBe("100.000000");

    await slice?.setFmPreDeEmphasisEnabled(true);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 dfm_pre_de_emphasis=1",
    );
    expect(slice?.fmPreDeEmphasisEnabled).toBe(true);

    await slice?.setTuneStepList([10, 50, 100]);
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 step_list=10,50,100",
    );
    expect(slice?.tuneStepListHz).toEqual([10, 50, 100]);

    await slice?.cwAutoTune({ intermittent: true });
    expect(channel.commands.at(-1)?.command).toBe("slice auto_tune 0 int=1");

    await slice?.update({
      audioGain: 55,
      agcThreshold: 65,
      loopAEnabled: true,
      txOffsetFrequencyMHz: 0.0015,
    });
    expect(channel.commands.at(-1)?.command).toBe(
      "slice set 0 audio_level=55 agc_threshold=65 loopa=1 tx_offset_freq=0.001500",
    );
    expect(slice?.audioGain).toBe(55);
    expect(slice?.agcThreshold).toBe(65);
    expect(slice?.loopAEnabled).toBe(true);
    expect(slice?.txOffsetFrequencyMHz).toBeCloseTo(0.0015);

    channel.emit(
      makeStatus(
        "S1|license feature name=smartlink enabled=1 reason=license_file",
      ),
    );
    const featureLicense = session.getFeatureLicense();
    expect(featureLicense?.features["smartlink"]?.enabled).toBe(true);
    const controller = session.featureLicense();
    expect(controller.getFeature("smartlink")?.reason).toBe("license_file");
    await controller.sendCommand("license refresh");
    expect(channel.commands.at(-1)?.command).toBe("license refresh");

    channel.emit(makeStatus("S2|slice 0 in_use=0"));
    expect(session.getSlice("0")).toBeUndefined();
  });

  it("creates remote audio stream controllers", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();

    expect(session.getRemoteAudioRxStreams()).toHaveLength(0);

    channel.prepareResponse({ message: "4000008" });
    const creationPromise = session.createRemoteAudioRxStream({
      compression: "opus",
    });
    expect(channel.commands.at(-1)?.command).toBe(
      "stream create type=remote_audio_rx compression=OPUS",
    );

    channel.emit(
      makeStatus(
        "S1|stream 0x04000008 type=remote_audio_rx compression=OPUS client_handle=0x1234 ip=10.0.0.5",
      ),
    );

    const stream = await creationPromise;
    expect(stream.streamId).toBe("0x04000008");
    expect(stream.compression).toBe("OPUS");
    expect(stream.clientHandle).toBe(0x1234);
    expect(stream.ip).toBe("10.0.0.5");

    expect(session.getAudioStreams()).toHaveLength(1);
    expect(session.getRemoteAudioRxStreams()).toHaveLength(1);
    expect(session.audioStream("0x04000008")).toBe(stream);
    expect(session.remoteAudioRxStream("0x04000008")).toBe(stream);

    channel.emit(makeStatus("S1|stream 0x04000008 ip=10.0.0.6 slice=1"));
    expect(stream.ip).toBe("10.0.0.6");
    expect(stream.slice).toBe("1");

    await stream.close();
    expect(channel.commands.at(-1)?.command).toBe("stream remove 0x04000008");

    channel.emit(makeStatus("S1|stream 0x04000008 removed=1"));
    expect(session.getAudioStreams()).toHaveLength(0);
    expect(session.getRemoteAudioRxStream("0x04000008")).toBeUndefined();
    expect(session.remoteAudioRxStream("0x04000008")).toBeUndefined();
    expect(session.audioStream("0x04000008")).toBeUndefined();
  });

  it("creates remote audio tx stream controllers", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    

    channel.prepareResponse({ message: "4000009" });
    const creationPromise = session.createRemoteAudioTxStream();
    expect(channel.commands.at(-1)?.command).toBe(
      "stream create type=remote_audio_tx",
    );

    channel.emit(
      makeStatus(
        "S1|stream 0x04000009 type=remote_audio_tx compression=OPUS client_handle=0x5678",
      ),
    );

    const stream = await creationPromise;
    expect(stream.type).toBe("remote_audio_tx");
    expect(stream.clientHandle).toBe(0x5678);
    expect(session.audioStream("0x04000009")).toBe(stream);
  });

  it("creates dax rx audio stream controllers", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    

    channel.prepareResponse({ message: "2000002" });
    const creationPromise = session.createDaxRxAudioStream({
      daxChannel: 3,
    });
    expect(channel.commands.at(-1)?.command).toBe(
      "stream create type=dax_rx dax_channel=3",
    );

    channel.emit(
      makeStatus(
        "S1|stream 0x02000002 type=dax_rx dax_channel=3 client_handle=0x9ABC",
      ),
    );

    const stream = await creationPromise;
    expect(stream.type).toBe("dax_rx");
    expect(stream.daxChannel).toBe(3);
    expect(stream.clientHandle).toBe(0x9abc);
    expect(session.audioStream("0x02000002")).toBe(stream);
  });

  it("allows closing audio streams after they are removed from state", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    

    channel.prepareResponse({ message: "400000A" });
    const creationPromise = session.createRemoteAudioRxStream();
    expect(channel.commands.at(-1)?.command).toBe(
      "stream create type=remote_audio_rx",
    );

    channel.emit(
      makeStatus("S1|stream 0x0400000A type=remote_audio_rx compression=OPUS"),
    );

    const stream = await creationPromise;
    channel.emit(makeStatus("S1|stream 0x0400000A removed=1"));

    await stream.close();
    expect(channel.commands.at(-1)?.command).toBe("stream remove 0x0400000A");
  });

  it("rejects pending audio stream creation when the session closes", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    

    channel.prepareResponse({ message: "400000B" });
    const creationPromise = session.createRemoteAudioRxStream();
    expect(channel.commands.at(-1)?.command).toBe(
      "stream create type=remote_audio_rx",
    );

    await session.close();
    await expect(creationPromise).rejects.toBeInstanceOf(FlexClientClosedError);
  });

  it("surfaces command rejections", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    

    channel.emit(makeStatus("S1|slice 1 freq=14.100000"));

    const slice = session.slice("1");
    expect(slice).toBeDefined();

    channel.prepareResponse({
      accepted: false,
      message: "Invalid mode",
      code: 0x50000001,
    });

    await expect(slice!.setMode("INVALID")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(FlexCommandRejectedError);
        const flexError = error as FlexCommandRejectedError;
        expect(flexError.message).toContain(
          "reason=Unable to get foundation receiver assignment",
        );
        expect(flexError.codeDescription).toBe(
          "Unable to get foundation receiver assignment",
        );
        return true;
      },
    );
  });

  it("provides radio snapshots and gps convenience getters", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    expect(channel).toBeDefined();
    

    const gpsStatus =
      "S0|gps lat=38.433731667#lon=-90.454651667#grid=EM48sk#altitude=235 m#tracked=10#visible=31#speed=0 kts#freq_error=0 ppb#status=Fine Lock#time=21:16:12Z#track=0.0";
    const radioStatus =
      "S4E48881B|radio slices=4 panadapters=4 lineout_gain=49 lineout_mute=0 headphone_gain=50 headphone_mute=0 remote_on_enabled=0 pll_done=0 freq_error_ppb=0 cal_freq=15.000000 tnf_enabled=1 nickname=FLEX-8600 callsign=KF0SMY binaural_rx=0 full_duplex_enabled=1 band_persistence_enabled=1 rtty_mark_default=2125 enforce_private_ip_connections=1 backlight=50 mute_local_audio_when_remote=1 daxiq_capacity=16 daxiq_available=16 alpha=0 low_latency_digital_modes=0 mf_enable=1 auto_save=1 max_internal_pa_power=100 external_pa_allowed=1";
    const atuStatus =
      "S0|atu status=TUNE_SUCCESSFUL atu_enabled=1 memories_enabled=1 using_mem=1";

    channel.emit(makeStatus(gpsStatus));
    channel.emit(makeStatus(radioStatus));
    channel.emit(makeStatus(atuStatus));

    const radioSnapshot = session.getRadio();
    expect(radioSnapshot?.gpsLatitude).toBeCloseTo(38.433731667, 9);
    expect(radioSnapshot?.gpsStatus).toBe("Fine Lock");
    expect(radioSnapshot?.lineoutGain).toBe(49);
    expect(radioSnapshot?.lineoutMute).toBe(false);
    expect(radioSnapshot?.headphoneGain).toBe(50);
    expect(radioSnapshot?.headphoneMute).toBe(false);
    expect(radioSnapshot?.fullDuplexEnabled).toBe(true);
    expect(radioSnapshot?.enforcePrivateIpConnections).toBe(true);
    expect(radioSnapshot?.bandPersistenceEnabled).toBe(true);
    expect(radioSnapshot?.tnfEnabled).toBe(true);
    expect(radioSnapshot?.binauralRx).toBe(false);
    expect(radioSnapshot?.maxInternalPaPower).toBe(100);
    expect(radioSnapshot?.externalPaAllowed).toBe(true);
    expect(radioSnapshot?.daxIqCapacity).toBe(16);
    expect(radioSnapshot?.frequencyErrorPpb).toBe(0);
    expect(radioSnapshot?.atuEnabled).toBe(true);
    expect(radioSnapshot?.atuMemoriesEnabled).toBe(true);
    expect(radioSnapshot?.atuUsingMemory).toBe(true);
    expect(radioSnapshot?.atuTuneStatus).toBe("TUNE_SUCCESSFUL");

    const radio = session.radio();
    expect(radio.gpsLatitude).toBeCloseTo(38.433731667, 9);
    expect(radio.gpsLongitude).toBeCloseTo(-90.454651667, 9);
    expect(radio.gpsAltitude).toBe("235 m");
    expect(radio.gpsSatellitesTracked).toBe(10);
    expect(radio.gpsSatellitesVisible).toBe(31);
    expect(radio.gpsStatus).toBe("Fine Lock");
    expect(radio.gpsUtcTime).toBe("21:16:12Z");
    expect(radio.gpsTrack).toBeCloseTo(0, 6);
    expect(radio.lineoutGain).toBe(49);
    expect(radio.lineoutMute).toBe(false);
    expect(radio.headphoneGain).toBe(50);
    expect(radio.headphoneMute).toBe(false);
    expect(radio.fullDuplexEnabled).toBe(true);
    expect(radio.enforcePrivateIpConnections).toBe(true);
    expect(radio.networkMtu).toBe(1500);
    expect(radio.bandPersistenceEnabled).toBe(true);
    expect(radio.tnfEnabled).toBe(true);
    expect(radio.muteLocalAudioWhenRemote).toBe(true);
    expect(radio.maxInternalPaPower).toBe(100);
    expect(radio.externalPaAllowed).toBe(true);
    expect(radio.atuEnabled).toBe(true);
    expect(radio.atuMemoriesEnabled).toBe(true);
    expect(radio.atuUsingMemory).toBe(true);
    expect(radio.atuTuneStatus).toBe("TUNE_SUCCESSFUL");

    await radio.setNickname("New Nick!");
    expect(channel.commands.at(-1)?.command).toBe("radio name New Nick");
    expect(session.getRadio()?.nickname).toBe("New Nick");

    await radio.setCallsign("kf0smy");
    expect(channel.commands.at(-1)?.command).toBe("radio callsign KF0SMY");
    expect(session.getRadio()?.callsign).toBe("KF0SMY");

    await radio.setFullDuplexEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set full_duplex_enabled=0",
    );
    expect(radio.fullDuplexEnabled).toBe(false);

    await radio.setEnforcePrivateIpConnections(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set enforce_private_ip_connections=0",
    );
    expect(radio.enforcePrivateIpConnections).toBe(false);

    await radio.setNetworkMtu(1428);
    expect(channel.commands.at(-1)?.command).toBe(
      "client set enforce_network_mtu=1 network_mtu=1428",
    );
    expect(radio.networkMtu).toBe(1428);

    await radio.setLowLatencyDigitalModes(true);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set low_latency_digital_modes=1",
    );
    expect(radio.lowLatencyDigitalModes).toBe(true);

    await radio.setMfEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe("radio set mf_enable=0");
    expect(radio.mfEnabled).toBe(false);

    await radio.setProfileAutoSave(false);
    expect(channel.commands.at(-1)?.command).toBe("profile autosave off");
    expect(radio.profileAutoSave).toBe(false);

    await radio.setAtuMemoriesEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe("atu set memories_enabled=0");
    expect(radio.atuMemoriesEnabled).toBe(false);

    await radio.startAtuTune();
    expect(channel.commands.at(-1)?.command).toBe("atu start");

    await radio.bypassAtu();
    expect(channel.commands.at(-1)?.command).toBe("atu bypass");

    await radio.clearAtuMemories();
    expect(channel.commands.at(-1)?.command).toBe("atu clear");

    await radio.setLineoutGain(105);
    expect(channel.commands.at(-1)?.command).toBe("mixer lineout gain 100");
    expect(radio.lineoutGain).toBe(100);

    await radio.setLineoutMute(true);
    expect(channel.commands.at(-1)?.command).toBe("mixer lineout mute 1");
    expect(radio.lineoutMute).toBe(true);

    await radio.setHeadphoneGain(12.4);
    expect(channel.commands.at(-1)?.command).toBe("mixer headphone gain 12");
    expect(radio.headphoneGain).toBe(12);

    await radio.setHeadphoneMute(true);
    expect(channel.commands.at(-1)?.command).toBe("mixer headphone mute 1");
    expect(radio.headphoneMute).toBe(true);

    await radio.setBacklightLevel(45);
    expect(channel.commands.at(-1)?.command).toBe("radio backlight 45");
    expect(radio.backlightLevel).toBe(45);

    await radio.setRemoteOnEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set remote_on_enabled=0",
    );
    expect(radio.remoteOnEnabled).toBe(false);

    await radio.setTnfEnabled(false);
    expect(channel.commands.at(-1)?.command).toBe("radio set tnf_enabled=0");
    expect(radio.tnfEnabled).toBe(false);

    await radio.setBinauralRx(true);
    expect(channel.commands.at(-1)?.command).toBe("radio set binaural_rx=1");
    expect(radio.binauralRx).toBe(true);

    await radio.setMuteLocalAudioWhenRemote(false);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set mute_local_audio_when_remote=0",
    );
    expect(radio.muteLocalAudioWhenRemote).toBe(false);

    await radio.setRttyMarkDefaultHz(1925.4);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set rtty_mark_default=1925",
    );
    expect(radio.rttyMarkDefaultHz).toBe(1925);

    await radio.setFrequencyErrorPpb(-2.6);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set freq_error_ppb=-3",
    );
    expect(radio.frequencyErrorPpb).toBe(-3);

    await radio.setCalibrationFrequencyMhz(15.1234567);
    expect(channel.commands.at(-1)?.command).toBe(
      "radio set cal_freq=15.123457",
    );
    expect(radio.calibrationFrequencyMhz).toBeCloseTo(15.123457, 6);
  });

  it("issues gps install and uninstall commands", async () => {
    const { factory, getChannel } = createMockControl();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor, NO_HANDSHAKE);
    const channel = getChannel();
    expect(channel).toBeDefined();
    

    await session.installGps();
    expect(channel.commands.at(-1)?.command).toBe("radio gps install");

    await session.uninstallGps();
    expect(channel.commands.at(-1)?.command).toBe("radio gps uninstall");
  });
});
