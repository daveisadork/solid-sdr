import type {
  FlexClientAdapters,
  FlexCommandOptions,
  FlexCommandResponse,
  FlexControlChannel,
  FlexRadioDescriptor,
  Logger,
} from "./adapters.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import type {
  FlexWireMessage,
  FlexStatusMessage,
  FlexReplyMessage,
  FlexNoticeMessage,
} from "./protocol.js";
import type { RfGainInfo } from "./rf-gain.js";
import {
  createRadioStateStore,
  type RadioStateStore,
  type RadioStateSnapshot,
  type RadioStateChange,
  type SliceSnapshot,
  type PanadapterSnapshot,
  type WaterfallSnapshot,
  type MeterSnapshot,
  type AudioStreamSnapshot,
  type RadioSnapshot,
  type RadioStatusContext,
  type FeatureLicenseSnapshot,
  type GuiClientSnapshot,
} from "./state/index.js";
import {
  FlexClientClosedError,
  FlexCommandRejectedError,
  FlexDiscoveryUnavailableError,
  FlexError,
} from "./errors.js";
import { describeResponseCode } from "./response-codes.js";
import { type SliceController, SliceControllerImpl } from "./slice.js";
import {
  type PanadapterController,
  PanadapterControllerImpl,
} from "./panadapter.js";
import { type MeterController, MeterControllerImpl } from "./meter.js";
import {
  type WaterfallController,
  WaterfallControllerImpl,
} from "./waterfall.js";
import { type RadioController, RadioControllerImpl } from "./radio.js";
import {
  type AudioStreamController,
  type RemoteAudioRxStreamController,
  AudioStreamControllerImpl,
} from "./audio-stream.js";
import {
  FeatureLicenseControllerImpl,
  type FeatureLicenseController,
} from "./feature-license.js";
import { createUdpSession, type UdpSession } from "./udp-session.js";

export interface FlexClientOptions {
  defaultCommandTimeoutMs?: number;
}

export type FlexConnectionProgressStage =
  | "control"
  | "handle"
  | "sync"
  | "data-plane"
  | "ready";

export interface FlexConnectionProgress {
  readonly stage: FlexConnectionProgressStage;
  readonly detail?: string;
  readonly handle?: string;
}

export interface FlexClient {
  readonly adapters: FlexClientAdapters;
  readonly options: FlexClientOptions;
  discover(
    callbacks: Parameters<
      NonNullable<FlexClientAdapters["discovery"]>["start"]
    >[0],
  ): Promise<FlexDiscoverySession>;
  connect(
    descriptor: FlexRadioDescriptor,
    options?: FlexConnectionOptions,
  ): Promise<FlexRadioSession>;
}

export interface FlexDiscoverySession {
  stop(): Promise<void>;
}

export interface FlexConnectionOptions {
  readonly commandTimeoutMs?: number;
  readonly controlOptions?: Record<string, unknown>;
  readonly udpSession?: UdpSession;
  readonly dataPlane?: FlexDataPlaneFactory;
  readonly handshake?: FlexHandshake | null;
  readonly pingIntervalMs?: number | null;
  readonly onProgress?: (progress: FlexConnectionProgress) => void;
}

export interface FlexDataPlaneContext {
  readonly descriptor: FlexRadioDescriptor;
  readonly handle: string;
  readonly session: FlexRadioSession;
  readonly udp: UdpSession;
  readonly logger?: Logger;
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
}

export interface FlexDataPlaneConnection {
  close(): Promise<void> | void;
}

export interface FlexDataPlaneFactory {
  connect(
    context: FlexDataPlaneContext,
  ): Promise<FlexDataPlaneConnection | void> | FlexDataPlaneConnection | void;
}

export interface FlexWaitForHandleOptions {
  readonly timeoutMs?: number;
}

export interface FlexHandshakeContext {
  readonly descriptor: FlexRadioDescriptor;
  readonly session: FlexRadioSession;
  readonly radio: RadioController;
  readonly udp: UdpSession;
  readonly logger?: Logger;
  readonly dataPlaneFactory?: FlexDataPlaneFactory;
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  waitForHandle(options?: FlexWaitForHandleOptions): Promise<string>;
  emitProgress(progress: FlexConnectionProgress): void;
  setClientId(clientId: string | null): void;
  attachDataPlane(factory: FlexDataPlaneFactory): Promise<void>;
}

