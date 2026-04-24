/**
 * The Radio class — the single object representing a FlexRadio.
 *
 * Collapses RadioHandle, RadioSession, RadioController, and FlexClient
 * into one unified construct that owns connection lifecycle, state,
 * protocol parsing, command dispatch, and UDP data routing.
 *
 * @module
 */

import { TypedEventEmitter, type Subscription } from "../util/events.js";
import type {
  FlexConnection,
  FlexTransport,
  RadioEndpoint,
} from "./transport.js";
import type { Logger, FlexRadioDescriptor } from "./adapters.js";
import type {
  FlexWireMessage,
  FlexStatusMessage,
  FlexReplyMessage,
  FlexReplyCodeLevel,
  FlexNoticeMessage,
} from "./protocol.js";
import { parseFlexMessage } from "./protocol.js";
import {
  createRadioStateStore,
  type RadioStateStore,
  type RadioStateSnapshot,
  type RadioStateChange,
  type RadioSnapshot,
  type RadioCwIambicMode,
  type RadioFilterSharpnessMode,
  type RadioOscillatorSetting,
  type RadioStatusContext,
} from "./state/index.js";
import { FlexClientClosedError, FlexCommandRejectedError } from "./errors.js";
import { FlexError } from "./errors.js";
import { describeResponseCode } from "./response-codes.js";
import {
  buildRadioListAttributes,
  parseRadioInfoReply,
  parseRadioVersionReply,
} from "./radio-replies.js";
import {
  clampInteger,
  ensureFinite,
  formatBooleanFlag,
  formatMegahertz,
  toInteger,
} from "./controller-helpers.js";
export interface RadioRequestSliceOptions {
  /** Panadapter stream id that should host the new slice, e.g. "0x40000000". */
  readonly panadapterStreamId?: string;
  /** Demodulation mode for the new slice, e.g. "USB", "DIGU", "LSB", "CW". */
  readonly demodMode?: string;
  /** Initial center frequency in MHz. */
  readonly frequencyMHz?: number;
  /** RX antenna port for the new slice, e.g. "ANT1", "ANT2", "RX_A". */
  readonly rxAntenna?: string;
  /** Restores persisted slice settings when available. */
  readonly loadPersistence?: boolean;
}
import { type SliceController, SliceControllerImpl } from "./slice.js";
import {
  type PanadapterController,
  PanadapterControllerImpl,
} from "./panadapter.js";
import {
  type WaterfallController,
  WaterfallControllerImpl,
} from "./waterfall.js";
import { type MeterController, MeterControllerImpl } from "./meter.js";
import {
  type AudioStreamController,
  type AudioStreamTxController,
  type RemoteAudioTxStreamController,
  AudioStreamControllerImpl,
  AudioStreamTxControllerImpl,
  RemoteAudioTxStreamControllerImpl,
} from "./audio-stream.js";
import {
  type EqualizerController,
  EqualizerControllerImpl,
} from "./equalizer.js";
import {
  type TxBandSettingController,
  TxBandSettingControllerImpl,
} from "./tx-band-settings.js";
import { type ApdController, ApdControllerImpl } from "./apd.js";
import { type XvtrController, XvtrControllerImpl } from "./xvtr.js";
import { type TnfController, TnfControllerImpl } from "./tnf.js";
import { type MemoryController, MemoryControllerImpl } from "./memory.js";
import {
  type SpotController,
  type SpotTriggeredEvent,
  SpotControllerImpl,
} from "./spot.js";
import { type CwxController, CwxControllerImpl } from "./cwx.js";
import { type DvkController, DvkControllerImpl } from "./dvk.js";
import {
  type FeatureLicenseController,
  FeatureLicenseControllerImpl,
} from "./feature-license.js";
import type {
  EqualizerId,
  EqualizerStateChange,
  TxBandSettingStateChange,
  ApdStateChange,
  XvtrStateChange,
  SpotStateChange,
  TnfStateChange,
  MemoryStateChange,
  CwxStateChange,
  DvkStateChange,
} from "./state/index.js";
import { parseVitaPacket, type VitaParsedPacket } from "../vita/parser.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Connection state exposed as a queryable property. */
export type RadioConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting";

/** Stages emitted during the "connecting" phase. */
export type ConnectionProgressStage =
  | "tcp"
  | "handle"
  | "sync"
  | "udp"
  | "ready";

/** Detail values emitted during the "sync" stage. */
export type ConnectionSyncDetail =
  | "radio-info"
  | "subscriptions"
  | "network"
  | "complete";

/** Granular progress detail emitted during the "connecting" phase. */
export interface ConnectionProgressDetail {
  readonly stage: ConnectionProgressStage;
  readonly detail?: ConnectionSyncDetail | string;
}

/** Options for {@link Radio.command}. */
export interface RadioCommandOptions {
  /** Per-command timeout in ms. Overrides the radio-wide default. */
  readonly timeoutMs?: number;
  /** Force a specific sequence number (advanced). */
  readonly sequenceHint?: number;
}

/** Response from a radio command. */
export interface RadioCommandResponse {
  readonly sequence: number;
  readonly accepted: boolean;
  readonly level?: FlexReplyCodeLevel;
  readonly code?: number;
  readonly message?: string;
  readonly raw: string;
}

/** Identity and connection options provided when calling {@link Radio.connect}. */
export interface RadioConnectOptions {
  /** Client identity metadata for the handshake. */
  readonly clientInfo?: RadioClientInfo;
  /** Default command timeout in ms. Defaults to 5000. */
  readonly defaultCommandTimeoutMs?: number;
  /** Heartbeat interval in ms, or null to disable. Defaults to 1000. */
  readonly pingIntervalMs?: number | null;
  /** Handle timeout in ms during handshake. Defaults to 10000. */
  readonly handleTimeoutMs?: number;
}

/** Client identity metadata announced during the handshake. */
export interface RadioClientInfo {
  /** Name of the client program. */
  readonly program?: string;
  /** Register as a GUI client. Defaults to true. */
  readonly isGui?: boolean;
  /** GUI client ID to reuse. */
  readonly guiClientId?: string | null;
  /** GUI client ID to bind for non-GUI connections. */
  readonly boundClientId?: string | null;
  /** Station name announced to the radio. */
  readonly station?: string;
}

// ---------------------------------------------------------------------------
// Event map
// ---------------------------------------------------------------------------

/** Event map for the {@link Radio} class. */
export interface RadioEvents {
  readonly connectionStateChange: RadioConnectionState;
  readonly connectingProgress: ConnectionProgressDetail;
  readonly change: RadioStateChange;
  readonly status: FlexStatusMessage;
  readonly reply: FlexReplyMessage;
  readonly notice: FlexNoticeMessage;
  readonly message: FlexWireMessage;
  readonly spotTriggered: SpotTriggeredEvent;
  readonly ready: undefined;
  readonly disconnected: undefined;
  readonly error: unknown;
}

export type RadioEventKey = keyof RadioEvents;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PendingCommand {
  readonly command: string;
  readonly sequence: number;
  readonly timeoutHandle?: ReturnType<typeof setTimeout>;
  readonly resolve: (response: RadioCommandResponse) => void;
  readonly reject: (reason: unknown) => void;
}

// ---------------------------------------------------------------------------
// RadioSession — the unified interface controllers use
// ---------------------------------------------------------------------------

/** Callback for VITA stream data routed by the Radio. */
export type StreamPacketHandler = (packet: VitaParsedPacket) => void;

/** Callback for individual meter value updates. */
export type MeterValueHandler = (meterId: number, rawValue: number) => void;

/**
 * Unified session interface that all controllers use to interact with the
 * Radio. Replaces the per-controller `*SessionApi` interfaces.
 *
 * Both the new {@link Radio} class and the legacy `FlexRadioSessionImpl`
 * implement this interface, so controllers work with either during migration.
 */
export interface RadioSession {
  /** Send a command to the radio and await its reply. */
  command(
    command: string,
    options?: RadioCommandOptions,
  ): Promise<RadioCommandResponse>;

  /** Access the internal state store (snapshots, patches). */
  getStore(): RadioStateStore;

  /** Look up (or lazily create) a slice controller by ID. */
  slice(id: string): SliceController | undefined;

  /**
   * Propagate a state change from an optimistic update.
   *
   * Controllers call this after patching the store directly
   * (e.g. `store.patchPanadapter(id, attrs)`) so that the change
   * is emitted to listeners and routed to other controllers.
   */
  applyStateChange(change: RadioStateChange): void;

  /**
   * Register a handler for VITA packets matching a specific stream ID.
   * Used by panadapter, waterfall, and audio controllers for their
   * lazy data pipelines. Returns a subscription to unregister.
   */
  registerStreamHandler(
    streamId: number,
    handler: StreamPacketHandler,
  ): Subscription;

