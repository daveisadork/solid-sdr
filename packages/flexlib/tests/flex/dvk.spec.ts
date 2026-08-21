import { describe, expect, it, vi } from "vitest";
import {
  DVK_MAX_WAV_FILE_SIZE_BYTES,
  validateDvkWavFile,
} from "../../src/flex/dvk.js";
import type { RadioStateChange } from "../../src/flex/state/index.js";
import { createRadioStateStore } from "../../src/flex/state/index.js";
import { createConnectedRadio, makeStatus } from "../helpers.js";

describe("DVK snapshot", () => {
  it("parses global status updates", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a dvk status arrives
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // then dvk state is tracked
    const dvk = store.getDvk();
    expect(dvk).toBeDefined();
    expect(dvk?.status).toBe("idle");
    expect(dvk?.enabled).toBe(true);
  });

  it("tracks recording additions", () => {
    // given a store with dvk state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // when a recording is added
    store.apply(makeStatus('S2|dvk added id=1 name="CQ DX" duration=3500'));

    // then the recording appears in state
    const dvk = store.getDvk();
    expect(dvk?.recordings).toHaveLength(1);
    expect(dvk?.recordings[0].id).toBe("1");
    expect(dvk?.recordings[0].name).toBe("CQ DX");
    expect(dvk?.recordings[0].durationMs).toBe(3500);
  });

  it("tracks recording deletions", () => {
    // given a store with a recording
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));
    store.apply(makeStatus('S2|dvk added id=1 name="CQ" duration=2000'));
    store.apply(makeStatus('S3|dvk added id=2 name="73" duration=1500'));
    expect(store.getDvk()?.recordings).toHaveLength(2);

    // when a recording is deleted
    store.apply(makeStatus("S4|dvk deleted id=1"));

    // then only the other remains
    const dvk = store.getDvk();
    expect(dvk?.recordings).toHaveLength(1);
    expect(dvk?.recordings[0].id).toBe("2");
  });

  it("updates existing recordings", () => {
    // given a store with a recording
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));
    store.apply(makeStatus('S2|dvk added id=1 name="CQ" duration=2000'));

    // when the same recording is re-added with updated info
    store.apply(makeStatus('S3|dvk added id=1 name="CQ-DX" duration=3000'));

    // then it is updated in place
    const dvk = store.getDvk();
    expect(dvk?.recordings).toHaveLength(1);
    expect(dvk?.recordings[0].name).toBe("CQ-DX");
    expect(dvk?.recordings[0].durationMs).toBe(3000);
  });

  it("applies marker-less update messages to the recording", () => {
    // given a store with a recording (wire shapes captured from a FLEX-8600)
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));
    store.apply(
      makeStatus('S2|dvk added id=14 name="Recording 14" duration=0'),
    );

    // when rename and upload confirmations arrive (no `added` marker)
    store.apply(makeStatus('S3|dvk id=14 name="ITEST Probe" duration=0'));
    store.apply(makeStatus('S4|dvk id=14 name="ITEST Probe" duration=500'));

    // then the recording reflects both updates
    const dvk = store.getDvk();
    expect(dvk?.recordings).toHaveLength(1);
    expect(dvk?.recordings[0].name).toBe("ITEST Probe");
    expect(dvk?.recordings[0].durationMs).toBe(500);
    // and the global status fields are untouched
    expect(dvk?.status).toBe("idle");
    expect(dvk?.statusRecordingId).toBeUndefined();
  });

  it("tracks playback status", () => {
    // given a store with dvk
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // when playback starts
    store.apply(makeStatus("S2|dvk status=playback id=1 enabled=1"));

    // then status and id are updated
    const dvk = store.getDvk();
    expect(dvk?.status).toBe("playback");
    expect(dvk?.statusRecordingId).toBe("1");
  });

  it("clears statusRecordingId when activity ends", () => {
    // given an active preview (wire shapes captured from a FLEX-8600)
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));
    store.apply(makeStatus("S2|dvk status=preview id=24 enabled=1"));
    expect(store.getDvk()?.statusRecordingId).toBe("24");

    // when the end-of-preview broadcast arrives (no id key)
    store.apply(makeStatus("S0|dvk status=idle enabled=1"));

    // then the slot id does not linger
    const dvk = store.getDvk();
    expect(dvk?.status).toBe("idle");
    expect(dvk?.statusRecordingId).toBeUndefined();
  });

  it("forces status to disabled when enabled=0 arrives alone", () => {
    // given a store with active playback
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=playback enabled=1 id=5"));
    expect(store.getDvk()?.status).toBe("playback");
    expect(store.getDvk()?.statusRecordingId).toBe("5");

    // when enabled=0 arrives without status/id
    store.apply(makeStatus("S2|dvk enabled=0"));

    // then status is forced to disabled and recordingId cleared
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(false);
    expect(dvk?.status).toBe("disabled");
    expect(dvk?.statusRecordingId).toBeUndefined();
  });

  it("overrides status when enabled=0 arrives with status and id in same message", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when a contradictory message arrives
    store.apply(makeStatus("S1|dvk status=playback enabled=0 id=5"));

    // then enabled=0 wins and forces disabled with cleared id
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(false);
    expect(dvk?.status).toBe("disabled");
    expect(dvk?.statusRecordingId).toBeUndefined();
  });

  it("does not override when enabled=1 arrives with status and id", () => {
    // given a fresh store
    const store = createRadioStateStore();

    // when enabled=1 arrives with playback status
    store.apply(makeStatus("S1|dvk status=playback enabled=1 id=5"));

    // then status and id are preserved
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(true);
    expect(dvk?.status).toBe("playback");
    expect(dvk?.statusRecordingId).toBe("5");
  });

  it("does not override enabled when its key is absent", () => {
    // given a store in playback
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=playback enabled=1 id=5"));

    // when a status-only update arrives without enabled key
    store.apply(makeStatus("S2|dvk status=idle"));

    // then enabled is unchanged, status applies, and the id is cleared
    // (a status without an id means the activity is over)
    const dvk = store.getDvk();
    expect(dvk?.enabled).toBe(true);
    expect(dvk?.status).toBe("idle");
    expect(dvk?.statusRecordingId).toBeUndefined();
  });

  it("snapshot includes dvk", () => {
    // given a store with dvk state
    const store = createRadioStateStore();
    store.apply(makeStatus("S1|dvk status=idle enabled=1"));

    // then snapshot includes dvk
    expect(store.snapshot().dvk).toBeDefined();
    expect(store.snapshot().dvk?.status).toBe("idle");
  });
});