export type FlexHandshake = (context: FlexHandshakeContext) => Promise<void>;

export interface FlexRadioEvents extends Record<string, unknown> {
  readonly change: RadioStateChange;
  readonly status: FlexStatusMessage;
  readonly reply: FlexReplyMessage;
  readonly notice: FlexNoticeMessage;
  readonly message: FlexWireMessage;
  readonly progress: FlexConnectionProgress;
  readonly ready: undefined;
  readonly disconnected: undefined;
}

export type FlexRadioEventKey = keyof FlexRadioEvents;
export type FlexRadioEventListener<TKey extends FlexRadioEventKey> = (
  payload: FlexRadioEvents[TKey],
) => void;

export interface FlexRadioSession {
  readonly descriptor: FlexRadioDescriptor;
  readonly isClosed: boolean;
  readonly isReady: boolean;
  readonly ready: Promise<void>;
  readonly clientHandle: string | null;
  readonly clientId: string | null;
  readonly udp: UdpSession;
  snapshot(): RadioStateSnapshot;
  getSlice(id: string): SliceSnapshot | undefined;
  getSlices(): readonly SliceSnapshot[];
  getPanadapter(id: string): PanadapterSnapshot | undefined;
  getPanadapters(): readonly PanadapterSnapshot[];
  getWaterfall(id: string): WaterfallSnapshot | undefined;
  getWaterfalls(): readonly WaterfallSnapshot[];
  getMeter(id: string): MeterSnapshot | undefined;
  getMeters(): readonly MeterSnapshot[];
  getAudioStream(id: string): AudioStreamSnapshot | undefined;
  getAudioStreams(): readonly AudioStreamSnapshot[];
  getGuiClient(id: string): GuiClientSnapshot | undefined;
  getGuiClients(): readonly GuiClientSnapshot[];
  getRemoteAudioRxStream(id: string): AudioStreamSnapshot | undefined;
  getRemoteAudioRxStreams(): readonly AudioStreamSnapshot[];
  getRadio(): RadioSnapshot | undefined;
  getFeatureLicense(): FeatureLicenseSnapshot | undefined;
  radio(): RadioController;
  featureLicense(): FeatureLicenseController;
  slice(id: string): SliceController | undefined;
  panadapter(id: string): PanadapterController | undefined;
  waterfall(id: string): WaterfallController | undefined;
  meter(id: string): MeterController | undefined;
  audioStream(id: string): AudioStreamController | undefined;
  remoteAudioRxStream(id: string): RemoteAudioRxStreamController | undefined;
  createPanadapter(
    options?: PanadapterCreateOptions,
  ): Promise<PanadapterController>;
  createRemoteAudioRxStream(
    options?: RemoteAudioStreamCreateOptions,
  ): Promise<RemoteAudioRxStreamController>;
  createRemoteAudioTxStream(
    options?: RemoteAudioStreamCreateOptions,
  ): Promise<AudioStreamController>;
  createDaxRxAudioStream(
    options: DaxRxAudioStreamCreateOptions,
  ): Promise<AudioStreamController>;
  createDaxTxAudioStream(): Promise<AudioStreamController>;
  createDaxMicAudioStream(): Promise<AudioStreamController>;
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  installGps(): Promise<void>;
  uninstallGps(): Promise<void>;
  on<TKey extends FlexRadioEventKey>(
    event: TKey,
    listener: FlexRadioEventListener<TKey>,
  ): Subscription;
  once<TKey extends FlexRadioEventKey>(
    event: TKey,
    listener: FlexRadioEventListener<TKey>,
  ): Subscription;
  off<TKey extends FlexRadioEventKey>(
    event: TKey,
    listener: FlexRadioEventListener<TKey>,
  ): void;
  close(): Promise<void>;
}

export interface PanadapterCreateOptions {
  readonly x?: number;
  readonly y?: number;
}

export type RemoteAudioCompression =
  | "none"
  | "NONE"
  | "opus"
  | "OPUS"
  | (string & {});

