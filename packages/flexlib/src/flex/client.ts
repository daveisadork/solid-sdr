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
import {
  createRadioStateStore,
  type RadioStateStore,
  type RadioStateSnapshot,
  type RadioStateChange,
  type SliceSnapshot,
  type PanadapterSnapshot,
  type WaterfallSnapshot,
  type MeterSnapshot,
} from "./radio-state.js";
import {
  FlexClientClosedError,
  FlexCommandRejectedError,
  FlexDiscoveryUnavailableError,
  FlexError,
} from "./errors.js";
import { describeResponseCode } from "./response-codes.js";
import type { SliceController } from "./slice.js";
import { SliceControllerImpl } from "./slice.js";
import type { PanadapterController } from "./panadapter.js";
import { PanadapterControllerImpl } from "./panadapter.js";
import type { MeterController } from "./meter.js";
import { MeterControllerImpl } from "./meter.js";
import type { WaterfallController } from "./waterfall.js";
import { WaterfallControllerImpl } from "./waterfall.js";

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
  slice(id: string): SliceController | undefined;
  panadapter(id: string): PanadapterController | undefined;
  waterfall(id: string): WaterfallController | undefined;
  meter(id: string): MeterController | undefined;
  createPanadapter(
    options?: PanadapterCreateOptions,
  ): Promise<PanadapterController>;
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
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
  readonly waitTimeoutMs?: number;
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
      });
    },
  };
}

interface InternalSessionOptions {
  readonly defaultCommandTimeoutMs: number;
}

class FlexRadioSessionImpl implements FlexRadioSession {
  private readonly events = new TypedEventEmitter<FlexRadioEvents>();
  private readonly store: RadioStateStore = createRadioStateStore();
  private readonly slices = new Map<string, SliceControllerImpl>();
  private readonly panControllers = new Map<string, PanadapterControllerImpl>();
  private readonly waterfallControllers = new Map<
    string,
    WaterfallControllerImpl
  >();
  private readonly meterControllers = new Map<string, MeterControllerImpl>();
  private readonly messageSub: Subscription;
  private closed = false;

  constructor(
    readonly descriptor: FlexRadioDescriptor,
    private readonly control: FlexControlChannel,
    private readonly options: InternalSessionOptions,
  ) {
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

  async createPanadapter(
    options?: PanadapterCreateOptions,
  ): Promise<PanadapterController> {
    if (this.closed) throw new FlexClientClosedError();
    const existing = new Set(
      this.store.snapshot().panadapters.map((pan) => pan.id),
    );
    let command = "display panafall create";
    if (options?.x !== undefined) command += ` x=${Math.round(options.x)}`;
    if (options?.y !== undefined) command += ` y=${Math.round(options.y)}`;
    await this.command(command);

    const waitMs = options?.waitTimeoutMs ?? 5_000;

    const immediate = this.store
      .snapshot()
      .panadapters.find((pan) => !existing.has(pan.id));
    if (immediate) {
      return this.panadapter(immediate.id)!;
    }

    return await new Promise<PanadapterController>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        reject(new FlexError("Panadapter creation timed out"));
      }, waitMs);

      const subscription = this.events.on("change", (change) => {
        if (change.entity !== "panadapter" || !change.snapshot) return;
        if (existing.has(change.id)) return;
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve(this.panadapter(change.id)!);
      });
    });
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
    if (change.entity === "slice") {
      const controller = this.slices.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (!change.snapshot) this.slices.delete(change.id);
      } else if (change.snapshot) {
        // lazily populate controller cache to accelerate future access
        this.slices.set(change.id, new SliceControllerImpl(this, change.id));
      }
      return;
    }
    if (change.entity === "panadapter") {
      const controller = this.panControllers.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (!change.snapshot) this.panControllers.delete(change.id);
      } else if (change.snapshot) {
        this.panControllers.set(
          change.id,
          new PanadapterControllerImpl(
            this,
            change.id,
            change.snapshot.streamId,
          ),
        );
      }
      return;
    }
    if (change.entity === "waterfall") {
      const controller = this.waterfallControllers.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (!change.snapshot) this.waterfallControllers.delete(change.id);
      } else if (change.snapshot) {
        this.waterfallControllers.set(
          change.id,
          new WaterfallControllerImpl(
            this,
            change.id,
            change.snapshot.streamId,
          ),
        );
      }
      return;
    }
    if (change.entity === "meter") {
      const controller = this.meterControllers.get(change.id);
      if (controller) {
        controller.onStateChange(change);
        if (!change.snapshot) this.meterControllers.delete(change.id);
      } else if (change.snapshot) {
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
