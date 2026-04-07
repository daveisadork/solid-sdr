import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  AudioStreamSnapshot,
  AudioStreamStateChange,
} from "./state/index.js";
import type { RadioSession } from "./radio-core.js";
import type { VitaParsedPacket } from "../vita/parser.js";
import {
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
} from "../vita/dax-audio-packet.js";

export type AudioStreamDataEvent = VitaParsedPacket;

/** Number of audio frames per DAX packet. */
const DAX_PACKET_SAMPLES = 128;

export interface AudioStreamControllerEvents {
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
  /**
   * Send stereo float32 audio samples to the radio.
   *
   * Handles VITA-49 packet framing, sequencing, and stream ID automatically.
   * Each call sends one packet of {@link DAX_PACKET_SAMPLES} frames (128).
   * Samples should be in the range [-1, 1].
   */
  sendAudio(left: Float32Array, right: Float32Array): void;
  /**
   * Send mono int16 audio samples to the radio (reduced bandwidth mode).
   *
   * Handles VITA-49 packet framing, sequencing, and stream ID automatically.
   * Each call sends one packet of {@link DAX_PACKET_SAMPLES} frames (128).
   */
  sendReducedBwAudio(samples: Int16Array): void;
  close(): Promise<void>;
}

export class AudioStreamControllerImpl implements AudioStreamController {
  private readonly events =
    new TypedEventEmitter<AudioStreamControllerEvents>();
  private streamHandle?: string;
  private dataListeners = 0;
  private dataSubscription?: Subscription;

  // TX packet templates — allocated once, reused per send
  private txAudioPkt?: VitaDaxAudioPacket;
  private txReducedBwPkt?: VitaDaxReducedBwPacket;
  private txPacketCount = 0;

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

  sendAudio(left: Float32Array, right: Float32Array): void {
    const numericId = this.requireNumericStreamId();
    if (!this.txAudioPkt) {
      this.txAudioPkt = new VitaDaxAudioPacket();
      this.txAudioPkt.streamId = numericId;
      this.txAudioPkt.left = new Float32Array(DAX_PACKET_SAMPLES);
      this.txAudioPkt.right = new Float32Array(DAX_PACKET_SAMPLES);
    }
    const pkt = this.txAudioPkt;
    pkt.streamId = numericId;
    pkt.header.packetCount = this.txPacketCount;
    const frames = Math.min(left.length, right.length, DAX_PACKET_SAMPLES);
    pkt.left.set(left.subarray(0, frames));
    pkt.right.set(right.subarray(0, frames));
    this.txPacketCount = (this.txPacketCount + 1) & 0xf;
    this.session.sendUdp(pkt.toBytes());
  }

  sendReducedBwAudio(samples: Int16Array): void {
    const numericId = this.requireNumericStreamId();
    if (!this.txReducedBwPkt) {
      this.txReducedBwPkt = new VitaDaxReducedBwPacket();
      this.txReducedBwPkt.streamId = numericId;
      this.txReducedBwPkt.samples = new Int16Array(DAX_PACKET_SAMPLES);
    }
    const pkt = this.txReducedBwPkt;
    pkt.streamId = numericId;
    pkt.header.packetCount = this.txPacketCount;
    const count = Math.min(samples.length, DAX_PACKET_SAMPLES);
    pkt.samples.set(samples.subarray(0, count));
    this.txPacketCount = (this.txPacketCount + 1) & 0xf;
    this.session.sendUdp(pkt.toBytes());
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

  private requireNumericStreamId(): number {
    const handle = this.streamHandle ?? this.current().streamId;
    const numericId = parseStreamIdentifier(handle);
    if (numericId === undefined) {
      throw new FlexStateUnavailableError(
        `Audio stream ${this.id} has no valid stream ID`,
      );
    }
    return numericId;
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