export interface RemoteAudioStreamCreateOptions {
  readonly compression?: RemoteAudioCompression;
}

export interface DaxRxAudioStreamCreateOptions {
  readonly daxChannel: number;
}

export function createFlexClient(
  adapters: FlexClientAdapters,
  options: FlexClientOptions = {},
): FlexClient {
  const opts: FlexClientOptions = {
    defaultCommandTimeoutMs: 5_000,
    ...options,
  };

  return {
    adapters,
    options: opts,
    async discover(callbacks) {
      const discovery = adapters.discovery;
      if (!discovery) throw new FlexDiscoveryUnavailableError();
      const session = await discovery.start(callbacks);
      return {
        stop: () => session.stop(),
      };
    },
    async connect(descriptor, connectionOptions) {
      const udpSession =
        connectionOptions?.udpSession ??
        createUdpSession({ logger: adapters.logger });
      const control = await adapters.control.connect(
        descriptor,
        connectionOptions?.controlOptions,
      );
      const session = new FlexRadioSessionImpl(descriptor, control, {
        defaultCommandTimeoutMs:
          connectionOptions?.commandTimeoutMs ??
          opts.defaultCommandTimeoutMs ??
          5_000,
        logger: adapters.logger,
        udpSession,
        pingIntervalMs:
          connectionOptions?.pingIntervalMs ??
          (connectionOptions?.pingIntervalMs === null ? null : 1_000),
      });
      const handshake =
        connectionOptions?.handshake === undefined
          ? defaultFlexHandshake
          : connectionOptions.handshake;
      try {
        await session.prepare({
          handshake,
          dataPlaneFactory: connectionOptions?.dataPlane,
          onProgress: connectionOptions?.onProgress,
        });
      } catch (error) {
        try {
          await session.close();
        } catch {
          // swallow secondary errors while closing after handshake failure
        }
        throw error;
      }
      return session;
    },
  };
}

interface InternalSessionOptions {
  readonly defaultCommandTimeoutMs: number;
  readonly logger?: FlexClientAdapters["logger"];
  readonly udpSession: UdpSession;
  readonly pingIntervalMs?: number | null;
}

interface SessionPrepareOptions {
  readonly handshake: FlexHandshake | null;
  readonly dataPlaneFactory?: FlexDataPlaneFactory;
  readonly onProgress?: (progress: FlexConnectionProgress) => void;
}

class FlexRadioSessionImpl implements FlexRadioSession {
  private readonly events = new TypedEventEmitter<FlexRadioEvents>();
  private readonly store: RadioStateStore;
  private readonly slices = new Map<string, SliceControllerImpl>();
  private readonly panControllers = new Map<string, PanadapterControllerImpl>();
  private readonly waterfallControllers = new Map<
    string,
    WaterfallControllerImpl
  >();
  private readonly meterControllers = new Map<string, MeterControllerImpl>();
  private readonly audioControllers = new Map<
    string,
    AudioStreamControllerImpl
  >();
  private readonly radioController: RadioController;
  private readonly featureLicenseController: FeatureLicenseController;
  private readonly messageSub: Subscription;
  private readonly rawLineSub: Subscription;
  private readonly handleWaiters: Array<{
    resolve: (handle: string) => void;
    reject: (reason: unknown) => void;
    timeoutHandle?: ReturnType<typeof setTimeout>;
  }> = [];
  private readonly readyPromise: Promise<void>;
  private readyResolve?: () => void;
  private readyReject?: (reason?: unknown) => void;
  private dataPlaneConnection?: FlexDataPlaneConnection;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private _clientHandle: string | null = null;
  private _clientId: string | null = null;
  private _isReady = false;
  private onProgress?: (progress: FlexConnectionProgress) => void;
  private readonly udpSession: UdpSession;
  private closed = false;

