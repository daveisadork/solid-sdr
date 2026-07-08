import { describe, expect, it, vi } from "vitest";
import { DaxIqAudioStreamControllerImpl } from "../../src/flex/audio-stream";
import type { RadioSession } from "../../src/flex/radio-core";

function fakeRadio(opts: {
  daxIqSampleRates: number[];
  model?: string;
}): RadioSession {
  return {
    modelInfo: {
      daxIqSampleRates: opts.daxIqSampleRates,
      modelName: opts.model ?? "FLEX-8600",
    },
    command: vi.fn().mockResolvedValue({ message: "" }),
    getStore: () => ({
      getAudioStream: () => ({
        id: "0x05000001",
        streamId: "0x05000001",
        type: "dax_iq",
        radioAck: true,
        tx: false,
        raw: {},
      }),
    }),
  } as unknown as RadioSession;
}

describe("DaxIqAudioStreamControllerImpl.setSampleRate", () => {
  it("sends the wire command for a supported rate", async () => {
    const radio = fakeRadio({
      daxIqSampleRates: [24000, 48000, 96000, 192000],
    });
    const ctrl = new DaxIqAudioStreamControllerImpl(radio, "0x05000001");
    await ctrl.setSampleRate(96000);
    expect(radio.command).toHaveBeenCalledWith(
      "stream set 0x05000001 daxiq_rate=96000",
    );
  });

  it("throws RangeError for an unsupported rate (no wire command sent)", async () => {
    const radio = fakeRadio({ daxIqSampleRates: [24000, 48000, 96000] });
    const ctrl = new DaxIqAudioStreamControllerImpl(radio, "0x05000001");
    await expect(ctrl.setSampleRate(192000)).rejects.toThrow(RangeError);
    expect(radio.command).not.toHaveBeenCalled();
  });

  it("skips the allow-list check when modelInfo reports no supported rates (unknown model)", async () => {
    const radio = fakeRadio({ daxIqSampleRates: [] });
    const ctrl = new DaxIqAudioStreamControllerImpl(radio, "0x05000001");
    await ctrl.setSampleRate(48000);
    expect(radio.command).toHaveBeenCalledWith(
      "stream set 0x05000001 daxiq_rate=48000",
    );
  });
});
