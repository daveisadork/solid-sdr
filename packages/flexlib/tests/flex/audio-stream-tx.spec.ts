import { describe, expect, it } from "vitest";
import { parseVitaPacket } from "../../src/vita/parser.js";
import { createConnectedRadio } from "../helpers.js";

async function createTxStream(sliceStatus: string) {
  const { radio, connection } = await createConnectedRadio();
  connection.emitStatus(`S1|slice 0 index_letter=A ${sliceStatus}`);
  connection.prepareResponse("stream create", { message: "2000003" });
  const creation = radio.createDaxTxAudioStream();
  connection.emitStatus(
    "S1|stream 0x02000003 type=dax_tx client_handle=0x12345678 slice=A",
  );
  return { stream: await creation, connection };
}

describe("DAX TX class follows the slice rate", () => {
  it.each([
    [24000, 0x03e3, 0x0123],
    [48000, 0x03e4, 0x0124],
    [96000, 0x03e5, 0x0125],
  ])("%i Hz stamps the matching class", async (rate, floatClass, intClass) => {
    const { stream, connection } = await createTxStream(`sample_rate=${rate}`);

    stream.sendAudio(new Float32Array(128), new Float32Array(128));
    stream.sendReducedBwAudio(new Int16Array(128));

    expect(connection.sentUdp).toHaveLength(2);
    const [stereo, mono] = connection.sentUdp.map((bytes) =>
      parseVitaPacket(bytes),
    );
    expect(stereo?.kind).toBe("daxAudio");
    expect(stereo?.kind === "daxAudio" && stereo.classId.packetClassCode).toBe(
      floatClass,
    );
    expect(mono?.kind === "daxReducedBw" && mono.classId.packetClassCode).toBe(
      intClass,
    );
  });

  it("drops the packet when the slice rate is missing or unsupported", async () => {
    const missing = await createTxStream("");
    missing.stream.sendAudio(new Float32Array(128), new Float32Array(128));
    missing.stream.sendReducedBwAudio(new Int16Array(128));
    expect(missing.connection.sentUdp).toHaveLength(0);

    const odd = await createTxStream("sample_rate=44100");
    odd.stream.sendAudio(new Float32Array(128), new Float32Array(128));
    expect(odd.connection.sentUdp).toHaveLength(0);
  });

  it("reports the followed slice rate as sampleRateHz, 0 while unknown", async () => {
    const known = await createTxStream("sample_rate=48000");
    expect(known.stream.sampleRateHz).toBe(48000);
    expect(known.stream.snapshot().sampleRateHz).toBe(48000);

    const unknown = await createTxStream("");
    expect(unknown.stream.sampleRateHz).toBe(0);
  });
});
