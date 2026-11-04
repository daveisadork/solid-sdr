import { describe, expect, it } from "vitest";
import { createConnectedRadio } from "../helpers.js";

const status = (char: string) =>
  `S2|cw slice=0 active=1 wpm=36 snr=27.7 lock=1 pitch=600 cwl=0 text="${char}"`;

describe("CW decoder", () => {
  it("subscribes in the handshake and creates a controller on the first status", async () => {
    const { radio, connection } = await createConnectedRadio();
    expect(connection.commands.filter((c) => c === "sub cw all")).toHaveLength(
      1,
    );

    connection.emitStatus("S1|slice 0 index_letter=A mode=CW active=0");
    connection.emitStatus("S1|slice 1 index_letter=B mode=CW");
    expect(radio.cwDecoder("0")).toBeUndefined();

    connection.emitStatus(
      'S3|cw slice=0 active=1 wpm=34 snr=24.0 lock=1 pitch=600 cwl=0 text="A"',
    );

    expect(radio.cwDecoder("0")).toMatchObject({
      sliceId: "0",
      active: true,
      text: "A",
      wpm: 34,
      snrDb: 24,
      locked: true,
      pitchHz: 600,
      lowerSideband: false,
    });
    expect(radio.cwDecoders()).toHaveLength(1);
    expect(radio.cwDecoder("1")).toBeUndefined();
    // The decoder's `active` is not the slice's `active`.
    expect(radio.slice("0")?.isActive).toBe(false);
  });

  it("emits each decoded character, including repeats and spaces", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|slice 0 index_letter=A mode=CW");
    connection.emitStatus(status("C"));
    const decoder = radio.cwDecoder("0");

    const texts: (string | undefined)[] = [];
    decoder?.on("change", (change) => texts.push(change.diff?.text));

    for (const char of ["A", "A", " ", "K"])
      connection.emitStatus(status(char));
    expect(texts).toEqual(["A", "A", " ", "K"]);
    expect(decoder?.text).toBe("K");
  });

  it("restores a substituted double quote in decoded text", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|slice 0 index_letter=A mode=CW");
    connection.emitStatus('S2|cw slice=0 text="say \x1ehi\x1e"');
    expect(radio.cwDecoder("0")?.text).toBe('say "hi"');
  });

  it("ignores a message with no slice or an unknown slice, and drops the decoder with its slice", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|slice 0 index_letter=A mode=CW");
    connection.emitStatus("S2|cw active=1 wpm=20");
    connection.emitStatus("S3|cw slice=7 active=1 wpm=20");
    expect(radio.cwDecoders()).toHaveLength(0);
    expect(radio.stateSnapshot().cwDecoders).toHaveLength(0);

    connection.emitStatus("S4|cw slice=0 active=1");
    const decoder = radio.cwDecoder("0");
    const removed: boolean[] = [];
    decoder?.on("change", (change) => removed.push(change.removed));

    connection.emitStatus("S5|slice 0 in_use=0");
    expect(removed).toEqual([true]);
    expect(radio.cwDecoder("0")).toBeUndefined();
    expect(radio.stateSnapshot().cwDecoders).toHaveLength(0);
  });
});
