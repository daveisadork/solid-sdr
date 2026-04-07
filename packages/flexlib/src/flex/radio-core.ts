/**
 * The Radio class — the single object representing a FlexRadio.
 *
 * Collapses RadioHandle, RadioSession, RadioController, and FlexClient
 * into one unified construct that owns connection lifecycle, state,
 * protocol parsing, command dispatch, and UDP data routing.
 *
 * @module
 */

import { TypedEventEmitter, type Subscription } from "../util/events.js";
import type {
  FlexConnection,
  FlexTransport,
  RadioEndpoint,
} from "./transport.js";
import type { Logger } from "./adapters.js";
import type {
  FlexWireMessage,
  FlexStatusMessage,
  FlexReplyMessage,
  FlexReplyCodeLevel,
  FlexNoticeMessage,
} from "./protocol.js";
import { parseFlexMessage } from "./protocol.js";
import {
  createRadioStateStore,
  type RadioStateStore,
  type RadioStateSnapshot,
  type RadioStateChange,
  type RadioSnapshot,
} from "./state/index.js";
import {
  FlexClientClosedError,
  FlexCommandRejectedError,
} from "./errors.js";
import { describeResponseCode } from "./response-codes.js";
import {
  parseVitaPacket,
  type VitaParsedPacket,
} from "../vita/parser.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Connection state exposed as a queryable property. */
export type NewRadioConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting";

// Internal alias used throughout this file. Exported as NewRadioConnectionState
// to avoid collision with the legacy RadioConnectionState in client.ts.
// During cleanup (Task 10) this will be renamed to RadioConnectionState.
type RadioConnectionState = NewRadioConnectionState;

/** Granular progress detail emitted during the "connecting" phase. */
export interface ConnectionProgressDetail {
  readonly stage: string;
  readonly detail?: string;
}

/** Options for {@link Radio.command}. */
export interface RadioCommandOptions {
  /** Per-command timeout in ms. Overrides the radio-wide default. */
  readonly timeoutMs?: number;
  /** Force a specific sequence number (advanced). */
  readonly sequenceHint?: number;
}

/** Response from a radio command. */
export interface RadioCommandResponse {
  readonly sequence: number;
  readonly accepted: boolean;
  readonly level?: FlexReplyCodeLevel;
  readonly code?: number;
  readonly message?: string;
  readonly raw: string;
}

/** Identity and connection options provided when calling {@link Radio.connect}. */
export interface RadioConnectOptions {
  /** Client identity metadata for the handshake. */
  readonly clientInfo?: RadioClientInfo;
  /** Default command timeout in ms. Defaults to 5000. */
  readonly defaultCommandTimeoutMs?: number;
  /** Heartbeat interval in ms, or null to disable. Defaults to 1000. */
  readonly pingIntervalMs?: number | null;
  /** Handle timeout in ms during handshake. Defaults to 10000. */
  readonly handleTimeoutMs?: number;
}

/** Client identity metadata announced during the handshake. */
export interface RadioClientInfo {
  /** Name of the client program. */
  readonly program?: string;
  /** Register as a GUI client. Defaults to true. */
  readonly isGui?: boolean;
  /** GUI client ID to reuse. */
  readonly guiClientId?: string | null;
  /** GUI client ID to bind for non-GUI connections. */
  readonly boundClientId?: string | null;
  /** Station name announced to the radio. */
  readonly station?: string;
}

// ---------------------------------------------------------------------------
// Event map
// ---------------------------------------------------------------------------

/** Event map for the {@link Radio} class. */
export interface RadioEvents extends Record<string, unknown> {
  readonly connectionStateChange: RadioConnectionState;
  readonly connectingProgress: ConnectionProgressDetail;
  readonly change: RadioStateChange;
  readonly status: FlexStatusMessage;
  readonly reply: FlexReplyMessage;
  readonly notice: FlexNoticeMessage;
  readonly message: FlexWireMessage;
  readonly ready: undefined;
  readonly disconnected: undefined;
  readonly error: unknown;
}

export type RadioEventKey = keyof RadioEvents;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PendingCommand {
  readonly command: string;
  readonly sequence: number;
  readonly timeoutHandle?: ReturnType<typeof setTimeout>;
  readonly resolve: (response: RadioCommandResponse) => void;
  readonly reject: (reason: unknown) => void;
}

