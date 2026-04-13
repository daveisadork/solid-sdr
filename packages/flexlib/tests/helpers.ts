import type {
  FlexConnection,
  FlexConnectionEvents,
  FlexTransport,
  FlexTransportEvents,
  RadioEndpoint,
} from "../src/flex/transport.js";
import type { Subscription } from "../src/util/events.js";
import { TypedEventEmitter } from "../src/util/events.js";
import type { FlexStatusMessage } from "../src/flex/protocol.js";
import { parseFlexMessage } from "../src/flex/protocol.js";
import { Radio } from "../src/flex/radio-core.js";

// ---------------------------------------------------------------------------
// Mock FlexConnection
// ---------------------------------------------------------------------------

/**
 * Mock connection for testing. Auto-responds to commands with success
 * and emits a handle line on connectTcp.
 */
export class MockFlexConnection
  extends TypedEventEmitter<FlexConnectionEvents>
  implements FlexConnection
{
  readonly sentTcp: string[] = [];
  readonly sentUdp: Uint8Array[] = [];
  private _closed = false;
  private customResponses = new Map<
    string,
    { accepted: boolean; message?: string; code?: number }
  >();

  /** Handle value emitted on connectTcp. Set to empty to skip. */
  handle = "0x12345678";

  /** Default handshake responses so connect() succeeds. */
  private static readonly HANDSHAKE_RESPONSES = new Map<string, string>([
    [
      "info",
      "screensaver=model,serial=0000-0000,name=Test,callsign=TEST,software_ver=3.10.10",
    ],
    ["version", "SmartSDR-MB=3.10.10#FPGA-MB=1.2.3#"],
    ["ant list", "ANT1,ANT2"],
    ["mic list", "MIC"],
    ["client gui", "test-client-id"],
  ]);

  on<K extends keyof FlexConnectionEvents>(
    event: K,
    handler: (payload: FlexConnectionEvents[K]) => void,
  ): Subscription {
    return super.on(event, handler);
  }

  async connectTcp(_endpoint: RadioEndpoint): Promise<void> {
    // Emit handle line immediately (before promise resolves) to simulate
    // the radio sending the handle as soon as TCP connects.
    if (this.handle) {
      queueMicrotask(() => {
        this.emit("tcpData", `H${this.handle}\n`);
      });
    }
  }

  async connectUdp(_endpoint: RadioEndpoint): Promise<void> {}

  async sendTcp(data: string): Promise<void> {
    this.sentTcp.push(data);
    // Auto-respond to commands with success
    const match = data.match(/^C(\d+)\|(.+?)[\n\r]*$/);
    if (match) {
      const seq = match[1];
      const cmd = match[2];
      const custom = this.findCustomResponse(cmd);
      const code = custom?.code ?? 0;
      const msg = custom?.message ?? "";
      const hexCode = code.toString(16).padStart(8, "0");
      const replyLine = `R${seq}|${hexCode}|${msg}\n`;
      queueMicrotask(() => {
        if (!this._closed) this.emit("tcpData", replyLine);
      });
    }
  }

  async sendUdp(data: Uint8Array): Promise<void> {
    this.sentUdp.push(data);
  }

  async close(): Promise<void> {
    this._closed = true;
  }

  // --- Test helpers ---

  /** Emit a raw TCP line (appends newline if missing). */
  emitTcpLine(line: string): void {
    const data = line.endsWith("\n") ? line : line + "\n";
    this.emit("tcpData", data);
  }

  /** Emit a status message as raw TCP text. */
  emitStatus(raw: string): void {
    this.emitTcpLine(raw);
  }

  /** Get the last command sent (without the C{seq}| prefix and trailing newline). */
  lastCommand(): string | undefined {
    const last = this.sentTcp.at(-1);
    if (!last) return undefined;
    const match = last.match(/^C\d+\|(.+?)[\n\r]*$/);
    return match?.[1];
  }

  /** Get all commands sent (stripped of sequence prefix). */
  get commands(): string[] {
    return this.sentTcp
      .map((s) => s.match(/^C\d+\|(.+?)[\n\r]*$/)?.[1])
      .filter((s): s is string => s !== undefined);
  }

  /** Prepare a custom response for the next command matching a prefix. */
  prepareResponse(
    cmdPrefix: string,
    response: { accepted?: boolean; message?: string; code?: number },
  ): void {
    this.customResponses.set(cmdPrefix, {
      accepted: response.accepted ?? true,
      message: response.message,
      code: response.code ?? 0,
    });
  }

  private findCustomResponse(cmd: string) {
    for (const [prefix, response] of this.customResponses) {
      if (cmd.startsWith(prefix)) {
        this.customResponses.delete(prefix);
        return response;
      }
    }
    // Check handshake defaults so connect() succeeds
    for (const [prefix, message] of MockFlexConnection.HANDSHAKE_RESPONSES) {
      if (cmd.startsWith(prefix)) {
        return { accepted: true, message, code: 0 };
      }
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Mock FlexTransport
// ---------------------------------------------------------------------------

export class MockFlexTransport
  extends TypedEventEmitter<FlexTransportEvents>
  implements FlexTransport
{
  connection?: MockFlexConnection;

  on<K extends keyof FlexTransportEvents>(
    event: K,
    handler: (payload: FlexTransportEvents[K]) => void,
  ): Subscription {
    return super.on(event, handler);
  }

  async startDiscovery(): Promise<void> {}
  async stopDiscovery(): Promise<void> {}

  createConnection(): FlexConnection {
    this.connection = new MockFlexConnection();
    return this.connection;
  }

  async close(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export const DEFAULT_DESCRIPTOR = {
  serial: "1234-0001",
  host: "192.168.1.100",
  port: 4992,
};

/**
 * Create a Radio and connect it with a mock transport.
 * The mock auto-responds to handshake commands with success.
 * Returns the radio and mock connection for emitting status lines.
 */
export async function createConnectedRadio(
  options?: {
    serial?: string;
    host?: string;
    port?: number;
  },
): Promise<{ radio: Radio; connection: MockFlexConnection }> {
  const transport = new MockFlexTransport();
  const radio = new Radio(
    options?.serial ?? DEFAULT_DESCRIPTOR.serial,
    transport,
    {
      host: options?.host ?? DEFAULT_DESCRIPTOR.host,
      port: options?.port ?? DEFAULT_DESCRIPTOR.port,
    },
  );

  await radio.connect({
    pingIntervalMs: null, // disable heartbeat in tests
  });

  const connection = transport.connection!;
  return { radio, connection };
}

/** Parse a raw status string into a FlexStatusMessage. Throws if invalid. */
export function makeStatus(raw: string): FlexStatusMessage {
  const parsed = parseFlexMessage(raw, Date.now());
  if (!parsed || parsed.kind !== "status")
    throw new Error(`failed to parse status: ${raw}`);
  return parsed;
}

/** Convert a hex string (with or without spaces/newlines) to Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) {
    throw new Error("hex string has odd length");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}
