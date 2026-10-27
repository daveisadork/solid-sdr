import { describe, expect, it } from "vitest";
import { createConnectedRadio } from "../helpers.js";

async function setup(status = "") {
  const { radio, connection } = await createConnectedRadio();
  connection.emitStatus(`S1|slice 0 index_letter=A mode=USB ${status}`.trim());
  const slice = radio.slice("0");
  if (!slice) throw new Error("slice missing");
  return { slice, connection };
}

describe("slice DSP parameters", () => {
  it("parses typed fields from status", async () => {
    const { slice } = await setup(
      "nr_delay=25 nr_wlen=256 nr_adapt_mode=fast nr_isdft_mode=half nrl_filter_size=128 nrl_delay=16 nrl_leakage_level=50 nrf_wlen=2048 anf_wlen=64 anf_delay=8 anf_adapt_mode=slow anf_isdft_mode=zero anfl_filter_size=64 anfl_delay=12 anfl_leakage_level=40 anft_min_db=-80 anft_tone_db_diff=6",
    );
    expect(slice.nrDelay).toBe(25);
    expect(slice.nrWlen).toBe(256);
    expect(slice.nrAdaptMode).toBe("fast");
    expect(slice.nrIsdftMode).toBe("half");
    expect(slice.nrlFilterSize).toBe(128);
    expect(slice.nrlDelay).toBe(16);
    expect(slice.nrlLeakageLevel).toBe(50);
    expect(slice.nrfWlen).toBe(2048);
    expect(slice.anfWlen).toBe(64);
    expect(slice.anfDelay).toBe(8);
    expect(slice.anfAdaptMode).toBe("slow");
    expect(slice.anfIsdftMode).toBe("zero");
    expect(slice.anflFilterSize).toBe(64);
    expect(slice.anflDelay).toBe(12);
    expect(slice.anflLeakageLevel).toBe(40);
    expect(slice.anftMinDb).toBe(-80);
    expect(slice.anftToneDbDiff).toBe(6);
  });

  it("sends the command key, which differs from the status key", async () => {
    const { slice, connection } = await setup();
    await slice.setNrlFilterSize(600);
    expect(connection.lastCommand()).toBe("slice set 0 lms_nr_taps=512");
    expect(slice.nrlFilterSize).toBe(512);
    await slice.setNrlDelay(0);
    expect(connection.lastCommand()).toBe("slice set 0 lms_nr_delay=1");
    await slice.setNrlLeakageLevel(150);
    expect(connection.lastCommand()).toBe(
      "slice set 0 lms_nr_leakage_level=100",
    );
    await slice.setAnflFilterSize(64);
    expect(connection.lastCommand()).toBe("slice set 0 lms_anf_taps=64");
    await slice.setAnflDelay(9);
    expect(connection.lastCommand()).toBe("slice set 0 lms_anf_delay=9");
    await slice.setAnflLeakageLevel(10);
    expect(connection.lastCommand()).toBe(
      "slice set 0 lms_anf_leakage_level=10",
    );
  });

  it("sends the plain-key setters", async () => {
    const { slice, connection } = await setup();
    await slice.setNrDelay(30);
    expect(connection.lastCommand()).toBe("slice set 0 nr_delay=30");
    await slice.setNrAdaptMode("slow");
    expect(connection.lastCommand()).toBe("slice set 0 nr_adapt_mode=slow");
    await slice.setNrIsdftMode("one");
    expect(connection.lastCommand()).toBe("slice set 0 nr_isdft_mode=one");
    await slice.setAnfDelay(5);
    expect(connection.lastCommand()).toBe("slice set 0 anf_delay=5");
    await slice.setAnfAdaptMode("auto");
    expect(connection.lastCommand()).toBe("slice set 0 anf_adapt_mode=auto");
    await slice.setAnfIsdftMode("half");
    expect(connection.lastCommand()).toBe("slice set 0 anf_isdft_mode=half");
    await slice.setAnftMinDb(-70);
    expect(connection.lastCommand()).toBe("slice set 0 anft_min_db=-70");
    await slice.setAnftToneDbDiff(8);
    expect(connection.lastCommand()).toBe("slice set 0 anft_tone_db_diff=8");
  });

  it("sends a window length only when it is a power of two, then clamps", async () => {
    const { slice, connection } = await setup();
    await slice.setNrWlen(100);
    expect(connection.lastCommand()).not.toMatch(/nr_wlen/);
    await slice.setNrWlen(1024);
    expect(connection.lastCommand()).toBe("slice set 0 nr_wlen=512");
    await slice.setAnfWlen(16);
    expect(connection.lastCommand()).toBe("slice set 0 anf_wlen=32");
    await slice.setNrfWlen(1000);
    expect(connection.lastCommand()).not.toMatch(/nrf_wlen/);
    await slice.setNrfWlen(256);
    expect(connection.lastCommand()).toBe("slice set 0 nrf_wlen=512");
    await slice.setNrfWlen(16384);
    expect(connection.lastCommand()).toBe("slice set 0 nrf_wlen=8192");
  });

  it("does not send an unknown mode string", async () => {
    const { slice, connection } = await setup();
    const before = connection.lastCommand();
    await slice.setNrAdaptMode("bogus" as never);
    await slice.setAgcThresholdMode("bogus" as never);
    expect(connection.lastCommand()).toBe(before);
  });

  it("resets one algorithm", async () => {
    const { slice, connection } = await setup();
    await slice.resetDspParameters("lms_nr");
    expect(connection.lastCommand()).toBe("slice reset 0 dsp_param=lms_nr");
    await slice.resetDspParameters("all");
    expect(connection.lastCommand()).toBe("slice reset 0 dsp_param=all");
  });
});

describe("AGC threshold mode and chain mode", () => {
  it("parses the AGC threshold mode and sends it", async () => {
    const { slice, connection } = await setup("agc_threshold_mode=auto");
    expect(slice.agcThresholdMode).toBe("auto");
    await slice.setAgcThresholdMode("manual");
    expect(connection.lastCommand()).toBe(
      "slice set 0 agc_threshold_mode=manual",
    );
    expect(slice.agcThresholdMode).toBe("manual");
  });

  it("reports the underlying mode of a waveform slice as chainMode", async () => {
    const { slice } = await setup("mode=FDVU chain_mode=DIGU");
    expect(slice.mode).toBe("FDVU");
    expect(slice.chainMode).toBe("DIGU");
  });
});
