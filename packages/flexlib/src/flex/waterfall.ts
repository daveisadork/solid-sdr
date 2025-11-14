import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type { WaterfallSnapshot, WaterfallStateChange } from "./radio-state.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import {
  FlexClientClosedError,
  FlexError,
  FlexStateUnavailableError,
} from "./errors.js";
import { parseRfGainInfo } from "./rf-gain.js";
import type { RfGainInfo } from "./rf-gain.js";
import {
  buildDisplaySetCommand,
  formatBooleanFlag,
  formatDbm,
  formatInteger,
  formatMegahertz,
} from "./controller-helpers.js";
import {
  clampLineSpeed,
  lineSpeedToDurationMs,
} from "./waterfall-line-speed.js";
import type {
  FlexUdpPacketEvent,
  FlexUdpScope,
  FlexUdpSession,
} from "./udp.js";

export interface WaterfallControllerEvents extends Record<string, unknown> {
  readonly change: WaterfallStateChange;
  readonly data: FlexUdpPacketEvent<"waterfall">;
}

export interface WaterfallUpdateRequest {
  centerFrequencyMHz?: number;
  bandwidthMHz?: number;
  lowDbm?: number;
  highDbm?: number;
  fps?: number;
  average?: number;
  weightedAverage?: boolean;
  rxAntenna?: string;
  rfGain?: number;
  daxIqChannel?: number;
  loopAEnabled?: boolean;
  loopBEnabled?: boolean;
  band?: string;
  lineSpeed?: number;
  blackLevel?: number;
  colorGain?: number;
  autoBlackLevelEnabled?: boolean;
  gradientIndex?: number;
}

export interface WaterfallSessionApi {
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  getWaterfall(id: string): WaterfallSnapshot | undefined;
  patchWaterfall(id: string, attributes: Record<string, string>): void;
  applyWaterfallRfGainInfo(id: string, info: RfGainInfo): void;
  readonly udp: FlexUdpSession;
}

export interface WaterfallController {
  readonly id: string;
  readonly state: WaterfallSnapshot;
  readonly streamId: string;
  readonly panadapterStreamId: string;
  /** @deprecated Use panadapterStreamId instead. */
  readonly panadapterStream: string;
  readonly centerFrequencyMHz: number;
  readonly bandwidthMHz: number;
  readonly lowDbm: number;
  readonly highDbm: number;
  readonly fps: number;
  readonly average: number;
  readonly weightedAverage: boolean;
  readonly rxAntenna: string;
  readonly rfGain: number;
  readonly rfGainLow: number;
  readonly rfGainHigh: number;
  readonly rfGainStep: number;
  readonly rfGainMarkers: readonly number[];
  readonly daxIqChannel: number;
  readonly loopAEnabled: boolean;
  readonly loopBEnabled: boolean;
  readonly wideEnabled: boolean;
  readonly band: string;
  readonly width: number;
  readonly height: number;
  /** Raw 0-100 line speed as reported by the radio. */
  readonly lineSpeed: number | undefined;
  /** Derived line duration in milliseconds computed from lineSpeed. */
  readonly lineDurationMs: number | undefined;
  readonly blackLevel: number;
  readonly colorGain: number;
  readonly autoBlackLevelEnabled: boolean;
  readonly gradientIndex: number;
  readonly clientHandle: number;
  snapshot(): WaterfallSnapshot;
  on<TKey extends keyof WaterfallControllerEvents>(
    event: TKey,
    listener: (payload: WaterfallControllerEvents[TKey]) => void,
  ): Subscription;
  setCenterFrequency(frequencyMHz: number): Promise<void>;
  setBandwidth(
    bandwidthMHz: number,
    options?: { autoCenter?: boolean },
  ): Promise<void>;
  setMinDbm(value: number): Promise<void>;
  setMaxDbm(value: number): Promise<void>;
  setDbmRange(range: { low: number; high: number }): Promise<void>;
  setFps(value: number): Promise<void>;
  setAverage(value: number): Promise<void>;
  setWeightedAverage(enabled: boolean): Promise<void>;
  setRxAntenna(port: string): Promise<void>;
  setRfGain(value: number): Promise<void>;
  setDaxIqChannel(channel: number): Promise<void>;
  setLoopAEnabled(enabled: boolean): Promise<void>;
  setLoopBEnabled(enabled: boolean): Promise<void>;
  setBand(band: string): Promise<void>;
  setLineSpeed(value: number): Promise<void>;
  setBlackLevel(level: number): Promise<void>;
  setColorGain(value: number): Promise<void>;
  setAutoBlackLevelEnabled(enabled: boolean): Promise<void>;
  setGradientIndex(index: number): Promise<void>;
  refreshRfGainInfo(): Promise<void>;
  update(request: WaterfallUpdateRequest): Promise<void>;
  close(): Promise<void>;
}