// ---------------------------------------------------------------------------
// RadioSession — the unified interface controllers use
// ---------------------------------------------------------------------------

/** Callback for VITA stream data routed by the Radio. */
export type StreamPacketHandler = (packet: VitaParsedPacket) => void;

/** Callback for individual meter value updates. */
export type MeterValueHandler = (meterId: number, rawValue: number) => void;

/**
 * Unified session interface that all controllers use to interact with the
 * Radio. Replaces the per-controller `*SessionApi` interfaces.
 */
export interface RadioSession {
  /** Send a command to the radio and await its reply. */
  command(
    command: string,
    options?: RadioCommandOptions,
  ): Promise<RadioCommandResponse>;

  /** Access the internal state store (snapshots, patches). */
  getStore(): RadioStateStore;

  /**
   * Register a handler for VITA packets matching a specific stream ID.
   * Used by panadapter, waterfall, and audio controllers for their
   * lazy data pipelines. Returns a subscription to unregister.
   */
  registerStreamHandler(streamId: number, handler: StreamPacketHandler): Subscription;

  /**
   * Register a handler for a specific meter's value updates.
   * Meter VITA packets carry multiple meter values per packet, so
   * the Radio dispatches individual values to registered handlers.
   * Returns a subscription to unregister.
   */
  registerMeterHandler(meterId: number, handler: MeterValueHandler): Subscription;
}

const DEFAULT_COMMAND_TIMEOUT_MS = 5_000;
const DEFAULT_HANDLE_TIMEOUT_MS = 10_000;
const DEFAULT_PING_INTERVAL_MS = 1_000;
const COMMAND_TERMINATOR = "\n";

/** Subscription commands sent during the default handshake. */
const DEFAULT_HANDSHAKE_COMMANDS: readonly string[] = [
  "profile global info",
  "profile tx info",
  "profile mic info",
  "profile display info",
  "sub client all",
  "sub tx all",
  "sub atu all",
  "sub amplifier all",
  "sub meter all",
  "sub pan all",
  "sub slice all",
  "sub gps all",
  "sub audio_stream all",
  "sub cwx all",
  "sub xvtr all",
  "sub memories all",
  "sub daxiq all",
  "sub dax all",
  "sub license all",
  "sub usb_cable all",
  "sub tnf all",
  "sub spot all",
  "sub rapidm all",
  "sub ale all",
  "sub log_manager",
  "sub radio all",
  "sub apd all",
  "sub dvk all",
  "keepalive enable",
];

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------

/**
 * The single object representing a FlexRadio.
 *
 * Owns connection lifecycle, state, controllers, events, and commands.
 * Use {@link connect} to establish a connection and {@link disconnect}
 * to tear it down.
 */
export class Radio {
  private readonly events = new TypedEventEmitter<RadioEvents>();
  private readonly store: RadioStateStore;
  private readonly logger?: Logger;

  private _connectionState: RadioConnectionState = "disconnected";
  private connection?: FlexConnection;
  private connectionSubs: Subscription[] = [];
  private pendingCommands = new Map<number, PendingCommand>();
  private nextSequence = 1;
  private tcpBuffer = "";
  private decoder?: InstanceType<typeof TextDecoder>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private defaultCommandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS;

  // Stream handler registries for UDP data routing
  private readonly streamHandlers = new Map<number, Set<StreamPacketHandler>>();
  private readonly meterHandlers = new Map<number, Set<MeterValueHandler>>();

  private _clientHandle: string | null = null;
  private _clientId: string | null = null;
  private _serial: string;
  private _endpoint: RadioEndpoint;

  private readonly handleWaiters: Array<{
    resolve: (handle: string) => void;
    reject: (reason: unknown) => void;
    timeoutHandle?: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    serial: string,
    private readonly transport: FlexTransport,
    endpoint: RadioEndpoint,
    options?: { logger?: Logger },
  ) {
    this._serial = serial;
    this._endpoint = { ...endpoint };
    this.logger = options?.logger;
    this.store = createRadioStateStore({ logger: this.logger });
  }

  // -----------------------------------------------------------------------
  // Public getters
  // -----------------------------------------------------------------------

  get connectionState(): RadioConnectionState {
    return this._connectionState;
  }

  get serial(): string {
    return this._serial;
  }

  get endpoint(): RadioEndpoint {
    return { ...this._endpoint };
  }

