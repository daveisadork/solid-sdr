/**
 * Transport abstraction for FlexRadio communication.
 *
 * The transport layer is split into two interfaces at different lifecycle levels:
 *
 * - {@link FlexTransport} is **client-level** and long-lived. It handles
 *   VITA discovery and creates per-radio {@link FlexConnection} instances.
 *
 * - {@link FlexConnection} is **per-radio** and disposable. Each connection
 *   owns a TCP + UDP pair for a single radio. Multiple connections can exist
 *   simultaneously for multi-radio support.
 *
 * The critical design constraint is that event handlers are attached BEFORE
 * connect methods are called. This ensures no events are lost, even when the
 * underlying transport (e.g. a WebRTC data channel) emits data before its
 * "open" event fires.
 *
 * @example
 * ```ts
 * const conn = transport.createConnection();
 *
 * // 1. Attach handlers first — ready to receive immediately
 * conn.on("tcpData", (chunk) => handleTcp(chunk));
 * conn.on("udpData", (packet) => handleUdp(packet));
 * conn.on("close", () => handleClose());
 *
 * // 2. Connect — data starts flowing, handlers catch it,
 * //    promise resolves when ready to SEND
 * await conn.connectTcp({ host: "192.168.1.100", port: 4992 });
 *
 * // 3. Now safe to send commands
 * await conn.sendTcp("C1|info\n");
 * ```
 *
 * @module
 */

import type { Subscription } from "../util/events.js";

import type { RadioEndpoint } from "./client.js";

// Re-export so new code can import from transport.ts
// without depending on the legacy client.ts module.
export type { RadioEndpoint } from "./client.js";

// ---------------------------------------------------------------------------
// FlexTransport — client-level, long-lived
// ---------------------------------------------------------------------------

/** Event map for {@link FlexTransport}. */
export interface FlexTransportEvents {
  /** Raw VITA discovery packet received from the network. */
  readonly discoveryData: Uint8Array;
  /** Transport-level error. */
  readonly error: unknown;
}

/**
 * Client-level transport that handles VITA discovery and creates per-radio
 * connections.
 *
 * A single FlexTransport instance is owned by a FlexClient for its entire
 * lifetime. Discovery can be started and stopped multiple times. Each call
 * to {@link createConnection} returns an independent {@link FlexConnection}.
 */
export interface FlexTransport {
  /** Subscribe to a transport event. */
  on<K extends keyof FlexTransportEvents>(
    event: K,
    handler: (payload: FlexTransportEvents[K]) => void,
  ): Subscription;

  /** Start listening for VITA discovery packets. */
  startDiscovery(): Promise<void>;

  /** Stop listening for VITA discovery packets. */
  stopDiscovery(): Promise<void>;

  /** Create a new per-radio connection. */
  createConnection(): FlexConnection;

  /** Close the transport and release all resources. */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// FlexConnection — per-radio, disposable
// ---------------------------------------------------------------------------

/** Event map for {@link FlexConnection}. */
export interface FlexConnectionEvents {
  /** Data received over the TCP command channel. */
  readonly tcpData: string | Uint8Array;
  /** Raw VITA packet received over the UDP data channel. */
  readonly udpData: Uint8Array;
  /** The connection has been closed. */
  readonly close: undefined;
  /** Connection-level error. */
  readonly error: unknown;
}

/**
 * Per-radio connection owning a TCP + UDP pair.
 *
 * Created by {@link FlexTransport.createConnection}. Each connection is
 * independent and disposable — close it on disconnect, create a fresh one
 * to reconnect. Multiple connections can exist simultaneously for multi-radio
 * support.
 *
 * **Handler-before-connect contract:** Event handlers MUST be attachable
 * before any `connect*` method is called. Implementations MUST emit events
 * to already-attached handlers as soon as data arrives, even if the connect
 * promise has not yet resolved. The connect promise resolves when the
 * connection is ready to *send*, not when it starts *receiving*.
 */
export interface FlexConnection {
  /** Subscribe to a connection event. Attach handlers BEFORE calling connect. */
  on<K extends keyof FlexConnectionEvents>(
    event: K,
    handler: (payload: FlexConnectionEvents[K]) => void,
  ): Subscription;

  /**
   * Open the TCP command channel to the radio.
   *
   * Handlers attached via {@link on} will begin receiving `tcpData` events
   * as soon as the radio sends data — potentially before this promise
   * resolves. The promise resolves when the connection is ready to accept
   * {@link sendTcp} calls.
   */
  connectTcp(endpoint: RadioEndpoint): Promise<void>;

  /**
   * Open the UDP data channel for VITA streaming data.
   *
   * The transport implementation is responsible for any setup the radio
   * requires to begin sending UDP data (e.g. the `client udpport` command).
   * The Radio class does not need to know what port is used.
   */
  connectUdp(endpoint: RadioEndpoint): Promise<void>;

  /** Send a string payload over the TCP command channel. */
  sendTcp(data: string): Promise<void>;

  /** Send a binary payload over the UDP data channel. */
  sendUdp(data: Uint8Array): Promise<void>;

  /** Close both TCP and UDP channels and release all resources. */
  close(): Promise<void>;
}