export class WaterfallControllerImpl implements WaterfallController {
  private readonly events = new TypedEventEmitter<WaterfallControllerEvents>();
  private streamHandle?: string;
  private dataListeners = 0;
  private dataScope?: FlexUdpScope<"waterfall">;
  private dataSubscription?: Subscription;

  constructor(
    private readonly session: WaterfallSessionApi,
    readonly id: string,
    streamHandle?: string,
  ) {
    this.streamHandle = streamHandle;
  }

  private current(): WaterfallSnapshot {
    const snapshot = this.session.getWaterfall(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Waterfall ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  get state(): WaterfallSnapshot {
    return this.current();
  }

  get streamId(): string {
    return this.current().streamId;
  }

  get panadapterStream(): string {
    return this.current().panadapterStreamId;
  }

  get panadapterStreamId(): string {
    return this.current().panadapterStreamId;
  }

  get centerFrequencyMHz(): number {
    return this.current().centerFrequencyMHz;
  }

  get bandwidthMHz(): number {
    return this.current().bandwidthMHz;
  }

  get lowDbm(): number {
    return this.current().lowDbm;
  }

  get highDbm(): number {
    return this.current().highDbm;
  }

  get fps(): number {
    return this.current().fps;
  }

  get average(): number {
    return this.current().average;
  }

  get weightedAverage(): boolean {
    return this.current().weightedAverage;
  }

  get rxAntenna(): string {
    return this.current().rxAntenna;
  }

  get rfGain(): number {
    return this.current().rfGain;
  }

  get rfGainLow(): number {
    return this.current().rfGainLow;
  }

  get rfGainHigh(): number {
    return this.current().rfGainHigh;
  }

  get rfGainStep(): number {
    return this.current().rfGainStep;
  }

  get rfGainMarkers(): readonly number[] {
    return this.current().rfGainMarkers;
  }

  get daxIqChannel(): number {
    return this.current().daxIqChannel;
  }

  get loopAEnabled(): boolean {
    return this.current().loopAEnabled;
  }

  get loopBEnabled(): boolean {
    return this.current().loopBEnabled;
  }

  get wideEnabled(): boolean {
    return this.current().wideEnabled;
  }

  get band(): string {
    return this.current().band;
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

  async setCenterFrequency(frequencyMHz: number): Promise<void> {
    await this.sendSet({ center: formatMegahertz(frequencyMHz) });
  }

  async setBandwidth(
    bandwidthMHz: number,
    options?: { autoCenter?: boolean },
  ): Promise<void> {
    const extras: string[] = [];
    if (options?.autoCenter) extras.push("autocenter=1");
    await this.sendSet({ bandwidth: formatMegahertz(bandwidthMHz) }, extras);
  }

  async setMinDbm(value: number): Promise<void> {
    await this.sendSet({ min_dbm: formatDbm(value) });
  }

  async setMaxDbm(value: number): Promise<void> {
    await this.sendSet({ max_dbm: formatDbm(value) });
  }

  async setDbmRange(range: { low: number; high: number }): Promise<void> {
    await this.sendSet({
      min_dbm: formatDbm(range.low),
      max_dbm: formatDbm(range.high),
    });
  }

  async setFps(value: number): Promise<void> {
    await this.sendSet({ fps: formatInteger(value) });
  }

  async setAverage(value: number): Promise<void> {
    await this.sendSet({ average: formatInteger(value) });
  }

  async setWeightedAverage(enabled: boolean): Promise<void> {
    await this.sendSet({ weighted_average: formatBooleanFlag(enabled) });
  }

  async setRxAntenna(port: string): Promise<void> {
    await this.sendSet({ rxant: port });
  }

  async setRfGain(value: number): Promise<void> {
    await this.sendSet({ rfgain: formatInteger(value) });
  }

  async setDaxIqChannel(channel: number): Promise<void> {
    await this.sendSet({ daxiq_channel: formatInteger(channel) });
  }

  async setLoopAEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ loopa: formatBooleanFlag(enabled) });
  }

