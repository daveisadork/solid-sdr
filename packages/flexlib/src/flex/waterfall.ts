import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type { WaterfallSnapshot, WaterfallStateChange } from "./state/index.js";
import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexClientClosedError, FlexStateUnavailableError } from "./errors.js";
import type { RfGainInfo } from "./rf-gain.js";
import {
  buildDisplaySetCommand,
  formatBooleanFlag,
  formatInteger,
} from "./controller-helpers.js";
import {
  clampLineSpeed,
  lineSpeedToDurationMs,
} from "./waterfall-line-speed.js";
import type { UdpPacketEvent, UdpScope, UdpSession } from "./udp-session.js";

export interface WaterfallControllerEvents extends Record<string, unknown> {
  readonly change: WaterfallStateChange;
  readonly data: UdpPacketEvent<"waterfall">;
}

export interface WaterfallUpdateRequest {
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
  readonly udp: UdpSession;
}

export interface WaterfallController {
  readonly id: string;
  readonly state: WaterfallSnapshot;
  readonly streamId: string;
  readonly panadapterStreamId: string;
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
  private streamHandle?: string;
  private dataListeners = 0;
  private dataScope?: UdpScope<"waterfall">;
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
    this.session.patchWaterfall(this.id, { stream_id: stream, ...entries });
    await this.session.command(command);
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