  /**
   * Register a handler for a specific meter's value updates.
   * Meter VITA packets carry multiple meter values per packet, so
   * the Radio dispatches individual values to registered handlers.
   * Returns a subscription to unregister.
   */
  registerMeterHandler(
    meterId: number,
    handler: MeterValueHandler,
  ): Subscription;

  /** Send a binary payload over the UDP data channel. */
  sendUdp(data: Uint8Array): Promise<void>;
}

const DEFAULT_COMMAND_TIMEOUT_MS = 5_000;
const DEFAULT_HANDLE_TIMEOUT_MS = 10_000;
const DEFAULT_PING_INTERVAL_MS = 1_000;
const COMMAND_TERMINATOR = "\n";

/** Subscription commands sent during the default handshake. */
const DEFAULT_HANDSHAKE_COMMANDS: readonly string[] = [
  "profile global info",
  "profile tx info",
  "profile mic info",
  "profile display info",
  "sub client all",
  "sub tx all",
  "sub atu all",
  "sub amplifier all",
  "sub meter all",
  "sub pan all",
  "sub slice all",
  "sub gps all",
  "sub audio_stream all",
  "sub cwx all",
  "sub xvtr all",
  "sub memories all",
  "sub daxiq all",
  "sub dax all",
  "sub license all",
  "sub usb_cable all",
  "sub tnf all",
  "sub spot all",
  "sub rapidm all",
  "sub ale all",
  "sub log_manager",
  "sub radio all",
  "sub apd all",
  "sub dvk all",
  "keepalive enable",
];

// ---------------------------------------------------------------------------
// Module-level helpers (merged from radio.ts RadioControllerImpl)
// ---------------------------------------------------------------------------

function sanitizeNickname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCallsign(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

const INVALID_CLIENT_STATION_CHARS = /[*#@!%^&.,;:?")(+=`'~<>|\\[\]{}]+/g;

function sanitizeClientStationName(value: string): string {
  return value.replace(INVALID_CLIENT_STATION_CHARS, "");
}

function normalizeLogModuleName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new FlexError("Log module name cannot be empty");
  }
  return trimmed;
}

function normalizeLogLevel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new FlexError("Log level cannot be empty");
  }
  return trimmed;
}

function encodeCwIambicMode(mode: RadioCwIambicMode): number {
  switch (mode) {
    case "a":
      return 0;
    case "b":
      return 1;
    case "strict_b":
      return 2;
    case "bug":
      return 3;
  }
}

const FILTER_SHARPNESS_MIN_LEVEL = 0;
const FILTER_SHARPNESS_MAX_LEVEL = 3;

type ProfileLoadDomain = "global" | "tx" | "mic" | "display";

type PreparedProfileName = {
  readonly normalized: string;
  readonly encoded: string;
};

function prepareProfileNameInput(raw: string): PreparedProfileName {
  const normalized = normalizeProfileName(raw);
  return {
    normalized,
    encoded: `"${escapeProfileName(normalized)}"`,
  };
}

function normalizeProfileName(raw: string): string {
  const trimmed = raw.trim();
  const withoutMarker = trimmed.replace(/\*/g, "").trim();
  if (!withoutMarker) {
    throw new FlexError("Profile name cannot be empty");
  }
  return withoutMarker;
}

