import {
  createFlexClient,
  type FlexClient,
  type FlexClientOptions,
  type FlexConnectionOptions,
  type FlexConnectionProgress,
  type FlexRadioSession,
} from "./session.js";
import type {
  DiscoveryAdapter,
  DiscoverySession,
  FlexCommandOptions,
  FlexCommandResponse,
  FlexClientAdapters,
  FlexRadioDescriptor,
} from "./adapters.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import type { RadioSnapshot, RadioStateChange } from "./state/index.js";
import { createDefaultRadioSnapshot } from "./state/radio.js";
import type { RadioController } from "./radio.js";
import type { SliceController } from "./slice.js";
import type { PanadapterController } from "./panadapter.js";
import type { WaterfallController } from "./waterfall.js";
import type { MeterController } from "./meter.js";
import type { AudioStreamController } from "./audio-stream.js";
import type { GuiClientSnapshot } from "./state/index.js";
import { FlexClientClosedError } from "./errors.js";

export type RadioConnectionState =
  | "disconnected"
  | "connecting"
  | "ready"
  | "disconnecting";

export type RadioHandle = RadioController & RadioHandleExtras;

export interface RadioHandleExtras {
  readonly serial: string;
  readonly connectionState: RadioConnectionState;
  readonly descriptor?: FlexRadioDescriptor;
  readonly lastSeen?: Date;
  readonly available: boolean;
  readonly ready: Promise<void>;
  connect(options?: RadioConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  slice(id: string): SliceController | undefined;
  panadapter(id: string): PanadapterController | undefined;
  waterfall(id: string): WaterfallController | undefined;
  meter(id: string): MeterController | undefined;
  audioStream(id: string): AudioStreamController | undefined;
  guiClients(): readonly GuiClientSnapshot[];
  snapshot(): RadioSnapshot;
  on<TKey extends RadioHandleEventKey>(
    event: TKey,
    listener: RadioHandleEventListener<TKey>,
  ): Subscription;
  off<TKey extends RadioHandleEventKey>(
    event: TKey,
    listener: RadioHandleEventListener<TKey>,
  ): void;
}

export interface RadioClient {
  readonly options: RadioClientOptions;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  getRadios(): readonly RadioHandle[];
  radio(serial: string): RadioHandle | undefined;
  on<TKey extends RadioClientEventKey>(
    event: TKey,
    listener: RadioClientEventListener<TKey>,
  ): Subscription;
  off<TKey extends RadioClientEventKey>(
    event: TKey,
    listener: RadioClientEventListener<TKey>,
  ): void;
}

export type RadioClientOptions = FlexClientOptions;

export type RadioConnectionOptions = FlexConnectionOptions;

export interface RadioProgressEvent {
  readonly serial: string;
  readonly progress: FlexConnectionProgress;
}

export interface RadioErrorEvent {
  readonly serial: string;
  readonly error: unknown;
}

export type RadioStateChangeWithSerial = RadioStateChange & {
  readonly radioSerial: string;
};

export interface RadioClientEvents extends Record<string, unknown> {
  readonly radioDiscovered: RadioHandle;
  readonly radioLost: { serial: string };
  readonly radioConnected: RadioHandle;
  readonly radioDisconnected: { serial: string };
  readonly radioChange: RadioStateChangeWithSerial;
  readonly sliceChange: RadioStateChangeWithSerial;
  readonly panadapterChange: RadioStateChangeWithSerial;
  readonly waterfallChange: RadioStateChangeWithSerial;
  readonly meterChange: RadioStateChangeWithSerial;
  readonly audioStreamChange: RadioStateChangeWithSerial;
  readonly guiClientChange: RadioStateChangeWithSerial;
  readonly progress: RadioProgressEvent;
  readonly error: RadioErrorEvent;
}

export type RadioClientEventKey = keyof RadioClientEvents;
export type RadioClientEventListener<
  TKey extends RadioClientEventKey,
> = (payload: RadioClientEvents[TKey]) => void;

export interface RadioHandleEvents extends Record<string, unknown> {
  readonly radioChange: RadioStateChangeWithSerial;
  readonly sliceChange: RadioStateChangeWithSerial;
  readonly panadapterChange: RadioStateChangeWithSerial;
  readonly waterfallChange: RadioStateChangeWithSerial;
  readonly meterChange: RadioStateChangeWithSerial;
  readonly audioStreamChange: RadioStateChangeWithSerial;
  readonly guiClientChange: RadioStateChangeWithSerial;
  readonly ready: undefined;
  readonly disconnected: undefined;
  readonly progress: FlexConnectionProgress;
  readonly error: unknown;
}

export type RadioHandleEventKey = keyof RadioHandleEvents;
export type RadioHandleEventListener<TKey extends RadioHandleEventKey> = (
  payload: RadioHandleEvents[TKey],
) => void;

type ClientEventEmitter = <TKey extends RadioClientEventKey>(
  event: TKey,
  payload: RadioClientEvents[TKey],
) => void;

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
}