  async setLoopBEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ loopb: formatBooleanFlag(enabled) });
  }

  async setBand(band: string): Promise<void> {
    await this.sendSet({ band });
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

  async refreshRfGainInfo(): Promise<void> {
    const stream = this.requireStreamHandle();
    const response = await this.session.command(
      `display panafall rfgain_info ${stream}`,
    );
    if (!response.message) {
      throw new FlexError("Flex radio returned no RF gain info");
    }
    const info = parseRfGainInfo(response.message);
    if (!info) {
      throw new FlexError(
        `Unable to parse RF gain info reply: ${response.message}`,
      );
    }
    this.session.applyWaterfallRfGainInfo(this.id, info);
  }

  async update(request: WaterfallUpdateRequest): Promise<void> {
    const entries = this.buildSetEntries(request);
    if (Object.keys(entries).length > 0) {
      await this.sendSet(entries);
    }
  }

  async close(): Promise<void> {
    this.teardownDataPipeline();
    const stream = this.requireStreamHandle();
    await this.session.command(`display panafall remove ${stream}`);
  }

  onStateChange(change: WaterfallStateChange): void {
    if (change.diff?.streamId) {
      this.streamHandle = change.diff.streamId;
    }
    this.events.emit("change", change);
    if (change.removed) {
      this.teardownDataPipeline();
    }
  }

  private buildSetEntries(
    request: WaterfallUpdateRequest,
  ): Record<string, string> {
    const entries = Object.create(null) as Record<string, string>;
    if (request.centerFrequencyMHz !== undefined)
      entries.center = formatMegahertz(request.centerFrequencyMHz);
    if (request.bandwidthMHz !== undefined)
      entries.bandwidth = formatMegahertz(request.bandwidthMHz);
    if (request.lowDbm !== undefined)
      entries.min_dbm = formatDbm(request.lowDbm);
    if (request.highDbm !== undefined)
      entries.max_dbm = formatDbm(request.highDbm);
    if (request.fps !== undefined) entries.fps = formatInteger(request.fps);
    if (request.average !== undefined)
      entries.average = formatInteger(request.average);
    if (request.weightedAverage !== undefined)
      entries.weighted_average = formatBooleanFlag(request.weightedAverage);
    if (request.rxAntenna !== undefined) entries.rxant = request.rxAntenna;
    if (request.rfGain !== undefined)
      entries.rfgain = formatInteger(request.rfGain);
    if (request.daxIqChannel !== undefined)
      entries.daxiq_channel = formatInteger(request.daxIqChannel);
    if (request.loopAEnabled !== undefined)
      entries.loopa = formatBooleanFlag(request.loopAEnabled);
    if (request.loopBEnabled !== undefined)
      entries.loopb = formatBooleanFlag(request.loopBEnabled);
    if (request.band !== undefined) entries.band = request.band;
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
    const stream = this.requireStreamHandle();
    const command = buildDisplaySetCommand(
      "display panafall set",
      stream,
      entries,
      extras,
    );
    await this.session.command(command);
    this.session.patchWaterfall(this.id, { stream_id: stream, ...entries });
  }

  private requireStreamHandle(): string {
    const snapshot = this.session.getWaterfall(this.id);
    if (snapshot?.streamId) {
      this.streamHandle = snapshot.streamId;
    }
    if (!this.streamHandle) {
      throw new FlexClientClosedError();
    }
    return this.streamHandle;
  }

  private ensureDataPipeline(): void {
    if (this.dataSubscription) return;
    const streamNumericId = Number.parseInt(this.streamId, 16);
    if (!Number.isFinite(streamNumericId)) return;
    this.dataScope = this.session.udp.scope(
      "waterfall",
      (event) => event.metadata.streamId === streamNumericId,
    );
    this.dataSubscription = this.dataScope.on((event) => {
      this.events.emit("data", event);
    });
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
    this.dataScope?.removeAll();
    this.dataScope = undefined;
  }
}
