import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type {
  PanadapterSnapshot,
  PanadapterStateChange,
} from "./radio-state.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import {
  FlexClientClosedError,
  FlexError,
  FlexStateUnavailableError,
} from "./errors.js";
import { parseRfGainInfo } from "./rf-gain.js";

export interface PanadapterControllerEvents extends Record<string, unknown> {
  readonly change: PanadapterStateChange;
}

export interface PanadapterUpdateRequest {
  centerFrequencyHz?: number;
  bandwidthHz?: number;
  autoCenterEnabled?: boolean;
  lowDbm?: number;
  highDbm?: number;
  fps?: number;
  average?: number;
  weightedAverage?: boolean;
  isBandZoomOn?: boolean;
  isSegmentZoomOn?: boolean;
  /**
   * Enables or disables the Wideband Noise Blanker (WNB) for the panadapter.
   */
  wnbEnabled?: boolean;
  /**
   * Wideband Noise Blanker (WNB) level from 0 to 100.
   */
  wnbLevel?: number;
  rxAntenna?: string;
  rfGain?: number;
  daxIqChannel?: number;
  loopAEnabled?: boolean;
  loopBEnabled?: boolean;
  band?: string;
  loggerDisplayEnabled?: boolean;
  loggerDisplayAddress?: string;
  loggerDisplayPort?: number;
  loggerDisplayRadioNum?: number;
}

export interface PanadapterSessionApi {
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  getPanadapter(id: string): PanadapterSnapshot | undefined;
  patchPanadapter(id: string, attributes: Record<string, string>): void;
}

export interface PanadapterController {
  readonly id: string;
  readonly state: PanadapterSnapshot;
  readonly streamId: string;
  readonly centerFrequencyHz: number;
  readonly bandwidthHz: number;
  readonly autoCenterEnabled: boolean;
  readonly minBandwidthHz: number;
  readonly maxBandwidthHz: number;
  readonly lowDbm: number;
  readonly highDbm: number;
  readonly fps: number;
  readonly average: number;
  readonly weightedAverage: boolean;
  readonly isBandZoomOn: boolean;
  readonly isSegmentZoomOn: boolean;
  /**
   * Whether the Wideband Noise Blanker (WNB) is enabled for the panadapter.
   */
  readonly wnbEnabled: boolean;
  /**
   * Wideband Noise Blanker (WNB) level from 0 to 100.
   */
  readonly wnbLevel: number;
  /**
   * Whether the noise blanker is currently updating.
   */
  readonly wnbUpdating: boolean;
  readonly rxAntenna: string;
  readonly rfGain: number;
  readonly rfGainLow: number;
  readonly rfGainHigh: number;
  readonly rfGainStep: number;
  readonly rfGainMarkers: readonly number[];
  readonly daxIqChannel: number;
  readonly daxIqRate: number;
  readonly width: number;
  readonly height: number;
  /**
   * Available RX antenna ports for the radio, e.g. "ANT1", "ANT2", "RX_A", "RX_B", "XVTR".
   */
  readonly rxAntennas: readonly string[];
  readonly loopAEnabled: boolean;
  readonly loopBEnabled: boolean;
  readonly wideEnabled: boolean;
  readonly loggerDisplayEnabled: boolean;
  readonly loggerDisplayAddress: string;
  readonly loggerDisplayPort: number;
  readonly loggerDisplayRadioNum: number;
  readonly waterfallStreamId: string;
  readonly attachedSlices: readonly string[];
  readonly clientHandle: number;
  readonly xvtr: string;
  readonly preampSetting: string;
  snapshot(): PanadapterSnapshot;
  on<TKey extends keyof PanadapterControllerEvents>(
    event: TKey,
    listener: (payload: PanadapterControllerEvents[TKey]) => void,
  ): Subscription;
  setCenterFrequency(frequencyHz: number): Promise<PanadapterSnapshot>;
  setBandwidth(bandwidthHz: number): Promise<PanadapterSnapshot>;
  setAutoCenter(enabled: boolean): Promise<PanadapterSnapshot>;
  setMinDbm(value: number): Promise<PanadapterSnapshot>;
  setMaxDbm(value: number): Promise<PanadapterSnapshot>;
  setDbmRange(range: {
    low: number;
    high: number;
  }): Promise<PanadapterSnapshot>;
  setFps(value: number): Promise<PanadapterSnapshot>;
  setAverage(value: number): Promise<PanadapterSnapshot>;
  setWeightedAverage(enabled: boolean): Promise<PanadapterSnapshot>;
  setBandZoom(enabled: boolean): Promise<PanadapterSnapshot>;
  setSegmentZoom(enabled: boolean): Promise<PanadapterSnapshot>;
  /**
   * Enables or disables the Wideband Noise Blanker (WNB) for the panadapter.
   */
  setWnbEnabled(enabled: boolean): Promise<PanadapterSnapshot>;
  /**
   * Sets the Wideband Noise Blanker (WNB) level from 0 to 100.
   */
  setWnbLevel(level: number): Promise<PanadapterSnapshot>;
  setRxAntenna(port: string): Promise<PanadapterSnapshot>;
  setRfGain(value: number): Promise<PanadapterSnapshot>;
  setDaxIqChannel(channel: number): Promise<PanadapterSnapshot>;
  setLoopAEnabled(enabled: boolean): Promise<PanadapterSnapshot>;
  setLoopBEnabled(enabled: boolean): Promise<PanadapterSnapshot>;
  setWidth(width: number): Promise<PanadapterSnapshot>;
  setHeight(height: number): Promise<PanadapterSnapshot>;
  setBand(band: string): Promise<PanadapterSnapshot>;
  setLoggerDisplayEnabled(enabled: boolean): Promise<PanadapterSnapshot>;
  setLoggerDisplayAddress(address: string): Promise<PanadapterSnapshot>;
  setLoggerDisplayPort(port: number): Promise<PanadapterSnapshot>;
  setLoggerDisplayRadioNumber(radio: number): Promise<PanadapterSnapshot>;
  refreshRfGainInfo(): Promise<PanadapterSnapshot>;
  clickTune(frequencyHz: number): Promise<void>;
  update(request: PanadapterUpdateRequest): Promise<PanadapterSnapshot>;
  close(): Promise<void>;
}