export function createRadioClient(
  adapters: FlexClientAdapters & { discovery: DiscoveryAdapter },
  options: RadioClientOptions = {},
): RadioClient {
  const baseClient = createFlexClient(adapters, options);
  const emitter = new TypedEventEmitter<RadioClientEvents>();
  const radios = new Map<string, RadioHandleCore>();
  let discoverySession: DiscoverySession | undefined;

  async function startDiscovery(): Promise<void> {
    if (discoverySession) return;
    discoverySession = await adapters.discovery.start({
      onOnline(descriptor) {
        handleDescriptor(descriptor);
      },
      onOffline(serial) {
        const radio = radios.get(serial);
        if (radio) {
          radio.setAvailable(false);
          emitter.emit("radioLost", { serial });
        }
      },
      onError(error) {
        emitter.emit("error", { serial: "", error });
      },
    });
  }

  async function stopDiscovery(): Promise<void> {
    if (!discoverySession) return;
    const session = discoverySession;
    discoverySession = undefined;
    await session.stop();
  }

  function handleDescriptor(descriptor: FlexRadioDescriptor): void {
    let radio = radios.get(descriptor.serial);
    if (!radio) {
      radio = new RadioHandleCore(descriptor.serial, baseClient, (event, payload) =>
        emitter.emit(event, payload),
      );
      radios.set(descriptor.serial, radio);
    }
    const firstDiscovery = !radio.descriptor;
    radio.updateDescriptor(descriptor);
    if (firstDiscovery) {
      emitter.emit("radioDiscovered", radio.publicInterface());
    }
  }

  return {
    options,
    startDiscovery,
    stopDiscovery,
    getRadios() {
      return Array.from(radios.values(), (radio) => radio.publicInterface());
    },
    radio(serial) {
      return radios.get(serial)?.publicInterface();
    },
    on(event, listener) {
      return emitter.on(event, listener);
    },
    off(event, listener) {
      emitter.off(event, listener);
    },
  };
}

class RadioHandleCore extends TypedEventEmitter<RadioHandleEvents> {
  readonly serial: string;
  private descriptorValue?: FlexRadioDescriptor;
  private _lastSeen?: Date;
  private session?: FlexRadioSession;
  private sessionSubscriptions: Subscription[] = [];
  private readonly readyDeferred: Deferred<void>;
  private cachedSnapshot: RadioSnapshot = createDefaultRadioSnapshot();
  private _connectionState: RadioConnectionState = "disconnected";
  private connectPromise?: Promise<void>;
  private publicInstance?: RadioHandle;
  private readonly clientConnected: (radio: RadioHandleCore) => void;
  private readonly clientDisconnected: (radio: RadioHandleCore) => void;
  private hasSnapshot = false;
  private _available = false;

  constructor(
    serial: string,
    private readonly client: FlexClient,
    private readonly clientEventEmitter: ClientEventEmitter,
  ) {
    super();
    this.serial = serial;
    this.readyDeferred = createDeferred<void>();
    this.clientConnected = () => {
      this.clientEventEmitter("radioConnected", this.publicInterface());
    };
    this.clientDisconnected = () => {
      this.clientEventEmitter("radioDisconnected", { serial: this.serial });
    };
  }

  publicInterface(): RadioHandle {
    if (!this.publicInstance) {
      this.publicInstance = createRadioHandleProxy(this);
    }
    return this.publicInstance;
  }

  get connectionState(): RadioConnectionState {
    return this._connectionState;
  }

  get descriptor(): FlexRadioDescriptor | undefined {
    return this.descriptorValue;
  }

  get ready(): Promise<void> {
    return this.readyDeferred.promise;
  }

  get lastSeen(): Date | undefined {
    return this._lastSeen;
  }

  get available(): boolean {
    return this._available;
  }

  isAvailable(): boolean {
    return this._available;
  }

  setAvailable(next: boolean): void {
    this._available = next;
  }

