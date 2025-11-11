import type {
  FlexClientAdapters,
  FlexCommandOptions,
  FlexCommandResponse,
  FlexControlChannel,
  FlexRadioDescriptor,
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
  type RadioProperties,
  type RadioStatusContext,
} from "./radio-state.js";
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

export interface FlexClientOptions {
  defaultCommandTimeoutMs?: number;
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
  readonly connectionParams?: Record<string, unknown>;
}

export interface FlexRadioEvents extends Record<string, unknown> {
  readonly change: RadioStateChange;
  readonly status: FlexStatusMessage;
  readonly reply: FlexReplyMessage;
  readonly notice: FlexNoticeMessage;
  readonly message: FlexWireMessage;
  readonly disconnected: undefined;
}

export type FlexRadioEventKey = keyof FlexRadioEvents;
export type FlexRadioEventListener<TKey extends FlexRadioEventKey> = (
  payload: FlexRadioEvents[TKey],
) => void;

export interface FlexRadioSession {
  readonly descriptor: FlexRadioDescriptor;
  readonly isClosed: boolean;
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
  getRemoteAudioRxStream(id: string): AudioStreamSnapshot | undefined;
  getRemoteAudioRxStreams(): readonly AudioStreamSnapshot[];
  getRadio(): RadioProperties | undefined;
  radio(): RadioController;
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
      const control = await adapters.control.connect(
        descriptor,
        connectionOptions?.connectionParams,
      );
      return new FlexRadioSessionImpl(descriptor, control, {
        defaultCommandTimeoutMs:
          connectionOptions?.commandTimeoutMs ??
          opts.defaultCommandTimeoutMs ??
          5_000,
        logger: adapters.logger,
      });
    },
  };
}

interface InternalSessionOptions {
  readonly defaultCommandTimeoutMs: number;
  readonly logger?: FlexClientAdapters["logger"];
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
  private readonly messageSub: Subscription;
  private closed = false;

  constructor(
    readonly descriptor: FlexRadioDescriptor,
    private readonly control: FlexControlChannel,
    private readonly options: InternalSessionOptions,
  ) {
    this.store = createRadioStateStore({ logger: options.logger });
    this.radioController = new RadioControllerImpl(
      {
        command: (command, options) => this.command(command, options),
        patchRadio: (attributes, context) =>
          this.patchRadio(attributes, context),
      },
      () => this.store.getRadio(),
    );
    this.messageSub = control.onMessage((message) =>
      this.handleWireMessage(message),
    );
  }

  get isClosed(): boolean {
    return this.closed;
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

  getRemoteAudioRxStream(id: string): AudioStreamSnapshot | undefined {
    const stream = this.getAudioStream(id);
    return stream && stream.type === "remote_audio_rx" ? stream : undefined;
  }

  getRemoteAudioRxStreams(): readonly AudioStreamSnapshot[] {
    return this.getAudioStreams().filter(
      (stream) => stream.type === "remote_audio_rx",
    );
  }

  private patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): void {
    const change = this.store.patchRadio(attributes, context);
    if (change) this.handleStateChange(change);
  }

  getRadio(): RadioProperties | undefined {
    return this.store.getRadio();
  }

  radio(): RadioController {
    return this.radioController;
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
    this.messageSub.unsubscribe();
    await this.control.close();
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