function escapeProfileName(value: string): string {
  return value.replace(/(["\\])/g, "\\$1");
}

function normalizeSliceCreatePanStreamId(streamId: string): string {
  const trimmed = streamId.trim();
  if (!trimmed) {
    throw new FlexError("Panadapter stream id cannot be empty");
  }
  const withoutPrefix =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed.slice(2)
      : trimmed;
  if (!/^[0-9a-fA-F]+$/.test(withoutPrefix)) {
    throw new FlexError(`Invalid panadapter stream id: ${streamId}`);
  }
  return `0x${withoutPrefix.toUpperCase().padStart(8, "0")}`;
}

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------

/**
 * The single object representing a FlexRadio.
 *
 * Owns connection lifecycle, state, controllers, events, and commands.
 * Use {@link connect} to establish a connection and {@link disconnect}
 * to tear it down.
 */
// Merge RadioSnapshot properties onto Radio's type so that
// radio.nickname, radio.sliceCount, etc. are visible to TypeScript.
// The actual values are provided by a Proxy in the constructor.
export interface Radio extends Readonly<RadioSnapshot> {}

export class Radio {
  private readonly events = new TypedEventEmitter<RadioEvents>();
  private readonly store: RadioStateStore;
  private readonly logger?: Logger;

  private _connectionState: RadioConnectionState = "disconnected";
  private connection?: FlexConnection;
  private connectionSubs: Subscription[] = [];
  private pendingCommands = new Map<number, PendingCommand>();
  private nextSequence = 1;
  private tcpBuffer = "";
  private decoder?: InstanceType<typeof TextDecoder>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private defaultCommandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS;

  // Stream handler registries for UDP data routing
  private readonly streamHandlers = new Map<number, Set<StreamPacketHandler>>();
  private readonly meterHandlers = new Map<number, Set<MeterValueHandler>>();

  // Controller caches
  private readonly sliceControllers = new Map<string, SliceControllerImpl>();
  private readonly panControllers = new Map<string, PanadapterControllerImpl>();
  private readonly waterfallControllers = new Map<
    string,
    WaterfallControllerImpl
  >();
  private readonly meterControllers = new Map<string, MeterControllerImpl>();
  private readonly audioControllers = new Map<
    string,
    | AudioStreamControllerImpl
    | AudioStreamTxControllerImpl
    | RemoteAudioTxStreamControllerImpl
  >();
  private readonly equalizerControllers = new Map<
    EqualizerId,
    EqualizerControllerImpl
  >();
  private readonly txBandControllers = new Map<
    string,
    TxBandSettingControllerImpl
  >();
  private readonly xvtrControllers = new Map<string, XvtrControllerImpl>();
  private readonly tnfControllers = new Map<string, TnfControllerImpl>();
  private readonly memoryControllers = new Map<string, MemoryControllerImpl>();
  private readonly spotControllers = new Map<string, SpotControllerImpl>();
  private readonly _apdController: ApdControllerImpl;
  private readonly _cwxController: CwxControllerImpl;
  private readonly _dvkController: DvkControllerImpl;
  private readonly _featureLicenseController: FeatureLicenseControllerImpl;

  private _clientHandle: string | null = null;
  private _clientId: string | null = null;
  private _serial: string;
  private _endpoint: RadioEndpoint;
  private _descriptor?: FlexRadioDescriptor;

  private readonly handleWaiters: Array<{
    resolve: (handle: string) => void;
    reject: (reason: unknown) => void;
    timeoutHandle?: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    serial: string,
    private readonly transport: FlexTransport,
    endpoint: RadioEndpoint,
    options?: { logger?: Logger },
  ) {
    this._serial = serial;
    this._endpoint = { ...endpoint };
    this.logger = options?.logger;
    this.store = createRadioStateStore({ logger: this.logger });
    this._apdController = new ApdControllerImpl(this);
    this._cwxController = new CwxControllerImpl(this);
    this._dvkController = new DvkControllerImpl(this);
    this._featureLicenseController = new FeatureLicenseControllerImpl(this);

    // Return a Proxy so that RadioSnapshot properties (nickname, sliceCount,
    // callsign, etc.) are readable directly on the Radio instance.
    // Properties defined on Radio itself take precedence over snapshot fields.
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Own properties and methods take precedence
        return Reflect.has(target, prop)
          ? Reflect.get(target, prop, receiver)
          : // Delegate to the current radio snapshot
            target.store.getRadio()?.[prop as keyof RadioSnapshot];
      },
    });
  }

  // -----------------------------------------------------------------------
  // Public getters
  // -----------------------------------------------------------------------

  get connectionState(): RadioConnectionState {
    return this._connectionState;
  }

  get serial(): string {
    return this._serial;
  }

  get endpoint(): RadioEndpoint {
    return { ...this._endpoint };
  }

  get clientHandle(): string | null {
    return this._clientHandle;
  }

  get clientId(): string | null {
    return this._clientId;
  }

  /** Last discovery descriptor, if this radio was found via discovery. */
  get descriptor(): FlexRadioDescriptor | undefined {
    return this._descriptor;
  }

  /** Current radio state snapshot. */
  snapshot(): RadioSnapshot | undefined {
    return this.store.getRadio();
  }

  /** Full state snapshot including all entities. */
  stateSnapshot(): RadioStateSnapshot {
    return this.store.snapshot();
  }

  // -----------------------------------------------------------------------
  // Entity controllers
  // -----------------------------------------------------------------------

  slices(): SliceController[] {
    return Array.from(this.sliceControllers.values());
  }

  slice(id: string): SliceController | undefined {
    return this.getOrCreateController(
      "slice",
      id,
      this.sliceControllers,
      () => {
        if (!this.store.getSlice(id)) return undefined;
        return new SliceControllerImpl(this, id);
      },
    );
  }

  panadapters(): PanadapterController[] {
    return Array.from(this.panControllers.values());
  }

  panadapter(id: string): PanadapterController | undefined {
    return this.getOrCreateController(
      "panadapter",
      id,
      this.panControllers,
      () => {
        const snapshot = this.store.getPanadapter(id);
        if (!snapshot) return undefined;
        return new PanadapterControllerImpl(this, id);
      },
    );
  }

  waterfalls(): WaterfallController[] {
    return Array.from(this.waterfallControllers.values());
  }

  waterfall(id: string): WaterfallController | undefined {
    return this.getOrCreateController(
      "waterfall",
      id,
      this.waterfallControllers,
      () => {
        const snapshot = this.store.getWaterfall(id);
        if (!snapshot) return undefined;
        return new WaterfallControllerImpl(this, id);
      },
    );
  }

  meters(): MeterController[] {
    return Array.from(this.meterControllers.values());
  }

  meter(id: string): MeterController | undefined {
    return this.getOrCreateController(
      "meter",
      id,
      this.meterControllers,
      () => {
        if (!this.store.getMeter(id)) return undefined;
        return new MeterControllerImpl(this, id);
      },
    );
  }

  audioStreams(): Array<
    | AudioStreamController
    | AudioStreamTxController
    | RemoteAudioTxStreamController
  > {
    return Array.from(this.audioControllers.values());
  }

  audioStream(id: string): AudioStreamController | undefined {
    return this.getOrCreateController(
      "audioStream",
      id,
      this.audioControllers,
      () => {
        const stream = this.store.getAudioStream(id);
        if (!stream) return undefined;
        switch (stream.type) {
          case "dax_tx":
            return new AudioStreamTxControllerImpl(this, id);
          case "remote_audio_tx":
            return new RemoteAudioTxStreamControllerImpl(this, id);
          default:
            return new AudioStreamControllerImpl(this, id);
        }
      },
    );
  }

  equalizer(id: EqualizerId): EqualizerController {
    let controller = this.equalizerControllers.get(id);
    if (!controller) {
      controller = new EqualizerControllerImpl(this, id);
      this.equalizerControllers.set(id, controller);
    }
    return controller;
  }

  txBandSettings(): TxBandSettingController[] {
    return Array.from(this.txBandControllers.values());
  }

  txBandSetting(id: string): TxBandSettingController | undefined {
    return this.getOrCreateController(
      "txBandSetting",
      id,
      this.txBandControllers,
      () => {
        if (!this.store.getTxBandSetting(id)) return undefined;
        return new TxBandSettingControllerImpl(this, id);
      },
    );
  }

  xvtrs(): XvtrController[] {
    return Array.from(this.xvtrControllers.values());
  }

  xvtr(id: string): XvtrController | undefined {
    return this.getOrCreateController("xvtr", id, this.xvtrControllers, () => {
      if (!this.store.getXvtr(id)) return undefined;
      return new XvtrControllerImpl(this, id);
    });
  }

  /**
   * Creates a new transverter definition on the radio.
   * Returns the controller for the newly created XVTR.
   */
  async createXvtr(): Promise<XvtrController> {
    const response = await this.command("xvtr create");
    const newId = response.message?.trim() ?? "";
    const controller = this.xvtr(newId);
    if (!controller)
      throw new FlexError(`XVTR ${newId} not available after creation`);
    return controller;
  }

  tnfs(): TnfController[] {
    return Array.from(this.tnfControllers.values());
  }

  tnf(id: string): TnfController | undefined {
    return this.getOrCreateController("tnf", id, this.tnfControllers, () => {
      if (!this.store.getTnf(id)) return undefined;
      return new TnfControllerImpl(this, id);
    });
  }

  /**
   * Creates a new TNF at the given frequency (in MHz).
   * Returns the controller for the newly created TNF.
   */
  async createTnf(frequencyMHz: number): Promise<void> {
    const freq = formatMegahertz(ensureFinite(frequencyMHz, "TNF frequency"));
    await this.command(`tnf create freq=${freq}`);
  }

  memories(): MemoryController[] {
    return Array.from(this.memoryControllers.values());
  }

  memory(id: string): MemoryController | undefined {
    return this.getOrCreateController(
      "memory",
      id,
      this.memoryControllers,
      () => {
        if (!this.store.getMemory(id)) return undefined;
        return new MemoryControllerImpl(this, id);
      },
    );
  }

  spots(): SpotController[] {
    return Array.from(this.spotControllers.values());
  }

  spot(id: string): SpotController | undefined {
    return this.getOrCreateController("spot", id, this.spotControllers, () => {
      if (!this.store.getSpot(id)) return undefined;
      return new SpotControllerImpl(this, id);
    });
  }

  /** Removes all spots from the radio. */
  async clearSpots(): Promise<void> {
    await this.command("spot clear");
  }

  cwx(): CwxController {
    return this._cwxController;
  }

  dvk(): DvkController {
    return this._dvkController;
  }

  apd(): ApdController {
    return this._apdController;
  }

  featureLicense(): FeatureLicenseController {
    return this._featureLicenseController;
  }

  // -----------------------------------------------------------------------
  // Resource creation
  // -----------------------------------------------------------------------

  async createPanadapter(options?: {
    x?: number;
    y?: number;
  }): Promise<PanadapterController> {
    let cmd = "display panafall create";
    if (options?.x !== undefined) cmd += ` x=${toInteger(options.x, "x")}`;
    if (options?.y !== undefined) cmd += ` y=${toInteger(options.y, "y")}`;
    const response = await this.command(cmd);
    const panId = normalizeEntityId(
      response.message?.split(",")[0]?.trim() ?? "",
    );
    const controller = this.panadapter(panId);
    if (!controller) {
      throw new FlexError(`Panadapter ${panId} not available after creation`);
    }
    return controller;
  }

  async createRemoteAudioRxStream(options?: {
    compression?: string;
  }): Promise<AudioStreamController> {
    let cmd = "stream create type=remote_audio_rx";
    if (options?.compression) {
      cmd += ` compression=${options.compression.toUpperCase()}`;
    }
    return this.createAudioStreamController(cmd, AudioStreamControllerImpl);
  }

  async createRemoteAudioTxStream(options?: {
    compression?: string;
  }): Promise<RemoteAudioTxStreamController> {
    let cmd = "stream create type=remote_audio_tx";
    if (options?.compression) {
      cmd += ` compression=${options.compression.toUpperCase()}`;
    }
    return this.createAudioStreamController(
      cmd,
      RemoteAudioTxStreamControllerImpl,
    );
  }

  async createDaxRxAudioStream(options: {
    daxChannel: number;
  }): Promise<AudioStreamController> {
    const channel = toInteger(options.daxChannel, "DAX RX channel");
    return this.createAudioStreamController(
      `stream create type=dax_rx dax_channel=${channel}`,
      AudioStreamControllerImpl,
    );
  }

  async createDaxTxAudioStream(): Promise<AudioStreamTxController> {
    return this.createAudioStreamController(
      "stream create type=dax_tx",
      AudioStreamTxControllerImpl,
    );
  }

  async createDaxMicAudioStream(): Promise<AudioStreamController> {
    return this.createAudioStreamController(
      "stream create type=dax_mic",
      AudioStreamControllerImpl,
    );
  }

  private async createAudioStreamController<
    T extends AudioStreamControllerImpl,
  >(
    cmd: string,
    Ctor: new (session: RadioSession, id: string) => T,
  ): Promise<T> {
    const response = await this.command(cmd);
    const streamId = normalizeEntityId(
      response.message?.split(",")[0]?.trim() ?? "",
    );
    const controller = new Ctor(this, streamId);
    this.audioControllers.set(streamId, controller);
    return controller;
  }

  private getOrCreateController<T>(
    _type: string,
    id: string,
    cache: Map<string, T>,
    create: () => T | undefined,
  ): T | undefined {
    let controller = cache.get(id);
    if (controller) return controller;
    controller = create();
    if (controller) cache.set(id, controller);
    return controller;
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  on<K extends RadioEventKey>(
    event: K,
    handler: (payload: RadioEvents[K]) => void,
  ): Subscription {
    return this.events.on(event, handler);
  }

  once<K extends RadioEventKey>(
    event: K,
    handler: (payload: RadioEvents[K]) => void,
  ): Subscription {
    return this.events.once(event, handler);
  }

  off<K extends RadioEventKey>(
    event: K,
    handler: (payload: RadioEvents[K]) => void,
  ): void {
    this.events.off(event, handler);
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  /**
   * Connect to the radio.
   *
   * Establishes TCP, performs the handshake (await handle, subscribe to
   * status, register as GUI client), then connects UDP.
   */
  async connect(options?: RadioConnectOptions): Promise<void> {
    if (this._connectionState !== "disconnected") return;

    this.defaultCommandTimeoutMs =
      options?.defaultCommandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const pingIntervalMs = options?.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
    const handleTimeoutMs =
      options?.handleTimeoutMs ?? DEFAULT_HANDLE_TIMEOUT_MS;

    this.setConnectionState("connecting");

    try {
      const conn = this.transport.createConnection();
      this.connection = conn;

      // CRITICAL: Attach handlers BEFORE connecting.
      // Data may start flowing before connectTcp resolves.
      this.connectionSubs = [
        conn.on("tcpData", (data) => this.handleTcpData(data)),
        conn.on("udpData", (data) => this.handleUdpData(data)),
        conn.on("close", () => this.handleConnectionClose()),
        conn.on("error", (err) => this.handleConnectionError(err)),
      ];

      // --- TCP ---
      this.emitProgress("tcp", "connecting");
      await conn.connectTcp(this._endpoint);

      // --- Handle ---
      this.emitProgress("handle", "waiting");
      const handle = await this.waitForHandle({ timeoutMs: handleTimeoutMs });
      this.emitProgress("handle", handle);

      // --- Handshake ---
      await this.performHandshake(options?.clientInfo);

      // --- UDP ---
      this.emitProgress("udp", "connecting");
      await conn.connectUdp(this._endpoint);

      // --- Ready ---
      this.setConnectionState("connected");
      this.emitProgress("ready");
      this.events.emit("ready", undefined);
      this.startHeartbeat(pingIntervalMs);
    } catch (error) {
      // Clean up on failure
      this.stopHeartbeat();
      this.rejectAllPending(error);
      this.rejectHandleWaiters(error);
      this.cleanupConnection();
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  /** Disconnect from the radio. */
  async disconnect(): Promise<void> {
    if (
      this._connectionState === "disconnected" ||
      this._connectionState === "disconnecting"
    ) {
      return;
    }

    this.setConnectionState("disconnecting");
    this.stopHeartbeat();
    this.rejectAllPending(new FlexClientClosedError());
    this.rejectHandleWaiters(new FlexClientClosedError());

    const conn = this.connection;
    this.cleanupConnection();

    if (conn) {
      try {
        await conn.close();
      } catch (error) {
        this.logger?.warn?.("Error closing connection", { error });
      }
    }

    this.setConnectionState("disconnected");
    this.events.emit("disconnected", undefined);
  }

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  /**
   * Send a command to the radio and await its reply.
   *
   * Throws {@link FlexCommandRejectedError} if the radio rejects the command.
   * Throws on timeout or if the connection is closed.
   */
  async command(
    command: string,
    options?: RadioCommandOptions,
  ): Promise<RadioCommandResponse> {
    if (
      this._connectionState !== "connecting" &&
      this._connectionState !== "connected"
    ) {
      throw new FlexClientClosedError();
    }
    const conn = this.connection;
    if (!conn) throw new FlexClientClosedError();

    const timeoutMs = options?.timeoutMs ?? this.defaultCommandTimeoutMs;

    let sequence: number;
    if (options?.sequenceHint !== undefined) {
      sequence = options.sequenceHint;
      if (sequence >= this.nextSequence) {
        this.nextSequence = sequence + 1;
      }
    } else {
      sequence = this.nextSequence++;
    }

    if (this.pendingCommands.has(sequence)) {
      throw new Error(`Sequence ${sequence} is already in-flight`);
    }

    const payload = `C${sequence}|${command}${COMMAND_TERMINATOR}`;

    return new Promise<RadioCommandResponse>((resolve, reject) => {
      const timeoutHandle =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pendingCommands.delete(sequence);
              reject(
                new Error(`Command timed out after ${timeoutMs}ms: ${command}`),
              );
            }, timeoutMs)
          : undefined;

      this.pendingCommands.set(sequence, {
        command,
        sequence,
        timeoutHandle,
        resolve: (response) => {
          if (!response.accepted) {
            const codeDescription =
              response.code !== undefined
                ? describeResponseCode(response.code)
                : undefined;
            reject(
              new FlexCommandRejectedError(
                buildCommandErrorMessage(command, response, codeDescription),
                {
                  sequence: response.sequence,
                  raw: response.raw,
                  message: response.message,
                  code: response.code,
                },
                codeDescription,
              ),
            );
            return;
          }
          resolve(response);
        },
        reject,
      });

      conn.sendTcp(payload).catch((error) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.pendingCommands.delete(sequence);
        reject(error);
      });
    });
  }

  // -----------------------------------------------------------------------
  // RadioSession interface (used by controllers)
  // -----------------------------------------------------------------------

  /** @internal */
  getStore(): RadioStateStore {
    return this.store;
  }

  /**
   * Propagate a state change (typically from an optimistic patch).
   * @internal Used by controllers after patching the store directly.
   */
  applyStateChange(change: RadioStateChange): void {
    this.handleStateChange(change);
  }

  private handleStateChange(change: RadioStateChange): void {
    type Identified = Extract<RadioStateChange, { id: string }>;
    switch (change.entity) {
      case "slice":
        this.updateController(
          change as Identified,
          this.sliceControllers,
          () => {
            if (!this.store.getSlice(change.id)) return undefined;
            return new SliceControllerImpl(this, change.id);
          },
        );
        break;
      case "panadapter":
        this.updateController(change as Identified, this.panControllers, () => {
          const snapshot = this.store.getPanadapter(change.id);
          if (!snapshot) return undefined;
          return new PanadapterControllerImpl(this, change.id);
        });
        break;
      case "waterfall":
        this.updateController(
          change as Identified,
          this.waterfallControllers,
          () => {
            const snapshot = this.store.getWaterfall(change.id);
            if (!snapshot) return undefined;
            return new WaterfallControllerImpl(this, change.id);
          },
        );
        break;
      case "meter":
        this.updateController(
          change as Identified,
          this.meterControllers,
          () => {
            if (!this.store.getMeter(change.id)) return undefined;
            return new MeterControllerImpl(this, change.id);
          },
        );
        break;
      case "audioStream":
        this.updateController(
          change as Identified,
          this.audioControllers,
          () => {
            const stream = this.store.getAudioStream(change.id);
            if (!stream) return undefined;
            switch (stream.type) {
              case "dax_tx":
                return new AudioStreamTxControllerImpl(this, change.id);
              case "remote_audio_tx":
                return new RemoteAudioTxStreamControllerImpl(this, change.id);
              default:
                return new AudioStreamControllerImpl(this, change.id);
            }
          },
        );
        break;
      case "txBandSetting":
        this.updateController(
          change as Identified & TxBandSettingStateChange,
          this.txBandControllers,
          () => {
            if (!this.store.getTxBandSetting(change.id)) return undefined;
            return new TxBandSettingControllerImpl(this, change.id);
          },
        );
        break;
      case "equalizer":
        this.updateController(
          change as Identified & EqualizerStateChange,
          this.equalizerControllers,
          () => new EqualizerControllerImpl(this, change.id as EqualizerId),
        );
        break;
      case "xvtr":
        this.updateController(
          change as Extract<RadioStateChange, { id: string }> & XvtrStateChange,
          this.xvtrControllers,
          () => {
            if (!this.store.getXvtr(change.id)) return undefined;
            return new XvtrControllerImpl(this, change.id);
          },
        );
        break;
      case "tnf":
        this.updateController(
          change as Extract<RadioStateChange, { id: string }> & TnfStateChange,
          this.tnfControllers,
          () => {
            if (!this.store.getTnf(change.id)) return undefined;
            return new TnfControllerImpl(this, change.id);
          },
        );
        break;
      case "memory":
        this.updateController(
          change as Extract<RadioStateChange, { id: string }> &
            MemoryStateChange,
          this.memoryControllers,
          () => {
            if (!this.store.getMemory(change.id)) return undefined;
            return new MemoryControllerImpl(this, change.id);
          },
        );
        break;
      case "spot":
        this.updateController(
          change as Extract<RadioStateChange, { id: string }> & SpotStateChange,
          this.spotControllers,
          () => {
            if (!this.store.getSpot(change.id)) return undefined;
            return new SpotControllerImpl(this, change.id);
          },
        );
        break;
      case "cwx":
        this._cwxController.onStateChange(change as CwxStateChange);
        break;
      case "dvk":
        this._dvkController.onStateChange(change as DvkStateChange);
        break;
      case "apd":
        this._apdController.onStateChange(change as ApdStateChange);
        break;
    }
    this.events.emit("change", change);
  }

  private updateController<
    TChange extends Extract<RadioStateChange, { id: string }>,
    TController extends { onStateChange(change: TChange): void },
  >(
    change: TChange,
    cache: Map<string, TController>,
    create: () => TController | undefined,
  ): void {
    const existing = cache.get(change.id);
    if (existing) {
      existing.onStateChange(change);
      if (change.removed) {
        cache.delete(change.id);
      }
      return;
    }
    const controller = create();
    if (controller) {
      cache.set(change.id, controller);
    }
  }

  /**
   * Update the radio's identity and descriptor from a discovery packet.
   * @internal Called by FlexClient when discovery data arrives.
   */
  updateFromDescriptor(descriptor: FlexRadioDescriptor): void {
    this._descriptor = descriptor;
    if (descriptor.serial) this._serial = descriptor.serial;
    if (descriptor.host && descriptor.port) {
      this._endpoint = { host: descriptor.host, port: descriptor.port };
    }
  }

  /**
   * Register a handler for VITA packets matching a specific stream ID.
   * @internal Used by controllers for lazy data pipelines.
   */
  registerStreamHandler(
    streamId: number,
    handler: StreamPacketHandler,
  ): Subscription {
    let bucket = this.streamHandlers.get(streamId);
    if (!bucket) {
      bucket = new Set();
      this.streamHandlers.set(streamId, bucket);
    }
    bucket.add(handler);
    return {
      unsubscribe: () => {
        bucket.delete(handler);
        if (bucket.size === 0) {
          this.streamHandlers.delete(streamId);
        }
      },
    };
  }

  /**
   * Register a handler for a specific meter's value updates.
   * @internal Used by MeterController for lazy data pipelines.
   */
  /**
   * Send a binary payload over the UDP data channel.
   * Used for TX audio (DAX TX, remote audio TX) and other outbound VITA packets.
   */
  async sendUdp(data: Uint8Array): Promise<void> {
    const conn = this.connection;
    if (!conn) throw new FlexClientClosedError();
    return conn.sendUdp(data);
  }

  registerMeterHandler(
    meterId: number,
    handler: MeterValueHandler,
  ): Subscription {
    let bucket = this.meterHandlers.get(meterId);
    if (!bucket) {
      bucket = new Set();
      this.meterHandlers.set(meterId, bucket);
    }
    bucket.add(handler);
    return {
      unsubscribe: () => {
        bucket.delete(handler);
        if (bucket.size === 0) {
          this.meterHandlers.delete(meterId);
        }
      },
    };
  }

  // -----------------------------------------------------------------------
  // Descriptor updates (used by FlexClient for discovery)
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Radio-level setters (merged from RadioControllerImpl)
  // -----------------------------------------------------------------------

  private patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): void {
    const change = this.store.patchRadio(attributes, context);
    if (change) this.events.emit("change", change);
  }

  private radioSnapshot(): RadioSnapshot | undefined {
    return this.store.getRadio();
  }

  private async commandAndPatch(
    command: string,
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): Promise<void> {
    this.patchRadio(attributes, context);
    try {
      await this.command(command);
    } catch (error) {
      try {
        await this.refreshInfo();
      } catch {
        // ignore refresh failures; original rejection is what matters
      }
      throw error;
    }
  }

  private async sendTransmitEntries(
    entries: Record<string, string>,
  ): Promise<void> {
    const segments = Object.entries(entries).map(
      ([entryKey, entryValue]) => `${entryKey}=${entryValue}`,
    );
    if (segments.length === 0) return;
    await this.commandAndPatch(`transmit set ${segments.join(" ")}`, entries, {
      source: "transmit",
    });
  }

  private async setTransmitBoolean(
    key: string,
    enabled: boolean,
  ): Promise<void> {
    await this.sendTransmitEntries({
      [key]: formatBooleanFlag(enabled),
    });
  }

  private async setTransmitInteger(
    key: string,
    value: number,
    min: number,
    max: number,
    label: string,
  ): Promise<void> {
    const clamped = clampInteger(value, min, max, label);
    await this.sendTransmitEntries({
      [key]: clamped.toString(10),
    });
  }

  private async setInterlockBoolean(
    key: string,
    enabled: boolean,
  ): Promise<void> {
    await this.sendInterlockValue(key, formatBooleanFlag(enabled));
  }

  private async setInterlockInteger(
    key: string,
    value: number,
    min: number,
    max: number,
    label: string,
  ): Promise<void> {
    const clamped = clampInteger(value, min, max, label);
    await this.sendInterlockValue(key, clamped.toString(10));
  }

  private async sendInterlockValue(key: string, value: string): Promise<void> {
    await this.commandAndPatch(
      `interlock ${key}=${value}`,
      { [key]: value },
      { source: "interlock" },
    );
  }

  private async loadProfileSelection(
    domain: ProfileLoadDomain,
    name: string,
  ): Promise<void> {
    const prepared = prepareProfileNameInput(name);
    await this.commandAndPatch(
      `profile ${domain} load ${prepared.encoded}`,
      { current: prepared.normalized },
      { source: "profile", identifier: domain },
    );
  }

  private async sendProfileCommand(
    command: string,
    name: string,
  ): Promise<void> {
    const { encoded } = prepareProfileNameInput(name);
    await this.command(`${command} ${encoded}`);
  }

  async refreshInfo(): Promise<void> {
    const response = await this.command("info");
    const message = response.message;
    if (!message) {
      throw new FlexError("Flex radio returned no info data");
    }
    const attributes = parseRadioInfoReply(message);
    if (Object.keys(attributes).length === 0) {
      throw new FlexError("Flex radio returned an unrecognized info payload");
    }
    this.patchRadio(attributes, { source: "info" });
  }

  async refreshVersions(): Promise<void> {
    const response = await this.command("version");
    const message = response.message;
    if (!message) {
      throw new FlexError("Flex radio returned no version data");
    }
    const attributes = parseRadioVersionReply(message);
    if (Object.keys(attributes).length === 0) {
      throw new FlexError(
        "Flex radio returned an unrecognized version payload",
      );
    }
    this.patchRadio(attributes, { source: "version" });
  }

  async refreshRxAntennaList(): Promise<void> {
    const response = await this.command("ant list");
    const attributes = buildRadioListAttributes(
      "rx_ant_list",
      response.message,
    );
    this.patchRadio(attributes);
  }

  async refreshMicList(): Promise<void> {
    const response = await this.command("mic list");
    const attributes = buildRadioListAttributes("mic_list", response.message);
    this.patchRadio(attributes);
  }

  async refreshProfileLists(): Promise<void> {
    await Promise.all([
      this.command("profile global info"),
      this.command("profile tx info"),
      this.command("profile mic info"),
      this.command("profile display info"),
    ]);
  }

  async setClientStationName(stationName: string): Promise<void> {
    const sanitized = sanitizeClientStationName(stationName);
    const encoded = sanitized.replace(/ /g, "\u007f");
    await this.command(`client station ${encoded}`);
  }

  async bindGuiClient(clientId: string): Promise<void> {
    const trimmed = clientId.trim();
    if (!trimmed) {
      throw new FlexError("GUI client id cannot be empty");
    }
    await this.command(`client bind client_id=${trimmed}`);
  }

  async requestSlice(
    options: RadioRequestSliceOptions = {},
  ): Promise<SliceController> {
    let command = "slice create";

    const panadapterStreamId = options.panadapterStreamId?.trim();
    if (panadapterStreamId) {
      command += ` pan=${normalizeSliceCreatePanStreamId(panadapterStreamId)}`;
    }

    if (options.frequencyMHz !== undefined) {
      const frequency = ensureFinite(options.frequencyMHz, "slice frequency");
      if (frequency !== 0) {
        command += ` freq=${frequency.toFixed(6)}`;
      }
    }

    const rxAntenna = options.rxAntenna?.trim();
    if (rxAntenna) {
      command += ` rxant=${rxAntenna}`;
    }

    const demodMode = options.demodMode?.trim();
    if (demodMode) {
      command += ` mode=${demodMode}`;
    }

    if (options.loadPersistence) {
      command += " load_from=PERSISTENCE";
    }

    const response = await this.command(command);
    console.log(response);
    const newId = response.message?.trim() ?? "";
    const controller = this.slice(newId);
    if (!controller)
      throw new FlexError(`Slice ${newId} not available after creation`);
    return controller;
  }

  async setNickname(nickname: string): Promise<void> {
    const sanitized = sanitizeNickname(nickname);
    await this.commandAndPatch(`radio name ${sanitized}`, {
      nickname: sanitized,
    });
  }

  async setCallsign(callsign: string): Promise<void> {
    const sanitized = sanitizeCallsign(callsign);
    await this.commandAndPatch(`radio callsign ${sanitized}`, {
      callsign: sanitized,
    });
  }

  async setFullDuplexEnabled(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set full_duplex_enabled=${formatBooleanFlag(enabled)}`,
      { full_duplex_enabled: formatBooleanFlag(enabled) },
    );
  }

  async setEnforcePrivateIpConnections(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set enforce_private_ip_connections=${formatBooleanFlag(enabled)}`,
      { enforce_private_ip_connections: formatBooleanFlag(enabled) },
    );
  }

  async setNetworkMtu(value: number): Promise<void> {
    const mtu = toInteger(value, "network MTU");
    const encodedMtu = mtu.toString(10);
    await this.commandAndPatch(
      `client set enforce_network_mtu=1 network_mtu=${encodedMtu}`,
      { network_mtu: encodedMtu },
    );
  }

  async setLowLatencyDigitalModes(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set low_latency_digital_modes=${formatBooleanFlag(enabled)}`,
      { low_latency_digital_modes: formatBooleanFlag(enabled) },
    );
  }

  async setMfEnabled(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set mf_enable=${formatBooleanFlag(enabled)}`,
      { mf_enable: formatBooleanFlag(enabled) },
    );
  }

  async setProfileAutoSave(enabled: boolean): Promise<void> {
    await this.commandAndPatch(`profile autosave ${enabled ? "on" : "off"}`, {
      auto_save: formatBooleanFlag(enabled),
    });
  }

  async setAtuMemoriesEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `atu set memories_enabled=${encoded}`,
      { memories_enabled: encoded },
      { source: "atu" },
    );
  }

  async startAtuTune(): Promise<void> {
    await this.command("atu start");
  }

  async bypassAtu(): Promise<void> {
    await this.command("atu bypass");
  }

  async clearAtuMemories(): Promise<void> {
    await this.command("atu clear");
  }

  async setLineoutGain(gain: number): Promise<void> {
    const clamped = clampInteger(gain, 0, 100);
    await this.commandAndPatch(`mixer lineout gain ${clamped}`, {
      lineout_gain: clamped.toString(10),
    });
  }

  async setLineoutMute(muted: boolean): Promise<void> {
    const encoded = formatBooleanFlag(muted);
    await this.commandAndPatch(`mixer lineout mute ${encoded}`, {
      lineout_mute: encoded,
    });
  }

  async setHeadphoneGain(gain: number): Promise<void> {
    const clamped = clampInteger(gain, 0, 100);
    await this.commandAndPatch(`mixer headphone gain ${clamped}`, {
      headphone_gain: clamped.toString(10),
    });
  }

  async setHeadphoneMute(muted: boolean): Promise<void> {
    const encoded = formatBooleanFlag(muted);
    await this.commandAndPatch(`mixer headphone mute ${encoded}`, {
      headphone_mute: encoded,
    });
  }

  async setBacklightLevel(level: number): Promise<void> {
    const clamped = clampInteger(level, 0, 100);
    await this.commandAndPatch(`radio backlight ${clamped}`, {
      backlight: clamped.toString(10),
    });
  }

  async setRemoteOnEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(`radio set remote_on_enabled=${encoded}`, {
      remote_on_enabled: encoded,
    });
  }

  async setMox(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `xmit ${encoded}`,
      { mox: encoded },
      { source: "interlock" },
    );
  }

  async setTxTune(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `transmit tune ${encoded}`,
      { tune: encoded },
      { source: "transmit" },
    );
  }

  async setTuneMode(mode: "single_tone" | "two_tone"): Promise<void> {
    const normalized = mode === "two_tone" ? "two_tone" : "single_tone";
    await this.commandAndPatch(
      `transmit set tune_mode=${normalized}`,
      { tune_mode: normalized },
      { source: "transmit" },
    );
  }

  async setInterlockTimeoutMs(timeoutMs: number): Promise<void> {
    await this.setInterlockInteger(
      "timeout",
      timeoutMs,
      0,
      600_000,
      "Interlock timeout",
    );
  }

  async setTxDelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger("tx_delay", delayMs, 0, 60_000, "TX delay");
  }

  async setTxReqRcaEnabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("rca_txreq_enable", enabled);
  }

  async setTxReqAccEnabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("acc_txreq_enable", enabled);
  }

  async setTxReqRcaPolarityHigh(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("rca_txreq_polarity", enabled);
  }

  async setTxReqAccPolarityHigh(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("acc_txreq_polarity", enabled);
  }

  async setTx1Enabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("tx1_enabled", enabled);
  }

  async setTx2Enabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("tx2_enabled", enabled);
  }

  async setTx3Enabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("tx3_enabled", enabled);
  }

  async setAccTxEnabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("acc_tx_enabled", enabled);
  }

  async setTx1DelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger("tx1_delay", delayMs, 0, 6_000, "TX1 delay");
  }

  async setTx2DelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger("tx2_delay", delayMs, 0, 6_000, "TX2 delay");
  }

  async setTx3DelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger("tx3_delay", delayMs, 0, 6_000, "TX3 delay");
  }

  async setAccTxDelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger(
      "acc_tx_delay",
      delayMs,
      0,
      6_000,
      "ACC TX delay",
    );
  }

  async setMaxPowerLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "max_power_level",
      level,
      0,
      100,
      "max power level",
    );
  }

  async setRfPower(level: number): Promise<void> {
    await this.setTransmitInteger("rfpower", level, 0, 100, "RF power");
  }

  async setTunePower(level: number): Promise<void> {
    await this.setTransmitInteger("tunepower", level, 0, 100, "Tune power");
  }

  async setTxFilter(lowHz: number, highHz: number): Promise<void> {
    const low = clampInteger(lowHz, 0, 10_000, "TX filter low");
    let high = clampInteger(highHz, 0, 10_000, "TX filter high");
    const minimumHigh = low + 50;
    if (high < minimumHigh) high = minimumHigh;
    if (high > 10_000) {
      high = 10_000;
      if (high < minimumHigh) {
        const adjustedLow = Math.max(0, high - 50);
        await this.setTxFilter(adjustedLow, high);
        return;
      }
    }
    await this.commandAndPatch(
      `transmit set filter_low=${low} filter_high=${high}`,
      {
        filter_low: low.toString(10),
        filter_high: high.toString(10),
      },
      { source: "transmit" },
    );
  }

  async setTxFilterLowHz(lowHz: number): Promise<void> {
    const currentHigh = this.radioSnapshot()?.txFilterHighHz ?? 10_000;
    await this.setTxFilter(lowHz, currentHigh);
  }

  async setTxFilterHighHz(highHz: number): Promise<void> {
    const currentLow = this.radioSnapshot()?.txFilterLowHz ?? 0;
    await this.setTxFilter(currentLow, highHz);
  }

  async setAmCarrierLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "am_carrier",
      level,
      0,
      100,
      "AM carrier level",
    );
  }

  async setMicSelection(selection: string): Promise<void> {
    const trimmed = selection.trim();
    if (!trimmed) {
      throw new FlexError("Mic selection cannot be empty");
    }
    const normalized = trimmed.toUpperCase();
    await this.commandAndPatch(
      `mic input ${normalized}`,
      {
        mic_selection: normalized,
      },
      { source: "transmit" },
    );
  }

  async setMicLevel(level: number): Promise<void> {
    await this.setTransmitInteger("miclevel", level, 0, 100, "Mic level");
  }

  async setMicBoost(enabled: boolean): Promise<void> {
    const normalized = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `mic boost ${normalized}`,
      { mic_boost: normalized },
      { source: "transmit" },
    );
  }

  async setHwAlcEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("hwalc_enabled", enabled);
  }

  async setTxInhibit(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("inhibit", enabled);
  }

  async setMicBias(enabled: boolean): Promise<void> {
    const normalized = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `mic bias ${normalized}`,
      { mic_bias: normalized },
      { source: "transmit" },
    );
  }

  async setMicAccessoryEnabled(enabled: boolean): Promise<void> {
    const normalized = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `mic acc ${normalized}`,
      { mic_acc: normalized },
      { source: "transmit" },
    );
  }

  async setDaxEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("dax", enabled);
  }

  async setCompanderEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("compander", enabled);
  }

  async setCompanderLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "compander_level",
      level,
      0,
      100,
      "Compander level",
    );
  }

  async setSpeechProcessorEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("speech_processor_enable", enabled);
  }

  async setSpeechProcessorLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "speech_processor_level",
      level,
      0,
      100,
      "Speech processor level",
    );
  }

  async setVoxEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("vox_enable", enabled);
  }

  async setVoxLevel(level: number): Promise<void> {
    await this.setTransmitInteger("vox_level", level, 0, 100, "VOX level");
  }

  async setVoxDelay(delay: number): Promise<void> {
    await this.setTransmitInteger("vox_delay", delay, 0, 100, "VOX delay");
  }

  async setTxMonitorEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `transmit set mon=${encoded}`,
      { sb_monitor: encoded },
      { source: "transmit" },
    );
  }

  async setTxCwMonitorGain(gain: number): Promise<void> {
    await this.setTransmitInteger(
      "mon_gain_cw",
      gain,
      0,
      100,
      "CW monitor gain",
    );
  }

  async setTxSbMonitorGain(gain: number): Promise<void> {
    await this.setTransmitInteger(
      "mon_gain_sb",
      gain,
      0,
      100,
      "SSB monitor gain",
    );
  }

  async setTxCwMonitorPan(pan: number): Promise<void> {
    await this.setTransmitInteger("mon_pan_cw", pan, 0, 100, "CW monitor pan");
  }

  async setTxSbMonitorPan(pan: number): Promise<void> {
    await this.setTransmitInteger("mon_pan_sb", pan, 0, 100, "SSB monitor pan");
  }

  async setShowTxInWaterfall(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("show_tx_in_waterfall", enabled);
  }

  async setTxRawIqEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("raw_iq_enable", enabled);
  }

  async setMeterInRxEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("met_in_rx", enabled);
  }

  async setTnfEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(`radio set tnf_enabled=${encoded}`, {
      tnf_enabled: encoded,
    });
  }

  async setBinauralRx(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(`radio set binaural_rx=${encoded}`, {
      binaural_rx: encoded,
    });
  }

  async setMuteLocalAudioWhenRemote(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `radio set mute_local_audio_when_remote=${encoded}`,
      { mute_local_audio_when_remote: encoded },
    );
  }

  async setRttyMarkDefaultHz(value: number): Promise<void> {
    const rounded = toInteger(value, "RTTY mark");
    await this.commandAndPatch(`radio set rtty_mark_default=${rounded}`, {
      rtty_mark_default: rounded.toString(10),
    });
  }

  async setFrequencyErrorPpb(value: number): Promise<void> {
    const rounded = toInteger(value, "frequency error");
    await this.commandAndPatch(`radio set freq_error_ppb=${rounded}`, {
      freq_error_ppb: rounded.toString(10),
    });
  }

  async setCalibrationFrequencyMhz(value: number): Promise<void> {
    const normalized = ensureFinite(value, "calibration frequency");
    const formatted = normalized.toFixed(6);
    await this.commandAndPatch(`radio set cal_freq=${formatted}`, {
      cal_freq: formatted,
    });
  }

  async startOffsetCalibration(): Promise<void> {
    if (!this.pllDone) return;
    await this.commandAndPatch("radio pll_start", {
      pll_done: "0",
    });
  }

  async setCwPitchHz(value: number): Promise<void> {
    const clamped = clampInteger(value, 100, 6_000, "CW pitch");
    await this.commandAndPatch(
      `cw pitch ${clamped}`,
      { pitch: clamped.toString(10) },
      { source: "transmit" },
    );
  }

  async setCwSpeedWpm(value: number): Promise<void> {
    const clamped = clampInteger(value, 5, 100, "CW speed");
    await this.commandAndPatch(
      `cw wpm ${clamped}`,
      { speed: clamped.toString(10) },
      { source: "transmit" },
    );
  }

  async setSyncCwx(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `cw synccwx ${encoded}`,
      { synccwx: encoded },
      { source: "transmit" },
    );
  }

  async setCwIambic(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `cw iambic ${encoded}`,
      { iambic: encoded },
      { source: "transmit" },
    );
  }

  async setCwIambicMode(mode: RadioCwIambicMode): Promise<void> {
    const encoded = encodeCwIambicMode(mode);
    await this.commandAndPatch(
      `cw mode ${encoded}`,
      { iambic_mode: encoded.toString(10) },
      { source: "transmit" },
    );
  }

  async setCwSwapPaddles(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `cw swap ${encoded}`,
      { swap_paddles: encoded },
      { source: "transmit" },
    );
  }

  async setCwBreakIn(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `cw break_in ${encoded}`,
      { break_in: encoded },
      { source: "transmit" },
    );
  }

  async setCwSidetone(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `cw sidetone ${encoded}`,
      { sidetone: encoded },
      { source: "transmit" },
    );
  }

  async setCwLeftEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `cw cwl_enabled ${encoded}`,
      { cwl_enabled: encoded },
      { source: "transmit" },
    );
  }

  async setCwBreakInDelayMs(delayMs: number): Promise<void> {
    const clamped = clampInteger(delayMs, 0, 2_000, "CW break-in delay");
    await this.commandAndPatch(
      `cw break_in_delay ${clamped}`,
      { break_in_delay: clamped.toString(10) },
      { source: "transmit" },
    );
  }

  async setFilterSharpnessLevel(
    mode: RadioFilterSharpnessMode,
    level: number,
  ): Promise<void> {
    const normalizedMode = mode;
    const clamped = clampInteger(
      level,
      FILTER_SHARPNESS_MIN_LEVEL,
      FILTER_SHARPNESS_MAX_LEVEL,
    );
    const encodedLevel = clamped.toString(10);
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "filter_sharpness",
      positional: [normalizedMode.toUpperCase()] as readonly string[],
    };
    await this.commandAndPatch(
      `radio filter_sharpness ${normalizedMode} level=${encodedLevel}`,
      { level: encodedLevel },
      context,
    );
  }

  async setFilterSharpnessAutoLevel(
    mode: RadioFilterSharpnessMode,
    enabled: boolean,
  ): Promise<void> {
    const normalizedMode = mode;
    const encoded = formatBooleanFlag(enabled);
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "filter_sharpness",
      positional: [normalizedMode.toUpperCase()] as readonly string[],
    };
    await this.commandAndPatch(
      `radio filter_sharpness ${normalizedMode} auto_level=${encoded}`,
      { auto_level: encoded },
      context,
    );
  }

  async setStaticNetworkParams(params: {
    ip: string;
    gateway: string;
    netmask: string;
  }): Promise<void> {
    const payload = {
      ip: params.ip.trim(),
      gateway: params.gateway.trim(),
      netmask: params.netmask.trim(),
    };
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "static_net_params",
    };
    await this.commandAndPatch(
      `radio static_net_params ip=${payload.ip} gateway=${payload.gateway} netmask=${payload.netmask}`,
      payload,
      context,
    );
  }

  async resetStaticNetworkParams(): Promise<void> {
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "static_net_params",
    };
    await this.commandAndPatch(
      "radio static_net_params reset",
      { ip: "", gateway: "", netmask: "" },
      context,
    );
  }

  async setOscillatorSetting(setting: RadioOscillatorSetting): Promise<void> {
    const normalized = setting.toLowerCase() as RadioOscillatorSetting;
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "oscillator",
    };
    await this.commandAndPatch(
      `radio oscillator ${normalized}`,
      { setting: normalized },
      context,
    );
  }

  async setLogModuleLevel(module: string, level: string): Promise<void> {
    const moduleName = normalizeLogModuleName(module);
    const moduleLevel = normalizeLogLevel(level);
    await this.commandAndPatch(
      `log module=${moduleName} level=${moduleLevel}`,
      { module: moduleName, level: moduleLevel },
      { source: "log", identifier: moduleName },
    );
  }

  async loadMicProfile(name: string): Promise<void> {
    await this.loadProfileSelection("mic", name);
  }

  async loadTxProfile(name: string): Promise<void> {
    await this.loadProfileSelection("tx", name);
  }

  async loadDisplayProfile(name: string): Promise<void> {
    await this.loadProfileSelection("display", name);
  }

  async loadGlobalProfile(name: string): Promise<void> {
    await this.loadProfileSelection("global", name);
  }

  async createTxProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile transmit create", name);
  }

  async resetTxProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile transmit reset", name);
  }

  async deleteTxProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile transmit delete", name);
  }

  async createMicProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile mic create", name);
  }

  async resetMicProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile mic reset", name);
  }

  async deleteMicProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile mic delete", name);
  }

  async saveGlobalProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile global save", name);
  }

  async deleteGlobalProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile global delete", name);
  }

  // -----------------------------------------------------------------------
  // TCP data handling
  // -----------------------------------------------------------------------

  private handleTcpData(data: string | Uint8Array): void {
    let chunk: string;
    if (typeof data === "string") {
      chunk = data;
    } else {
      if (!this.decoder) this.decoder = new TextDecoder();
      chunk = this.decoder.decode(data, { stream: true });
    }

    if (!chunk) return;
    this.tcpBuffer += chunk;

    while (true) {
      const newlineIndex = this.tcpBuffer.indexOf("\n");
      if (newlineIndex === -1) break;
      const line = this.tcpBuffer.slice(0, newlineIndex).replace(/\r$/, "");
      this.tcpBuffer = this.tcpBuffer.slice(newlineIndex + 1);
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (!line) return;

    // Handle/version prefixed lines arrive before regular protocol messages
    const prefix = line[0];
    if (prefix === "H") {
      const handle = line.slice(1).trim();
      if (handle) this.assignClientHandle(handle);
      return;
    }
    if (prefix === "V") {
      const version = line.slice(1).trim();
      if (version) {
        this.logger?.info?.("Flex radio version", { version });
      }
      return;
    }

    // Parse as a protocol message
    const parsed = parseFlexMessage(line, Date.now());
    if (!parsed) return;

    this.events.emit("message", parsed);

    switch (parsed.kind) {
      case "status":
        this.events.emit("status", parsed);
        for (const change of this.store.apply(parsed)) {
          this.handleStateChange(change);
        }
        this.handleSpotTriggered(parsed);
        break;
      case "reply":
        this.events.emit("reply", parsed);
        this.handleReply(parsed);
        break;
      case "notice":
        this.events.emit("notice", parsed);
        break;
    }
  }

  private handleSpotTriggered(message: FlexStatusMessage): void {
    if (message.source !== "spot" || !message.positional.includes("triggered"))
      return;
    const id = message.identifier;
    if (!id) return;

    const panadapterStreamId = message.attributes["pan"];
    const event: SpotTriggeredEvent = { spotId: id, panadapterStreamId };

    // Emit on the individual spot controller if it exists
    this.spotControllers.get(id)?.onTriggered(panadapterStreamId);

    // Emit on the radio for global listeners
    this.events.emit("spotTriggered", event);
  }

  private handleReply(reply: FlexReplyMessage): void {
    const entry = this.pendingCommands.get(reply.sequence);
    if (!entry) {
      if (reply.sequence !== 0) {
        this.logger?.warn?.("Received reply for unknown sequence", {
          sequence: reply.sequence,
          reply: reply.raw,
        });
      }
      return;
    }
    this.pendingCommands.delete(reply.sequence);
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);

    const accepted = reply.level === "success" || reply.level === "info";
    entry.resolve({
      sequence: reply.sequence,
      accepted,
      code: reply.code,
      level: reply.level,
      message: reply.message,
      raw: reply.raw,
    });
  }

  // -----------------------------------------------------------------------
  // UDP data handling
  // -----------------------------------------------------------------------

  private handleUdpData(data: Uint8Array): void {
    const parsed = parseVitaPacket(data);
    if (!parsed) {
      this.logger?.warn?.("Unhandled UDP packet", {
        payloadLength: data.byteLength,
      });
      return;
    }

    if (parsed.kind === "meter") {
      // Meter packets carry multiple meter IDs per packet.
      // Dispatch individual values to registered meter handlers.
      const meterPacket = parsed.packet;
      const count = meterPacket.numMeters;
      for (let i = 0; i < count; i++) {
        const meterId = meterPacket.ids[i];
        const handlers = this.meterHandlers.get(meterId);
        if (handlers) {
          for (const handler of handlers) {
            handler(meterId, meterPacket.values[i]);
          }
        }
      }
      return;
    }

    // All other stream types: route by VITA stream ID.
    const handlers = this.streamHandlers.get(parsed.streamId);
    if (handlers) {
      for (const handler of handlers) {
        handler(parsed);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Handle waiting
  // -----------------------------------------------------------------------

  private waitForHandle(options?: { timeoutMs?: number }): Promise<string> {
    if (this._clientHandle) return Promise.resolve(this._clientHandle);

    return new Promise<string>((resolve, reject) => {
      const waiter = {
        resolve: (handle: string) => {
          if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
          resolve(handle);
        },
        reject: (reason: unknown) => {
          if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
          reject(reason);
        },
        timeoutHandle: undefined as ReturnType<typeof setTimeout> | undefined,
      };

      const timeoutMs = options?.timeoutMs ?? DEFAULT_HANDLE_TIMEOUT_MS;
      if (timeoutMs > 0) {
        waiter.timeoutHandle = setTimeout(() => {
          this.removeHandleWaiter(waiter);
          reject(
            new Error(`Timed out waiting for Flex handle after ${timeoutMs}ms`),
          );
        }, timeoutMs);
      }

      this.handleWaiters.push(waiter);
    });
  }

  private assignClientHandle(handle: string): void {
    if (!handle || this._clientHandle === handle) return;
    this._clientHandle = handle;
    const clientChanges = this.store.setLocalClientHandle(handle);
    for (const change of clientChanges) {
      this.events.emit("change", change);
    }
    this.resolveHandleWaiters(handle);
  }

  private removeHandleWaiter(
    waiter: (typeof this.handleWaiters)[number],
  ): void {
    const index = this.handleWaiters.indexOf(waiter);
    if (index >= 0) this.handleWaiters.splice(index, 1);
  }

  private resolveHandleWaiters(handle: string): void {
    if (!this.handleWaiters.length) return;
    const waiters = this.handleWaiters.splice(0);
    for (const waiter of waiters) {
      if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
      try {
        waiter.resolve(handle);
      } catch {
        // swallow
      }
    }
  }

  private rejectHandleWaiters(reason: unknown): void {
    if (!this.handleWaiters.length) return;
    const waiters = this.handleWaiters.splice(0);
    for (const waiter of waiters) {
      if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
      try {
        waiter.reject(reason);
      } catch {
        // swallow
      }
    }
  }

  // -----------------------------------------------------------------------
  // Handshake
  // -----------------------------------------------------------------------

  private async performHandshake(clientInfo?: RadioClientInfo): Promise<void> {
    const info = clientInfo ?? {};

    // Announce program name
    const programName = info.program?.trim();
    if (programName) {
      // fire-and-forget, don't await
      this.command(`client program ${programName}`).catch(() => {});
    }

    // Refresh radio info — these methods parse the replies and patch the store
    this.emitProgress("sync", "radio-info");
    await Promise.all([
      this.refreshInfo(),
      this.refreshVersions(),
      this.refreshRxAntennaList(),
      this.refreshMicList(),
    ]);

    // Subscribe to status updates
    this.emitProgress("sync", "subscriptions");
    await Promise.all(
      DEFAULT_HANDSHAKE_COMMANDS.map((cmd) =>
        this.command(cmd).catch(() => {}),
      ),
    );

    // Configure network
    this.emitProgress("sync", "network");
    await this.command("client set send_reduced_bw_dax=1").catch(() => {});

    // Register as GUI client
    const isGui = info.isGui !== false; // default true
    if (isGui) {
      const guiClientId = info.guiClientId;
      const response = await this.command(
        guiClientId ? `client gui ${guiClientId}` : "client gui",
      );
      this._clientId = response.message?.trim() ?? null;
    } else if (info.boundClientId) {
      await this.command(`client bind_gui_client ${info.boundClientId}`);
    }

    const stationName = info.station;
    if (stationName) {
      await this.command(`client station ${stationName}`).catch(() => {});
    }

    this.emitProgress("sync", "complete");
  }

  // -----------------------------------------------------------------------
  // Heartbeat
  // -----------------------------------------------------------------------

  private startHeartbeat(intervalMs?: number | null): void {
    if (this.heartbeatTimer || !intervalMs || intervalMs <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      this.command("ping").catch((error) => {
        this.logger?.warn?.("Flex ping failed", { error });
      });
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  // -----------------------------------------------------------------------
  // Connection event handlers
  // -----------------------------------------------------------------------

  private handleConnectionClose(): void {
    if (
      this._connectionState === "disconnected" ||
      this._connectionState === "disconnecting"
    ) {
      return;
    }
    // Unexpected close
    this.stopHeartbeat();
    this.rejectAllPending(new FlexClientClosedError());
    this.rejectHandleWaiters(new FlexClientClosedError());
    this.cleanupConnection();
    this.setConnectionState("disconnected");
    this.events.emit("disconnected", undefined);
  }

  private handleConnectionError(error: unknown): void {
    this.events.emit("error", error);
  }

  // -----------------------------------------------------------------------
  // Cleanup helpers
  // -----------------------------------------------------------------------

  private rejectAllPending(reason: unknown): void {
    for (const entry of this.pendingCommands.values()) {
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      try {
        entry.reject(reason);
      } catch {
        // swallow
      }
    }
    this.pendingCommands.clear();
  }

  private cleanupConnection(): void {
    for (const sub of this.connectionSubs) sub.unsubscribe();
    this.connectionSubs = [];
    this.connection = undefined;
    this._clientHandle = null;
    this._clientId = null;
    this.tcpBuffer = "";
    this.decoder = undefined;
    this.nextSequence = 1;
    this.store.reset();
    this.streamHandlers.clear();
    this.meterHandlers.clear();
    this.sliceControllers.clear();
    this.panControllers.clear();
    this.waterfallControllers.clear();
    this.meterControllers.clear();
    this.audioControllers.clear();
    this.equalizerControllers.clear();
    this.txBandControllers.clear();
    this.xvtrControllers.clear();
    this.tnfControllers.clear();
    this.memoryControllers.clear();
    this.spotControllers.clear();
  }

  private setConnectionState(state: RadioConnectionState): void {
    if (this._connectionState === state) return;
    this._connectionState = state;
    this.events.emit("connectionStateChange", state);
  }

  private emitProgress(stage: ConnectionProgressStage, detail?: string): void {
    this.events.emit("connectingProgress", { stage, detail });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCommandErrorMessage(
  command: string,
  response: RadioCommandResponse,
  codeDescription?: string,
): string {
  const parts: string[] = ["Flex command rejected", `command=${command}`];
  if (response.code !== undefined) {
    parts.push(`code=${response.code.toString(16)}`);
  }
  if (codeDescription) {
    parts.push(`reason=${codeDescription}`);
  }
  if (response.message) {
    parts.push(`radio="${response.message}"`);
  }
  return parts.join(" | ");
}

function normalizeEntityId(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  const withoutPrefix =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed.slice(2)
      : trimmed;
  const upper = withoutPrefix.toUpperCase();
  const padded = upper.padStart(8, "0");
  return `0x${padded}`;
}
