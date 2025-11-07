import type {
  FlexCommandOptions,
  FlexCommandResponse,
} from "./adapters.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  AudioStreamSnapshot,
  AudioStreamStateChange,
} from "./radio-state.js";

export interface AudioStreamControllerEvents
  extends Record<string, unknown> {
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
  readonly port?: number;
  readonly daxChannel?: number;
  readonly slice?: string;
  readonly rxGain?: number;
  readonly rxMuted?: boolean;
  readonly txGain?: number;
  readonly txMuted?: boolean;
  readonly clients?: number;
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

  constructor(
    private readonly session: AudioStreamSessionApi,
    readonly id: string,
  ) {}

  private current(): AudioStreamSnapshot {
    const snapshot = this.session.getAudioStream(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Audio stream ${this.id} is no longer available`,
      );
    }
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

  get port(): number | undefined {
    return this.current().port;
  }

  get daxChannel(): number | undefined {
    return this.current().daxChannel;
  }

  get slice(): string | undefined {
    return this.current().slice;
  }

  get rxGain(): number | undefined {
    return this.current().rxGain;
  }

  get rxMuted(): boolean | undefined {
    return this.current().rxMuted;
  }

  get txGain(): number | undefined {
    return this.current().txGain;
  }

  get txMuted(): boolean | undefined {
    return this.current().txMuted;
  }

  get clients(): number | undefined {
    return this.current().clients;
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
    const streamId = this.streamId;
    await this.session.command(`stream remove ${streamId}`);
  }

  onStateChange(change: AudioStreamStateChange): void {
    this.events.emit("change", change);
  }
}

// Backwards compatibility aliases while the higher-level API transitions.
export type RemoteAudioStreamController = AudioStreamController;
export const RemoteAudioStreamControllerImpl = AudioStreamControllerImpl;