describe("DVK controller", () => {
  it("provides getters and sends commands", async () => {
    // given a connected radio with dvk state
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");
    connection.emitStatus('S2|dvk added id=1 name="CQ" duration=2000');

    // then controller reflects state
    const dvk = radio.dvk();
    expect(dvk.status).toBe("idle");
    expect(dvk.enabled).toBe(true);
    expect(dvk.recordings).toHaveLength(1);

    // given a change listener
    const changes: RadioStateChange[] = [];
    dvk.on("change", (c) => changes.push(c));

    // when commands are sent
    // create is bare; the reply carries the allocated slot as `N-"Name"`
    connection.prepareResponse("dvk create", { message: '13-"Recording 13"' });
    const createdId = await dvk.create();
    expect(connection.lastCommand()).toBe("dvk create");
    expect(createdId).toBe("13");

    await dvk.startRecording("1");
    expect(connection.lastCommand()).toBe("dvk rec_start id=1");

    await dvk.stopRecording("1");
    expect(connection.lastCommand()).toBe("dvk rec_stop id=1");

    await dvk.startPreview("1");
    expect(connection.lastCommand()).toBe("dvk preview_start id=1");

    await dvk.stopPreview("1");
    expect(connection.lastCommand()).toBe("dvk preview_stop id=1");

    await dvk.startPlayback("1");
    expect(connection.lastCommand()).toBe("dvk playback_start id=1");

    await dvk.stopPlayback("1");
    expect(connection.lastCommand()).toBe("dvk playback_stop id=1");

    await dvk.remove("1");
    expect(connection.lastCommand()).toBe("dvk remove id=1");

    await dvk.setName("1", "Renamed");
    expect(connection.lastCommand()).toBe('dvk set_name name="Renamed" id=1');

    await dvk.clear("1");
    expect(connection.lastCommand()).toBe("dvk clear id=1");
  });

  it("create throws when the reply does not carry a slot id", async () => {
    // given a connected radio with dvk state
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");

    // when the create reply is not the expected `N-"Name"` shape
    connection.prepareResponse("dvk create", { message: "" });

    // then create rejects instead of returning a bogus id
    await expect(radio.dvk().create()).rejects.toThrow("dvk create reply");
  });

  it("rejects names containing double quotes, allows single quotes", async () => {
    // given a connected radio with dvk state
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");
    const dvk = radio.dvk();
    const before = connection.lastCommand();

    // when a name contains a double quote (the radio has no escape syntax
    // and would silently ignore the rename)
    // then the command is refused before reaching the wire
    await expect(dvk.setName("1", 'CQ "DX"')).rejects.toThrow("double quotes");
    expect(connection.lastCommand()).toBe(before);

    // but single quotes round-trip fine on a real radio (contractions)
    await dvk.setName("1", "It's CQ time");
    expect(connection.lastCommand()).toBe(
      `dvk set_name name="It's CQ time" id=1`,
    );
  });

  it("emits change events on status updates", async () => {
    // given a connected radio with dvk
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");

    const dvk = radio.dvk();
    const changes: RadioStateChange[] = [];
    dvk.on("change", (c) => changes.push(c));

    // when status changes
    connection.emitStatus("S2|dvk status=recording id=1 enabled=1");

    // then change event fires
    expect(changes).toHaveLength(1);
    expect(dvk.status).toBe("recording");
  });
});

