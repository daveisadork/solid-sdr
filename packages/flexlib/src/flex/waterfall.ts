import { type Subscription, TypedEventEmitter } from "../util/events.js";
import type { VitaWaterfallPacket } from "../vita/waterfall-packet.js";
import {
  buildDisplaySetCommand,
  formatBooleanFlag,
  formatInteger,
} from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession, StreamPacketHandler } from "./radio-core.js";
import type { WaterfallSnapshot, WaterfallStateChange } from "./state/index.js";
import {
  clampLineSpeed,
  lineSpeedToDurationMs,
} from "./waterfall-line-speed.js";

export interface WaterfallControllerEvents {
  readonly change: WaterfallStateChange;
  readonly data: VitaWaterfallPacket;
}

export interface WaterfallUpdateRequest {
  lineSpeed?: number;
  blackLevel?: number;
  colorGain?: number;
  autoBlackLevelEnabled?: boolean;
  gradientIndex?: number;
}

export interface WaterfallController
  extends Readonly<Omit<WaterfallSnapshot, "raw">> {
  snapshot(): WaterfallSnapshot;
  on<TKey extends keyof WaterfallControllerEvents>(
    event: TKey,
    listener: (payload: WaterfallControllerEvents[TKey]) => void,
  ): Subscription;
  setLineSpeed(value: number): Promise<void>;
  setBlackLevel(level: number): Promise<void>;
  setColorGain(value: number): Promise<void>;
  setAutoBlackLevelEnabled(enabled: boolean): Promise<void>;
  setGradientIndex(index: number): Promise<void>;
  update(request: WaterfallUpdateRequest): Promise<void>;
  close(): Promise<void>;
}

export class WaterfallControllerImpl implements WaterfallController {
  private readonly events = new TypedEventEmitter<WaterfallControllerEvents>();
  private dataListeners = 0;
  private dataSubscription?: Subscription;

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  private current(): WaterfallSnapshot {
    const snapshot = this.radio.getStore().getWaterfall(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Waterfall ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  get streamId(): string {
    return this.current().streamId;
  }

  get panadapterStreamId(): string {
    return this.current().panadapterStreamId;
  }

  get width(): number {
    return this.current().width;
  }

  get height(): number {
    return this.current().height;
  }

  get lineSpeed(): number | undefined {
    return this.current().lineSpeed;
  }

  get lineDurationMs(): number | undefined {
    const speed = this.current().lineSpeed;
    if (speed === undefined) return undefined;
    return lineSpeedToDurationMs(speed);
  }

  get blackLevel(): number {
    return this.current().blackLevel;
  }

  get colorGain(): number {
    return this.current().colorGain;
  }

  get autoBlackLevelEnabled(): boolean {
    return this.current().autoBlackLevelEnabled;
  }

  get gradientIndex(): number {
    return this.current().gradientIndex;
  }

  get clientHandle(): number {
    return this.current().clientHandle;
  }

  get centerFrequencyMHz() {
    return this.current().centerFrequencyMHz;
  }

  get bandwidthMHz() {
    return this.current().bandwidthMHz;
  }

  get lowDbm() {
    return this.current().lowDbm;
  }

  get highDbm() {
    return this.current().highDbm;
  }

  get fps() {
    return this.current().fps;
  }

  get average() {
    return this.current().average;
  }

  get weightedAverage() {
    return this.current().weightedAverage;
  }

  get rxAntenna() {
    return this.current().rxAntenna;
  }

  get rfGain() {
    return this.current().rfGain;
  }

  get rfGainLow() {
    return this.current().rfGainLow;
  }

  get rfGainHigh() {
    return this.current().rfGainHigh;
  }

  get rfGainStep() {
    return this.current().rfGainStep;
  }

  get rfGainMarkers() {
    return this.current().rfGainMarkers;
  }

  get daxIqChannel() {
    return this.current().daxIqChannel;
  }

  get isBandZoomOn() {
    return this.current().isBandZoomOn;
  }

  get isSegmentZoomOn() {
    return this.current().isSegmentZoomOn;
  }

  get loopAEnabled() {
    return this.current().loopAEnabled;
  }

  get loopBEnabled() {
    return this.current().loopBEnabled;
  }

  get wideEnabled() {
    return this.current().wideEnabled;
  }

  get band() {
    return this.current().band;
  }

  get xvtr() {
    return this.current().xvtr;
  }

  snapshot(): WaterfallSnapshot {
    return this.current();
  }

  on<TKey extends keyof WaterfallControllerEvents>(
    event: TKey,
    listener: (payload: WaterfallControllerEvents[TKey]) => void,
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

  async setLineSpeed(value: number): Promise<void> {
    await this.sendSet({ line_duration: formatInteger(clampLineSpeed(value)) });
  }

  async setBlackLevel(level: number): Promise<void> {
    await this.sendSet({ black_level: formatInteger(level) });
  }

  async setColorGain(value: number): Promise<void> {
    await this.sendSet({ color_gain: formatInteger(value) });
  }

  async setAutoBlackLevelEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ auto_black: formatBooleanFlag(enabled) });
  }

  async setGradientIndex(index: number): Promise<void> {
    await this.sendSet({ gradient_index: formatInteger(index) });
  }

  async update(request: WaterfallUpdateRequest): Promise<void> {
    const entries = this.buildSetEntries(request);
    if (Object.keys(entries).length > 0) {
      await this.sendSet(entries);
    }
  }

  async close(): Promise<void> {
    this.teardownDataPipeline();
    await this.radio.command(`display panafall remove ${this.id}`);
    const changes = this.radio.getStore().removeWaterfall(this.id);
    if (changes) {
      for (const change of changes) this.radio.applyStateChange(change);
    }
  }

  onStateChange(change: WaterfallStateChange): void {
    this.events.emit("change", change);
    if (change.removed) {
      this.teardownDataPipeline();
    }
  }

  private buildSetEntries(
    request: WaterfallUpdateRequest,
  ): Record<string, string> {
    const entries = Object.create(null) as Record<string, string>;
    if (request.lineSpeed !== undefined)
      entries.line_duration = formatInteger(clampLineSpeed(request.lineSpeed));
    if (request.blackLevel !== undefined)
      entries.black_level = formatInteger(request.blackLevel);
    if (request.colorGain !== undefined)
      entries.color_gain = formatInteger(request.colorGain);
    if (request.autoBlackLevelEnabled !== undefined)
      entries.auto_black = formatBooleanFlag(request.autoBlackLevelEnabled);
    if (request.gradientIndex !== undefined)
      entries.gradient_index = formatInteger(request.gradientIndex);
    return entries;
  }

  private async sendSet(
    entries: Record<string, string>,
    extras: readonly string[] = [],
  ): Promise<void> {
    const command = buildDisplaySetCommand(
      "display panafall set",
      this.id,
      entries,
      extras,
    );
    const change = this.radio
      .getStore()
      .patchWaterfall(this.id, { stream_id: this.id, ...entries });
    if (change) this.radio.applyStateChange(change);
    await this.radio.command(command);
  }

  private readonly handleStreamPacket: StreamPacketHandler = (packet) => {
    this.events.emit(
      "data",
      packet as unknown as WaterfallControllerEvents["data"],
    );
  };

  private ensureDataPipeline(): void {
    if (this.dataSubscription) return;
    const streamNumericId = Number.parseInt(this.streamId, 16);
    if (!Number.isFinite(streamNumericId)) return;
    this.dataSubscription = this.radio.registerStreamHandler(
      streamNumericId,
      this.handleStreamPacket,
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
