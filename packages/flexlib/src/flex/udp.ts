import type { Logger } from "./adapters.js";
import {
  TypedEventEmitter,
  type Listener,
  type Subscription,
} from "./events.js";
import {
  parseVitaPacket,
  type ParseVitaPacketOptions,
  type VitaPacketKind,
  type VitaParsedPacket,
  type VitaPacketMetadata,
} from "../vita/parser.js";

export type FlexUdpEventKey = VitaPacketKind;

export type FlexUdpPacketEvent<TKey extends FlexUdpEventKey> = {
  readonly kind: TKey;
  readonly packet: Extract<VitaParsedPacket, { kind: TKey }>["packet"];
  readonly metadata: VitaPacketMetadata;
};

export type FlexUdpEvents = {
  [K in FlexUdpEventKey]: FlexUdpPacketEvent<K>;
};

export type FlexUdpPayload = ArrayBuffer | ArrayBufferView | Uint8Array;

export interface FlexUdpMessageEvent {
  readonly data: unknown;
}

export interface FlexUdpSession {
  on<TKey extends FlexUdpEventKey>(
    event: TKey,
    listener: (payload: FlexUdpEvents[TKey]) => void,
  ): Subscription;
  once<TKey extends FlexUdpEventKey>(
    event: TKey,
    listener: (payload: FlexUdpEvents[TKey]) => void,
  ): Subscription;
  off<TKey extends FlexUdpEventKey>(
    event: TKey,
    listener: (payload: FlexUdpEvents[TKey]) => void,
  ): void;
  removeAll(): void;
  ingest(payload: FlexUdpPayload): void;
  ingestMessageEvent(event: FlexUdpMessageEvent): void;
  scope<TKey extends FlexUdpEventKey>(
    event: TKey,
    filter?: FlexUdpScopeFilter<TKey>,
  ): FlexUdpScope<TKey>;
}

export interface FlexUdpSessionOptions {
  readonly logger?: Logger;
}

export interface FlexRtcDataChannel {
  addEventListener(
    type: "message",
    listener: (event: FlexUdpMessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: FlexUdpMessageEvent) => void,
  ): void;
}

export function createFlexUdpSession(
  options: FlexUdpSessionOptions = {},
): FlexUdpSession {
  return new FlexUdpSessionImpl(options);
}

export interface AttachRtcDataChannelOptions {
  readonly onError?: (error: unknown) => void;
}

export type FlexUdpScopeFilter<TKey extends FlexUdpEventKey> = (
  event: FlexUdpEvents[TKey],
) => boolean;

export interface FlexUdpScope<TKey extends FlexUdpEventKey> {
  on(listener: Listener<FlexUdpEvents[TKey]>): Subscription;
  once(listener: Listener<FlexUdpEvents[TKey]>): Subscription;
  off(listener: Listener<FlexUdpEvents[TKey]>): void;
  removeAll(): void;
}

export function attachRtcDataChannelToFlexUdp(
  udpSession: FlexUdpSession,
  channel: FlexRtcDataChannel,
  options: AttachRtcDataChannelOptions = {},
): () => void {
  const handler = (event: FlexUdpMessageEvent) => {
    try {
      udpSession.ingestMessageEvent(event);
    } catch (error) {
      options.onError?.(error);
    }
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
  };
}

class FlexUdpSessionImpl implements FlexUdpSession {
  private readonly events = new TypedEventEmitter<FlexUdpEvents>();

  private readonly scratch: Required<ParseVitaPacketOptions> = {
    meter: { ids: new Uint16Array(0), values: new Int16Array(0) },
    panadapter: { payload: new Uint16Array(0) },
    waterfall: { data: new Uint16Array(0) },
  };

  constructor(private readonly options: FlexUdpSessionOptions) {}

