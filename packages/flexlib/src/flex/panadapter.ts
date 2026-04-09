import type {
  PanadapterSnapshot,
  PanadapterStateChange,
} from "./state/index.js";
import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexError, FlexStateUnavailableError } from "./errors.js";
import { parseRfGainInfo } from "./rf-gain.js";
import {
  buildDisplaySetCommand,
  clampInteger,
  clampNumber,
  formatBooleanFlag,
  formatDbm,
  formatInteger,
  formatMegahertz,
} from "./controller-helpers.js";
import type { RadioSession } from "./radio-core.js";
import type { VitaParsedPacket } from "../vita/parser.js";

export interface PanadapterControllerEvents {
  readonly change: PanadapterStateChange;
  readonly data: VitaParsedPacket<"panadapter">;
}

export interface PanadapterUpdateRequest {
  centerFrequencyMHz?: number;
  bandwidthMHz?: number;
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
  noiseFloorPosition?: number;
  noiseFloorPositionEnabled?: boolean;
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

export interface PanadapterController
  extends Readonly<Omit<PanadapterSnapshot, "raw">> {
  snapshot(): PanadapterSnapshot;
  on<TKey extends keyof PanadapterControllerEvents>(
    event: TKey,
    listener: (payload: PanadapterControllerEvents[TKey]) => void,
  ): Subscription;
  setCenterFrequency(frequencyMHz: number): Promise<void>;
  setBandwidth(bandwidthMHz: number): Promise<void>;
  setAutoCenter(enabled: boolean): Promise<void>;
  setMinDbm(value: number): Promise<void>;
  setMaxDbm(value: number): Promise<void>;
  setDbmRange(range: { low: number; high: number }): Promise<void>;
  setFps(value: number): Promise<void>;
  setAverage(value: number): Promise<void>;
  setWeightedAverage(enabled: boolean): Promise<void>;
  setBandZoom(enabled: boolean): Promise<void>;
  setSegmentZoom(enabled: boolean): Promise<void>;
  /**
   * Enables or disables the Wideband Noise Blanker (WNB) for the panadapter.
   */
  setWnbEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the Wideband Noise Blanker (WNB) level from 0 to 100.
   */
  setWnbLevel(level: number): Promise<void>;
  setNoiseFloorPosition(value: number): Promise<void>;
  setNoiseFloorPositionEnabled(enabled: boolean): Promise<void>;
  setRxAntenna(port: string): Promise<void>;
  setRfGain(value: number): Promise<void>;
  setDaxIqChannel(channel: number): Promise<void>;
  setLoopAEnabled(enabled: boolean): Promise<void>;
  setLoopBEnabled(enabled: boolean): Promise<void>;
  setWidth(width: number): Promise<void>;
  setHeight(height: number): Promise<void>;
  setSize(size: { width: number; height: number }): Promise<void>;
  setBand(band: string): Promise<void>;
  setLoggerDisplayEnabled(enabled: boolean): Promise<void>;
  setLoggerDisplayAddress(address: string): Promise<void>;
  setLoggerDisplayPort(port: number): Promise<void>;
  setLoggerDisplayRadioNumber(radio: number): Promise<void>;
  refreshRfGainInfo(): Promise<void>;
  clickTune(frequencyMHz: number): Promise<void>;
  update(request: PanadapterUpdateRequest): Promise<void>;
  close(): Promise<void>;
}

export class PanadapterControllerImpl implements PanadapterController {
  private readonly events = new TypedEventEmitter<PanadapterControllerEvents>();
  private dataListeners = 0;
  private dataSubscription?: Subscription;

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  private current(): PanadapterSnapshot {
    const snapshot = this.radio.getStore().getPanadapter(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Panadapter ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  get streamId(): string {
    return this.current().streamId;
  }

  get band(): string {
    return this.current().band;
  }

  get centerFrequencyMHz(): number {
    return this.current().centerFrequencyMHz;
  }

  get bandwidthMHz(): number {
    return this.current().bandwidthMHz;
  }

  get autoCenterEnabled(): boolean {
    return this.current().autoCenterEnabled;
  }

  get minBandwidthMHz(): number {
    return this.current().minBandwidthMHz;
  }

  get maxBandwidthMHz(): number {
    return this.current().maxBandwidthMHz;
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

  get noiseFloorPosition(): number {
    return this.current().noiseFloorPosition;
  }

  get noiseFloorPositionEnabled(): boolean {
    return this.current().noiseFloorPositionEnabled;
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

  async setBandwidth(bandwidthMHz: number): Promise<void> {
    const snapshot = this.current();
    const target = this.clampBandwidth(bandwidthMHz, snapshot);
    const props: { bandwidth: string; autocenter?: string } = {
      bandwidth: formatMegahertz(target),
    };
    if (snapshot.autoCenterEnabled) {
      props.autocenter = "1"; // autocenter is enabled
    }
    await this.sendSet(props);
  }

  /**
   * Mirrors FlexLib's behaviour: toggling auto-center is a local flag that only
   * affects the next bandwidth command (which will append `autocenter=1`).
   * There is no standalone wire command for this setting.
   */
  async setAutoCenter(enabled: boolean): Promise<void> {
    this.applyAutoCenter(enabled);
  }

  async setMinDbm(value: number): Promise<void> {
    const clamped = clampNumber(value, -180, undefined);
    await this.sendSet({ min_dbm: formatDbm(clamped) });
  }

  async setMaxDbm(value: number): Promise<void> {
    const clamped = clampNumber(value, undefined, 20);
    await this.sendSet({ max_dbm: formatDbm(clamped) });
  }

  async setDbmRange(range: { low: number; high: number }): Promise<void> {
    const low = clampNumber(range.low, -180, undefined);
    const high = clampNumber(range.high, undefined, 20);
    await this.sendSet({
      min_dbm: formatDbm(low),
      max_dbm: formatDbm(high),
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

  async setBandZoom(enabled: boolean): Promise<void> {
    await this.sendSet({ band_zoom: formatBooleanFlag(enabled) });
  }

  async setSegmentZoom(enabled: boolean): Promise<void> {
    await this.sendSet({ segment_zoom: formatBooleanFlag(enabled) });
  }

  async setWnbEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ wnb: formatBooleanFlag(enabled) });
  }

  async setWnbLevel(level: number): Promise<void> {
    const clamped = clampInteger(level, 0, 100, "WNB level");
    await this.sendSet({ wnb_level: formatInteger(clamped) });
  }

  async setNoiseFloorPosition(value: number): Promise<void> {
    await this.sendSet({
      pan_position: formatInteger(value, "noise floor position"),
    });
  }

  async setNoiseFloorPositionEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ pan_position_enable: formatBooleanFlag(enabled) });
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

  async setWidth(width: number): Promise<void> {
    const entries: Record<string, string> = {
      xpixels: formatInteger(width),
    };
    await this.sendSet(entries);
  }

  async setHeight(height: number): Promise<void> {
    const entries: Record<string, string> = {
      ypixels: formatInteger(height),
    };
    await this.sendSet(entries);
  }

  async setSize(size: { width: number; height: number }): Promise<void> {
    const entries: Record<string, string> = {
      xpixels: formatInteger(size.width),
      ypixels: formatInteger(size.height),
    };
    await this.sendSet(entries);
  }

  async setBand(band: string): Promise<void> {
    await this.sendSet({ band });
  }

  async setLoggerDisplayEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ n1mm_spectrum_enable: formatBooleanFlag(enabled) });
  }

