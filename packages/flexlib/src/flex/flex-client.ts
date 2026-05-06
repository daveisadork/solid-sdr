/**
 * FlexClient — the top-level entry point for interacting with FlexRadio devices.
 *
 * Manages VITA discovery and the collection of known radios. Platform-specific
 * entry points (`@repo/flexlib/node`, `@repo/flexlib/bridge`) pre-wire the
 * transport so construction is zero-config.
 *
 * @module
 */

import { TypedEventEmitter, type Subscription } from "../util/events.js";
import type { FlexTransport, RadioEndpoint } from "./transport.js";
import type { Logger } from "./adapters.js";
import type { FlexRadioDescriptor } from "./adapters.js";
import { Radio, type RadioConnectOptions } from "./radio-core.js";
import { FlexCommandRejectedError } from "./errors.js";
import { parseVitaPacket } from "../vita/parser.js";
import { decodeDiscoveryPayload } from "./discovery.js";
import { describeResponseCode } from "./response-codes.js";
import { parseFlexMessage, type FlexReplyMessage } from "./protocol.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating a FlexClient. */
export interface FlexClientOptions {
  /** Transport implementation. Required for the base import; pre-wired by platform entry points. */
  readonly transport: FlexTransport;
  /** Optional logger instance. */
  readonly logger?: Logger;
  /**
   * How long (ms) before a radio that stops sending discovery packets
   * is considered offline. Defaults to 20000. Set to 0 to disable.
   */
  readonly offlineTimeoutMs?: number;
}

/** Options for lightweight one-shot command connections. */
export interface FlexClientCommandOptions {
  /**
   * How long to wait for the radio's reply before failing.
   * Defaults to 5000ms.
   */
  readonly timeoutMs?: number;
}

/** Event map for the FlexClient. */
export interface FlexClientEvents {
  /** A new radio was discovered on the network. */
  readonly radioDiscovered: Radio;
  /** A known radio's discovery data was updated (e.g. availableClients changed). */
  readonly radioUpdated: Radio;
  /** A previously discovered radio stopped sending discovery packets on a specific endpoint. */
  readonly radioLost: {
    readonly serial: string;
    readonly endpoint?: RadioEndpoint;
  };
  /** Transport-level error. */
  readonly error: unknown;
}

export type FlexClientEventKey = keyof FlexClientEvents;

// ---------------------------------------------------------------------------
// FlexClient
// ---------------------------------------------------------------------------

/**
 * Top-level client that manages radio discovery and the collection of
 * known radios.
 *
 * @example
 * ```ts
 * import { FlexClient } from "@repo/flexlib/node";
 *
 * const client = new FlexClient();
 * await client.startDiscovery();
 *
 * client.on("radioDiscovered", async (radio) => {
 *   await radio.connect();
 *   console.log(`Connected to ${radio.serial}`);
 * });
 * ```
 */
// Exported as FlexClient to avoid collision with legacy FlexClient in session.ts.
// Will be renamed to FlexClient during cleanup (Task 10).
export class FlexClient {
  private readonly transport: FlexTransport;
  private readonly events = new TypedEventEmitter<FlexClientEvents>();
  private readonly radioMap = new Map<string, Radio>();
  private readonly offlineTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly logger?: Logger;
  private readonly offlineTimeoutMs: number;
  private discoveryActive = false;
  private transportSub?: Subscription;
  private transportErrorSub?: Subscription;
  private closed = false;

