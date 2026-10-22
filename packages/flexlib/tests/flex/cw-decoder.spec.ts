import { describe, expect, it } from "vitest";
import { createConnectedRadio } from "../helpers.js";

describe("CW decoder", () => {
  it("subscribes in the handshake and routes status by slice", async () => {
    const { radio, connection } = await createConnectedRadio();
    expect(connection.commands).toContain("sub cw all");
    expect(connection.commands.filter((c) => c === "sub cw all")).toHaveLength(
      1,
    );

    connection.emitStatus("S1|slice 0 index_letter=A mode=CW");
    connection.emitStatus("S2|slice 1 index_letter=B mode=CW");
    const slice = radio.slice("0");
    const other = radio.slice("1");
    expect(slice?.cwDecoder).toBeUndefined();

    const events: unknown[] = [];
    slice?.on("cwDecoder", (change) => events.push(change));

    connection.emitStatus(
      'S3|cw slice=0 active=1 text="CQ DE W1AW" wpm=22.5 snr=11.5 lock=1 pitch=600 cwl=0',
    );

    expect(slice?.cwDecoder).toMatchObject({
      sliceId: "0",
      active: true,
      text: "CQ DE W1AW",
      wpm: 22.5,
      snrDb: 11.5,
      locked: true,
      pitchHz: 600,
      lowerSideband: false,
    });
    expect(other?.cwDecoder).toBeUndefined();
    expect(events).toHaveLength(1);
  });

  it("restores a substituted double quote in decoded text", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|slice 0 index_letter=A mode=CW");
    connection.emitStatus('S2|cw slice=0 text="say \x1ehi\x1e"');
    expect(radio.slice("0")?.cwDecoder?.text).toBe('say "hi"');
  });

  it("keeps earlier fields when a later message carries only some", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|slice 0 index_letter=A mode=CW");
    connection.emitStatus("S2|cw slice=0 active=1 wpm=18 pitch=500");
    connection.emitStatus("S3|cw slice=0 snr=9 lock=1");
    expect(radio.slice("0")?.cwDecoder).toMatchObject({
      active: true,
      wpm: 18,
      pitchHz: 500,
      snrDb: 9,
      locked: true,
    });
  });

  it("ignores a message with no slice or an unknown slice, and drops state with the slice", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|slice 0 index_letter=A mode=CW");
    connection.emitStatus("S2|cw active=1 wpm=20");
    connection.emitStatus("S3|cw slice=7 active=1 wpm=20");
    expect(radio.slice("0")?.cwDecoder).toBeUndefined();
    expect(radio.stateSnapshot().cwDecoders).toHaveLength(0);

    connection.emitStatus("S4|cw slice=0 active=1");
    expect(radio.slice("0")?.cwDecoder).toBeDefined();
    connection.emitStatus("S5|slice 0 in_use=0");
    expect(radio.stateSnapshot().cwDecoders).toHaveLength(0);
  });
});
