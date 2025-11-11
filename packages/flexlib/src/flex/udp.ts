import type { Logger } from "./adapters.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
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
}
