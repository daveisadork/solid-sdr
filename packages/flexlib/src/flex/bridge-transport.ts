/**
 * WebRTC bridge transport implementation.
 *
 * Uses RTCDataChannels over an existing RTCPeerConnection to implement the
 * {@link FlexTransport} and {@link FlexConnection} interfaces. The bridge
 * server on the other end of the peer connection proxies TCP/UDP traffic
 * to and from the FlexRadio device.
 *
 * @module
 */

import type { Subscription } from "../util/events.js";
import { TypedEventEmitter } from "../util/events.js";
import type {
  FlexConnection,
  FlexConnectionEvents,
  FlexTransport,
  FlexTransportEvents,
  RadioEndpoint,
} from "./transport.js";

// ---------------------------------------------------------------------------
// Minimal WebRTC type shims
// ---------------------------------------------------------------------------
// The library tsconfig uses `"lib": ["es2023"]` (no DOM), so we declare
// just the surface area we need. These are structurally compatible with
// the real DOM `RTCPeerConnection` and `RTCDataChannel` types.

/** Minimal `Event` shim for environments without DOM types. @internal */
interface BridgeEvent {
  readonly type: string;
}

/** Minimal `MessageEvent` shim for environments without DOM types. @internal */
interface BridgeMessageEvent extends BridgeEvent {
  readonly data: unknown;
}

/** @internal */
interface DataChannelInit {
  ordered?: boolean;
  maxRetransmits?: number;
  protocol?: string;
}

/** @internal */
interface DataChannelEventMap {
  open: BridgeEvent;
  close: BridgeEvent;
  error: BridgeEvent;
  message: BridgeMessageEvent;
}

/** Minimal subset of `RTCDataChannel` used by this module. @internal */
export interface BridgeDataChannel {
  binaryType: string;
  readonly readyState: string;
  send(data: string): void;
  close(): void;
  addEventListener<K extends keyof DataChannelEventMap>(
    type: K,
    listener: (this: void, ev: DataChannelEventMap[K]) => void,
    options?: { once?: boolean },
  ): void;
}

/** Minimal subset of `RTCPeerConnection` used by this module. @internal */
export interface BridgePeerConnection {
  createDataChannel(label: string, init?: DataChannelInit): BridgeDataChannel;
}

// ---------------------------------------------------------------------------
// BridgeConnection
// ---------------------------------------------------------------------------

/**
 * Per-radio connection using WebRTC data channels for TCP and UDP.
 *
 * Implements the handler-before-connect contract: event handlers are
 * attached via {@link on} before {@link connectTcp} / {@link connectUdp}
 * are called. Message handlers are wired to the data channel immediately
 * on creation — before waiting for the "open" event — so no data is lost.
 */
