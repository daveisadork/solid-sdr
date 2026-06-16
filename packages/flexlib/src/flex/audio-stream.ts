import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { clampInteger } from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  AudioStreamSnapshot,
  AudioStreamStateChange,
} from "./state/index.js";
import type { RadioSession } from "./radio-core.js";
import type { VitaPacket } from "../vita/parser.js";
import {
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
} from "../vita/dax-audio-packet.js";
import { VitaOpusPacket } from "../vita/opus-packet.js";

export type AudioStreamDataEvent = VitaPacket;

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

/** DAX TX stream controller with explicit TX ownership requests. */
export interface DaxTxAudioStreamController extends AudioStreamTxController {
  /**
   * Request or yield DAX TX ownership from the radio.
   *
   * In MultiFLEX scenarios, this asks the radio to grant this client
   * transmit ownership or to yield it back to another client.
   */
  requestTx(tx: boolean): Promise<void>;
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

/** DAX RX stream controller with per-channel RX gain. */
export interface DaxRxAudioStreamController extends AudioStreamController {
  /**
   * Set the RX gain (0..100) for this DAX RX channel.
   *
   * Requires the stream to be bound to a slice. Throws
   * {@link FlexStateUnavailableError} if no slice is currently bound.
   */
  setRxGain(gain: number): Promise<void>;
}

/** DAX IQ stream controller with sample-rate selection. */
export interface DaxIqAudioStreamController extends AudioStreamController {
  /**
   * Set the IQ sample rate. `rate` must be one of the model's supported
   * rates (see RadioSession.modelInfo.daxIqSampleRates). Throws RangeError
   * if not. Models with no published rate list (unknown model) skip the
   * client-side check and let the radio validate.
   */
  setSampleRate(rate: number): Promise<void>;
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

  get radioAck() {
    return this.current().radioAck;
  }

  get daxChannel() {
    return this.current().daxChannel;
  }

  get daxIqChannel() {
    return this.current().daxIqChannel;
  }

  get daxIqRate() {
    return this.current().daxIqRate;
  }

  get active() {
    return this.current().active;
  }

  get pan() {
    return this.current().pan;
  }

  get endpointType() {
    return this.current().endpointType;
  }

  get clientGuiHandle() {
    return this.current().clientGuiHandle;
  }

  get payloadEndian() {
    return this.current().payloadEndian;
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
    await this.radio.command(`stream remove ${this.id}`);
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

/** DAX TX audio stream with explicit TX ownership requests. */
export class DaxTxAudioStreamControllerImpl
  extends AudioStreamTxControllerImpl
  implements DaxTxAudioStreamController
{
  async requestTx(tx: boolean): Promise<void> {
    await this.radio.command(`stream set ${this.id} tx=${tx ? 1 : 0}`);
  }
}

/** DAX RX audio stream with per-channel RX gain. */
export class DaxRxAudioStreamControllerImpl
  extends AudioStreamControllerImpl
  implements DaxRxAudioStreamController
{
  async setRxGain(gain: number): Promise<void> {
    const sliceLetter = this.slice;
    if (sliceLetter === undefined) {
      throw new FlexStateUnavailableError(
        `DAX RX stream ${this.id} has no slice bound; cannot set gain`,
      );
    }
    const slice = this.radio
      .getStore()
      .getSlices()
      .find((s) => s.indexLetter === sliceLetter);
    if (!slice) {
      throw new FlexStateUnavailableError(
        `DAX RX stream ${this.id} bound to slice ${sliceLetter} but slice is not in store`,
      );
    }
    const clamped = clampInteger(gain, 0, 100, "DAX RX gain");
    await this.radio.command(
      `audio stream ${this.id} slice ${slice.id} gain ${clamped}`,
    );
  }
}

/** DAX IQ audio stream with sample-rate control. */
export class DaxIqAudioStreamControllerImpl
  extends AudioStreamControllerImpl
  implements DaxIqAudioStreamController
{
  async setSampleRate(rate: number): Promise<void> {
    const allowed = this.radio.modelInfo.daxIqSampleRates;
    if (allowed.length > 0 && !allowed.includes(rate)) {
      throw new RangeError(
        `DAX IQ sample rate ${rate} not supported on ${this.radio.modelInfo.modelName}. Allowed: ${allowed.join(", ")}`,
      );
    }
    await this.radio.command(`stream set ${this.id} daxiq_rate=${rate}`);
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