  updateDescriptor(descriptor: FlexRadioDescriptor): void {
    this.descriptorValue = descriptor;
    this._available = true;
    const lastSeenValue = descriptor.discoveryMeta?.lastSeen;
    this._lastSeen =
      typeof lastSeenValue === "number" ? new Date(lastSeenValue) : new Date();

    const diff = this.applyDescriptorToSnapshot(descriptor);
    if (diff) {
      const isInitial = !this.hasSnapshot;
      this.hasSnapshot = true;
      this.emitRadioChange(diff, isInitial);
    }
  }

  async connect(options?: RadioConnectionOptions): Promise<void> {
    if (this._connectionState === "ready" && this.session && !this.session.isClosed)
      return this.session.ready;
    if (this.connectPromise) return this.connectPromise;
    const descriptor = this.descriptorValue;
    if (!descriptor) throw new Error("Radio descriptor not available");
    this._connectionState = "connecting";
    this.readyDeferred.promise.catch(() => {});
    this.connectPromise = (async () => {
      try {
        const session = await this.client.connect(descriptor, options);
        this.attachSession(session);
        await session.ready;
      } catch (error) {
        this._connectionState = "disconnected";
        this.readyDeferred.reject(error);
        throw error;
      } finally {
        this.connectPromise = undefined;
      }
    })();
    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    if (!this.session) return;
    this._connectionState = "disconnecting";
    const session = this.session;
    await session.close();
  }

  snapshot(): RadioSnapshot {
    return this.cachedSnapshot;
  }

  command(command: string, options?: FlexCommandOptions) {
    const session = this.requireSession();
    return session.command(command, options);
  }

  slice(id: string): SliceController | undefined {
    return this.session?.slice(id);
  }

  panadapter(id: string): PanadapterController | undefined {
    return this.session?.panadapter(id);
  }

  waterfall(id: string): WaterfallController | undefined {
    return this.session?.waterfall(id);
  }

  meter(id: string): MeterController | undefined {
    return this.session?.meter(id);
  }

  audioStream(id: string): AudioStreamController | undefined {
    return this.session?.audioStream(id);
  }

  guiClients(): readonly GuiClientSnapshot[] {
    return this.session?.getGuiClients() ?? [];
  }

  on<TKey extends RadioHandleEventKey>(
    event: TKey,
    listener: RadioHandleEventListener<TKey>,
  ): Subscription {
    return super.on(event, listener);
  }

  off<TKey extends RadioHandleEventKey>(
    event: TKey,
    listener: RadioHandleEventListener<TKey>,
  ): void {
    super.off(event, listener);
  }

  currentRadioController(): RadioController | undefined {
    return this.session?.radio();
  }

  currentSnapshot(): RadioSnapshot {
    return this.cachedSnapshot;
  }

  currentReady(): Promise<void> {
    return this.readyDeferred.promise;
  }

  private requireSession(): FlexRadioSession {
    const session = this.session;
    if (!session || session.isClosed) {
      throw new FlexClientClosedError();
    }
    return session;
  }

  private attachSession(session: FlexRadioSession): void {
    this.session = session;
    this._connectionState = "connecting";
    const changeSub = session.on("change", (change: RadioStateChange) =>
      this.forwardChange(change),
    );
    const statusSub = session.on("status", () => {
      /* no-op placeholder */
    });
    const progressSub = session.on(
      "progress",
      (progress: FlexConnectionProgress) => {
        this.emit("progress", progress);
        this.clientEventEmitter("progress", {
          serial: this.serial,
          progress,
        });
      },
    );
    const readySub = session.on("ready", () => {
      this._connectionState = "ready";
      this.readyDeferred.resolve(undefined);
      this.emit("ready", undefined);
      this.clientConnected(this);
    });
    const disconnectSub = session.on("disconnected", () => {
      this._connectionState = "disconnected";
      this.emit("disconnected", undefined);
      this.clientDisconnected(this);
      this.detachSession();
    });
    const errorSub = session.on("error", (error: unknown) => {
      this.emit("error", error);
      this.clientEventEmitter("error", { serial: this.serial, error });
    });

    this.sessionSubscriptions = [
      changeSub,
      statusSub,
      progressSub,
      readySub,
      disconnectSub,
      errorSub,
    ];
  }

  private detachSession(): void {
    for (const sub of this.sessionSubscriptions) sub.unsubscribe();
    this.sessionSubscriptions = [];
    this.cachedSnapshot = this.session?.getRadio() ?? this.cachedSnapshot;
    this.session = undefined;
  }