  get clientHandle(): string | null {
    return this._clientHandle;
  }

  get clientId(): string | null {
    return this._clientId;
  }

  /** Current radio state snapshot. */
  snapshot(): RadioSnapshot | undefined {
    return this.store.getRadio();
  }

  /** Full state snapshot including all entities. */
  stateSnapshot(): RadioStateSnapshot {
    return this.store.snapshot();
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  on<K extends RadioEventKey>(
    event: K,
    handler: (payload: RadioEvents[K]) => void,
  ): Subscription {
    return this.events.on(event, handler);
  }

  once<K extends RadioEventKey>(
    event: K,
    handler: (payload: RadioEvents[K]) => void,
  ): Subscription {
    return this.events.once(event, handler);
  }

  off<K extends RadioEventKey>(
    event: K,
    handler: (payload: RadioEvents[K]) => void,
  ): void {
    this.events.off(event, handler);
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  /**
   * Connect to the radio.
   *
   * Establishes TCP, performs the handshake (await handle, subscribe to
   * status, register as GUI client), then connects UDP.
   */
  async connect(options?: RadioConnectOptions): Promise<void> {
    if (this._connectionState !== "disconnected") return;

    this.defaultCommandTimeoutMs =
      options?.defaultCommandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const pingIntervalMs = options?.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
    const handleTimeoutMs =
      options?.handleTimeoutMs ?? DEFAULT_HANDLE_TIMEOUT_MS;

    this.setConnectionState("connecting");

    try {
      const conn = this.transport.createConnection();
      this.connection = conn;

      // CRITICAL: Attach handlers BEFORE connecting.
      // Data may start flowing before connectTcp resolves.
      this.connectionSubs = [
        conn.on("tcpData", (data) => this.handleTcpData(data)),
        conn.on("udpData", (data) => this.handleUdpData(data)),
        conn.on("close", () => this.handleConnectionClose()),
        conn.on("error", (err) => this.handleConnectionError(err)),
      ];

      // --- TCP ---
      this.emitProgress("tcp", "connecting");
      await conn.connectTcp(this._endpoint);

      // --- Handle ---
      this.emitProgress("handle", "waiting");
      const handle = await this.waitForHandle({ timeoutMs: handleTimeoutMs });
      this.emitProgress("handle", handle);

      // --- Handshake ---
      await this.performHandshake(options?.clientInfo);

      // --- UDP ---
      this.emitProgress("udp", "connecting");
      await conn.connectUdp(this._endpoint);

      // --- Ready ---
      this.setConnectionState("connected");
      this.emitProgress("ready");
      this.events.emit("ready", undefined);
      this.startHeartbeat(pingIntervalMs);
    } catch (error) {
      // Clean up on failure
      this.stopHeartbeat();
      this.rejectAllPending(error);
      this.rejectHandleWaiters(error);
      this.cleanupConnection();
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  /** Disconnect from the radio. */
  async disconnect(): Promise<void> {
    if (
      this._connectionState === "disconnected" ||
      this._connectionState === "disconnecting"
    ) {
      return;
    }

    this.setConnectionState("disconnecting");
    this.stopHeartbeat();
    this.rejectAllPending(new FlexClientClosedError());
    this.rejectHandleWaiters(new FlexClientClosedError());

    const conn = this.connection;
    this.cleanupConnection();

    if (conn) {
      try {
        await conn.close();
      } catch (error) {
        this.logger?.warn?.("Error closing connection", { error });
      }
    }

    this.setConnectionState("disconnected");
    this.events.emit("disconnected", undefined);
  }

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  /**
   * Send a command to the radio and await its reply.
   *
   * Throws {@link FlexCommandRejectedError} if the radio rejects the command.
   * Throws on timeout or if the connection is closed.
   */
  async command(
    command: string,
    options?: RadioCommandOptions,
  ): Promise<RadioCommandResponse> {
    if (this._connectionState !== "connecting" && this._connectionState !== "connected") {
      throw new FlexClientClosedError();
    }
    const conn = this.connection;
    if (!conn) throw new FlexClientClosedError();

    const timeoutMs =
      options?.timeoutMs ?? this.defaultCommandTimeoutMs;

    let sequence: number;
    if (options?.sequenceHint !== undefined) {
      sequence = options.sequenceHint;
      if (sequence >= this.nextSequence) {
        this.nextSequence = sequence + 1;
      }
    } else {
      sequence = this.nextSequence++;
    }

    if (this.pendingCommands.has(sequence)) {
      throw new Error(`Sequence ${sequence} is already in-flight`);
    }

    const payload = `C${sequence}|${command}${COMMAND_TERMINATOR}`;

    return new Promise<RadioCommandResponse>((resolve, reject) => {
      const timeoutHandle =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pendingCommands.delete(sequence);
              reject(
                new Error(`Command timed out after ${timeoutMs}ms: ${command}`),
              );
            }, timeoutMs)
          : undefined;

      this.pendingCommands.set(sequence, {
        command,
        sequence,
        timeoutHandle,
        resolve: (response) => {
          if (!response.accepted) {
            const codeDescription =
              response.code !== undefined
                ? describeResponseCode(response.code)
                : undefined;
            reject(
              new FlexCommandRejectedError(
                buildCommandErrorMessage(command, response, codeDescription),
                {
                  sequence: response.sequence,
                  raw: response.raw,
                  message: response.message,
                  code: response.code,
                },
                codeDescription,
              ),
            );
            return;
          }
          resolve(response);
        },
        reject,
      });

      conn.sendTcp(payload).catch((error) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.pendingCommands.delete(sequence);
        reject(error);
      });
    });
  }

  // -----------------------------------------------------------------------
  // RadioSession interface (used by controllers)
  // -----------------------------------------------------------------------

  /** @internal */
  getStore(): RadioStateStore {
    return this.store;
  }

  /**
   * Register a handler for VITA packets matching a specific stream ID.
   * @internal Used by controllers for lazy data pipelines.
   */
  registerStreamHandler(
    streamId: number,
    handler: StreamPacketHandler,
  ): Subscription {
    let bucket = this.streamHandlers.get(streamId);
    if (!bucket) {
      bucket = new Set();
      this.streamHandlers.set(streamId, bucket);
    }
    bucket.add(handler);
    return {
      unsubscribe: () => {
        bucket.delete(handler);
        if (bucket.size === 0) {
          this.streamHandlers.delete(streamId);
        }
      },
    };
  }

  /**
   * Register a handler for a specific meter's value updates.
   * @internal Used by MeterController for lazy data pipelines.
   */
  registerMeterHandler(
    meterId: number,
    handler: MeterValueHandler,
  ): Subscription {
    let bucket = this.meterHandlers.get(meterId);
    if (!bucket) {
      bucket = new Set();
      this.meterHandlers.set(meterId, bucket);
    }
    bucket.add(handler);
    return {
      unsubscribe: () => {
        bucket.delete(handler);
        if (bucket.size === 0) {
          this.meterHandlers.delete(meterId);
        }
      },
    };
  }

  // -----------------------------------------------------------------------
  // Descriptor updates (used by FlexClient for discovery)
  // -----------------------------------------------------------------------

  /** @internal Update radio identity from a discovery descriptor. */
  updateFromDescriptor(info: {
    serial?: string;
    host?: string;
    port?: number;
  }): void {
    if (info.serial) this._serial = info.serial;
    if (info.host && info.port) {
      this._endpoint = { host: info.host, port: info.port };
    }
  }

  // -----------------------------------------------------------------------
  // TCP data handling
  // -----------------------------------------------------------------------

  private handleTcpData(data: string | Uint8Array): void {
    let chunk: string;
    if (typeof data === "string") {
      chunk = data;
    } else {
      if (!this.decoder) this.decoder = new TextDecoder();
      chunk = this.decoder.decode(data, { stream: true });
    }

    if (!chunk) return;
    this.tcpBuffer += chunk;

    while (true) {
      const newlineIndex = this.tcpBuffer.indexOf("\n");
      if (newlineIndex === -1) break;
      const line = this.tcpBuffer
        .slice(0, newlineIndex)
        .replace(/\r$/, "");
      this.tcpBuffer = this.tcpBuffer.slice(newlineIndex + 1);
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (!line) return;

    // Handle/version prefixed lines arrive before regular protocol messages
    const prefix = line[0];
    if (prefix === "H") {
      const handle = line.slice(1).trim();
      if (handle) this.assignClientHandle(handle);
      return;
    }
    if (prefix === "V") {
      const version = line.slice(1).trim();
      if (version) {
        this.logger?.info?.("Flex radio version", { version });
      }
      return;
    }

    // Parse as a protocol message
    const parsed = parseFlexMessage(line, Date.now());
    if (!parsed) return;

    this.events.emit("message", parsed);

    switch (parsed.kind) {
      case "status":
        this.events.emit("status", parsed);
        for (const change of this.store.apply(parsed)) {
          this.events.emit("change", change);
        }
        break;
      case "reply":
        this.events.emit("reply", parsed);
        this.handleReply(parsed);
        break;
      case "notice":
        this.events.emit("notice", parsed);
        break;
    }
  }

  private handleReply(reply: FlexReplyMessage): void {
    const entry = this.pendingCommands.get(reply.sequence);
    if (!entry) {
      if (reply.sequence !== 0) {
        this.logger?.warn?.("Received reply for unknown sequence", {
          sequence: reply.sequence,
          reply: reply.raw,
        });
      }
      return;
    }
    this.pendingCommands.delete(reply.sequence);
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);

    const accepted = reply.level === "success" || reply.level === "info";
    entry.resolve({
      sequence: reply.sequence,
      accepted,
      code: reply.code,
      level: reply.level,
      message: reply.message,
      raw: reply.raw,
    });
  }

  // -----------------------------------------------------------------------
  // UDP data handling
  // -----------------------------------------------------------------------

  private handleUdpData(data: Uint8Array): void {
    const parsed = parseVitaPacket(data);
    if (!parsed) {
      this.logger?.warn?.("Unhandled UDP packet", {
        payloadLength: data.byteLength,
      });
      return;
    }

    if (parsed.kind === "meter") {
      // Meter packets carry multiple meter IDs per packet.
      // Dispatch individual values to registered meter handlers.
      const meterPacket = parsed.packet;
      const count = meterPacket.numMeters;
      for (let i = 0; i < count; i++) {
        const meterId = meterPacket.ids[i];
        const handlers = this.meterHandlers.get(meterId);
        if (handlers) {
          for (const handler of handlers) {
            handler(meterId, meterPacket.values[i]);
          }
        }
      }
      return;
    }

    // All other stream types: route by VITA stream ID.
    const handlers = this.streamHandlers.get(parsed.streamId);
    if (handlers) {
      for (const handler of handlers) {
        handler(parsed);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Handle waiting
  // -----------------------------------------------------------------------

  private waitForHandle(options?: {
    timeoutMs?: number;
  }): Promise<string> {
    if (this._clientHandle) return Promise.resolve(this._clientHandle);

    return new Promise<string>((resolve, reject) => {
      const waiter = {
        resolve: (handle: string) => {
          if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
          resolve(handle);
        },
        reject: (reason: unknown) => {
          if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
          reject(reason);
        },
        timeoutHandle: undefined as ReturnType<typeof setTimeout> | undefined,
      };

      const timeoutMs = options?.timeoutMs ?? DEFAULT_HANDLE_TIMEOUT_MS;
      if (timeoutMs > 0) {
        waiter.timeoutHandle = setTimeout(() => {
          this.removeHandleWaiter(waiter);
          reject(
            new Error(
              `Timed out waiting for Flex handle after ${timeoutMs}ms`,
            ),
          );
        }, timeoutMs);
      }

      this.handleWaiters.push(waiter);
    });
  }

  private assignClientHandle(handle: string): void {
    if (!handle || this._clientHandle === handle) return;
    this._clientHandle = handle;
    const clientChanges = this.store.setLocalClientHandle(handle);
    for (const change of clientChanges) {
      this.events.emit("change", change);
    }
    this.resolveHandleWaiters(handle);
  }

  private removeHandleWaiter(waiter: (typeof this.handleWaiters)[number]): void {
    const index = this.handleWaiters.indexOf(waiter);
    if (index >= 0) this.handleWaiters.splice(index, 1);
  }

  private resolveHandleWaiters(handle: string): void {
    if (!this.handleWaiters.length) return;
    const waiters = this.handleWaiters.splice(0);
    for (const waiter of waiters) {
      if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
      try {
        waiter.resolve(handle);
      } catch {
        // swallow
      }
    }
  }

  private rejectHandleWaiters(reason: unknown): void {
    if (!this.handleWaiters.length) return;
    const waiters = this.handleWaiters.splice(0);
    for (const waiter of waiters) {
      if (waiter.timeoutHandle) clearTimeout(waiter.timeoutHandle);
      try {
        waiter.reject(reason);
      } catch {
        // swallow
      }
    }
  }

  // -----------------------------------------------------------------------
  // Handshake
  // -----------------------------------------------------------------------

  private async performHandshake(
    clientInfo?: RadioClientInfo,
  ): Promise<void> {
    const info = clientInfo ?? {};

    // Announce program name
    const programName = info.program?.trim();
    if (programName) {
      // fire-and-forget, don't await
      this.command(`client program ${programName}`).catch(() => {});
    }

    // Refresh radio info
    this.emitProgress("sync", "radio-info");
    await Promise.all([
      this.command("radio info").catch(() => {}),
      this.command("version").catch(() => {}),
      this.command("ant list").catch(() => {}),
      this.command("mic list").catch(() => {}),
    ]);

    // Subscribe to status updates
    this.emitProgress("sync", "subscriptions");
    await Promise.all(
      DEFAULT_HANDSHAKE_COMMANDS.map((cmd) =>
        this.command(cmd).catch(() => {}),
      ),
    );

    // Configure network
    this.emitProgress("sync", "network");
    await this.command("client set send_reduced_bw_dax=1").catch(() => {});

    // Register as GUI client
    const isGui = info.isGui !== false; // default true
    if (isGui) {
      const guiClientId = info.guiClientId;
      const response = await this.command(
        guiClientId ? `client gui ${guiClientId}` : "client gui",
      );
      this._clientId = response.message?.trim() ?? null;
    } else if (info.boundClientId) {
      await this.command(
        `client bind_gui_client ${info.boundClientId}`,
      );
    }

    const stationName = info.station;
    if (stationName) {
      await this.command(`client station ${stationName}`).catch(() => {});
    }

    this.emitProgress("sync", "complete");
  }

  // -----------------------------------------------------------------------
  // Heartbeat
  // -----------------------------------------------------------------------

  private startHeartbeat(intervalMs?: number | null): void {
    if (this.heartbeatTimer || !intervalMs || intervalMs <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      this.command("ping").catch((error) => {
        this.logger?.warn?.("Flex ping failed", { error });
      });
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  // -----------------------------------------------------------------------
  // Connection event handlers
  // -----------------------------------------------------------------------

  private handleConnectionClose(): void {
    if (
      this._connectionState === "disconnected" ||
      this._connectionState === "disconnecting"
    ) {
      return;
    }
    // Unexpected close
    this.stopHeartbeat();
    this.rejectAllPending(new FlexClientClosedError());
    this.rejectHandleWaiters(new FlexClientClosedError());
    this.cleanupConnection();
    this.setConnectionState("disconnected");
    this.events.emit("disconnected", undefined);
  }

  private handleConnectionError(error: unknown): void {
    this.events.emit("error", error);
  }

  // -----------------------------------------------------------------------
  // Cleanup helpers
  // -----------------------------------------------------------------------

  private rejectAllPending(reason: unknown): void {
    for (const entry of this.pendingCommands.values()) {
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      try {
        entry.reject(reason);
      } catch {
        // swallow
      }
    }
    this.pendingCommands.clear();
  }

  private cleanupConnection(): void {
    for (const sub of this.connectionSubs) sub.unsubscribe();
    this.connectionSubs = [];
    this.connection = undefined;
    this._clientHandle = null;
    this._clientId = null;
    this.tcpBuffer = "";
    this.decoder = undefined;
    this.nextSequence = 1;
    this.streamHandlers.clear();
    this.meterHandlers.clear();
  }

  private setConnectionState(state: RadioConnectionState): void {
    if (this._connectionState === state) return;
    this._connectionState = state;
    this.events.emit("connectionStateChange", state);
  }

  private emitProgress(stage: string, detail?: string): void {
    this.events.emit("connectingProgress", { stage, detail });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCommandErrorMessage(
  command: string,
  response: RadioCommandResponse,
  codeDescription?: string,
): string {
  const parts: string[] = ["Flex command rejected", `command=${command}`];
  if (response.code !== undefined) {
    parts.push(`code=${response.code.toString(16)}`);
  }
  if (codeDescription) {
    parts.push(`reason=${codeDescription}`);
  }
  if (response.message) {
    parts.push(`radio="${response.message}"`);
  }
  return parts.join(" | ");
}