  constructor(
    readonly descriptor: FlexRadioDescriptor,
    private readonly control: FlexControlChannel,
    private readonly options: InternalSessionOptions,
  ) {
    this.udpSession = options.udpSession;
    this.store = createRadioStateStore({ logger: options.logger });
    this.radioController = new RadioControllerImpl(
      {
        command: (command, options) => this.command(command, options),
        patchRadio: (attributes, context) =>
          this.patchRadio(attributes, context),
      },
      () => this.store.getRadio(),
    );
    this.featureLicenseController = new FeatureLicenseControllerImpl(
      {
        command: (command, options) => this.command(command, options),
      },
      () => this.store.getFeatureLicense(),
    );
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.messageSub = control.onMessage((message) =>
      this.handleWireMessage(message),
    );
    this.rawLineSub = control.onRawLine((line) => this.handleRawLine(line));
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get ready(): Promise<void> {
    return this.readyPromise;
  }

  get clientHandle(): string | null {
    return this._clientHandle;
  }

  get clientId(): string | null {
    return this._clientId;
  }

  get udp(): UdpSession {
    return this.udpSession;
  }

  snapshot(): RadioStateSnapshot {
    return this.store.snapshot();
  }

  getSlice(id: string): SliceSnapshot | undefined {
    return this.store.getSlice(id);
  }

  getSlices(): readonly SliceSnapshot[] {
    return this.store.snapshot().slices;
  }

  getPanadapter(id: string): PanadapterSnapshot | undefined {
    return this.store.getPanadapter(id);
  }

  getPanadapters(): readonly PanadapterSnapshot[] {
    return this.store.snapshot().panadapters;
  }

  getWaterfall(id: string): WaterfallSnapshot | undefined {
    return this.store.getWaterfall(id);
  }

  getWaterfalls(): readonly WaterfallSnapshot[] {
    return this.store.snapshot().waterfalls;
  }

  getMeter(id: string): MeterSnapshot | undefined {
    return this.store.getMeter(id);
  }

  getMeters(): readonly MeterSnapshot[] {
    return this.store.snapshot().meters;
  }

  getAudioStream(id: string): AudioStreamSnapshot | undefined {
    return this.store.getAudioStream(id);
  }

  getAudioStreams(): readonly AudioStreamSnapshot[] {
    return this.store.snapshot().audioStreams;
  }

  getGuiClient(id: string): GuiClientSnapshot | undefined {
    return this.store.getGuiClient(id);
  }

  getGuiClients(): readonly GuiClientSnapshot[] {
    return this.store.snapshot().guiClients;
  }

  getRemoteAudioRxStream(id: string): AudioStreamSnapshot | undefined {
    const stream = this.getAudioStream(id);
    return stream && stream.type === "remote_audio_rx" ? stream : undefined;
  }

  getRemoteAudioRxStreams(): readonly AudioStreamSnapshot[] {
    return this.getAudioStreams().filter(
      (stream) => stream.type === "remote_audio_rx",
    );
  }

  async prepare(options: SessionPrepareOptions): Promise<void> {
    if (options.handshake === null) {
      this.markReady();
      return;
    }

    this.onProgress = options.onProgress;
    const handshake = options.handshake ?? defaultFlexHandshake;
    this.emitProgress({ stage: "control" });
    try {
      await handshake({
        descriptor: this.descriptor,
        session: this,
        radio: this.radioController,
        udp: this.udpSession,
        logger: this.options.logger,
        dataPlaneFactory: options.dataPlaneFactory,
        command: (command, commandOptions) =>
          this.command(command, commandOptions),
        waitForHandle: (handleOptions) => this.waitForHandle(handleOptions),
        emitProgress: (progress) => this.emitProgress(progress),
        setClientId: (clientId) => this.setClientId(clientId),
        attachDataPlane: async (factory) => {
          await this.attachDataPlane(factory);
        },
      });
      if (
        options.dataPlaneFactory &&
        !this.dataPlaneConnection &&
        this._clientHandle
      ) {
        await this.attachDataPlane(options.dataPlaneFactory);
      }
      this.markReady();
    } catch (error) {
      this.failReady(error);
      throw error;
    }
  }

  private async attachDataPlane(factory?: FlexDataPlaneFactory): Promise<void> {
    if (!factory) return;
    if (!this._clientHandle) {
      throw new Error("Flex data-plane attachment requires a client handle");
    }
    await this.teardownDataPlane();
    const result = await factory.connect({
      descriptor: this.descriptor,
      handle: this._clientHandle,
      session: this,
      udp: this.udpSession,
      logger: this.options.logger,
      command: (command, commandOptions) =>
        this.command(command, commandOptions),
    });
    if (result) {
      this.dataPlaneConnection = result;
    }
  }

  private async teardownDataPlane(): Promise<void> {
    if (!this.dataPlaneConnection) return;
    const connection = this.dataPlaneConnection;
    this.dataPlaneConnection = undefined;
    try {
      await connection.close();
    } catch (error) {
      this.options.logger?.warn?.("Flex data-plane close failed", { error });
    }
  }

  private waitForHandle(options?: FlexWaitForHandleOptions): Promise<string> {
    if (this._clientHandle) return Promise.resolve(this._clientHandle);
    if (this.closed) return Promise.reject(new FlexClientClosedError());
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
      if (options?.timeoutMs && options.timeoutMs > 0) {
        waiter.timeoutHandle = setTimeout(() => {
          this.removeHandleWaiter(waiter);
          reject(
            new Error(
              `Timed out waiting for Flex handle after ${options.timeoutMs}ms`,
            ),
          );
        }, options.timeoutMs);
      }
      this.handleWaiters.push(waiter);
    });
  }

  private removeHandleWaiter(waiter: {
    resolve: (handle: string) => void;
    reject: (reason: unknown) => void;
    timeoutHandle?: ReturnType<typeof setTimeout>;
  }): void {
    const index = this.handleWaiters.indexOf(waiter);
    if (index >= 0) {
      this.handleWaiters.splice(index, 1);
    }
  }

  private resolveHandleWaiters(handle: string): void {
    if (!this.handleWaiters.length) return;
    const waiters = this.handleWaiters.splice(0, this.handleWaiters.length);
    for (const waiter of waiters) {
      if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
      try {
        waiter.resolve(handle);
      } catch (error) {
        this.options.logger?.error?.("Handle waiter rejection", { error });
      }
    }
  }

  private rejectHandleWaiters(reason: unknown): void {
    if (!this.handleWaiters.length) return;
    const waiters = this.handleWaiters.splice(0, this.handleWaiters.length);
    for (const waiter of waiters) {
      if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
      try {
        waiter.reject(reason);
      } catch (error) {
        this.options.logger?.error?.("Handle waiter rejection", { error });
      }
    }
  }

  private handleRawLine(line: string): void {
    if (!line) return;
    const prefix = line[0];
    switch (prefix) {
      case "H": {
        const handle = line.slice(1).trim();
        if (handle) this.assignClientHandle(handle);
        break;
      }
      case "V": {
        const version = line.slice(1).trim();
        if (version) {
          this.options.logger?.info?.("Flex radio version", { version });
        }
        break;
      }
      default:
        break;
    }
  }

  private assignClientHandle(handle: string): void {
    if (!handle) return;
    if (this._clientHandle === handle) return;
    this._clientHandle = handle;
    const clientChanges = this.store.setLocalClientHandle(handle);
    for (const change of clientChanges) {
      this.handleStateChange(change);
    }
    this.resolveHandleWaiters(handle);
  }

  private setClientId(clientId: string | null): void {
    this._clientId = clientId ?? null;
  }

  private emitProgress(progress: FlexConnectionProgress): void {
    if (!this.closed) {
      this.events.emit("progress", progress);
    }
    this.onProgress?.(progress);
  }

  private markReady(): void {
    if (this._isReady) return;
    this._isReady = true;
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = undefined;
      this.readyReject = undefined;
    }
    this.startHeartbeat();
    this.emitProgress({ stage: "ready" });
    this.events.emit("ready", undefined);
    this.onProgress = undefined;
  }

  private startHeartbeat(): void {
    if (
      this.heartbeatTimer ||
      !this.options.pingIntervalMs ||
      this.options.pingIntervalMs <= 0
    ) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      this.command("ping").catch((error) => {
        this.options.logger?.warn?.("Flex ping failed", { error });
      });
    }, this.options.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private failReady(reason: unknown): void {
    if (!this._isReady && this.readyReject) {
      this.readyReject(reason ?? new FlexClientClosedError());
      this.readyReject = undefined;
      this.readyResolve = undefined;
    }
    this.rejectHandleWaiters(reason ?? new FlexClientClosedError());
    this.onProgress = undefined;
  }

  private patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): void {
    const change = this.store.patchRadio(attributes, context);
    if (change) this.handleStateChange(change);
  }

  getRadio(): RadioSnapshot | undefined {
    return this.store.getRadio();
  }

  radio(): RadioController {
    return this.radioController;
  }

  getFeatureLicense(): FeatureLicenseSnapshot | undefined {
    return this.store.getFeatureLicense();
  }

  featureLicense(): FeatureLicenseController {
    return this.featureLicenseController;
  }

  slice(id: string): SliceController | undefined {
    if (this.closed) return undefined;
    let controller = this.slices.get(id);
    if (!controller) {
      const snapshot = this.store.getSlice(id);
      if (!snapshot) return undefined;
      controller = new SliceControllerImpl(this, id);
      this.slices.set(id, controller);
    }
    return controller;
  }

  panadapter(id: string): PanadapterController | undefined {
    if (this.closed) return undefined;
    let controller = this.panControllers.get(id);
    if (!controller) {
      const snapshot = this.store.getPanadapter(id);
      if (!snapshot) return undefined;
      controller = new PanadapterControllerImpl(this, id, snapshot.streamId);
      this.panControllers.set(id, controller);
    }
    return controller;
  }

  waterfall(id: string): WaterfallController | undefined {
    if (this.closed) return undefined;
    let controller = this.waterfallControllers.get(id);
    if (!controller) {
      const snapshot = this.store.getWaterfall(id);
      if (!snapshot) return undefined;
      controller = new WaterfallControllerImpl(this, id, snapshot.streamId);
      this.waterfallControllers.set(id, controller);
    }
    return controller;
  }

  meter(id: string): MeterController | undefined {
    if (this.closed) return undefined;
    let controller = this.meterControllers.get(id);
    if (!controller) {
      const snapshot = this.store.getMeter(id);
      if (!snapshot) return undefined;
      controller = new MeterControllerImpl(this, id);
      this.meterControllers.set(id, controller);
    }
    return controller;
  }

  audioStream(id: string): AudioStreamController | undefined {
    if (this.closed) return undefined;
    let controller = this.audioControllers.get(id);
    if (!controller) {
      const snapshot = this.store.getAudioStream(id);
      if (!snapshot) return undefined;
      controller = new AudioStreamControllerImpl(this, id);
      this.audioControllers.set(id, controller);
    }
    return controller;
  }

  remoteAudioRxStream(id: string): RemoteAudioRxStreamController | undefined {
    const snapshot = this.getRemoteAudioRxStream(id);
    if (!snapshot) return undefined;
    return this.audioStream(id);
  }

  private async createAudioStream(
    command: string,
  ): Promise<AudioStreamController> {
    if (this.closed) throw new FlexClientClosedError();
    const response = await this.command(command);
    // The radio emits the status event before it replies, so the store already
    // has the new stream snapshot by the time we inspect the response.
    if (this.closed) {
      throw new FlexClientClosedError();
    }
    const idRaw = response.message?.split(",")[0]?.trim();
    if (!idRaw) {
      throw new FlexError("Audio stream creation did not return an identifier");
    }
    const streamId = normalizeEntityId(idRaw);
    const controller = this.audioStream(streamId);
    if (!controller) {
      throw new FlexError(
        `Audio stream ${streamId} is not available after creation`,
      );
    }
    return controller;
  }

  async createPanadapter(
    options?: PanadapterCreateOptions,
  ): Promise<PanadapterController> {
    if (this.closed) throw new FlexClientClosedError();
    let command = "display panafall create";
    if (options?.x !== undefined) command += ` x=${Math.round(options.x)}`;
    if (options?.y !== undefined) command += ` y=${Math.round(options.y)}`;
    const response = await this.command(command);
    // The radio emits the status event before it replies, so the store already
    // contains the new panadapter (and associated waterfall) snapshot by now.
    if (this.closed) {
      throw new FlexClientClosedError();
    }
    const ids = response.message
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const panToken = ids?.[0];
    if (!panToken) {
      throw new FlexError("Panadapter creation did not return identifiers");
    }
    const panId = normalizeEntityId(panToken);
    const controller = this.panadapter(panId);
    if (!controller) {
      throw new FlexError(
        `Panadapter ${panId} is not available after creation`,
      );
    }
    return controller;
  }

  async createRemoteAudioRxStream(
    options?: RemoteAudioStreamCreateOptions,
  ): Promise<RemoteAudioRxStreamController> {
    let command = "stream create type=remote_audio_rx";
    const compression = options?.compression;
    if (compression) {
      command += ` compression=${compression.toUpperCase()}`;
    }
    return (await this.createAudioStream(
      command,
    )) as RemoteAudioRxStreamController;
  }

  async createRemoteAudioTxStream(
    options?: RemoteAudioStreamCreateOptions,
  ): Promise<AudioStreamController> {
    let command = "stream create type=remote_audio_tx";
    const compression = options?.compression;
    if (compression) {
      command += ` compression=${compression.toUpperCase()}`;
    }
    return this.createAudioStream(command);
  }

  async createDaxRxAudioStream(
    options: DaxRxAudioStreamCreateOptions,
  ): Promise<AudioStreamController> {
    const command = `stream create type=dax_rx dax_channel=${Math.round(options.daxChannel)}`;
    return this.createAudioStream(command);
  }

  async createDaxTxAudioStream(): Promise<AudioStreamController> {
    return this.createAudioStream("stream create type=dax_tx");
  }

  async createDaxMicAudioStream(): Promise<AudioStreamController> {
    return this.createAudioStream("stream create type=dax_mic");
  }

  patchSlice(id: string, attributes: Record<string, string>): void {
    const change = this.store.patchSlice(id, attributes);
    if (change) this.handleStateChange(change);
  }

  patchPanadapter(id: string, attributes: Record<string, string>): void {
    const change = this.store.patchPanadapter(id, attributes);
    if (change) this.handleStateChange(change);
  }

  patchWaterfall(id: string, attributes: Record<string, string>): void {
    const change = this.store.patchWaterfall(id, attributes);
    if (change) this.handleStateChange(change);
  }

  patchAudioStream(id: string, attributes: Record<string, string>): void {
    const change = this.store.patchAudioStream(id, attributes);
    if (change) this.handleStateChange(change);
  }

  applyPanadapterRfGainInfo(id: string, info: RfGainInfo): void {
    const change = this.store.applyPanadapterRfGainInfo(id, info);
    if (change) this.handleStateChange(change);
  }

  applyWaterfallRfGainInfo(id: string, info: RfGainInfo): void {
    const change = this.store.applyWaterfallRfGainInfo(id, info);
    if (change) this.handleStateChange(change);
  }

  async command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse> {
    if (this.closed) throw new FlexClientClosedError();
    const mergedOptions = {
      timeoutMs: options?.timeoutMs ?? this.options.defaultCommandTimeoutMs,
      sequenceHint: options?.sequenceHint,
    };
    const response = await this.control.send(command, mergedOptions);
    if (!response.accepted) {
      const codeDescription =
        response.code !== undefined
          ? describeResponseCode(response.code)
          : undefined;
      throw new FlexCommandRejectedError(
        buildCommandErrorMessage(command, response, codeDescription),
        {
          sequence: response.sequence,
          raw: response.raw,
          message: response.message,
          code: response.code,
        },
        codeDescription,
      );
    }
    return response;
  }

  async installGps(): Promise<void> {
    await this.command("radio gps install");
  }

  async uninstallGps(): Promise<void> {
    await this.command("radio gps uninstall");
  }

  on<TKey extends FlexRadioEventKey>(
    event: TKey,
    listener: FlexRadioEventListener<TKey>,
  ): Subscription {
    return this.events.on(event, listener);
  }

  once<TKey extends FlexRadioEventKey>(
    event: TKey,
    listener: FlexRadioEventListener<TKey>,
  ): Subscription {
    return this.events.once(event, listener);
  }

  off<TKey extends FlexRadioEventKey>(
    event: TKey,
    listener: FlexRadioEventListener<TKey>,
  ): void {
    this.events.off(event, listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.stopHeartbeat();
    this.messageSub.unsubscribe();
    this.rawLineSub.unsubscribe();
    await this.teardownDataPlane();
    this.failReady(new FlexClientClosedError());
    this.onProgress = undefined;
    try {
      await this.control.close();
    } catch (error) {
      this.options.logger?.warn?.("Flex control close failed", { error });
    }
    this.events.emit("disconnected", undefined);
    this.events.removeAll();
    this.slices.clear();
    this.panControllers.clear();
    this.waterfallControllers.clear();
    this.meterControllers.clear();
    this.audioControllers.clear();
  }

  private handleWireMessage(message: FlexWireMessage): void {
    if (this.closed) return;
    this.events.emit("message", message);
    switch (message.kind) {
      case "status":
        this.events.emit("status", message);
        for (const change of this.store.apply(message)) {
          this.handleStateChange(change);
        }
        break;
      case "reply":
        this.events.emit("reply", message);
        break;
      case "notice":
        this.events.emit("notice", message);
        break;
      case "unknown":
        break;
    }
  }

  private handleStateChange(change: RadioStateChange): void {
    this.events.emit("change", change);
    if (change.entity === "audioStream") {
      const controller = this.audioControllers.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (change.removed) this.audioControllers.delete(change.id);
      } else {
        this.audioControllers.set(
          change.id,
          new AudioStreamControllerImpl(this, change.id),
        );
      }
      return;
    }
    if (change.entity === "slice") {
      const controller = this.slices.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (change.removed) this.slices.delete(change.id);
      } else {
        // lazily populate controller cache to accelerate future access
        this.slices.set(change.id, new SliceControllerImpl(this, change.id));
      }
      return;
    }
    if (change.entity === "panadapter") {
      const controller = this.panControllers.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (change.removed) this.panControllers.delete(change.id);
      } else {
        this.panControllers.set(
          change.id,
          new PanadapterControllerImpl(this, change.id, change.diff?.streamId),
        );
      }
      return;
    }
    if (change.entity === "waterfall") {
      const controller = this.waterfallControllers.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (change.removed) this.waterfallControllers.delete(change.id);
      } else {
        this.waterfallControllers.set(
          change.id,
          new WaterfallControllerImpl(this, change.id, change.diff?.streamId),
        );
      }
      return;
    }
    if (change.entity === "meter") {
      const controller = this.meterControllers.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (change.removed) this.meterControllers.delete(change.id);
      } else {
        this.meterControllers.set(
          change.id,
          new MeterControllerImpl(this, change.id),
        );
      }
      return;
    }
  }
}

