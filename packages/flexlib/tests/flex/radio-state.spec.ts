import { describe, expect, it } from "vitest";
import { createRadioStateStore } from "../../src/flex/radio-state.js";
import { lineSpeedToDurationMs } from "../../src/flex/waterfall-line-speed.js";
import { makeStatus } from "../helpers.js";

const SLICE_STATUS =
  "S3A5E996B|slice 0 in_use=1 sample_rate=24000 RF_frequency=15.000000 client_handle=0x68AE2A9B index_letter=A rit_on=0 rit_freq=0 xit_on=0 xit_freq=0 rxant=ANT1 mode=USB wide=1 filter_lo=100 filter_hi=2800 step=100 step_list=1,10,50,100,500,1000,2000,3000 agc_mode=fast agc_threshold=60 agc_off_level=0 pan=0x40000000 txant=ANT1 loopa=0 loopb=0 qsk=0 dax_iq_channel=0 dax=1 dax_clients=0 lock=0 tx=0 active=0 audio_level=49 audio_pan=50 audio_mute=0 record=0 play=disabled record_time=0.0 anf=0 anf_level=0 nr=0 nr_level=0 nr_wlen=256 nr_delay=25 nr_adapt_mode=2 nr_isdft_mode=1 nb=1 nb_level=50 wnb=1 wnb_level=90 nrl=1 nrl_level=35 nrl_filter_size=128 nrl_delay=16 nrl_leakage_level=50 anfl=1 anfl_level=45 anfl_filter_size=128 anfl_delay=16 anfl_leakage_level=50 nrs=1 nrs_level=20 rnn=1 anft=1 nrf=1 nrf_level=55 nrf_winc=256 nrf_wlen=2048 esc=on esc_gain=0.750000 esc_phase_shift=15.5 apf=0 apf_level=0 squelch=0 squelch_level=20 diversity=0 diversity_parent=0 diversity_child=0 diversity_index=1342177293 ant_list=ANT1,ANT2,RX_A,RX_B,XVTA,XVTB mode_list=LSB,USB,AM,CW,DIGL,DIGU,SAM,FM,NFM,DFM,RTTY fm_tone_mode=OFF fm_tone_value=67.0 fm_repeater_offset_freq=0.000000 tx_offset_freq=0.000000 repeater_offset_dir=SIMPLEX fm_tone_burst=0 fm_deviation=5000 dfm_pre_de_emphasis=0 post_demod_low=300 post_demod_high=3300 rtty_mark=2125 rtty_shift=170 digl_offset=2210 digu_offset=1500 post_demod_bypass=0 rfgain=8 tx_ant_list=ANT1,ANT2,XVTA,XVTB rx_error_mHz=-31.677248";

const PAN_STATUS =
  "S3A411681|display pan 0x40000000 client_handle=0x3A411681 wnb=0 wnb_level=90 wnb_updating=0 band_zoom=0 segment_zoom=0 x_pixels=50 y_pixels=20 center=14.100000 bandwidth=0.200000 min_dbm=-125.00 max_dbm=-40.00 fps=25 average=0 weighted_average=0 rfgain=8 rxant=ANT1 wide=0 loopa=0 loopb=0 band=20 daxiq_channel=0 waterfall=0x42000000 min_bw=0.001230 max_bw=14.745601 xvtr= pre=+8dB ant_list=ANT1,ANT2,RX_A,RX_B,XVTA,XVTB";

const WATERFALL_STATUS =
  "S3A411681|display waterfall 0x42000000 client_handle=0x3A411681 x_pixels=50 center=14.100000 bandwidth=0.200000 band_zoom=0 segment_zoom=0 line_duration=100 rfgain=8 rxant=ANT1 wide=0 loopa=0 loopb=0 band=20 daxiq_channel=0 panadapter=0x40000000 color_gain=50 auto_black=1 black_level=0 gradient_index=0 xvtr=";

const METER_STATUS =
  "S3A411681|meter 1.src=TX-#1.num=5#1.nam=HWALC#1.low=-150.0#1.hi=20.0#1.desc=Voltage present at the Hardware ALC RCA Plug#1.unit=dBFS#1.fps=20#";