/** Minimal WAV file: RIFF/WAVE with a fmt chunk and an empty data chunk. */
function makeWav({
  channels = 2,
  sampleRate = 24_000,
  bitsPerSample = 16,
} = {}): Uint8Array {
  const buf = new Uint8Array(44);
  const view = new DataView(buf.buffer);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < 4; i++) buf[offset + i] = text.charCodeAt(i);
  };
  tag(0, "RIFF");
  view.setUint32(4, 36, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  tag(36, "data");
  view.setUint32(40, 0, true);
  return buf;
}

describe("validateDvkWavFile", () => {
  it("accepts 2-channel 16-bit 24 kHz WAV", () => {
    expect(() => validateDvkWavFile(makeWav())).not.toThrow();
  });

  it("rejects wrong sample rate, channel count, and bit depth", () => {
    expect(() => validateDvkWavFile(makeWav({ sampleRate: 48_000 }))).toThrow(
      "24000",
    );
    expect(() => validateDvkWavFile(makeWav({ channels: 1 }))).toThrow(
      "2-channel",
    );
    expect(() => validateDvkWavFile(makeWav({ bitsPerSample: 32 }))).toThrow(
      "16-bit",
    );
  });

  it("rejects non-WAV bytes", () => {
    expect(() => validateDvkWavFile(new Uint8Array([1, 2, 3]))).toThrow("RIFF");
  });

  it("rejects oversize files", () => {
    const big = new Uint8Array(DVK_MAX_WAV_FILE_SIZE_BYTES + 1);
    expect(() => validateDvkWavFile(big)).toThrow("maximum");
  });
});

describe("DVK upload/download", () => {
  it("marks the slot then uploads via the generic file path", async () => {
    // given a connected radio with dvk state
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");
    connection.prepareResponse("file upload", { message: "4995" });

    // when a WAV is uploaded into slot 3
    const wav = makeWav();
    const upload = await radio.dvk().upload("3", wav);
    await new Promise<void>((resolve) => upload.on("done", () => resolve()));

    // then the slot is marked before the file upload command
    const markIndex = connection.commands.indexOf("dvk upload id=3");
    const uploadIndex = connection.commands.findIndex((c) =>
      c.startsWith("file upload"),
    );
    expect(markIndex).toBeGreaterThanOrEqual(0);
    expect(uploadIndex).toBeGreaterThan(markIndex);
    expect(connection.commands[uploadIndex]).toBe(
      `file upload ${wav.byteLength} dvk_recording cq.wav`,
    );

    // and the bytes reach the transport
    const received = Buffer.concat(
      connection.uploadedChunks.map((c) => Buffer.from(c)),
    );
    expect(received).toEqual(Buffer.from(wav));
  });

  it("refuses to upload an invalid WAV without touching the wire", async () => {
    // given a connected radio with dvk state
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");
    const before = connection.commands.length;

    // when a wrong-format WAV is uploaded
    await expect(
      radio.dvk().upload("3", makeWav({ sampleRate: 48_000 })),
    ).rejects.toThrow("24000");

    // then no command was sent
    expect(connection.commands.length).toBe(before);
  });

  it("downloads a recording via a dvk download command", async () => {
    // given a connected radio with dvk state and a download receiver
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");
    const expected = new Uint8Array([0xca, 0xfe]);
    const accept = vi.fn();
    connection.downloadReceiver = {
      accept,
      result: () => Promise.resolve(expected),
    };
    connection.prepareResponse("dvk download", { message: "42607" });

    // when slot 2 is downloaded
    const bytes = await radio.dvk().download("2");

    // then the dvk download command carried the id and the port was accepted
    expect(connection.commands).toContain("dvk download id=2");
    expect(accept).toHaveBeenCalledWith(42607);
    expect(bytes).toEqual(expected);
  });

  it("download retries while the file server is busy", async () => {
    // given a connected radio whose file server is busy (as it is for ~2s
    // after an upload)
    const { radio, connection } = await createConnectedRadio();
    connection.emitStatus("S1|dvk status=idle enabled=1");
    const expected = new Uint8Array([0xca, 0xfe]);
    connection.downloadReceiver = {
      accept: vi.fn(),
      result: () => Promise.resolve(expected),
    };
    connection.prepareResponse("dvk download", {
      code: 0x50000053,
      message: "File server busy",
    });

    // when the download starts against the busy rejection
    const pending = radio.dvk().download("2");
    // wait out the first (rejected) attempt, then let the retry succeed
    await vi.waitFor(() => {
      expect(
        connection.commands.filter((c) => c === "dvk download id=2"),
      ).toHaveLength(1);
    });
    connection.prepareResponse("dvk download", { message: "42607" });

    // then the retry completes the transfer
    expect(await pending).toEqual(expected);
    expect(
      connection.commands.filter((c) => c === "dvk download id=2").length,
    ).toBeGreaterThanOrEqual(2);
  });
});
