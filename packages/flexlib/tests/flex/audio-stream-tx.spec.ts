import { describe, expect, it } from "vitest";
import { VitaDaxAudioPacket } from "../../src/vita/dax-audio-packet.js";
import { parseVitaPacket } from "../../src/vita/parser.js";
import { createConnectedRadio, type MockFlexConnection } from "../helpers.js";

const OUR_HANDLE = "0x12345678";
const OTHER_HANDLE = "0x785E6DE8";

function slice(index: number, letter: string, handle: string, rest: string) {
  return `S${handle.slice(2)}|slice ${index} in_use=1 index_letter=${letter} client_handle=${handle} ${rest}`;
}

async function createTxStream(...sliceStatuses: string[]) {
  const { radio, connection } = await createConnectedRadio();
  for (const status of sliceStatuses) connection.emitStatus(status);
  connection.prepareResponse("stream create", { message: "84000000" });
  const creation = radio.createDaxTxAudioStream();
  connection.emitStatus(
    `S12345678|stream 0x84000000 type=dax_tx client_handle=${OUR_HANDLE} tx=1 ip=10.16.83.140`,
  );
  return { radio, connection, stream: await creation };
}

function sentClasses(connection: MockFlexConnection): (number | undefined)[] {
  return connection.sentUdp.map((bytes) => {
    const packet = parseVitaPacket(bytes);
    return packet?.kind === "daxAudio" || packet?.kind === "daxReducedBw"
      ? packet.classId.packetClassCode
      : undefined;
  });
}

describe("DAX TX class follows the transmit slice rate", () => {
  it.each([
    [24000, 0x03e3, 0x0123],
    [48000, 0x03e4, 0x0124],
    [96000, 0x03e5, 0x0125],
  ])("%i Hz stamps the matching class", async (rate, floatClass, intClass) => {
    const { stream, connection } = await createTxStream(
      slice(0, "A", OUR_HANDLE, `tx=1 sample_rate=${rate}`),
    );

    stream.sendAudio(new Float32Array(128), new Float32Array(128));
    stream.sendReducedBwAudio(new Int16Array(128));

    expect(sentClasses(connection)).toEqual([floatClass, intClass]);
  });

  it("drops the packet when the slice rate is missing or unsupported", async () => {
    const missing = await createTxStream(slice(0, "A", OUR_HANDLE, "tx=1"));
    missing.stream.sendAudio(new Float32Array(128), new Float32Array(128));
    missing.stream.sendReducedBwAudio(new Int16Array(128));
    expect(missing.connection.sentUdp).toHaveLength(0);

    const odd = await createTxStream(
      slice(0, "A", OUR_HANDLE, "tx=1 sample_rate=44100"),
    );
    odd.stream.sendAudio(new Float32Array(128), new Float32Array(128));
    expect(odd.connection.sentUdp).toHaveLength(0);
  });

  it("drops the packet when only another client has a transmit slice", async () => {
    const { stream, connection } = await createTxStream(
      slice(0, "A", OTHER_HANDLE, "tx=1 sample_rate=24000"),
    );

    stream.sendAudio(new Float32Array(128), new Float32Array(128));
    stream.sendReducedBwAudio(new Int16Array(128));

    expect(connection.sentUdp).toHaveLength(0);
    expect(stream.sampleRateHz).toBe(0);
  });

  it("follows transmit to another slice and clears when that slice goes away", async () => {
    const { radio, stream, connection } = await createTxStream(
      slice(0, "A", OUR_HANDLE, "tx=1 sample_rate=24000"),
      slice(1, "B", OUR_HANDLE, "tx=0 sample_rate=48000"),
    );
    const rates: number[] = [];
    stream.on("change", (change) => {
      if (change.diff?.sampleRateHz !== undefined) {
        rates.push(change.diff.sampleRateHz);
      }
    });

    connection.emitStatus(slice(0, "A", OUR_HANDLE, "tx=0"));
    connection.emitStatus(slice(1, "B", OUR_HANDLE, "tx=1"));
    stream.sendAudio(new Float32Array(128), new Float32Array(128));
    expect(sentClasses(connection)).toEqual([0x03e4]);
    expect(radio.getStore().getAudioStream("0x84000000")?.sampleRateHz).toBe(
      48000,
    );

    connection.emitStatus("S12345678|slice 1 in_use=0");
    stream.sendAudio(new Float32Array(128), new Float32Array(128));
    expect(connection.sentUdp).toHaveLength(1);
    expect(rates).toEqual([0, 48000, 0]);
  });

  it("follows the bound GUI client's transmit slice", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(
      `S785E6DE8|client ${OTHER_HANDLE} connected client_id=GUI-UUID program=SmartSDR-Win station=Shack`,
    );
    connection.emitStatus(
      slice(0, "A", OTHER_HANDLE, "tx=1 sample_rate=48000"),
    );
    await radio.bindGuiClient("GUI-UUID");
    connection.prepareResponse("stream create", { message: "84000000" });
    const creation = radio.createDaxTxAudioStream();
    connection.emitStatus(
      `S12345678|stream 0x84000000 type=dax_tx client_handle=${OUR_HANDLE} tx=1 ip=10.16.83.140`,
    );
    const stream = await creation;

    stream.sendAudio(new Float32Array(128), new Float32Array(128));

    expect(sentClasses(connection)).toEqual([0x03e4]);
  });
});

describe("DAX RX and mic sample rate", () => {
  it("DAX RX takes the rate of its own client's slice with that letter", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus(slice(0, "A", OTHER_HANDLE, "sample_rate=48000"));
    connection.emitStatus(slice(1, "A", OUR_HANDLE, "sample_rate=24000"));
    connection.emitStatus(
      `S12345678|stream 0x04000009 type=dax_rx dax_channel=1 slice=A client_handle=${OUR_HANDLE} ip=10.16.83.140`,
    );

    expect(radio.getStore().getAudioStream("0x04000009")?.sampleRateHz).toBe(
      24000,
    );
  });

  it("DAX mic takes the rate from the class of the packets it receives", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("stream create", { message: "04000010" });
    const creation = radio.createDaxMicAudioStream();
    connection.emitStatus(
      `S12345678|stream 0x04000010 type=dax_mic client_handle=${OUR_HANDLE} ip=10.16.83.140`,
    );
    const stream = await creation;
    stream.on("data", () => {});

    const packet = new VitaDaxAudioPacket();
    packet.streamId = 0x04000010;
    packet.classId.packetClassCode = 0x03e4;
    packet.left = new Float32Array(128);
    packet.right = new Float32Array(128);
    connection.emit("udpData", packet.toBytes());

    expect(radio.getStore().getAudioStream("0x04000010")?.sampleRateHz).toBe(
      48000,
    );
  });
});