  async setLoggerDisplayAddress(address: string): Promise<void> {
    await this.sendSet({ n1mm_address: address });
  }

  async setLoggerDisplayPort(port: number): Promise<void> {
    await this.sendSet({ n1mm_port: formatInteger(port) });
  }

  async setLoggerDisplayRadioNumber(radio: number): Promise<void> {
    await this.sendSet({ n1mm_radio: formatInteger(radio) });
  }

  async refreshRfGainInfo(): Promise<void> {
    const response = await this.radio.command(
      `display pan rfgain_info ${this.id}`,
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
    const change = this.radio
      .getStore()
      .applyPanadapterRfGainInfo(this.id, info);
    if (change) this.radio.applyStateChange(change);
  }

  async clickTune(frequencyMHz: number): Promise<void> {
    const command = `slice m ${formatMegahertz(frequencyMHz)} pan=${this.id}`;
    await this.radio.command(command);
  }

  async update(request: PanadapterUpdateRequest): Promise<void> {
    if (request.autoCenterEnabled !== undefined) {
      this.applyAutoCenter(request.autoCenterEnabled);
    }
    const entries = this.buildSetEntries(request);
    if (Object.keys(entries).length > 0) {
      await this.sendSet(entries);
    }
  }

  async close(): Promise<void> {
    this.teardownDataPipeline();
    await this.radio.command(`display pan remove ${this.id}`);
    const changes = this.radio.getStore().removePanadapter(this.id);
    if (changes) {
      for (const change of changes) this.radio.applyStateChange(change);
    }
  }

  onStateChange(change: PanadapterStateChange): void {
    this.events.emit("change", change);
    if (change.removed) {
      this.teardownDataPipeline();
    }
  }

  private buildSetEntries(
    request: PanadapterUpdateRequest,
  ): Record<string, string> {
    const entries = Object.create(null) as Record<string, string>;
    if (request.centerFrequencyMHz !== undefined)
      entries.center = formatMegahertz(request.centerFrequencyMHz);
    if (request.bandwidthMHz !== undefined) {
      const target = this.clampBandwidth(request.bandwidthMHz);
      entries.bandwidth = formatMegahertz(target);
      if (request.autoCenterEnabled) {
        entries.autocenter = formatBooleanFlag(request.autoCenterEnabled);
      }
    }
    if (request.lowDbm !== undefined) {
      const clamped = clampNumber(request.lowDbm, -180, undefined);
      entries.min_dbm = formatDbm(clamped);
    }
    if (request.highDbm !== undefined) {
      const clamped = clampNumber(request.highDbm, undefined, 20);
      entries.max_dbm = formatDbm(clamped);
    }
    if (request.fps !== undefined) entries.fps = formatInteger(request.fps);
    if (request.average !== undefined)
      entries.average = formatInteger(request.average);
    if (request.weightedAverage !== undefined)
      entries.weighted_average = formatBooleanFlag(request.weightedAverage);
    if (request.isBandZoomOn !== undefined)
      entries.band_zoom = formatBooleanFlag(request.isBandZoomOn);
    if (request.isSegmentZoomOn !== undefined)
      entries.segment_zoom = formatBooleanFlag(request.isSegmentZoomOn);
    if (request.wnbEnabled !== undefined)
      entries.wnb = formatBooleanFlag(request.wnbEnabled);
    if (request.wnbLevel !== undefined) {
      const clamped = clampInteger(request.wnbLevel, 0, 100, "WNB level");
      entries.wnb_level = formatInteger(clamped);
    }
    if (request.noiseFloorPosition !== undefined)
      entries.pan_position = formatInteger(
        request.noiseFloorPosition,
        "noise floor position",
      );
    if (request.noiseFloorPositionEnabled !== undefined)
      entries.pan_position_enable = formatBooleanFlag(
        request.noiseFloorPositionEnabled,
      );
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
    if (request.loggerDisplayEnabled !== undefined)
      entries.n1mm_spectrum_enable = formatBooleanFlag(
        request.loggerDisplayEnabled,
      );
    if (request.loggerDisplayAddress !== undefined)
      entries.n1mm_address = request.loggerDisplayAddress;
    if (request.loggerDisplayPort !== undefined)
      entries.n1mm_port = formatInteger(request.loggerDisplayPort);
    if (request.loggerDisplayRadioNum !== undefined)
      entries.n1mm_radio = formatInteger(request.loggerDisplayRadioNum);
    return entries;
  }

  private async sendSet(entries: Record<string, string>): Promise<void> {
    const command = buildDisplaySetCommand("display pan set", this.id, entries);
    const change = this.radio
      .getStore()
      .patchPanadapter(this.id, { stream_id: this.id, ...entries });
    if (change) this.radio.applyStateChange(change);
    try {
      await this.radio.command(command);
    } catch (error) {
      await this.radio.command("sub pan all");
      throw error;
    }
  }

  private ensureDataPipeline(): void {
    if (this.dataSubscription) return;
    const streamNumericId = Number.parseInt(this.streamId, 16);
    if (!Number.isFinite(streamNumericId)) return;
    this.dataSubscription = this.radio.registerStreamHandler(
      streamNumericId,
      (packet) => {
        this.events.emit(
          "data",
          packet as unknown as PanadapterControllerEvents["data"],
        );
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

  /**
   * See comment on setAutoCenter — we only patch local state so future
   * bandwidth updates can include the `autocenter` flag.
   */
  private applyAutoCenter(enabled: boolean): void {
    const change = this.radio.getStore().patchPanadapter(this.id, {
      auto_center: formatBooleanFlag(enabled),
    });
    if (change) this.radio.applyStateChange(change);
  }

  private clampBandwidth(
    bandwidthMHz: number,
    snapshot: PanadapterSnapshot = this.current(),
  ): number {
    const min =
      snapshot.minBandwidthMHz > 0 ? snapshot.minBandwidthMHz : undefined;
    const max =
      snapshot.maxBandwidthMHz > 0 ? snapshot.maxBandwidthMHz : undefined;
    return clampNumber(bandwidthMHz, min, max);
  }
}
