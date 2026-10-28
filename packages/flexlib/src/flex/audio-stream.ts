import { type Subscription, TypedEventEmitter } from "../util/events.js";
import {
  daxAudioClassForRate,
  daxAudioSampleRateFromClass,
  daxReducedBwClassForRate,
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
} from "../vita/dax-audio-packet.js";
import { VitaOpusPacket } from "../vita/opus-packet.js";
import type { VitaPacket } from "../vita/parser.js";
import { parseClientHandle } from "./client-handle.js";
import { clampInteger } from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type {
  AudioStreamSnapshot,
  AudioStreamStateChange,
} from "./state/index.js";

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
   * Only a stream this client owns sends the gain; for any other stream the
   * call does nothing. While the stream has no bound slice, the gain is held
   * and sent once a slice is bound. Only the most recent held gain is kept.
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
  protected numericStreamId = 0;
  protected ownedByThisClient = false;
  private lastRxClassCode?: number;
  private dataListeners = 0;
  private dataSubscription?: Subscription;

  constructor(
    protected readonly radio: RadioSession,
    readonly id: string,
  ) {
    const numericId = parseStreamIdentifier(id);
    if (numericId === undefined) {
      throw new FlexStateUnavailableError(
        `Audio stream ${id} has no valid stream ID`,
      );
    }

    this.numericStreamId = numericId;

    const own = radio.clientHandle;
    const ownHandle = own ? parseClientHandle(own) : undefined;
    this.ownedByThisClient =
      ownHandle !== undefined && this.clientHandle === ownHandle;
  }

  get slice(): AudioStreamSnapshot["slice"] {
    return this.current().slice;
  }

  get type(): AudioStreamSnapshot["type"] {
    return this.current().type;
  }

  get compression(): AudioStreamSnapshot["compression"] {
    return this.current().compression;
  }

  get clientHandle(): AudioStreamSnapshot["clientHandle"] {
    return this.current().clientHandle;
  }

  get ip(): AudioStreamSnapshot["ip"] {
    return this.current().ip;
  }

  get radioAck(): AudioStreamSnapshot["radioAck"] {
    return this.current().radioAck;
  }

  get daxChannel(): AudioStreamSnapshot["daxChannel"] {
    return this.current().daxChannel;
  }

  get daxIqChannel(): AudioStreamSnapshot["daxIqChannel"] {
    return this.current().daxIqChannel;
  }

  get daxIqRate(): AudioStreamSnapshot["daxIqRate"] {
    return this.current().daxIqRate;
  }

  get active(): AudioStreamSnapshot["active"] {
    return this.current().active;
  }

  get pan(): AudioStreamSnapshot["pan"] {
    return this.current().pan;
  }

  get endpointType(): AudioStreamSnapshot["endpointType"] {
    return this.current().endpointType;
  }

  get clientGuiHandle(): AudioStreamSnapshot["clientGuiHandle"] {
    return this.current().clientGuiHandle;
  }

  get payloadEndian(): AudioStreamSnapshot["payloadEndian"] {
    return this.current().payloadEndian;
  }

  get streamId(): AudioStreamSnapshot["streamId"] {
    return this.current().streamId;
  }

  get tx(): AudioStreamSnapshot["tx"] {
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

  get sampleRateHz(): AudioStreamSnapshot["sampleRateHz"] {
    return this.current().sampleRateHz;
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
    this.dataSubscription = this.radio.registerStreamHandler(
      this.numericStreamId,
      (packet) => {
        if (
          (packet.kind === "daxAudio" || packet.kind === "daxReducedBw") &&
          packet.classId.packetClassCode !== this.lastRxClassCode
        ) {
          this.lastRxClassCode = packet.classId.packetClassCode;
          this.onRxClassChange(this.lastRxClassCode);
        }
        this.events.emit("data", packet);
      },
    );
  }

  // DAX mic has no slice to follow, so its rate comes from the packets.
  private onRxClassChange(classCode: number): void {
    if (this.current().type !== "dax_mic") return;
    const rate = daxAudioSampleRateFromClass(classCode);
    if (rate === undefined) return;
    const change = this.radio
      .getStore()
      .setAudioStreamSampleRate(this.id, rate);
    if (change) this.radio.applyStateChange(change);
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
  private audioClassCode?: number;
  private reducedBwClassCode?: number;

  /** Packets are dropped while the rate has no class code. */
  protected updateClassCodes(rateHz: number): void {
    this.audioClassCode = daxAudioClassForRate(rateHz);
    this.reducedBwClassCode = daxReducedBwClassForRate(rateHz);
  }

  sendAudio(left: Float32Array, right: Float32Array): void {
    const classCode = this.audioClassCode;
    if (classCode === undefined) return;
    if (!this.txAudioPkt) {
      this.txAudioPkt = new VitaDaxAudioPacket();
      this.txAudioPkt.streamId = this.numericStreamId;
      this.txAudioPkt.left = new Float32Array(DAX_PACKET_SAMPLES);
      this.txAudioPkt.right = new Float32Array(DAX_PACKET_SAMPLES);
    }
    const pkt = this.txAudioPkt;
    pkt.classId.packetClassCode = classCode;
    pkt.header.packetCount = this.txPacketCount;
    const frames = Math.min(left.length, right.length, DAX_PACKET_SAMPLES);
    pkt.left.set(left.subarray(0, frames));
    pkt.right.set(right.subarray(0, frames));
    this.txPacketCount = (this.txPacketCount + 1) & 0xf;
    this.radio.sendUdp(pkt.toBytes());
  }

  sendReducedBwAudio(samples: Int16Array): void {
    const classCode = this.reducedBwClassCode;
    if (classCode === undefined) return;
    if (!this.txReducedBwPkt) {
      this.txReducedBwPkt = new VitaDaxReducedBwPacket();
      this.txReducedBwPkt.streamId = this.numericStreamId;
      this.txReducedBwPkt.samples = new Int16Array(DAX_PACKET_SAMPLES);
    }
    const pkt = this.txReducedBwPkt;
    pkt.classId.packetClassCode = classCode;
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
  constructor(
    protected readonly radio: RadioSession,
    readonly id: string,
  ) {
    super(radio, id);
    this.updateClassCodes(
      radio.getStore().getAudioStream(id)?.sampleRateHz ?? 0,
    );
  }

  override onStateChange(change: AudioStreamStateChange): void {
    super.onStateChange(change);
    const rate = change.diff?.sampleRateHz;
    if (rate !== undefined) this.updateClassCodes(rate);
  }

  async requestTx(tx: boolean): Promise<void> {
    await this.radio.command(`stream set ${this.id} tx=${tx ? 1 : 0}`);
  }
}

/** DAX RX audio stream with per-channel RX gain. */
export class DaxRxAudioStreamControllerImpl
  extends AudioStreamControllerImpl
  implements DaxRxAudioStreamController
{
  private pendingGain?: number;
  private sliceId?: string;

  constructor(radio: RadioSession, id: string) {
    super(radio, id);
    this.updateSliceId();
  }

  async setRxGain(gain: number): Promise<void> {
    const clamped = clampInteger(gain, 0, 100, "DAX RX gain");
    const change = this.radio
      .getStore()
      .patchAudioStream(this.id, { gain: clamped.toString() });
    if (change) {
      this.radio.applyStateChange(change);
      await this.sendGain(clamped);
    }
  }

  private updateSliceId() {
    const indexLetter = this.slice;
    const store = this.radio.getStore();
    const boundClientId = store.getBoundClientId();
    const clientHandle =
      store.getGuiClients().find((client) => client.clientId === boundClientId)
        ?.clientHandleInt ?? this.clientHandle;
    const slice = store
      .getSlices()
      .find(
        (s) => s.indexLetter === indexLetter && s.clientHandle === clientHandle,
      );
    this.sliceId = slice?.id;
  }

  override onStateChange(change: AudioStreamStateChange): void {
    super.onStateChange(change);
    if (change.diff?.slice !== undefined) this.updateSliceId();
    if (change.removed || this.pendingGain === undefined) return;
    this.sendGain(this.pendingGain).catch(() => {
      // The caller already returned; a refused or unsendable gain is dropped.
    });
  }

  private async sendGain(gain: number): Promise<void> {
    if (!this.slice || !this.ownedByThisClient) {
      this.pendingGain = gain;
      return;
    }
    const sliceId = this.sliceId;
    if (!sliceId) {
      throw new FlexStateUnavailableError(
        `DAX RX stream ${this.id} bound to slice ${this.slice} but slice is not in store`,
      );
    }
    this.pendingGain = undefined;
    await this.radio.command(
      `audio stream ${this.id} slice ${sliceId} gain ${gain}`,
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

  constructor(radio: RadioSession, id: string) {
    super(radio, id);
    // Remote audio does not follow a slice. Uncompressed remote RX arrives
    // as 24 kHz float stereo, and there is no command to change its rate.
    this.updateClassCodes(24000);
  }

  sendOpus(frame: Uint8Array): void {
    if (!this.opusPkt) {
      this.opusPkt = new VitaOpusPacket();
      this.opusPkt.streamId = this.numericStreamId;
    }
    const pkt = this.opusPkt;
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