describe("createRadioStateStore", () => {
  it("tracks slices and panadapters from real messages", () => {
    const store = createRadioStateStore();
    store.apply(makeStatus(PAN_STATUS));
    let pan = store.getPanadapter("0x40000000");
    expect(pan).toBeDefined();
    expect(pan?.centerFrequencyMHz).toBeCloseTo(14.1, 6);
    expect(pan?.bandwidthMHz).toBeCloseTo(0.2, 6);
    expect(pan?.band).toBe("20");
    expect(pan?.clientHandle).toBe(977_344_129);
    expect(pan?.isBandZoomOn).toBe(false);
    expect(pan?.isSegmentZoomOn).toBe(false);
    expect(pan?.preampSetting).toBe("+8dB");
    expect(pan?.xvtr).toBe("");
    expect(pan?.rxAntennas).toEqual([
      "ANT1",
      "ANT2",
      "RX_A",
      "RX_B",
      "XVTA",
      "XVTB",
    ]);
    expect(pan?.raw["pre"]).toBe("+8dB");

    store.apply(makeStatus(SLICE_STATUS));
    const slice = store.getSlice("0");
    expect(slice).toBeDefined();
    expect(slice?.frequencyMHz).toBeCloseTo(15, 6);
    expect(slice?.sampleRateHz).toBe(24_000);
    expect(slice?.indexLetter).toBe("A");
    expect(slice?.mode).toBe("USB");
    expect(slice?.panadapterStreamId).toBe("0x40000000");
    expect(slice?.daxChannel).toBe(1);
    expect(slice?.daxIqChannel).toBe(0);
    expect(slice?.daxClientCount).toBe(0);
    expect(slice?.tuneStepListHz).toEqual([
      1, 10, 50, 100, 500, 1000, 2000, 3000,
    ]);
    expect(slice?.txOffsetFrequencyMHz).toBeCloseTo(0);
    expect(slice?.postDemodLowHz).toBe(300);
    expect(slice?.postDemodHighHz).toBe(3_300);
    expect(slice?.postDemodBypass).toBe(false);
    expect(slice?.recordTimeSeconds).toBe(0);
    expect(slice?.isLocked).toBe(false);
    expect(slice?.isQskEnabled).toBe(false);
    expect(slice?.isWide).toBe(true);
    expect(slice?.diversityParent).toBe(false);
    expect(slice?.availableRxAntennas).toEqual([
      "ANT1",
      "ANT2",
      "RX_A",
      "RX_B",
      "XVTA",
      "XVTB",
    ]);
    expect(slice?.availableTxAntennas).toEqual([
      "ANT1",
      "ANT2",
      "XVTA",
      "XVTB",
    ]);
    expect(slice?.modeList).toEqual([
      "LSB",
      "USB",
      "AM",
      "CW",
      "DIGL",
      "DIGU",
      "SAM",
      "FM",
      "NFM",
      "DFM",
      "RTTY",
    ]);
    expect(slice?.rxErrorMilliHz).toBeCloseTo(-31.677248);
    expect(slice?.playbackAvailable).toBe(false);
    expect(slice?.playbackEnabled).toBe(false);
    expect(slice?.raw["mode_list"]).toBe(
      "LSB,USB,AM,CW,DIGL,DIGU,SAM,FM,NFM,DFM,RTTY",
    );
    expect(slice?.nrlEnabled).toBe(true);
    expect(slice?.nrlLevel).toBe(35);
    expect(slice?.anflEnabled).toBe(true);
    expect(slice?.anflLevel).toBe(45);
    expect(slice?.nrsEnabled).toBe(true);
    expect(slice?.nrsLevel).toBe(20);
    expect(slice?.rnnEnabled).toBe(true);
    expect(slice?.anftEnabled).toBe(true);
    expect(slice?.nrfEnabled).toBe(true);
    expect(slice?.nrfLevel).toBe(55);
    expect(slice?.escEnabled).toBe(true);
    expect(slice?.escGain).toBeCloseTo(0.75);
    expect(slice?.escPhaseShift).toBeCloseTo(15.5);

    pan = store.getPanadapter("0x40000000");
    expect(pan?.attachedSlices).toEqual(["0"]);
  });

  it("handles real meter metadata and removal", () => {
    const store = createRadioStateStore();
    store.apply(makeStatus(METER_STATUS));
    const meter = store.getMeter("1");
    expect(meter).toBeDefined();
    expect(meter?.source).toBe("TX-");
    expect(meter?.sourceIndex).toBe(5);
    expect(meter?.name).toBe("HWALC");
    expect(meter?.description).toBe(
      "Voltage present at the Hardware ALC RCA Plug",
    );
    expect(meter?.units).toBe("dBFS");
    expect(meter?.low).toBeCloseTo(-150);
    expect(meter?.high).toBeCloseTo(20);
    expect(meter?.fps).toBeCloseTo(20);

    store.apply(makeStatus("S3A411681|meter 1 removed"));
    expect(store.getMeter("1")).toBeUndefined();
  });

  it("tracks waterfall attributes from a real message", () => {
    const store = createRadioStateStore();
    store.apply(makeStatus(WATERFALL_STATUS));
    const waterfall = store.getWaterfall("0x42000000");
    expect(waterfall).toBeDefined();
    expect(waterfall?.panadapterStreamId).toBe("0x40000000");
    expect(waterfall?.centerFrequencyMHz).toBeCloseTo(14.1, 6);
    expect(waterfall?.bandwidthMHz).toBeCloseTo(0.2, 6);
    expect(waterfall?.isBandZoomOn).toBe(false);
    expect(waterfall?.isSegmentZoomOn).toBe(false);
    expect(waterfall?.lineSpeed).toBe(100);
    expect(waterfall?.lineDurationMs).toBe(lineSpeedToDurationMs(100));
    expect(waterfall?.colorGain).toBe(50);
    expect(waterfall?.autoBlackLevelEnabled).toBe(true);
    expect(waterfall?.raw["x_pixels"]).toBe("50");
    expect(waterfall?.clientHandle).toBe(977_344_129);
  });

  it("updates radio gps properties from gps status messages", () => {
    const store = createRadioStateStore();
    const gpsStatus =
      "S0|gps lat=38.433865#lon=-90.454626667#grid=EM48sk#altitude=218 m#tracked=12#visible=26#speed=0 kts#freq_error=-1 ppb#status=Fine Lock#time=11:22:37Z#track=0.0";
    const gnssStatus = "S0|gps gnss_powered_ant=false";
    const installStatus = "S0|gps gps=installed";

    const [change] = store.apply(makeStatus(gpsStatus));
    expect(change?.entity).toBe("radio");

    let radio = store.getRadio();
    expect(radio).toBeDefined();
    expect(radio?.gpsLatitude).toBeCloseTo(38.433865, 6);
    expect(radio?.gpsLongitude).toBeCloseTo(-90.454626667, 9);
    expect(radio?.gpsGrid).toBe("EM48sk");
    expect(radio?.gpsAltitude).toBe("218 m");
    expect(radio?.gpsSatellitesTracked).toBe(12);
    expect(radio?.gpsSatellitesVisible).toBe(26);
    expect(radio?.gpsSpeed).toBe("0 kts");
    expect(radio?.gpsFreqError).toBe("-1 ppb");
    expect(radio?.gpsStatus).toBe("Fine Lock");
    expect(radio?.gpsUtcTime).toBe("11:22:37Z");
    expect(radio?.gpsTrack).toBeCloseTo(0, 6);
    expect(radio?.raw["lat"]).toBe("38.433865");
    expect(radio?.raw["freq_error"]).toBe("-1 ppb");

    store.apply(makeStatus(gnssStatus));
    radio = store.getRadio();
    expect(radio?.gpsGnssPoweredAntenna).toBe(false);
    expect(radio?.raw["gnss_powered_ant"]).toBe("false");

    store.apply(makeStatus(installStatus));
    radio = store.getRadio();
    expect(radio?.gpsInstalled).toBe(true);
  });

  it("parses filter sharpness, static network, and oscillator statuses", () => {
    const store = createRadioStateStore();
    const filterVoice =
      "S5FE02338|radio filter_sharpness VOICE level=2 auto_level=1";
    const filterCw =
      "S5FE02338|radio filter_sharpness CW level=2 auto_level=1";
    const filterDigital =
      "S5FE02338|radio filter_sharpness DIGITAL level=2 auto_level=1";
    const staticNet =
      "S5FE02338|radio static_net_params ip= gateway= netmask=";
    const oscillator =
      "S5FE02338|radio oscillator state=gpsdo setting=auto locked=1 ext_present=0 gnss_present=0 gpsdo_present=1 tcxo_present=1";

    for (const raw of [
      filterVoice,
      filterCw,
      filterDigital,
      staticNet,
      oscillator,
    ]) {
      store.apply(makeStatus(raw));
    }

    const radio = store.getRadio();
    expect(radio).toBeDefined();
    expect(radio?.filterSharpnessVoice).toBe(2);
    expect(radio?.filterSharpnessVoiceAuto).toBe(true);
    expect(radio?.filterSharpnessCw).toBe(2);
    expect(radio?.filterSharpnessCwAuto).toBe(true);
    expect(radio?.filterSharpnessDigital).toBe(2);
    expect(radio?.filterSharpnessDigitalAuto).toBe(true);
    expect(radio?.staticIp).toBeUndefined();
    expect(radio?.staticGateway).toBeUndefined();
    expect(radio?.staticNetmask).toBeUndefined();
    expect(radio?.oscillatorState).toBe("gpsdo");
    expect(radio?.oscillatorSetting).toBe("auto");
    expect(radio?.oscillatorLocked).toBe(true);
    expect(radio?.oscillatorExternalPresent).toBe(false);
    expect(radio?.oscillatorGnssPresent).toBe(false);
    expect(radio?.oscillatorGpsdoPresent).toBe(true);
    expect(radio?.oscillatorTcxoPresent).toBe(true);

    expect(radio?.raw["filter_sharpness"]).toBeUndefined();
    expect(radio?.raw["oscillator"]).toBeUndefined();
    expect(radio?.raw["state"]).toBe("gpsdo");
    expect(radio?.raw["setting"]).toBe("auto");
    expect(radio?.raw["locked"]).toBe("1");
    expect(radio?.raw["ext_present"]).toBe("0");
    expect(radio?.raw["gnss_present"]).toBe("0");
    expect(radio?.raw["gpsdo_present"]).toBe("1");
    expect(radio?.raw["tcxo_present"]).toBe("1");
    expect(radio?.raw["ip"]).toBe("");
    expect(radio?.raw["gateway"]).toBe("");
    expect(radio?.raw["netmask"]).toBe("");
  });
});