export class PanadapterControllerImpl implements PanadapterController {
  private readonly events = new TypedEventEmitter<PanadapterControllerEvents>();
  private streamHandle?: string;

  constructor(
    private readonly session: PanadapterSessionApi,
    readonly id: string,
    streamHandle?: string,
  ) {
    this.streamHandle = streamHandle;
  }

  private current(): PanadapterSnapshot {
    const snapshot = this.session.getPanadapter(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Panadapter ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  get state(): PanadapterSnapshot {
    return this.current();
  }

  get streamId(): string {
    return this.current().streamId;
  }

  get centerFrequencyHz(): number {
    return this.current().centerFrequencyHz;
  }

  get bandwidthHz(): number {
    return this.current().bandwidthHz;
  }

  get autoCenterEnabled(): boolean {
    return this.current().autoCenterEnabled;
  }

  get minBandwidthHz(): number {
    return this.current().minBandwidthHz;
  }

  get maxBandwidthHz(): number {
    return this.current().maxBandwidthHz;
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

  get isBandZoomOn(): boolean {
    return this.current().isBandZoomOn;
  }

  get isSegmentZoomOn(): boolean {
    return this.current().isSegmentZoomOn;
  }

  get wnbEnabled(): boolean {
    return this.current().wnbEnabled;
  }

  get wnbLevel(): number {
    return this.current().wnbLevel;
  }

  get wnbUpdating(): boolean {
    return this.current().wnbUpdating;
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

  get daxIqRate(): number {
    return this.current().daxIqRate;
  }

  get width(): number {
    return this.current().width;
  }

  get height(): number {
    return this.current().height;
  }

  get rxAntennas(): readonly string[] {
    return this.current().rxAntennas;
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

  get loggerDisplayEnabled(): boolean {
    return this.current().loggerDisplayEnabled;
  }

  get loggerDisplayAddress(): string {
    return this.current().loggerDisplayAddress;
  }

  get loggerDisplayPort(): number {
    return this.current().loggerDisplayPort;
  }

  get loggerDisplayRadioNum(): number {
    return this.current().loggerDisplayRadioNum;
  }

  get waterfallStreamId(): string {
    return this.current().waterfallStreamId;
  }

  get attachedSlices(): readonly string[] {
    return this.current().attachedSlices;
  }

  get clientHandle(): number {
    return this.current().clientHandle;
  }

  get xvtr(): string {
    return this.current().xvtr;
  }

  get preampSetting(): string {
    return this.current().preampSetting;
  }

  snapshot(): PanadapterSnapshot {
    return this.current();
  }

  on<TKey extends keyof PanadapterControllerEvents>(
    event: TKey,
    listener: (payload: PanadapterControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  async setCenterFrequency(frequencyHz: number): Promise<PanadapterSnapshot> {
    await this.sendSet({ center: formatMegahertz(frequencyHz) });
    return this.snapshot();
  }

  async setBandwidth(bandwidthHz: number): Promise<PanadapterSnapshot> {
    const snapshot = this.current();
    const target = this.clampBandwidth(bandwidthHz, snapshot);
    const extras: string[] = [];
    if (snapshot.autoCenterEnabled) extras.push("autocenter=1");
    await this.sendSet({ bandwidth: formatMegahertz(target) }, extras);
    return this.snapshot();
  }

  setAutoCenter(enabled: boolean): Promise<PanadapterSnapshot> {
    this.applyAutoCenter(enabled);
    return Promise.resolve(this.snapshot());
  }

  async setMinDbm(value: number): Promise<PanadapterSnapshot> {
    const clamped = this.clampNumber(value, -180, undefined);
    await this.sendSet({ min_dbm: formatDbm(clamped) });
    return this.snapshot();
  }

  async setMaxDbm(value: number): Promise<PanadapterSnapshot> {
    const clamped = this.clampNumber(value, undefined, 20);
    await this.sendSet({ max_dbm: formatDbm(clamped) });
    return this.snapshot();
  }

  async setDbmRange(range: {
    low: number;
    high: number;
  }): Promise<PanadapterSnapshot> {
    const low = this.clampNumber(range.low, -180, undefined);
    const high = this.clampNumber(range.high, undefined, 20);
    await this.sendSet({
      min_dbm: formatDbm(low),
      max_dbm: formatDbm(high),
    });
    return this.snapshot();
  }

  async setFps(value: number): Promise<PanadapterSnapshot> {
    await this.sendSet({ fps: this.toIntString(value) });
    return this.snapshot();
  }

  async setAverage(value: number): Promise<PanadapterSnapshot> {
    await this.sendSet({ average: this.toIntString(value) });
    return this.snapshot();
  }

  async setWeightedAverage(enabled: boolean): Promise<PanadapterSnapshot> {
    await this.sendSet({ weighted_average: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setBandZoom(enabled: boolean): Promise<PanadapterSnapshot> {
    await this.sendSet({ band_zoom: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setSegmentZoom(enabled: boolean): Promise<PanadapterSnapshot> {
    await this.sendSet({ segment_zoom: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setWnbEnabled(enabled: boolean): Promise<PanadapterSnapshot> {
    await this.sendSet({ wnb: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setWnbLevel(level: number): Promise<PanadapterSnapshot> {
    const clamped = this.clampNumber(Math.round(level), 0, 100);
    await this.sendSet({ wnb_level: this.toIntString(clamped) });
    return this.snapshot();
  }

  async setRxAntenna(port: string): Promise<PanadapterSnapshot> {
    await this.sendSet({ rxant: port });
    return this.snapshot();
  }

  async setRfGain(value: number): Promise<PanadapterSnapshot> {
    await this.sendSet({ rfgain: this.toIntString(value) });
    return this.snapshot();
  }

  async setDaxIqChannel(channel: number): Promise<PanadapterSnapshot> {
    await this.sendSet({ daxiq_channel: this.toIntString(channel) });
    return this.snapshot();
  }

  async setLoopAEnabled(enabled: boolean): Promise<PanadapterSnapshot> {
    await this.sendSet({ loopa: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setLoopBEnabled(enabled: boolean): Promise<PanadapterSnapshot> {
    await this.sendSet({ loopb: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setWidth(width: number): Promise<PanadapterSnapshot> {
    const entries: Record<string, string> = {
      xpixels: this.toIntString(width),
    };
    await this.sendSet(entries);
    return this.snapshot();
  }

  async setHeight(height: number): Promise<PanadapterSnapshot> {
    const entries: Record<string, string> = {
      ypixels: this.toIntString(height),
    };
    await this.sendSet(entries);
    return this.snapshot();
  }

  async setBand(band: string): Promise<PanadapterSnapshot> {
    await this.sendSet({ band });
    return this.snapshot();
  }

  async setLoggerDisplayEnabled(enabled: boolean): Promise<PanadapterSnapshot> {
    await this.sendSet({ n1mm_spectrum_enable: this.toFlag(enabled) });
    return this.snapshot();
  }

  async setLoggerDisplayAddress(address: string): Promise<PanadapterSnapshot> {
    await this.sendSet({ n1mm_address: address });
    return this.snapshot();
  }

  async setLoggerDisplayPort(port: number): Promise<PanadapterSnapshot> {
    await this.sendSet({ n1mm_port: this.toIntString(port) });
    return this.snapshot();
  }

  async setLoggerDisplayRadioNumber(
    radio: number,
  ): Promise<PanadapterSnapshot> {
    await this.sendSet({ n1mm_radio: this.toIntString(radio) });
    return this.snapshot();
  }

  async refreshRfGainInfo(): Promise<PanadapterSnapshot> {
    const stream = this.requireStreamHandle();
    const response = await this.session.command(
      `display pan rfgain_info ${stream}`,
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
      rf_gain_markers: info.markers.length > 0 ? info.markers.join(",") : "",
    };
    this.session.patchPanadapter(this.id, attributes);
    return this.snapshot();
  }

  async clickTune(frequencyHz: number): Promise<void> {
    const stream = this.requireStreamHandle();
    const command = `slice m ${formatMegahertz(frequencyHz)} pan=${stream}`;
    await this.session.command(command);
  }

  async update(request: PanadapterUpdateRequest): Promise<PanadapterSnapshot> {
    const entries = this.buildSetEntries(request);
    if (Object.keys(entries).length > 0) {
      await this.sendSet(entries);
    }
    if (request.autoCenterEnabled !== undefined) {
      this.applyAutoCenter(request.autoCenterEnabled);
    }
    return this.snapshot();
  }

  async close(): Promise<void> {
    const stream = this.requireStreamHandle();
    await this.session.command(`display pan remove ${stream}`);
  }

  onStateChange(change: PanadapterStateChange): void {
    if (change.snapshot?.streamId) {
      this.streamHandle = change.snapshot.streamId;
    }
    this.events.emit("change", change);
  }

  private buildSetEntries(
    request: PanadapterUpdateRequest,
  ): Record<string, string> {
    const entries = Object.create(null) as Record<string, string>;
    if (request.centerFrequencyHz !== undefined)
      entries.center = formatMegahertz(request.centerFrequencyHz);
    if (request.bandwidthHz !== undefined) {
      const target = this.clampBandwidth(request.bandwidthHz);
      entries.bandwidth = formatMegahertz(target);
    }
    if (request.lowDbm !== undefined) {
      const clamped = this.clampNumber(request.lowDbm, -180, undefined);
      entries.min_dbm = formatDbm(clamped);
    }
    if (request.highDbm !== undefined) {
      const clamped = this.clampNumber(request.highDbm, undefined, 20);
      entries.max_dbm = formatDbm(clamped);
    }
    if (request.fps !== undefined) entries.fps = this.toIntString(request.fps);
    if (request.average !== undefined)
      entries.average = this.toIntString(request.average);
    if (request.weightedAverage !== undefined)
      entries.weighted_average = this.toFlag(request.weightedAverage);
    if (request.isBandZoomOn !== undefined)
      entries.band_zoom = this.toFlag(request.isBandZoomOn);
    if (request.isSegmentZoomOn !== undefined)
      entries.segment_zoom = this.toFlag(request.isSegmentZoomOn);
    if (request.wnbEnabled !== undefined)
      entries.wnb = this.toFlag(request.wnbEnabled);
    if (request.wnbLevel !== undefined) {
      const clamped = this.clampNumber(Math.round(request.wnbLevel), 0, 100);
      entries.wnb_level = this.toIntString(clamped);
    }
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
    if (request.loggerDisplayEnabled !== undefined)
      entries.n1mm_spectrum_enable = this.toFlag(request.loggerDisplayEnabled);
    if (request.loggerDisplayAddress !== undefined)
      entries.n1mm_address = request.loggerDisplayAddress;
    if (request.loggerDisplayPort !== undefined)
      entries.n1mm_port = this.toIntString(request.loggerDisplayPort);
    if (request.loggerDisplayRadioNum !== undefined)
      entries.n1mm_radio = this.toIntString(request.loggerDisplayRadioNum);
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
    const command = `display pan set ${stream} ${parts.join(" ")}${extras.length ? " " + extras.join(" ") : ""}`;
    await this.session.command(command);
    this.session.patchPanadapter(this.id, { stream_id: stream, ...entries });
  }

  private requireStreamHandle(): string {
    const snapshot = this.session.getPanadapter(this.id);
    if (snapshot?.streamId) {
      this.streamHandle = snapshot.streamId;
    }
    if (!this.streamHandle) {
      throw new FlexClientClosedError();
    }
    return this.streamHandle;
  }

  private applyAutoCenter(enabled: boolean): void {
    this.session.patchPanadapter(this.id, {
      auto_center: this.toFlag(enabled),
    });
  }

  private clampBandwidth(
    bandwidthHz: number,
    snapshot: PanadapterSnapshot = this.current(),
  ): number {
    const min =
      snapshot.minBandwidthHz > 0 ? snapshot.minBandwidthHz : undefined;
    const max =
      snapshot.maxBandwidthHz > 0 ? snapshot.maxBandwidthHz : undefined;
    return this.clampNumber(bandwidthHz, min, max);
  }

  private clampNumber(value: number, min?: number, max?: number): number {
    let result = value;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  }

  private toFlag(value: boolean): string {
    return value ? "1" : "0";
  }

  private toIntString(value: number): string {
    return Math.round(value).toString(10);
  }
}
function formatMegahertz(frequencyHz: number): string {
  const mhz = frequencyHz / 1_000_000;
  return mhz.toFixed(6);
}

function formatDbm(value: number): string {
  return value.toFixed(6);
}
