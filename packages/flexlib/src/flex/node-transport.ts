/**
 * Node.js transport implementation using `net.Socket` for TCP and `dgram`
 * for UDP. Provides zero-config transport for Node.js users.
 *
 * @module
 */

import { Socket } from "node:net";
import {
  createSocket,
  type Socket as DgramSocket,
  type RemoteInfo,
} from "node:dgram";
import type { Subscription } from "../util/events.js";
import { TypedEventEmitter } from "../util/events.js";
import type {
  FlexConnection,
  FlexConnectionEvents,
  FlexTransport,
  FlexTransportEvents,
  RadioEndpoint,
} from "./transport.js";

/** Default port that FlexRadio devices broadcast VITA discovery packets on. */
const DISCOVERY_PORT = 4992;

// ---------------------------------------------------------------------------
// NodeConnection
// ---------------------------------------------------------------------------

/**
 * Per-radio connection using Node `net.Socket` for TCP and `dgram` for UDP.
 *
 * Implements the handler-before-connect contract: event handlers are
 * attached via {@link on} before {@link connectTcp} / {@link connectUdp}
 * are called. Events emitted by the underlying sockets are forwarded to
 * handlers immediately, even before the connect promise resolves.
 */
export class NodeConnection
  extends TypedEventEmitter<FlexConnectionEvents>
  implements FlexConnection
{
  private tcpSocket?: Socket;
  private udpSocket?: DgramSocket;
  private closed = false;

  on<K extends keyof FlexConnectionEvents>(
    event: K,
    handler: (payload: FlexConnectionEvents[K]) => void,
  ): Subscription {
    return super.on(event, handler);
  }

  async connectTcp(endpoint: RadioEndpoint): Promise<void> {
    if (this.closed) throw new Error("Connection is closed");
    if (this.tcpSocket) throw new Error("TCP already connected");

    const socket = new Socket();
    this.tcpSocket = socket;

    // Attach event forwarding immediately so handlers receive data
    // as soon as the kernel delivers it — potentially before the
    // connect callback fires.
    socket.on("data", (chunk: Buffer) => {
      this.emit("tcpData", chunk);
    });
    socket.on("close", () => {
      this.emit("close", undefined);
    });
    socket.on("error", (err: Error) => {
      this.emit("error", err);
    });

    return new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        socket.removeListener("error", onError);
        reject(err);
      };
      socket.once("error", onError);
      socket.connect(endpoint.port, endpoint.host, () => {
        socket.removeListener("error", onError);
        resolve();
      });
    });
  }

  async connectUdp(_endpoint: RadioEndpoint): Promise<void> {
    if (this.closed) throw new Error("Connection is closed");
    if (this.udpSocket) throw new Error("UDP already connected");

    const socket = createSocket({ type: "udp4", reuseAddr: true });
    this.udpSocket = socket;

    socket.on("message", (msg: Buffer) => {
      this.emit("udpData", msg);
    });
    socket.on("error", (err: Error) => {
      this.emit("error", err);
    });

    // Bind to an ephemeral port.
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.bind(0, () => {
        socket.removeAllListeners("error");
        resolve();
      });
    });

    // Tell the radio where to send UDP data.
    const localPort = socket.address().port;
    await this.sendTcp(`C0|client udpport ${localPort}\n`);
  }

  async sendTcp(data: string): Promise<void> {
    if (this.closed) throw new Error("Connection is closed");
    const socket = this.tcpSocket;
    if (!socket || socket.destroyed) {
      throw new Error("TCP socket is not connected");
    }
    return new Promise<void>((resolve, reject) => {
      socket.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  async sendUdp(data: Uint8Array): Promise<void> {
    if (this.closed) throw new Error("Connection is closed");
    const socket = this.udpSocket;
    if (!socket) {
      throw new Error("UDP socket is not connected");
    }
    return new Promise<void>((resolve, reject) => {
      socket.send(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    const tcp = this.tcpSocket;
    const udp = this.udpSocket;
    this.tcpSocket = undefined;
    this.udpSocket = undefined;

    if (udp) {
      try {
        udp.close();
      } catch {
        // already closed
      }
    }

    if (tcp) {
      tcp.removeAllListeners();
      if (!tcp.destroyed) {
        await new Promise<void>((resolve) => {
          tcp.once("close", resolve);
          tcp.destroy();
        });
      }
    }

    this.removeAll();
  }
}

// ---------------------------------------------------------------------------
// NodeTransport
// ---------------------------------------------------------------------------

/**
 * Client-level transport for Node.js. Listens for VITA discovery broadcasts
 * on port 4992 and creates {@link NodeConnection} instances for per-radio
 * communication.
 */
export class NodeTransport
  extends TypedEventEmitter<FlexTransportEvents>
  implements FlexTransport
{
  private discoverySocket?: DgramSocket;
  private closed = false;

  on<K extends keyof FlexTransportEvents>(
    event: K,
    handler: (payload: FlexTransportEvents[K]) => void,
  ): Subscription {
    return super.on(event, handler);
  }

  async startDiscovery(): Promise<void> {
    if (this.closed) throw new Error("Transport is closed");
    if (this.discoverySocket) return; // already listening

    const socket = createSocket({ type: "udp4", reuseAddr: true });
    this.discoverySocket = socket;

    socket.on("message", (msg: Buffer, _rinfo: RemoteInfo) => {
      this.emit("discoveryData", msg);
    });
    socket.on("error", (err: Error) => {
      this.emit("error", err);
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.bind(DISCOVERY_PORT, () => {
        socket.removeAllListeners("error");
        socket.setBroadcast(true);
        resolve();
      });
    });
  }

  async stopDiscovery(): Promise<void> {
    const socket = this.discoverySocket;
    if (!socket) return;
    this.discoverySocket = undefined;
    try {
      socket.close();
    } catch {
      // already closed
    }
  }

  createConnection(): FlexConnection {
    if (this.closed) throw new Error("Transport is closed");
    return new NodeConnection();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.stopDiscovery();
    this.removeAll();
  }
}
