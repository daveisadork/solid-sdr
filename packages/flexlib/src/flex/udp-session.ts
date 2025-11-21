import type { Logger } from "./adapters.js";
import {
  TypedEventEmitter,
  type Listener,
  type Subscription,
} from "../util/events.js";
import {
  parseVitaPacket,
  type ParseVitaPacketOptions,
  type VitaPacketKind,
  type VitaParsedPacket,
  type VitaPacketMetadata,
} from "../vita/parser.js";

export type UdpEventKey = VitaPacketKind;

export type UdpPacketEvent<TKey extends UdpEventKey> = {
  readonly kind: TKey;
  readonly packet: Extract<VitaParsedPacket, { kind: TKey }>["packet"];
  readonly metadata: VitaPacketMetadata;
};

export type UdpEvents = {
  [K in UdpEventKey]: UdpPacketEvent<K>;
};

export type UdpPayload = ArrayBuffer | ArrayBufferView | Uint8Array;

export interface UdpMessageEvent {
  readonly data: unknown;
}

export interface UdpSession {
  on<TKey extends UdpEventKey>(
    event: TKey,
    listener: (payload: UdpEvents[TKey]) => void,
  ): Subscription;
  once<TKey extends UdpEventKey>(
    event: TKey,
    listener: (payload: UdpEvents[TKey]) => void,
  ): Subscription;
  off<TKey extends UdpEventKey>(
    event: TKey,
    listener: (payload: UdpEvents[TKey]) => void,
  ): void;
  removeAll(): void;
  ingest(payload: UdpPayload): void;
  ingestMessageEvent(event: UdpMessageEvent): void;
  scope<TKey extends UdpEventKey>(
    event: TKey,
    filter?: UdpScopeFilter<TKey>,
  ): UdpScope<TKey>;
}

export interface UdpSessionOptions {
  readonly logger?: Logger;
}

export interface RtcDataChannel {
  addEventListener(
    type: "message",
    listener: (event: UdpMessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: UdpMessageEvent) => void,
  ): void;
}

export function createUdpSession(
  options: UdpSessionOptions = {},
): UdpSession {
  return new UdpSessionImpl(options);
}

export interface AttachRtcDataChannelOptions {
  readonly onError?: (error: unknown) => void;
}

export type UdpScopeFilter<TKey extends UdpEventKey> = (
  event: UdpEvents[TKey],
) => boolean;

export interface UdpScope<TKey extends UdpEventKey> {
  on(listener: Listener<UdpEvents[TKey]>): Subscription;
  once(listener: Listener<UdpEvents[TKey]>): Subscription;
  off(listener: Listener<UdpEvents[TKey]>): void;
  removeAll(): void;
}

export function attachRtcDataChannel(
  udpSession: UdpSession,
  channel: RtcDataChannel,
  options: AttachRtcDataChannelOptions = {},
): () => void {
  const handler = (event: UdpMessageEvent) => {
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

class UdpSessionImpl implements UdpSession {
  private readonly events = new TypedEventEmitter<UdpEvents>();

  private readonly scratch: Required<ParseVitaPacketOptions> = {
    meter: { ids: new Uint16Array(0), values: new Int16Array(0) },
    panadapter: { payload: new Uint16Array(0) },
    waterfall: { data: new Uint16Array(0) },
  };

  constructor(private readonly options: UdpSessionOptions) {}

  on<TKey extends UdpEventKey>(
    event: TKey,
    listener: (payload: UdpEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  once<TKey extends UdpEventKey>(
    event: TKey,
    listener: (payload: UdpEvents[TKey]) => void,
  ): Subscription {
    return this.events.once(event, listener);
  }

  off<TKey extends UdpEventKey>(
    event: TKey,
    listener: (payload: UdpEvents[TKey]) => void,
  ): void {
    this.events.off(event, listener);
  }

  removeAll(): void {
    this.events.removeAll();
  }

  ingest(payload: UdpPayload): void {
    const bytes = this.normalizePayload(payload);
    this.dispatch(bytes);
  }

  ingestMessageEvent(event: UdpMessageEvent): void {
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
    this.events.emit(kind, { kind, packet, metadata } as UdpEvents[typeof kind]);
  }

  private normalizePayload(payload: UdpPayload): Uint8Array {
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

  scope<TKey extends UdpEventKey>(
    event: TKey,
    filter: UdpScopeFilter<TKey> = () => true,
  ): UdpScope<TKey> {
    return new UdpScopeImpl(this, event, filter);
  }
}

class UdpScopeImpl<TKey extends UdpEventKey>
  implements UdpScope<TKey>
{
  private readonly listeners = new Set<Listener<UdpEvents[TKey]>>();
  private parentSubscription?: Subscription;

  constructor(
    private readonly parent: UdpSessionImpl,
    private readonly event: TKey,
    private readonly filter: UdpScopeFilter<TKey>,
  ) {}

  on(listener: Listener<UdpEvents[TKey]>): Subscription {
    this.listeners.add(listener);
    this.ensureParent();
    return {
      unsubscribe: () => this.off(listener),
    };
  }

  once(listener: Listener<UdpEvents[TKey]>): Subscription {
    const wrapper: Listener<UdpEvents[TKey]> = (payload) => {
      this.off(wrapper);
      listener(payload);
    };
    return this.on(wrapper);
  }

  off(listener: Listener<UdpEvents[TKey]>): void {
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

  private emit(payload: UdpEvents[TKey]): void {
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
