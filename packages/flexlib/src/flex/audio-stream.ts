import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  AudioStreamSnapshot,
  AudioStreamStateChange,
} from "./radio-state.js";

export interface AudioStreamControllerEvents extends Record<string, unknown> {
  readonly change: AudioStreamStateChange;
}

export interface AudioStreamSessionApi {
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  getAudioStream(id: string): AudioStreamSnapshot | undefined;
  patchAudioStream(id: string, attributes: Record<string, string>): void;
}

export interface AudioStreamController {
  readonly id: string;
  readonly state: AudioStreamSnapshot;
  readonly streamId: string;
  readonly type: string;
  readonly compression?: string;
  readonly clientHandle?: number;
  readonly ip?: string;
  readonly daxChannel?: number;
  readonly slice?: string;
  snapshot(): AudioStreamSnapshot;
  on<TKey extends keyof AudioStreamControllerEvents>(
    event: TKey,
    listener: (payload: AudioStreamControllerEvents[TKey]) => void,
  ): Subscription;
  close(): Promise<void>;
}

export class AudioStreamControllerImpl implements AudioStreamController {
  private readonly events =
    new TypedEventEmitter<AudioStreamControllerEvents>();
  private streamHandle?: string;

  constructor(
    private readonly session: AudioStreamSessionApi,
    readonly id: string,
  ) {
    const snapshot = this.session.getAudioStream(id);
    if (snapshot) {
      this.streamHandle = snapshot.streamId;
    }
  }

  private current(): AudioStreamSnapshot {
    const snapshot = this.session.getAudioStream(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Audio stream ${this.id} is no longer available`,
      );
    }
    this.streamHandle = snapshot.streamId;
    return snapshot;
  }

  get state(): AudioStreamSnapshot {
    return this.current();
  }

  get streamId(): string {
    return this.current().streamId;
  }

  get type(): string {
    return this.current().type;
  }

  get compression(): string | undefined {
    return this.current().compression;
  }

  get clientHandle(): number | undefined {
    return this.current().clientHandle;
  }

  get ip(): string | undefined {
    return this.current().ip;
  }

  get daxChannel(): number | undefined {
    return this.current().daxChannel;
  }

  get slice(): string | undefined {
    return this.current().slice;
  }

  snapshot(): AudioStreamSnapshot {
    return this.current();
  }

  on<TKey extends keyof AudioStreamControllerEvents>(
    event: TKey,
    listener: (payload: AudioStreamControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  async close(): Promise<void> {
    const snapshot = this.session.getAudioStream(this.id);
    const streamId = snapshot?.streamId ?? this.streamHandle;
    if (!streamId) return;
    this.streamHandle = streamId;
    await this.session.command(`stream remove ${streamId}`);
  }

  onStateChange(change: AudioStreamStateChange): void {
    if (change.diff?.streamId) {
      this.streamHandle = change.diff.streamId;
    }
    this.events.emit("change", change);
  }
}

// Convenience alias for remote audio RX stream controllers.
export type RemoteAudioRxStreamController = AudioStreamController;
export const RemoteAudioRxStreamControllerImpl = AudioStreamControllerImpl;
