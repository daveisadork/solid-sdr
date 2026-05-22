import { describe, expect, it } from "vitest";
import { FlexError, FlexStateUnavailableError } from "../../src/flex/errors.js";
import { createConnectedRadio } from "../helpers.js";

describe("waveform controller", () => {
  it("tracks waveform state and sends uninstall/restart commands", async () => {
    const { radio, connection } = await createConnectedRadio();

    connection.emitStatus("S1|waveform installed_list=NAVTEX\u007f\u007f1.0");
    connection.emitStatus("S2|waveform container name=FT8 version=0.9");

    const legacy = radio
      .stateSnapshot()
      .waveforms.find((waveform) => !waveform.isContainer);
    const container = radio
      .stateSnapshot()
      .waveforms.find((waveform) => waveform.isContainer);

    expect(legacy).toBeDefined();
    expect(container).toBeDefined();
    if (!legacy || !container) throw new Error("expected waveform snapshots");

    const legacyController = radio.waveform(legacy.id);
    const containerController = radio.waveform(container.id);
    expect(legacyController).toBeDefined();
    expect(containerController).toBeDefined();
    if (!legacyController || !containerController) {
      throw new Error("expected waveform controllers");
    }

    expect(legacyController.displayName).toBe("NAVTEX 1.0");
    expect(containerController.displayName).toBe("FT8 0.9");

    await legacyController.uninstall();
    expect(connection.lastCommand()).toBe("waveform uninstall NAVTEX");

    await expect(legacyController.restart()).rejects.toBeInstanceOf(FlexError);

    await containerController.restart();
    expect(connection.lastCommand()).toBe("waveform restart FT8");

    await containerController.uninstall();
    expect(connection.lastCommand()).toBe("waveform remove_container FT8");

    connection.emitStatus("S3|waveform container name=FT8 version=0.9 removed");
    expect(radio.waveform(container.id)).toBeUndefined();
    expect(() => containerController.snapshot()).toThrow(
      FlexStateUnavailableError,
    );
  });
});