  constructor(options: FlexClientOptions) {
    this.transport = options.transport;
    this.logger = options.logger;
    this.offlineTimeoutMs = options.offlineTimeoutMs ?? 20_000;

    this.transportSub = this.transport.on("discoveryData", (data) =>
      this.handleDiscoveryData(data),
    );
    this.transportErrorSub = this.transport.on("error", (err) =>
      this.events.emit("error", err),
    );
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  on<K extends FlexClientEventKey>(
    event: K,
    handler: (payload: FlexClientEvents[K]) => void,
  ): Subscription {
    return this.events.on(event, handler);
  }

  off<K extends FlexClientEventKey>(
    event: K,
    handler: (payload: FlexClientEvents[K]) => void,
  ): void {
    this.events.off(event, handler);
  }

  // -----------------------------------------------------------------------
  // Discovery
  // -----------------------------------------------------------------------

  /** Start listening for VITA discovery packets on the network. */
  async startDiscovery(): Promise<void> {
    if (this.closed) throw new Error("FlexClient is closed");
    if (this.discoveryActive) return;
    await this.transport.startDiscovery();
    this.discoveryActive = true;
  }

  /** Stop listening for discovery packets. */
  async stopDiscovery(): Promise<void> {
    if (!this.discoveryActive) return;
    await this.transport.stopDiscovery();
    this.discoveryActive = false;
    this.clearOfflineTimers();
  }

  // -----------------------------------------------------------------------
  // Radio collection
  // -----------------------------------------------------------------------

  /** All known radios (discovered or directly connected). */
  radios(): Radio[] {
    return Array.from(this.radioMap.values());
  }

  /** Look up a radio by serial number. */
  radio(serial: string): Radio | undefined {
    return this.radioMap.get(serial);
  }

  /** Look up a radio by host:port endpoint. */
  radioByEndpoint(endpoint: RadioEndpoint): Radio | undefined {
    const target = `${endpoint.host}:${endpoint.port}`;
    for (const radio of this.radioMap.values()) {
      const ep = radio.endpoint;
      if (`${ep.host}:${ep.port}` === target) return radio;
    }
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Direct connection
  // -----------------------------------------------------------------------

  /**
   * Connect directly to a radio by IP:port without discovery.
   *
   * The returned Radio will have limited identity information until the
   * TCP handshake populates it from status messages.
   */
  async connect(
    endpoint: RadioEndpoint,
    options?: RadioConnectOptions,
  ): Promise<Radio> {
    if (this.closed) throw new Error("FlexClient is closed");
    const radio = new Radio("unknown", this.transport, endpoint, {
      logger: this.logger,
    });
    await radio.connect(options);
    // After connect, serial should be populated from status messages
    if (radio.serial && radio.serial !== "unknown") {
      this.radioMap.set(radio.serial, radio);
    }
    return radio;
  }

  /**
   * Force-disconnect a GUI client by handle using a lightweight transient TCP
   * connection instead of a full radio session.
   */
  async disconnectClient(
    target: Radio | RadioEndpoint,
    clientHandle: number | string,
    options?: FlexClientCommandOptions,
  ): Promise<void> {
    if (this.closed) throw new Error("FlexClient is closed");
    const endpoint = target instanceof Radio ? target.endpoint : target;
    const handle = normalizeClientHandle(clientHandle);
    const reply = await this.sendEphemeralCommand(
      endpoint,
      `client disconnect ${handle}`,
      options,
    );

    if (reply.code !== 0) {
      throw new FlexCommandRejectedError(
        reply.message || `Radio rejected command: client disconnect ${handle}`,
        {
          sequence: reply.sequence,
          code: reply.code,
          raw: reply.raw,
          message: reply.message,
        },
        describeResponseCode(reply.code),
      );
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /** Close the client, disconnect all radios, and release resources. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.stopDiscovery();

    // Disconnect all tracked radios
    const disconnects = Array.from(this.radioMap.values()).map((radio) =>
      radio.disconnect().catch((err) => {
        this.logger?.warn?.("Error disconnecting radio during close", {
          serial: radio.serial,
          error: err,
        });
      }),
    );
    await Promise.all(disconnects);
    this.radioMap.clear();

    this.transportSub?.unsubscribe();
    this.transportErrorSub?.unsubscribe();
    this.transportSub = undefined;
    this.transportErrorSub = undefined;

    await this.transport.close();
    this.events.removeAll();
  }

  // -----------------------------------------------------------------------
  // Discovery data handling
  // -----------------------------------------------------------------------

  private handleDiscoveryData(data: Uint8Array): void {
    try {
      const parsed = parseVitaPacket(data);
      if (!parsed || parsed.kind !== "discovery") return;

      const descriptor = decodeDiscoveryPayload(
        parsed.packet.payload,
        Date.now(),
      );

      const endpoint: RadioEndpoint = {
        host: descriptor.host,
        port: descriptor.port,
      };
      this.scheduleOfflineTimer(descriptor.serial, endpoint);

      let radio = this.radioMap.get(descriptor.serial);
      if (!radio) {
        radio = new Radio(
          descriptor.serial,
          this.transport,
          { host: descriptor.host, port: descriptor.port },
          { logger: this.logger },
        );
        radio.updateFromDescriptor(descriptor);
        this.updateRadioFromDescriptor(radio, descriptor);
        this.radioMap.set(descriptor.serial, radio);
        this.events.emit("radioDiscovered", radio);
      } else {
        radio.updateFromDescriptor(descriptor);
        this.updateRadioFromDescriptor(radio, descriptor);
        this.events.emit("radioUpdated", radio);
      }
    } catch (error) {
      this.logger?.warn?.("Failed to parse discovery packet", { error });
    }
  }

  private updateRadioFromDescriptor(
    radio: Radio,
    descriptor: FlexRadioDescriptor,
  ): void {
    // Push descriptor fields into the radio's state store so that
    // properties like model, nickname, callsign are available before connect.
    const store = radio.getStore();
    const diff: Record<string, string> = {};
    if (descriptor.serial) diff.serial = descriptor.serial;
    if (descriptor.model) diff.model = descriptor.model;
    if (descriptor.nickname) diff.nickname = descriptor.nickname;
    if (descriptor.callsign) diff.callsign = descriptor.callsign;
    if (descriptor.version) diff.version = descriptor.version;
    if (Object.keys(diff).length > 0) {
      const change = store.patchRadio(diff);
      if (change) radio.applyStateChange(change);
    }
  }

  // -----------------------------------------------------------------------
  // Offline timers
  // -----------------------------------------------------------------------

  private scheduleOfflineTimer(serial: string, endpoint: RadioEndpoint): void {
    if (this.offlineTimeoutMs <= 0) return;

    const key = `${serial}:${endpoint.host}:${endpoint.port}`;
    const existing = this.offlineTimers.get(key);
    if (existing !== undefined) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.offlineTimers.delete(key);
      if (!this.closed) {
        this.events.emit("radioLost", { serial, endpoint });
      }
    }, this.offlineTimeoutMs);
    this.offlineTimers.set(key, timer);
  }

  private clearOfflineTimers(): void {
    for (const timer of this.offlineTimers.values()) clearTimeout(timer);
    this.offlineTimers.clear();
  }

  private async sendEphemeralCommand(
    endpoint: RadioEndpoint,
    command: string,
    options?: FlexClientCommandOptions,
  ): Promise<FlexReplyMessage> {
    const connection = this.transport.createConnection();
    const sequence = 1;
    const timeoutMs = options?.timeoutMs ?? 5_000;
    let tcpBuffer = "";

    try {
      const replyPromise = new Promise<FlexReplyMessage>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timed out waiting for reply to: ${command}`));
        }, timeoutMs);

        const clear = () => {
          clearTimeout(timeout);
          tcpSubscription.unsubscribe();
          errorSubscription.unsubscribe();
          closeSubscription.unsubscribe();
        };

        const tcpSubscription = connection.on("tcpData", (data) => {
          tcpBuffer += decodeTcpChunk(data);

          while (true) {
            const newlineIndex = tcpBuffer.indexOf("\n");
            if (newlineIndex === -1) break;

            const line = tcpBuffer.slice(0, newlineIndex).replace(/\r$/, "");
            tcpBuffer = tcpBuffer.slice(newlineIndex + 1);

            const parsed = parseFlexMessage(line, Date.now());
            if (parsed?.kind === "reply" && parsed.sequence === sequence) {
              clear();
              resolve(parsed);
              return;
            }
          }
        });

        const errorSubscription = connection.on("error", (error) => {
          clear();
          reject(error);
        });

        const closeSubscription = connection.on("close", () => {
          clear();
          reject(
            new Error(
              `Command connection closed before reply was received: ${command}`,
            ),
          );
        });
      });

      await connection.connectTcp(endpoint);
      await connection.sendTcp(`C${sequence}|${command}\n`);
      return await replyPromise;
    } finally {
      await connection.close().catch((error) => {
        this.logger?.warn?.("Failed to close ephemeral command connection", {
          endpoint,
          command,
          error,
        });
      });
    }
  }
}

function decodeTcpChunk(data: string | Uint8Array): string {
  if (typeof data === "string") return data;
  return new TextDecoder().decode(data);
}

function normalizeClientHandle(clientHandle: number | string): string {
  if (typeof clientHandle === "number") {
    if (!Number.isInteger(clientHandle) || clientHandle < 0) {
      throw new Error(`Invalid client handle: ${clientHandle}`);
    }
    return `0x${clientHandle.toString(16).toUpperCase()}`;
  }

  const trimmed = clientHandle.trim();
  if (!trimmed) throw new Error("Client handle must not be empty");
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    return `0x${trimmed.slice(2).toUpperCase()}`;
  }
  if (/^\d+$/.test(trimmed)) {
    return `0x${Number.parseInt(trimmed, 10).toString(16).toUpperCase()}`;
  }
  throw new Error(`Invalid client handle: ${clientHandle}`);
}
