import type {
  FlexCommandOptions,
  FlexCommandResponse,
  FlexControlChannel,
  FlexControlFactory,
} from "../src/flex/adapters.js";
import type {
  FlexStatusMessage,
  FlexWireMessage,
} from "../src/flex/protocol.js";
import { parseFlexMessage } from "../src/flex/protocol.js";

export class MockControlChannel implements FlexControlChannel {
  readonly commands: Array<{ command: string; options?: FlexCommandOptions }> =
    [];
  private readonly listeners = new Set<(message: FlexWireMessage) => void>();
  private readonly rawListeners = new Set<(line: string) => void>();
  private sequence = 1;
  private nextResponse?: Partial<FlexCommandResponse>;
  closed = false;

  send(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse> {
    this.commands.push({ command, options });
    const response = this.nextResponse ?? {};
    this.nextResponse = undefined;
    const accepted = response.accepted ?? true;
    const payload: FlexCommandResponse = {
      sequence: response.sequence ?? this.sequence++,
      accepted,
      code: response.code,
      message: response.message,
      raw: response.raw ?? (accepted ? "R|0|OK" : "R|1|ERR"),
    };
    return new Promise((resolve) => {
      queueMicrotask(() => resolve(payload));
    });
  }

  onMessage(listener: (message: FlexWireMessage) => void) {
    this.listeners.add(listener);
    return {
      unsubscribe: () => this.listeners.delete(listener),
    };
  }

  onRawLine(listener: (line: string) => void) {
    this.rawListeners.add(listener);
    return {
      unsubscribe: () => this.rawListeners.delete(listener),
    };
  }

  emit(message: FlexWireMessage) {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  emitRaw(line: string) {
    for (const listener of this.rawListeners) {
      listener(line);
    }
  }

  prepareResponse(response: Partial<FlexCommandResponse>) {
    this.nextResponse = response;
  }

  close(): Promise<void> {
    this.closed = true;
    this.listeners.clear();
    this.rawListeners.clear();
    return Promise.resolve();
  }
}

export class MockControlFactory implements FlexControlFactory {
  channel?: MockControlChannel;

  connect(): Promise<FlexControlChannel> {
    this.channel = new MockControlChannel();
    return Promise.resolve(this.channel);
  }
}

export function makeStatus(raw: string): FlexStatusMessage {
  const parsed = parseFlexMessage(raw, Date.now());
  if (!parsed || parsed.kind !== "status")
    throw new Error(`failed to parse status: ${raw}`);
  return parsed;
}

/**
 * Convert a hex string (with or without spaces/newlines) to Uint8Array
 */
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
