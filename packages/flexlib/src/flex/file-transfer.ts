import { TypedEventEmitter, type Subscription } from "../util/events.js";

// ---------------------------------------------------------------------------
// FileUpload
// ---------------------------------------------------------------------------

export interface FileUploadEvents {
  /** Transfer progress as a 0–100 float from the radio's `transfer=` field. */
  readonly progress: number;
  /** Radio reported a failure; `reason` is the radio's `reason=` value if present. */
  readonly failed: { readonly reason?: string };
  /** All bytes have been written to the transport. */
  readonly done: undefined;
}

/** Handle returned by {@link Radio.uploadFile}. Emits progress/failed/done events. */
export interface FileUpload {
  on<K extends keyof FileUploadEvents>(
    event: K,
    handler: (payload: FileUploadEvents[K]) => void,
  ): Subscription;
}

/** @internal */
export class FileUploadImpl
  extends TypedEventEmitter<FileUploadEvents>
  implements FileUpload
{
  receiveProgress(value: number): void {
    this.emit("progress", value);
  }

  receiveFailed(reason?: string): void {
    this.emit("failed", { reason });
  }

  receiveDone(): void {
    this.emit("done", undefined);
  }
}

// ---------------------------------------------------------------------------
// FileDownload
// ---------------------------------------------------------------------------

/** Handle returned by {@link Radio.createDownload}. Call {@link start} to initiate the transfer. */
export interface FileDownload {
  start(): Promise<Uint8Array>;
}

/** @internal */
export class FileDownloadImpl implements FileDownload {
  private readonly executor: () => Promise<Uint8Array>;

  constructor(executor: () => Promise<Uint8Array>) {
    this.executor = executor;
  }

  start(): Promise<Uint8Array> {
    return this.executor();
  }
}

// ---------------------------------------------------------------------------
// UploadFileOptions
// ---------------------------------------------------------------------------

export interface UploadFileOptions {
  /**
   * Sent as `file filename <name>` before the upload command.
   * Required for some targets (e.g. `new_waveform`); omit for others.
   */
  readonly filename?: string;
  /** Upload target, e.g. `new_waveform`, `update`, `turf`, `memories_csv_file`. */
  readonly target: string;
  /** File bytes. Pass a `Uint8Array` for small files; an `AsyncIterable` for large ones. */
  readonly data: Uint8Array | AsyncIterable<Uint8Array>;
  /**
   * Total byte count. Required when `data` is `AsyncIterable`; inferred
   * automatically when `data` is `Uint8Array`.
   */
  readonly totalBytes?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a `Uint8Array` in a single-yield async iterable, or pass through as-is. */
export function toAsyncIterable(
  data: Uint8Array | AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  if (data instanceof Uint8Array) {
    const buf = data;
    return (async function* () {
      yield buf;
    })();
  }
  return data;
}

/** Extract the total byte count from upload options, throwing if it can't be determined. */
export function resolveTotalBytes(opts: UploadFileOptions): number {
  if (opts.data instanceof Uint8Array) return opts.data.byteLength;
  if (opts.totalBytes === undefined) {
    throw new Error(
      "totalBytes is required when data is AsyncIterable — the radio needs the size before receiving bytes",
    );
  }
  return opts.totalBytes;
}