  private forwardChange(change: RadioStateChange): void {
    const payload: RadioStateChangeWithSerial = {
      ...change,
      radioSerial: this.serial,
    };

    if (change.entity === "radio" && change.diff) {
      this.cachedSnapshot = Object.freeze({
        ...this.cachedSnapshot,
        ...change.diff,
      });
    }

    switch (change.entity) {
      case "radio":
        this.emit("radioChange", payload);
        this.clientEventEmitter("radioChange", payload);
        break;
      case "slice":
        this.emit("sliceChange", payload);
        this.clientEventEmitter("sliceChange", payload);
        break;
      case "panadapter":
        this.emit("panadapterChange", payload);
        this.clientEventEmitter("panadapterChange", payload);
        break;
      case "waterfall":
        this.emit("waterfallChange", payload);
        this.clientEventEmitter("waterfallChange", payload);
        break;
      case "meter":
        this.emit("meterChange", payload);
        this.clientEventEmitter("meterChange", payload);
        break;
      case "audioStream":
        this.emit("audioStreamChange", payload);
        this.clientEventEmitter("audioStreamChange", payload);
        break;
      case "guiClient":
        this.emit("guiClientChange", payload);
        this.clientEventEmitter("guiClientChange", payload);
        break;
      default:
        break;
    }
  }

  private emitRadioChange(
    diff: Partial<RadioSnapshot>,
    isNew: boolean,
  ): void {
    this.cachedSnapshot = Object.freeze({
      ...this.cachedSnapshot,
      ...diff,
    });
    const change: RadioStateChangeWithSerial = {
      entity: "radio",
      diff,
      removed: false,
      kind: isNew ? "added" : "updated",
      radioSerial: this.serial,
    };
    this.emit("radioChange", change);
    this.clientEventEmitter("radioChange", change);
  }

  private applyDescriptorToSnapshot(
    descriptor: FlexRadioDescriptor,
  ): Partial<RadioSnapshot> | undefined {
    const diff: Partial<RadioSnapshot> = {};
    const assign = <K extends keyof RadioSnapshot>(
      key: K,
      value: RadioSnapshot[K],
    ) => {
      if (this.cachedSnapshot[key] !== value) {
        diff[key] = value;
      }
    };

    assign("serial", descriptor.serial);
    assign("model", descriptor.model);
    assign("nickname", descriptor.nickname);
    assign("callsign", descriptor.callsign);
    assign("availableSlices", descriptor.availableSlices);
    assign("availablePanadapters", descriptor.availablePanadapters);
    assign("version", descriptor.version);
    assign("ipAddress", descriptor.host);

    return Object.keys(diff).length > 0 ? diff : undefined;
  }
}

function createRadioHandleProxy(core: RadioHandleCore): RadioHandle {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_, prop) {
      if (prop === Symbol.toStringTag) return "RadioHandle";

      if (prop === "serial") return core.serial;
      if (prop === "connectionState") return core.connectionState;
      if (prop === "descriptor") return core.descriptor;
      if (prop === "lastSeen") return core.lastSeen;
      if (prop === "available") return core.available;
      if (prop === "ready") return core.ready;
      if (prop === "connect") return core.connect.bind(core);
      if (prop === "disconnect") return core.disconnect.bind(core);
      if (prop === "command") return core.command.bind(core);
      if (prop === "slice") return core.slice.bind(core);
      if (prop === "panadapter") return core.panadapter.bind(core);
      if (prop === "waterfall") return core.waterfall.bind(core);
      if (prop === "meter") return core.meter.bind(core);
      if (prop === "audioStream") return core.audioStream.bind(core);
      if (prop === "guiClients") return core.guiClients.bind(core);
      if (prop === "snapshot") return core.snapshot.bind(core);
      if (prop === "on")
        return core.on.bind(core) as RadioHandleExtras["on"];
      if (prop === "off")
        return core.off.bind(core) as RadioHandleExtras["off"];

      const controller = core.currentRadioController();
      if (controller && Reflect.has(controller, prop)) {
        const value = Reflect.get(controller, prop, controller);
        return typeof value === "function" ? value.bind(controller) : value;
      }

      const snapshot = core.currentSnapshot();
      if (typeof prop === "string" && prop in snapshot) {
        return (snapshot as unknown as Record<string, unknown>)[prop];
      }
      return undefined;
    },
    has(_, prop) {
      if (
        [
          "serial",
          "connectionState",
          "descriptor",
          "lastSeen",
          "available",
          "ready",
          "connect",
          "disconnect",
          "command",
          "slice",
          "panadapter",
          "waterfall",
          "meter",
          "audioStream",
          "guiClients",
          "snapshot",
          "on",
          "off",
        ].includes(prop as string)
      )
        return true;
      const controller = core.currentRadioController();
      return !!controller && Reflect.has(controller, prop);
    },
  };

  return new Proxy({}, handler) as unknown as RadioHandle;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
