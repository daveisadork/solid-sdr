import { describe, expect, it, vi } from "vitest";
import { createConnectedRadio } from "../helpers.js";

describe("APD controller", () => {
  it("reflects status and toggles enable state", async () => {
    // given a connected radio (mock transport already sends a handle)
    const { radio, connection } = await createConnectedRadio();

    // given a slice exists for the APD to reference
    // (use mock's default handle 0x12345678 so APD client_handle filtering passes)
    connection.emitStatus(
      "S1|slice 0 in_use=1 sample_rate=48000 RF_frequency=14.100000 client_handle=0x12345678 index_letter=A rit_on=0 rit_freq=0 xit_on=0 xit_freq=0 rxant=ANT1 mode=USB wide=1 filter_lo=100 filter_hi=2800 step=100 txant=ANT1 tx=1 active=1 audio_level=49 audio_pan=50",
    );

    // when APD status messages arrive
    connection.emitStatus("S1|apd enable=1 configurable=1");
    connection.emitStatus("S1|apd freq=0.000000 tx_error_mHz=0.250000");
    connection.emitStatus(
      "S1|apd slice=0 mmx=0 client_handle=0x12345678 ant=ANT1 freq=14.100000 rx_error_mHz=0.125000 equalizer_active=1 configurable=1",
    );

    // then the APD controller reflects the parsed state
    const controller = radio.apd();
    expect(controller.enabled).toBe(true);
    expect(controller.configurable).toBe(true);
    expect(controller.equalizerActive).toBe(true);
    expect(controller.antenna).toBe("ANT1");
    expect(controller.frequencyMHz).toBeCloseTo(14.1, 6);
    expect(controller.sliceId).toBe("0");
    expect(controller.clientHandle).toBe(0x12345678);
    expect(controller.rxErrorMilliHz).toBeCloseTo(0.125, 6);
    expect(controller.txErrorMilliHz).toBeCloseTo(0.25, 6);

    // given a change spy is attached
    const changeSpy = vi.fn();
    controller.on("change", changeSpy);

    // when setEnabled(false) is called
    await controller.setEnabled(false);

    // then the correct command is sent and state updates
    expect(connection.lastCommand()).toBe("apd enable=0");
    expect(controller.enabled).toBe(false);
    expect(changeSpy).toHaveBeenCalled();
  });
});
