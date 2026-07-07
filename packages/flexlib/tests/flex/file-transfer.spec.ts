import { describe, expect, it, vi } from "vitest";
import {
  resolveTotalBytes,
  toAsyncIterable,
  type UploadFileOptions,
} from "../../src/flex/file-transfer.js";
import type { FileDownloadReceiver } from "../../src/flex/transport.js";
import { createConnectedRadio } from "../helpers.js";

// ---------------------------------------------------------------------------
// toAsyncIterable
// ---------------------------------------------------------------------------

describe("toAsyncIterable", () => {
  it("wraps a Uint8Array in a single-yield iterable", async () => {
    const buf = new Uint8Array([1, 2, 3]);
    const chunks: Uint8Array[] = [];
    for await (const c of toAsyncIterable(buf)) chunks.push(c);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(buf);
  });

  it("passes through an AsyncIterable unchanged", async () => {
    async function* gen() {
      yield new Uint8Array([1]);
      yield new Uint8Array([2]);
    }
    const chunks: Uint8Array[] = [];
    for await (const c of toAsyncIterable(gen())) chunks.push(c);
    expect(chunks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// resolveTotalBytes
// ---------------------------------------------------------------------------

describe("resolveTotalBytes", () => {
  it("infers byteLength from Uint8Array", () => {
    const opts: UploadFileOptions = {
      target: "new_waveform",
      data: new Uint8Array(42),
    };
    expect(resolveTotalBytes(opts)).toBe(42);
  });

  it("uses explicit totalBytes for AsyncIterable", async () => {
    async function* gen() {
      yield new Uint8Array(10);
    }
    const opts: UploadFileOptions = {
      target: "new_waveform",
      data: gen(),
      totalBytes: 10,
    };
    expect(resolveTotalBytes(opts)).toBe(10);
  });

  it("throws when totalBytes is missing for AsyncIterable", () => {
    async function* gen() {
      yield new Uint8Array(1);
    }
    const opts: UploadFileOptions = { target: "new_waveform", data: gen() };
    expect(() => resolveTotalBytes(opts)).toThrow("totalBytes is required");
  });
});

// ---------------------------------------------------------------------------
// Radio.uploadFile
// ---------------------------------------------------------------------------

describe("Radio.uploadFile", () => {
  it("sends file filename and file upload commands in order", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "4995" });

    const data = new Uint8Array([0xde, 0xad]);
    await radio.uploadFile({
      filename: "test.wfp",
      target: "new_waveform",
      data,
    });

    expect(connection.commands).toContain("file filename test.wfp");
    const uploadCmd = connection.commands.find((c) =>
      c.startsWith("file upload"),
    );
    expect(uploadCmd).toBe("file upload 2 new_waveform");
  });

  it("sends filename inline for non-new_waveform targets", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "4995" });

    await radio.uploadFile({
      filename: "my.wfp",
      target: "waveform_docker_image",
      data: new Uint8Array(2),
    });

    expect(connection.commands.some((c) => c.startsWith("file filename"))).toBe(
      false,
    );
    const uploadCmd = connection.commands.find((c) =>
      c.startsWith("file upload"),
    );
    expect(uploadCmd).toBe("file upload 2 waveform_docker_image my.wfp");
  });

  it("omits file filename when not provided", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "4995" });

    await radio.uploadFile({ target: "update", data: new Uint8Array(1) });

    expect(connection.commands.some((c) => c.startsWith("file filename"))).toBe(
      false,
    );
  });

  it("streams bytes to the transport", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "4995" });

    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const upload = await radio.uploadFile({ target: "update", data });

    await new Promise<void>((resolve) => upload.on("done", () => resolve()));

    const received = Buffer.concat(
      connection.uploadedChunks.map((c) => Buffer.from(c)),
    );
    expect(received).toEqual(Buffer.from(data));
  });

  it("emits progress events from file update status messages", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "4995" });

    const upload = await radio.uploadFile({
      target: "update",
      data: new Uint8Array(1),
    });

    const progress: number[] = [];
    upload.on("progress", (p) => progress.push(p));

    connection.emitStatus("S1|file update transfer=42.5");
    connection.emitStatus("S2|file update transfer=100.0");

    expect(progress).toEqual([42.5, 100.0]);
  });

  it("emits failed event from file update status message", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "4995" });

    const upload = await radio.uploadFile({
      target: "update",
      data: new Uint8Array(1),
    });

    const failures: Array<{ reason?: string }> = [];
    upload.on("failed", (f) => failures.push(f));

    connection.emitStatus("S1|file update failed=1 reason=size_mismatch");

    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe("size_mismatch");
  });

  it("throws when a second upload is started while one is in progress", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "4995" });
    // Stall openUpload so the first upload doesn't complete
    connection.openUpload = () => new Promise<void>(() => {});

    await radio.uploadFile({ target: "update", data: new Uint8Array(1) });

    connection.prepareResponse("file upload", { message: "4995" });
    await expect(
      radio.uploadFile({ target: "update", data: new Uint8Array(1) }),
    ).rejects.toThrow("already in progress");
  });

  it("throws when radio returns a non-numeric port", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.prepareResponse("file upload", { message: "not-a-port" });

    await expect(
      radio.uploadFile({ target: "update", data: new Uint8Array(1) }),
    ).rejects.toThrow("valid upload port");
  });
});

// ---------------------------------------------------------------------------
// Radio.createDownload
// ---------------------------------------------------------------------------

describe("Radio.createDownload", () => {
  it("calls prepareDownload before sending the file download command", async () => {
    const { radio, connection } = await createConnectedRadio();
    let prepareCalledBeforeCommand = false;
    let commandSent = false;

    const receiver: FileDownloadReceiver = {
      accept: vi.fn(),
      result: () =>
        new Promise<Uint8Array>((resolve) =>
          setTimeout(() => resolve(new Uint8Array([1, 2, 3])), 0),
        ),
    };

    connection.prepareDownload = async () => {
      prepareCalledBeforeCommand = !commandSent;
      return receiver;
    };

    const origSendTcp = connection.sendTcp.bind(connection);
    connection.sendTcp = async (data: string) => {
      if (data.includes("file download")) commandSent = true;
      return origSendTcp(data);
    };

    connection.prepareResponse("file download", { message: "42607" });

    const download = radio.createDownload("db_package");
    await download.start();

    expect(prepareCalledBeforeCommand).toBe(true);
    expect(receiver.accept).toHaveBeenCalledWith(42607);
  });

  it("returns the bytes from the receiver", async () => {
    const { radio, connection } = await createConnectedRadio();
    const expected = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);

    connection.downloadReceiver = {
      accept: vi.fn(),
      result: () => Promise.resolve(expected),
    };
    connection.prepareResponse("file download", { message: "42607" });

    const result = await radio.createDownload("db_package").start();
    expect(result).toEqual(expected);
  });

  it("throws when radio returns a non-numeric port", async () => {
    const { radio, connection } = await createConnectedRadio();
    connection.downloadReceiver = {
      accept: vi.fn(),
      result: () => new Promise<Uint8Array>(() => {}),
    };
    connection.prepareResponse("file download", { message: "bad" });

    await expect(radio.createDownload("db_package").start()).rejects.toThrow(
      "valid download port",
    );
  });
});
