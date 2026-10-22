import { describe, expect, it } from "vitest";
import { createConnectedRadio } from "../helpers.js";

describe("Presets", () => {
  it("subscribes in the handshake and stores preset fields", async () => {
    const { radio, connection } = await createConnectedRadio();
    expect(connection.commands).toContain("sub preset all");

    connection.emitStatus(
      "S1|preset id=1 name=Contest slice_config=abc ale_config=def radio_config=x",
    );
    connection.emitStatus("S2|preset id=2 name=Rag");

    expect(radio.presets()).toHaveLength(2);
    const preset = radio.preset("1");
    expect(preset?.name).toBe("Contest");
    expect(preset?.sliceConfig).toBe("abc");
    expect(preset?.aleConfig).toBe("def");
    expect(preset?.active).toBe(false);
    expect(preset?.snapshot().raw.radio_config).toBe("x");
  });

  it("applies a preset, then skips the send once it is active", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|preset id=1 name=A");
    connection.emitStatus("S2|preset id=2 name=B");

    await radio.preset("1")?.select();
    expect(connection.lastCommand()).toBe("preset apply id=1");

    connection.emitStatus("S3|preset id=1 applied");
    expect(radio.activePresetId).toBe("1");
    expect(radio.preset("1")?.active).toBe(true);
    expect(radio.preset("2")?.active).toBe(false);

    const before = connection.commands.length;
    await radio.preset("1")?.select();
    expect(connection.commands).toHaveLength(before);

    await radio.preset("2")?.select();
    expect(connection.lastCommand()).toBe("preset apply id=2");
    connection.emitStatus("S4|preset id=2 applied");
    expect(radio.preset("1")?.active).toBe(false);
    expect(radio.preset("2")?.active).toBe(true);
  });

  it("subscribes again on created and drops a removed preset", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|preset id=1 name=A");

    connection.emitStatus("S2|preset id=5 created");
    expect(connection.lastCommand()).toBe("sub preset all");
    expect(radio.preset("5")).toBeUndefined();

    const controller = radio.preset("1");
    connection.emitStatus("S3|preset id=1 removed");
    expect(radio.preset("1")).toBeUndefined();
    expect(() => controller?.snapshot()).toThrow();
  });
});