function buildCommandErrorMessage(
  command: string,
  response: FlexCommandResponse,
  codeDescription?: string,
): string {
  const parts: string[] = [`Flex command rejected`, `command=${command}`];
  if (response.code !== undefined) {
    parts.push(`code=${response.code}`);
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
  const withoutPrefix =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed.slice(2)
      : trimmed;
  const upper = withoutPrefix.toUpperCase();
  const padded = upper.padStart(8, "0");
  return `0x${padded}`;
}

const DEFAULT_HANDLE_TIMEOUT_MS = 10_000;

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
  "keepalive enable",
];

export async function defaultFlexHandshake(
  context: FlexHandshakeContext,
): Promise<void> {
  const handle = await context.waitForHandle({
    timeoutMs: DEFAULT_HANDLE_TIMEOUT_MS,
  });
  context.emitProgress({ stage: "handle", handle });

  context.emitProgress({ stage: "sync", detail: "radio-info" });
  await Promise.all([
    context.radio.refreshInfo(),
    context.radio.refreshVersions(),
    context.radio.refreshRxAntennaList(),
    context.radio.refreshMicList(),
  ]);

  context.emitProgress({ stage: "sync", detail: "subscriptions" });
  await Promise.all(
    DEFAULT_HANDSHAKE_COMMANDS.map((command) => context.command(command)),
  );

  if (context.dataPlaneFactory) {
    context.emitProgress({ stage: "data-plane" });
    await context.attachDataPlane(context.dataPlaneFactory);
  }

  const clientGuiResponse = await context.command("client gui");
  const clientId = clientGuiResponse.message?.trim();
  context.setClientId(clientId && clientId.length ? clientId : null);

  context.emitProgress({ stage: "sync", detail: "audio" });
  await context.session.createRemoteAudioRxStream({
    compression: "OPUS",
  });
}
