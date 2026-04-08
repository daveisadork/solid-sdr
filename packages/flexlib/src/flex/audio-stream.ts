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
import { VitaOpusPacket } from "../vita/opus-packet.js";

export type AudioStreamDataEvent = VitaParsedPacket;

/** Number of audio frames per DAX packet. */
const DAX_PACKET_SAMPLES = 128;

export interface AudioStreamControllerEvents {
  readonly change: AudioStreamStateChange;
  readonly data: AudioStreamDataEvent;
}

/** Base controller for all audio streams (RX and TX). */
export interface AudioStreamController
  extends Readonly<Omit<AudioStreamSnapshot, "raw">> {
  snapshot(): AudioStreamSnapshot;
  on<TKey extends keyof AudioStreamControllerEvents>(
    event: TKey,
    listener: (payload: AudioStreamControllerEvents[TKey]) => void,
  ): Subscription;
  close(): Promise<void>;
}

/** TX-capable audio stream controller (DAX TX, DAX Mic). */
export interface AudioStreamTxController extends AudioStreamController {
  /**
   * Send stereo float32 audio samples to the radio.
   *
   * Handles VITA-49 packet framing, sequencing, and stream ID automatically.
   * Each call sends one packet of 128 frames. Samples should be in [-1, 1].
   */
  sendAudio(left: Float32Array, right: Float32Array): void;
  /**
   * Send mono int16 audio samples to the radio (reduced bandwidth mode).
   *
   * Handles VITA-49 packet framing, sequencing, and stream ID automatically.
   * Each call sends one packet of 128 frames.
   */
  sendReducedBwAudio(samples: Int16Array): void;
}

/** Remote audio TX stream controller — supports PCM and Opus. */
export interface RemoteAudioTxStreamController extends AudioStreamTxController {
  /**
   * Send an Opus-encoded audio frame to the radio.
   *
   * The caller is responsible for encoding; the controller handles
   * VITA-49 packet framing, sequencing, and stream ID.
   */
  sendOpus(frame: Uint8Array): void;
}

export class AudioStreamControllerImpl implements AudioStreamController {
  private readonly events =
    new TypedEventEmitter<AudioStreamControllerEvents>();
  private streamHandle?: string;
  private dataListeners = 0;
  private dataSubscription?: Subscription;

  constructor(
    protected readonly radio: RadioSession,
    readonly id: string,
  ) {}

  get slice() {
    return this.current().slice;
  }

  get type() {
    return this.current().type;
  }

  get compression() {
    return this.current().compression;
  }

  get clientHandle() {
    return this.current().clientHandle;
  }

  get ip() {
    return this.current().ip;
  }

  get daxChannel() {
    return this.current().daxChannel;
  }

  get streamId() {
    return this.current().streamId;
  }

  get tx() {
    return this.current().tx;
  }

  private current(): AudioStreamSnapshot {
    const snapshot = this.radio.getStore().getAudioStream(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Audio stream ${this.id} is no longer available`,
      );
    }
    return snapshot;
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
    const snapshot = this.radio.getStore().getAudioStream(this.id);
    const streamId = snapshot?.streamId ?? this.streamHandle;
    if (!streamId) return;
    this.streamHandle = streamId;
    await this.radio.command(`stream remove ${streamId}`);
    const change = this.radio.getStore().removeAudioStream(this.id);
    if (change) this.radio.applyStateChange(change);
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

  protected requireNumericStreamId(): number {
    const handle = this.streamHandle ?? this.current().streamId;
    const numericId = parseStreamIdentifier(handle);
    if (numericId === undefined) {
      throw new FlexStateUnavailableError(
        `Audio stream ${this.id} has no valid stream ID`,
      );
    }
    return numericId;
  }

  private ensureDataPipeline(): void {
    if (this.dataSubscription) return;
    const streamNumericId = parseStreamIdentifier(this.id);
    if (!Number.isFinite(streamNumericId)) return;
    this.dataSubscription = this.radio.registerStreamHandler(
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

/** TX-capable audio stream (DAX TX, DAX Mic). */
export class AudioStreamTxControllerImpl
  extends AudioStreamControllerImpl
  implements AudioStreamTxController
{
  private txAudioPkt?: VitaDaxAudioPacket;
  private txReducedBwPkt?: VitaDaxReducedBwPacket;
  private txPacketCount = 0;

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
    this.radio.sendUdp(pkt.toBytes());
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
    this.radio.sendUdp(pkt.toBytes());
  }
}

/** Remote audio TX stream — supports PCM and Opus. */
export class RemoteAudioTxStreamControllerImpl
  extends AudioStreamTxControllerImpl
  implements RemoteAudioTxStreamController
{
  private opusPkt?: VitaOpusPacket;

  sendOpus(frame: Uint8Array): void {
    const numericId = this.requireNumericStreamId();
    if (!this.opusPkt) {
      this.opusPkt = new VitaOpusPacket();
      this.opusPkt.streamId = numericId;
    }
    const pkt = this.opusPkt;
    pkt.streamId = numericId;
    pkt.payload = frame;
    this.radio.sendUdp(pkt.toBytes());
  }
}

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
