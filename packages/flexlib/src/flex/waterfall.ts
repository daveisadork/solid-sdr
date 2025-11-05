import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type {
  WaterfallSnapshot,
  WaterfallStateChange,
} from "./radio-state.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import {
  FlexClientClosedError,
  FlexError,
  FlexStateUnavailableError,
} from "./errors.js";
import { parseRfGainInfo } from "./rf-gain.js";

export interface WaterfallControllerEvents extends Record<string, unknown> {
  readonly change: WaterfallStateChange;
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
  lineDurationMs?: number;
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
}

export interface WaterfallController {
  readonly id: string;
  readonly state: WaterfallSnapshot;
  readonly streamId: string;
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
  setCenterFrequency(frequencyMHz: number): Promise<WaterfallSnapshot>;
  setBandwidth(
    bandwidthMHz: number,
    options?: { autoCenter?: boolean },
  ): Promise<WaterfallSnapshot>;
  setMinDbm(value: number): Promise<WaterfallSnapshot>;
  setMaxDbm(value: number): Promise<WaterfallSnapshot>;
  setDbmRange(range: {
    low: number;
    high: number;
  }): Promise<WaterfallSnapshot>;
  setFps(value: number): Promise<WaterfallSnapshot>;
  setAverage(value: number): Promise<WaterfallSnapshot>;
  setWeightedAverage(enabled: boolean): Promise<WaterfallSnapshot>;
  setRxAntenna(port: string): Promise<WaterfallSnapshot>;
  setRfGain(value: number): Promise<WaterfallSnapshot>;
  setDaxIqChannel(channel: number): Promise<WaterfallSnapshot>;
  setLoopAEnabled(enabled: boolean): Promise<WaterfallSnapshot>;
  setLoopBEnabled(enabled: boolean): Promise<WaterfallSnapshot>;
  setBand(band: string): Promise<WaterfallSnapshot>;
  setLineDuration(ms: number): Promise<WaterfallSnapshot>;
  setBlackLevel(level: number): Promise<WaterfallSnapshot>;
  setColorGain(value: number): Promise<WaterfallSnapshot>;
  setAutoBlackLevelEnabled(enabled: boolean): Promise<WaterfallSnapshot>;
  setGradientIndex(index: number): Promise<WaterfallSnapshot>;
  refreshRfGainInfo(): Promise<WaterfallSnapshot>;
  update(request: WaterfallUpdateRequest): Promise<WaterfallSnapshot>;
  close(): Promise<void>;
}

export class WaterfallControllerImpl implements WaterfallController {
  private readonly events = new TypedEventEmitter<WaterfallControllerEvents>();
  private streamHandle?: string;

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
    return this.current().panadapterStream;
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

  get lineDurationMs(): number | undefined {
    return this.current().lineDurationMs;
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
    return this.events.on(event, listener);
  }

  async setCenterFrequency(
    frequencyMHz: number,
  ): Promise<WaterfallSnapshot> {
    await this.sendSet({ center: formatMegahertz(frequencyMHz) });
    return this.snapshot();
  }

  async setBandwidth(
    bandwidthMHz: number,
    options?: { autoCenter?: boolean },
  ): Promise<WaterfallSnapshot> {
    const extras: string[] = [];
    if (options?.autoCenter) extras.push("autocenter=1");
    await this.sendSet({ bandwidth: formatMegahertz(bandwidthMHz) }, extras);
    return this.snapshot();
  }

