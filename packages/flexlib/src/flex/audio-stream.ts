import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  AudioStreamSnapshot,
  AudioStreamStateChange,
} from "./state/index.js";
import type { RadioSession } from "./radio-core.js";
import type { VitaParsedPacket } from "../vita/parser.js";

export type AudioStreamDataEvent = VitaParsedPacket;

export interface AudioStreamControllerEvents extends Record<string, unknown> {
  readonly change: AudioStreamStateChange;
  readonly data: AudioStreamDataEvent;
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
  readonly tx: boolean;
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
  private dataListeners = 0;
  private dataSubscription?: Subscription;

  constructor(
    private readonly session: RadioSession,
    readonly id: string,
  ) {
    const snapshot = this.session.getStore().getAudioStream(id);
    if (snapshot) {
      this.streamHandle = snapshot.streamId;
    }
  }

  private current(): AudioStreamSnapshot {
    const snapshot = this.session.getStore().getAudioStream(this.id);
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

  get tx(): boolean {
    return this.current().tx;
  }

  snapshot(): AudioStreamSnapshot {
    return this.current();
  }

  on<TKey extends keyof AudioStreamControllerEvents>(
    event: TKey,
    listener: (payload: AudioStreamControllerEvents[TKey]) => void,
  ): Subscription {
    if (event === "data") {
      this.ensureDataPipeline();
      this.dataListeners += 1;
      const subscription = this.events.on(event, listener);
      return {
        unsubscribe: () => {
          subscription.unsubscribe();
          this.handleDataUnsubscribe();
        },
      };
    }
    return this.events.on(event, listener);
  }

  async close(): Promise<void> {
    this.teardownDataPipeline();
    const snapshot = this.session.getStore().getAudioStream(this.id);
    const streamId = snapshot?.streamId ?? this.streamHandle;
    if (!streamId) return;
    this.streamHandle = streamId;
    await this.session.command(`stream remove ${streamId}`);
    const change = this.session.getStore().removeAudioStream(this.id);
    if (change) this.session.applyStateChange(change);
  }

  onStateChange(change: AudioStreamStateChange): void {
    if (change.diff?.streamId) {
      this.streamHandle = change.diff.streamId;
      if (this.dataListeners > 0) {
        this.teardownDataPipeline();
        this.ensureDataPipeline();
      }
    }
    this.events.emit("change", change);
    if (change.removed) {
      this.teardownDataPipeline();
    }
  }

  private ensureDataPipeline(): void {
    if (this.dataSubscription) return;
    const streamNumericId = parseStreamIdentifier(this.streamId);
    if (!Number.isFinite(streamNumericId)) return;
    this.dataSubscription = this.session.registerStreamHandler(
      streamNumericId!,
      (packet) => {
        this.events.emit("data", packet);
      },
    );
  }

  private handleDataUnsubscribe(): void {
    if (this.dataListeners === 0) return;
    this.dataListeners = Math.max(0, this.dataListeners - 1);
    if (this.dataListeners === 0) {
      this.teardownDataPipeline();
    }
  }

  private teardownDataPipeline(): void {
    this.dataSubscription?.unsubscribe();
    this.dataSubscription = undefined;
  }
}

// Convenience alias for remote audio RX stream controllers.
export type RemoteAudioRxStreamController = AudioStreamController;
export const RemoteAudioRxStreamControllerImpl = AudioStreamControllerImpl;

function parseStreamIdentifier(id: string): number | undefined {
  if (!id) return undefined;
  const trimmed = id.trim();
  if (trimmed === "") return undefined;
  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    const parsed = Number.parseInt(trimmed.slice(2), 16);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
