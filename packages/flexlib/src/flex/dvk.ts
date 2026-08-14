import { type Subscription, TypedEventEmitter } from "../util/events.js";
import {
  FlexCommandRejectedError,
  FlexError,
  FlexStateUnavailableError,
} from "./errors.js";
import type { FileUpload } from "./file-transfer.js";
import type { RadioSession } from "./radio-core.js";
import type {
  DvkRecording,
  DvkSnapshot,
  DvkStateChange,
} from "./state/index.js";

/** Events emitted by a {@link DvkController}. */
export interface DvkControllerEvents {
  readonly change: DvkStateChange;
}

/**
 * A full 10-second slot at the required WAV format is under 1 MB, so this
 * is a generous sanity ceiling rather than a tight bound.
 */
export const DVK_MAX_WAV_FILE_SIZE_BYTES = 5_000_000;

// Reply codes are hex on the wire; this is "File server busy".
const FILE_SERVER_BUSY_CODE = 0x50000053;

/**
 * Validates that `data` is a WAV file in the format the radio stores DVK
 * recordings in: 2-channel 16-bit PCM at 24 kHz.
 *
 * @throws {FlexError} when the file is too large, not a WAV, or the wrong format.
 */
export function validateDvkWavFile(data: Uint8Array): void {
  if (data.byteLength > DVK_MAX_WAV_FILE_SIZE_BYTES) {
    throw new FlexError(
      `WAV file is ${data.byteLength} bytes; maximum is ${DVK_MAX_WAV_FILE_SIZE_BYTES}`,
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
  if (data.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    throw new FlexError("Not a valid WAV file (missing RIFF/WAVE header)");
  }
  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const chunkId = tag(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "fmt ") {
      if (offset + 24 > data.byteLength) break;
      const channels = view.getUint16(offset + 10, true);
      const sampleRate = view.getUint32(offset + 12, true);
      const bitsPerSample = view.getUint16(offset + 22, true);
      if (channels !== 2 || sampleRate !== 24_000 || bitsPerSample !== 16) {
        throw new FlexError(
          `WAV format is ${channels}-channel ${bitsPerSample}-bit ${sampleRate} Hz; ` +
            "DVK requires 2-channel 16-bit 24000 Hz",
        );
      }
      return;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new FlexError("Not a valid WAV file (missing fmt chunk)");
}

/**
 * Names travel the wire quote-delimited (`name="X"`) and come back the same
 * way in status messages. No escape syntax is known, so an embedded quote
 * would corrupt the command or the reply parse.
 */
function validateName(name: string): void {
  if (name.includes('"') || name.includes("'")) {
    throw new FlexError("DVK recording names may not contain quotes");
  }
}

/**
 * Controller for the DVK (Digital Voice Keyer).
 *
 * Provides access to DVK system status and stored recordings, and
 * methods to create, record, play, and manage voice keyer entries.
 */
export interface DvkController extends Readonly<Omit<DvkSnapshot, "raw">> {
  /** Returns the current snapshot of DVK state. */
  snapshot(): DvkSnapshot;

  /** Registers a listener for DVK state changes. */
  on<TKey extends keyof DvkControllerEvents>(
    event: TKey,
    listener: (payload: DvkControllerEvents[TKey]) => void,
  ): Subscription;

  /**
   * Allocates a recording slot and returns its id.
   *
   * The radio either reuses an existing empty slot or mints a new one; the
   * reply carries the allocated slot as `N-"Name"`. Slots get a default name
   * — use {@link setName} to rename.
   */
  create(): Promise<string>;

  /** Starts recording into the specified recording slot. */
  startRecording(id: string): Promise<void>;

  /** Stops recording into the specified recording slot. */
  stopRecording(id: string): Promise<void>;

  /** Starts preview playback of the specified recording. */
  startPreview(id: string): Promise<void>;

  /** Stops preview playback of the specified recording. */
  stopPreview(id: string): Promise<void>;

  /** Starts playback (on-air) of the specified recording. */
  startPlayback(id: string): Promise<void>;

  /** Stops playback of the specified recording. */
  stopPlayback(id: string): Promise<void>;

  /** Deletes a recording by ID. */
  remove(id: string): Promise<void>;

  /** Renames a recording. */
  setName(id: string, name: string): Promise<void>;

  /** Clears a recording's audio content, keeping the slot. */
  clear(id: string): Promise<void>;

  /**
   * Uploads a WAV file into the specified recording slot.
   *
   * Validates the WAV format client-side (see {@link validateDvkWavFile}),
   * then marks the target slot and streams the bytes via the generic file
   * upload path. The returned {@link FileUpload} emits progress/failed/done.
   */
  upload(id: string, data: Uint8Array, filename: string): Promise<FileUpload>;

  /** Downloads the specified recording as raw WAV bytes. */
  download(id: string): Promise<Uint8Array>;
}

export class DvkControllerImpl implements DvkController {
  private readonly events = new TypedEventEmitter<DvkControllerEvents>();

  constructor(private readonly radio: RadioSession) {}

  private current(): DvkSnapshot {
    const snapshot = this.radio.getStore().getDvk();
    if (!snapshot) {
      throw new FlexStateUnavailableError("DVK status is not available");
    }
    return snapshot;
  }

  snapshot(): DvkSnapshot {
    return this.current();
  }

  get status() {
    return this.current().status;
  }

  get enabled(): boolean {
    return this.current().enabled;
  }

  get statusRecordingId(): string | undefined {
    return this.current().statusRecordingId;
  }

  get recordings(): readonly DvkRecording[] {
    return this.current().recordings;
  }

  async create(): Promise<string> {
    const response = await this.radio.command("dvk create");
    const match = /^(\d+)-"/.exec(response.message ?? "");
    if (!match) {
      throw new FlexError(
        `Unexpected dvk create reply: ${JSON.stringify(response.message)}`,
      );
    }
    return match[1];
  }

  async startRecording(id: string): Promise<void> {
    await this.radio.command(`dvk rec_start id=${id}`);
  }

  async stopRecording(id: string): Promise<void> {
    await this.radio.command(`dvk rec_stop id=${id}`);
  }

  async startPreview(id: string): Promise<void> {
    await this.radio.command(`dvk preview_start id=${id}`);
  }

  async stopPreview(id: string): Promise<void> {
    await this.radio.command(`dvk preview_stop id=${id}`);
  }

  async startPlayback(id: string): Promise<void> {
    await this.radio.command(`dvk playback_start id=${id}`);
  }

  async stopPlayback(id: string): Promise<void> {
    await this.radio.command(`dvk playback_stop id=${id}`);
  }

  async remove(id: string): Promise<void> {
    await this.radio.command(`dvk remove id=${id}`);
  }

  async setName(id: string, name: string): Promise<void> {
    validateName(name);
    await this.radio.command(`dvk set_name name="${name}" id=${id}`);
  }

  async clear(id: string): Promise<void> {
    await this.radio.command(`dvk clear id=${id}`);
  }

  async upload(
    id: string,
    data: Uint8Array,
    filename: string,
  ): Promise<FileUpload> {
    validateDvkWavFile(data);
    // Marks the slot the following generic file upload lands in.
    await this.radio.command(`dvk upload id=${id}`);
    return this.radio.uploadFile({ target: "dvk_recording", filename, data });
  }

  async download(id: string): Promise<Uint8Array> {
    // The radio's file server stays busy for ~2 s after an upload and
    // rejects downloads with "File server busy" until it releases, so
    // retry that specific rejection for a bounded window.
    const deadline = Date.now() + 5_000;
    for (;;) {
      try {
        return await this.radio
          .createDownloadWithCommand(`dvk download id=${id}`)
          .start();
      } catch (error) {
        const busy =
          error instanceof FlexCommandRejectedError &&
          error.response.code === FILE_SERVER_BUSY_CODE;
        if (!busy || Date.now() >= deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  on<TKey extends keyof DvkControllerEvents>(
    event: TKey,
    listener: (payload: DvkControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: DvkStateChange): void {
    this.events.emit("change", change);
  }
}