  on<TKey extends FlexUdpEventKey>(
    event: TKey,
    listener: (payload: FlexUdpEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  once<TKey extends FlexUdpEventKey>(
    event: TKey,
    listener: (payload: FlexUdpEvents[TKey]) => void,
  ): Subscription {
    return this.events.once(event, listener);
  }

  off<TKey extends FlexUdpEventKey>(
    event: TKey,
    listener: (payload: FlexUdpEvents[TKey]) => void,
  ): void {
    this.events.off(event, listener);
  }

  removeAll(): void {
    this.events.removeAll();
  }

  ingest(payload: FlexUdpPayload): void {
    const bytes = this.normalizePayload(payload);
    this.dispatch(bytes);
  }

  ingestMessageEvent(event: FlexUdpMessageEvent): void {
    const { data } = event;
    if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
      this.dispatch(new Uint8Array(data));
      return;
    }
    if (ArrayBuffer.isView(data)) {
      const view = new Uint8Array(
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
      this.dispatch(view);
      return;
    }
    throw new TypeError(
      `Unsupported UDP message payload type: ${typeof data}`,
    );
  }

  private dispatch(payload: Uint8Array): void {
    const parsed = parseVitaPacket(payload, this.scratch);
    if (!parsed) {
      this.options.logger?.warn?.("Unhandled UDP packet", {
        payloadLength: payload.byteLength,
      });
      return;
    }
    const { kind, packet } = parsed;
    const metadata: VitaPacketMetadata = {
      header: parsed.header,
      classId: parsed.classId,
      streamId: parsed.streamId,
      timestampInt: parsed.timestampInt,
      timestampFrac: parsed.timestampFrac,
    };
    this.events.emit(kind, { kind, packet, metadata } as FlexUdpEvents[typeof kind]);
  }

  private normalizePayload(payload: FlexUdpPayload): Uint8Array {
    if (payload instanceof Uint8Array) {
      return payload;
    }
    if (typeof ArrayBuffer !== "undefined" && payload instanceof ArrayBuffer) {
      return new Uint8Array(payload);
    }
    if (ArrayBuffer.isView(payload)) {
      return new Uint8Array(
        payload.buffer,
        payload.byteOffset,
        payload.byteLength,
      );
    }
    throw new TypeError("Unsupported UDP payload");
  }

  scope<TKey extends FlexUdpEventKey>(
    event: TKey,
    filter: FlexUdpScopeFilter<TKey> = () => true,
  ): FlexUdpScope<TKey> {
    return new FlexUdpScopeImpl(this, event, filter);
  }
}

class FlexUdpScopeImpl<TKey extends FlexUdpEventKey>
  implements FlexUdpScope<TKey>
{
  private readonly listeners = new Set<Listener<FlexUdpEvents[TKey]>>();
  private parentSubscription?: Subscription;

  constructor(
    private readonly parent: FlexUdpSessionImpl,
    private readonly event: TKey,
    private readonly filter: FlexUdpScopeFilter<TKey>,
  ) {}

  on(listener: Listener<FlexUdpEvents[TKey]>): Subscription {
    this.listeners.add(listener);
    this.ensureParent();
    return {
      unsubscribe: () => this.off(listener),
    };
  }

  once(listener: Listener<FlexUdpEvents[TKey]>): Subscription {
    const wrapper: Listener<FlexUdpEvents[TKey]> = (payload) => {
      this.off(wrapper);
      listener(payload);
    };
    return this.on(wrapper);
  }

  off(listener: Listener<FlexUdpEvents[TKey]>): void {
    const removed = this.listeners.delete(listener);
    if (!removed) return;
    if (this.listeners.size === 0) {
      this.teardownParent();
    }
  }

  removeAll(): void {
    if (this.listeners.size === 0) return;
    this.listeners.clear();
    this.teardownParent();
  }

  private ensureParent(): void {
    if (this.parentSubscription) return;
    this.parentSubscription = this.parent.on(this.event, (payload) => {
      if (this.filter(payload)) {
        this.emit(payload);
      }
    });
  }

  private teardownParent(): void {
    if (!this.parentSubscription) return;
    this.parentSubscription.unsubscribe();
    this.parentSubscription = undefined;
  }

  private emit(payload: FlexUdpEvents[TKey]): void {
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