export class BridgeConnection
  extends TypedEventEmitter<FlexConnectionEvents>
  implements FlexConnection
{
  private readonly pc: BridgePeerConnection;
  private tcpChannel?: BridgeDataChannel;
  private udpChannel?: BridgeDataChannel;
  private closed = false;

  constructor(pc: BridgePeerConnection) {
    super();
    this.pc = pc;
  }

  on<K extends keyof FlexConnectionEvents>(
    event: K,
    handler: (payload: FlexConnectionEvents[K]) => void,
  ): Subscription {
    return super.on(event, handler);
  }

  async connectTcp(endpoint: RadioEndpoint): Promise<void> {
    if (this.closed) throw new Error("Connection is closed");
    if (this.tcpChannel) throw new Error("TCP already connected");

    const dc = this.pc.createDataChannel(`${endpoint.host}:${endpoint.port}`, {
      ordered: true,
      protocol: "tcp",
    });
    dc.binaryType = "arraybuffer";
    this.tcpChannel = dc;

    // Attach event forwarding IMMEDIATELY — before waiting for "open".
    // This ensures handlers receive data as soon as the channel delivers
    // it, even if "open" has not yet fired.
    dc.addEventListener("message", (ev: BridgeMessageEvent) => {
      this.emit("tcpData", ev.data as string | Uint8Array);
    });
    dc.addEventListener("close", () => {
      this.emit("close", undefined);
    });
    dc.addEventListener("error", (ev: BridgeEvent) => {
      this.emit("error", ev);
    });

    // Resolve when the channel is open and ready to send.
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        resolve();
      };
      const onError = (event: BridgeEvent) => {
        reject(new Error("TCP data channel error", { cause: event }));
      };
      dc.addEventListener("open", onOpen, { once: true });
      dc.addEventListener("error", onError, { once: true });
    });
  }

  async connectUdp(endpoint: RadioEndpoint): Promise<void> {
    if (this.closed) throw new Error("Connection is closed");
    if (this.udpChannel) throw new Error("UDP already connected");

    // UDP channel uses port + 1 as the label convention.
    const dc = this.pc.createDataChannel(
      `${endpoint.host}:${endpoint.port + 1}`,
      {
        ordered: false,
        maxRetransmits: 0,
        protocol: "udp",
      },
    );
    dc.binaryType = "arraybuffer";
    this.udpChannel = dc;

    // Attach event forwarding immediately.
    dc.addEventListener("message", (ev: BridgeMessageEvent) => {
      this.emit("udpData", new Uint8Array(ev.data as ArrayBuffer));
    });
    dc.addEventListener("error", (ev: BridgeEvent) => {
      this.emit("error", ev);
    });

    // The bridge server handles `client udpport` internally, so we just
    // wait for the channel to open.
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        resolve();
      };
      const onError = (event: BridgeEvent) => {
        reject(new Error("UDP data channel error", { cause: event }));
      };
      dc.addEventListener("open", onOpen, { once: true });
      dc.addEventListener("error", onError, { once: true });
    });
  }

  async sendTcp(data: string): Promise<void> {
    if (this.closed) throw new Error("Connection is closed");
    const dc = this.tcpChannel;
    if (!dc || dc.readyState !== "open") {
      throw new Error("TCP data channel is not connected");
    }
    dc.send(data);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    const tcp = this.tcpChannel;
    const udp = this.udpChannel;
    this.tcpChannel = undefined;
    this.udpChannel = undefined;

    if (udp) {
      try {
        udp.close();
      } catch {
        // already closed
      }
    }

    if (tcp) {
      try {
        tcp.close();
      } catch {
        // already closed
      }
    }

    this.removeAll();
  }
}

// ---------------------------------------------------------------------------
// BridgeTransport
// ---------------------------------------------------------------------------

/**
 * Client-level transport using a WebRTC peer connection. Opens a
 * "discovery" data channel for VITA discovery packets and creates
 * {@link BridgeConnection} instances for per-radio communication.
 */
export class BridgeTransport
  extends TypedEventEmitter<FlexTransportEvents>
  implements FlexTransport
{
  private readonly pc: BridgePeerConnection;
  private discoveryChannel?: BridgeDataChannel;
  private closed = false;

  constructor(pc: BridgePeerConnection) {
    super();
    this.pc = pc;
  }

  on<K extends keyof FlexTransportEvents>(
    event: K,
    handler: (payload: FlexTransportEvents[K]) => void,
  ): Subscription {
    return super.on(event, handler);
  }

  async startDiscovery(): Promise<void> {
    if (this.closed) throw new Error("Transport is closed");
    if (this.discoveryChannel) return; // already listening

    const dc = this.pc.createDataChannel("discovery", {
      ordered: false,
      maxRetransmits: 0,
      protocol: "discovery",
    });
    dc.binaryType = "arraybuffer";
    this.discoveryChannel = dc;

    // Attach message forwarding immediately.
    dc.addEventListener("message", (ev: BridgeMessageEvent) => {
      this.emit("discoveryData", new Uint8Array(ev.data as ArrayBuffer));
    });
    dc.addEventListener("error", (ev: BridgeEvent) => {
      this.emit("error", ev);
    });

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        resolve();
      };
      const onError = (event: BridgeEvent) => {
        reject(new Error("Discovery channel error", { cause: event }));
      };
      dc.addEventListener("open", onOpen, { once: true });
      dc.addEventListener("error", onError, { once: true });
    });
  }

  async stopDiscovery(): Promise<void> {
    const dc = this.discoveryChannel;
    if (!dc) return;
    this.discoveryChannel = undefined;
    try {
      dc.close();
    } catch {
      // already closed
    }
  }

  createConnection(): FlexConnection {
    if (this.closed) throw new Error("Transport is closed");
    return new BridgeConnection(this.pc);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.stopDiscovery();
    this.removeAll();
  }
}
