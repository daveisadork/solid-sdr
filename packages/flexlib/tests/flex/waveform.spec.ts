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

  it("decodes the container environment and replaces it in place", async () => {
    const { radio, connection } = await createConnectedRadio();
    const b64 = (value: unknown) =>
      Buffer.from(JSON.stringify(value), "utf8").toString("base64");

    connection.emitStatus(
      `S1|waveform container name=FT8 version=0.9 env=${b64({ MODE: "fast", GREETING: "héllo wörld=1" })}`,
    );
    const id = radio.stateSnapshot().waveforms[0]?.id ?? "";
    const controller = radio.waveform(id);
    expect(controller?.env).toEqual({
      MODE: "fast",
      GREETING: "héllo wörld=1",
    });
    expect(Object.isFrozen(controller?.env)).toBe(true);

    connection.emitStatus(
      `S2|waveform container name=FT8 version=0.9 env=${b64({ MODE: "slow" })}`,
    );
    expect(radio.waveform(id)).toBe(controller);
    expect(radio.waveforms()).toHaveLength(1);
    expect(controller?.env).toEqual({ MODE: "slow" });
  });

  it("treats an undecodable environment as empty", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      "S1|waveform container name=FT8 version=0.9 env=%%%not-base64",
    );
    connection.emitStatus(
      `S2|waveform container name=PSK version=1.0 env=${Buffer.from("[1,2]").toString("base64")}`,
    );
    for (const waveform of radio.stateSnapshot().waveforms) {
      expect(waveform.env).toEqual({});
    }
  });

  it("stages, clears, and recreates, and rejects refusals", async () => {
    const { radio, connection } = await createConnectedRadio();

    await radio.stageWaveformEnv("CALL", "W1AW portable");
    expect(connection.lastCommand()).toBe("waveform env CALL=W1AW portable");
    await radio.clearWaveformEnv();
    expect(connection.lastCommand()).toBe("waveform env clear");
    await radio.recreateWaveform("FT8");
    expect(connection.lastCommand()).toBe("waveform recreate FT8");

    const before = connection.commands.length;
    await expect(radio.stageWaveformEnv("", "x")).rejects.toThrow(RangeError);
    await expect(radio.stageWaveformEnv("A B", "x")).rejects.toThrow(
      RangeError,
    );
    await expect(radio.stageWaveformEnv("A", "x\nquit")).rejects.toThrow(
      RangeError,
    );
    await expect(radio.recreateWaveform("a b")).rejects.toThrow(RangeError);
    expect(connection.commands).toHaveLength(before);

    connection.prepareResponse("waveform recreate", {
      code: 0x50000001,
      message: "no",
    });
    await expect(radio.recreateWaveform("FT8")).rejects.toThrow();
  });

  it("reports the restarted status as an event", async () => {
    const { radio, connection } = await createConnectedRadio();
    const events: unknown[] = [];
    radio.on("waveformRestarted", (event) => events.push(event));

    connection.emitStatus("S1|waveform restarted name=FT8 result=ok");
    connection.emitStatus("S2|waveform restarted name=FT8 result=error");

    expect(events).toEqual([
      { name: "FT8", success: true, result: "ok" },
      { name: "FT8", success: false, result: "error" },
    ]);
  });
});
