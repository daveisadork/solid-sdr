import { describe, expect, it } from "vitest";
import type { FlexRadioDescriptor } from "../../src/flex/adapters.js";
import { createFlexClient } from "../../src/flex/client.js";
import { FlexCommandRejectedError } from "../../src/flex/errors.js";
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

describe("FlexClient", () => {
  it("connects and updates slice state", async () => {
    const factory = new MockControlFactory();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor);
    const channel = factory.channel;
    expect(channel).toBeDefined();
    if (!channel) throw new Error("control channel not created");

    const changes: unknown[] = [];
    session.on("change", (change) => {
      changes.push(change);
    });

    channel.emit(makeStatus("S1|slice 0 freq=14.074000 mode=USB active=1"));

    const slice = session.slice("0");
    expect(slice).toBeDefined();
    expect(slice?.mode).toBe("USB");
    expect(slice?.sampleRateHz).toBe(0);
    expect(slice?.indexLetter).toBe("");
    expect(slice?.isWide).toBe(false);
    expect(slice?.isQskEnabled).toBe(false);
    expect(slice?.availableRxAntennas).toEqual([]);
    expect(slice?.availableTxAntennas).toEqual([]);
    expect(slice?.owner).toBe("");
    expect(slice?.clientHandle).toBe(0);
    expect(slice?.diversityParent).toBeUndefined();
    expect(slice?.modeList).toEqual([]);
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
    expect(channel.commands.at(-1)?.command).toBe("slice set 0 lms_nr_level=15");
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
      "slice set 0 fm_tone_value=100.0",
    );
    expect(slice?.fmToneValue).toBe("100.0");

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
    expect(channel.commands.at(-1)?.command).toBe(
      "slice auto_tune 0 int=1",
    );

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

    channel.emit(makeStatus("S2|slice 0 in_use=0"));
    expect(session.getSlice("0")).toBeUndefined();
  });

  it("surfaces command rejections", async () => {
    const factory = new MockControlFactory();
    const client = createFlexClient({ control: factory });
    const session = await client.connect(descriptor);
    const channel = factory.channel;
    if (!channel) throw new Error("control channel not created");

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
});