  async setMinDbm(value: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ min_dbm: formatDbm(value) });
    return this.snapshot();
  }

  async setMaxDbm(value: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ max_dbm: formatDbm(value) });
    return this.snapshot();
  }

  async setDbmRange(range: {
    low: number;
    high: number;
  }): Promise<WaterfallSnapshot> {
    await this.sendSet({
      min_dbm: formatDbm(range.low),
      max_dbm: formatDbm(range.high),
    });
    return this.snapshot();
  }

  async setFps(value: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ fps: this.toIntString(value) });
    return this.snapshot();
  }

  async setAverage(value: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ average: this.toIntString(value) });
    return this.snapshot();
  }

  async setWeightedAverage(enabled: boolean): Promise<WaterfallSnapshot> {
    await this.sendSet({ weighted_average: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setRxAntenna(port: string): Promise<WaterfallSnapshot> {
    await this.sendSet({ rxant: port });
    return this.snapshot();
  }

  async setRfGain(value: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ rfgain: this.toIntString(value) });
    return this.snapshot();
  }

  async setDaxIqChannel(channel: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ daxiq_channel: this.toIntString(channel) });
    return this.snapshot();
  }

  async setLoopAEnabled(enabled: boolean): Promise<WaterfallSnapshot> {
    await this.sendSet({ loopa: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setLoopBEnabled(enabled: boolean): Promise<WaterfallSnapshot> {
    await this.sendSet({ loopb: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setBand(band: string): Promise<WaterfallSnapshot> {
    await this.sendSet({ band });
    return this.snapshot();
  }

  async setLineDuration(ms: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ line_duration: this.toIntString(ms) });
    return this.snapshot();
  }

  async setBlackLevel(level: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ black_level: this.toIntString(level) });
    return this.snapshot();
  }

  async setColorGain(value: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ color_gain: this.toIntString(value) });
    return this.snapshot();
  }

  async setAutoBlackLevelEnabled(
    enabled: boolean,
  ): Promise<WaterfallSnapshot> {
    await this.sendSet({ auto_black: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setGradientIndex(index: number): Promise<WaterfallSnapshot> {
    await this.sendSet({ gradient_index: this.toIntString(index) });
    return this.snapshot();
  }

  async refreshRfGainInfo(): Promise<WaterfallSnapshot> {
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
    const attributes: Record<string, string> = {
      rf_gain_low: this.toIntString(info.low),
      rf_gain_high: this.toIntString(info.high),
      rf_gain_step: this.toIntString(info.step),
      rf_gain_markers:
        info.markers.length > 0 ? info.markers.join(",") : "",
    };
    this.session.patchWaterfall(this.id, attributes);
    return this.snapshot();
  }

  async update(request: WaterfallUpdateRequest): Promise<WaterfallSnapshot> {
    const entries = this.buildSetEntries(request);
    if (Object.keys(entries).length > 0) {
      await this.sendSet(entries);
    }
    return this.snapshot();
  }

  async close(): Promise<void> {
    const stream = this.requireStreamHandle();
    await this.session.command(`display panafall remove ${stream}`);
  }

  onStateChange(change: WaterfallStateChange): void {
    if (change.snapshot?.streamId) {
      this.streamHandle = change.snapshot.streamId;
    }
    this.events.emit("change", change);
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
    if (request.fps !== undefined) entries.fps = this.toIntString(request.fps);
    if (request.average !== undefined)
      entries.average = this.toIntString(request.average);
    if (request.weightedAverage !== undefined)
      entries.weighted_average = this.toFlag(request.weightedAverage);
    if (request.rxAntenna !== undefined) entries.rxant = request.rxAntenna;
    if (request.rfGain !== undefined)
      entries.rfgain = this.toIntString(request.rfGain);
    if (request.daxIqChannel !== undefined)
      entries.daxiq_channel = this.toIntString(request.daxIqChannel);
    if (request.loopAEnabled !== undefined)
      entries.loopa = this.toFlag(request.loopAEnabled);
    if (request.loopBEnabled !== undefined)
      entries.loopb = this.toFlag(request.loopBEnabled);
    if (request.band !== undefined) entries.band = request.band;
    if (request.lineDurationMs !== undefined)
      entries.line_duration = this.toIntString(request.lineDurationMs);
    if (request.blackLevel !== undefined)
      entries.black_level = this.toIntString(request.blackLevel);
    if (request.colorGain !== undefined)
      entries.color_gain = this.toIntString(request.colorGain);
    if (request.autoBlackLevelEnabled !== undefined)
      entries.auto_black = this.toFlag(request.autoBlackLevelEnabled);
    if (request.gradientIndex !== undefined)
      entries.gradient_index = this.toIntString(request.gradientIndex);
    return entries;
  }

  private async sendSet(
    entries: Record<string, string>,
    extras: readonly string[] = [],
  ): Promise<void> {
    const stream = this.requireStreamHandle();
    const parts = Object.entries(entries).map(
      ([key, value]) => `${key}=${value}`,
    );
    const command = `display panafall set ${stream} ${parts.join(" ")}${extras.length ? " " + extras.join(" ") : ""}`;
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

  private toFlag(value: boolean): string {
    return value ? "1" : "0";
  }

  private toIntString(value: number): string {
    return Math.round(value).toString(10);
  }
}

function formatMegahertz(frequencyMHz: number): string {
  return frequencyMHz.toFixed(6);
}

function formatDbm(value: number): string {
  return value.toFixed(6);
}
