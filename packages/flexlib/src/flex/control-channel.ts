import type {
  Clock,
  FlexCommandOptions,
  FlexCommandResponse,
  FlexControlChannel,
  FlexControlFactory,
  FlexRadioDescriptor,
  FlexWireChunk,
  FlexWireTransport,
  FlexWireTransportFactory,
  FlexWireTransportHandlers,
  Logger,
} from "./adapters.js";
import type { Subscription } from "./events.js";
import { FlexClientClosedError } from "./errors.js";
import type { FlexWireMessage, FlexReplyMessage } from "./protocol.js";
import { parseFlexMessage } from "./protocol.js";

const DEFAULT_CLOCK: Clock = { now: () => Date.now() };
const DEFAULT_COMMAND_TIMEOUT_MS = 5_000;

interface PendingCommand {
  readonly command: string;
  readonly sequence: number;
  readonly timeoutHandle?: ReturnType<typeof setTimeout>;
  readonly resolve: (response: FlexCommandResponse) => void;
  readonly reject: (reason: unknown) => void;
}

export interface ControlChannelFactoryOptions {
  readonly transportFactory: FlexWireTransportFactory;
  readonly clock?: Clock;
  readonly logger?: Logger;
  readonly defaultCommandTimeoutMs?: number;
  readonly commandTerminator?: string;
  readonly textDecoderFactory?: () => WireTextDecoder;
}

type WireDecodeInput =
  | Uint8Array
  | ArrayBuffer
  | ArrayBufferView
  | undefined;

interface WireTextDecoder {
  decode(input?: WireDecodeInput, options?: { stream?: boolean }): string;
}

export function createControlChannelFactory(
  options: ControlChannelFactoryOptions,
): FlexControlFactory {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const logger = options.logger;
  const transportFactory = options.transportFactory;
  const defaultTimeout =
    options.defaultCommandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const commandTerminator = options.commandTerminator ?? "\n";

  return {
    async connect(
      radio: FlexRadioDescriptor,
      connectOptions?: Record<string, unknown>,
    ) {
      const listeners = new Set<(message: FlexWireMessage) => void>();
      const rawLineListeners = new Set<(line: string) => void>();
      const pending = new Map<number, PendingCommand>();
      let nextSequence = 1;
      let closed = false;
      let closing = false;
      let buffer = "";
      const decoder = createDecoder(options.textDecoderFactory);

      const settlePendingWithError = (error: unknown) => {
        for (const entry of pending.values()) {
          if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
          entry.reject(error);
        }
        pending.clear();
      };

      const finalize = (error?: unknown) => {
        if (closed) return;
        closed = true;
        const cause =
          error instanceof Error ? error : new FlexClientClosedError();
        settlePendingWithError(cause);
        listeners.clear();
        rawLineListeners.clear();
      };

      const handleReply = (reply: FlexReplyMessage) => {
        const entry = pending.get(reply.sequence);
        if (!entry) {
          if (reply.sequence !== 0) {
            logger?.warn?.("Received reply for unknown sequence", {
              sequence: reply.sequence,
              reply: reply.raw,
            });
          }
          return;
        }
        pending.delete(reply.sequence);
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
        const accepted = reply.code === 0;
        entry.resolve({
          sequence: reply.sequence,
          accepted,
          code: reply.code,
          message: reply.message,
          raw: reply.raw,
        });
      };

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        for (const listener of rawLineListeners) {
          try {
            listener(trimmed);
          } catch (error) {
            logger?.error?.("Flex wire raw-line listener threw", { error });
          }
        }
        const parsed = parseFlexMessage(trimmed, clock.now());
        if (!parsed) return;
        for (const listener of listeners) {
          try {
            listener(parsed);
          } catch (error) {
            logger?.error?.("Flex wire listener threw", { error });
          }
        }
        if (parsed.kind === "reply") handleReply(parsed);
      };

      const handleChunk = (chunk: string) => {
        if (!chunk) return;
        buffer += chunk;
        while (true) {
          const newlineIndex = buffer.indexOf("\n");
          if (newlineIndex === -1) break;
          const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
          buffer = buffer.slice(newlineIndex + 1);
          handleLine(line);
        }
      };

      const handleData = (chunk: FlexWireChunk) => {
        if (closed) return;
        if (typeof chunk === "string") {
          handleChunk(chunk);
          return;
        }

        if (chunk instanceof Uint8Array) {
          handleChunk(decoder.decode(chunk, { stream: true }));
          return;
        }

        if (chunk instanceof ArrayBuffer) {
          handleChunk(decoder.decode(new Uint8Array(chunk), { stream: true }));
          return;
        }

        if (ArrayBuffer.isView(chunk)) {
          const view = new Uint8Array(
            chunk.buffer,
            chunk.byteOffset,
            chunk.byteLength,
          );
          handleChunk(decoder.decode(view, { stream: true }));
          return;
        }

        logger?.warn?.("Received unsupported wire payload", { chunk });
      };

      const handleTransportClose = (cause?: unknown) => {
        if (closed) return;
        if (cause) logger?.warn?.("Flex wire transport closed", { cause });
        handleChunk(decoder.decode());
        finalize(
          cause instanceof Error ? cause : new FlexClientClosedError(),
        );
      };

      const transportHandlers: FlexWireTransportHandlers = {
        onData: handleData,
        onClose: handleTransportClose,
        onError(error) {
          if (closed) return;
          logger?.error?.("Flex wire transport error", { error });
          handleTransportClose(error);
        },
      };

      const transport: FlexWireTransport = await transportFactory.connect(
        radio,
        transportHandlers,
        connectOptions,
      );

      const sendCommand = async (
        command: string,
        sendOptions?: FlexCommandOptions,
      ): Promise<FlexCommandResponse> => {
        if (closed) throw new FlexClientClosedError();

        const sequenceHint = sendOptions?.sequenceHint;
        let sequence: number;
        if (sequenceHint !== undefined) {
          sequence = sequenceHint;
          if (sequenceHint >= nextSequence) {
            nextSequence = sequenceHint + 1;
          }
        } else {
          sequence = nextSequence++;
        }

        if (pending.has(sequence)) {
          throw new Error(`Sequence ${sequence} is already in-flight`);
        }

        const timeoutMs =
          sendOptions?.timeoutMs !== undefined
            ? sendOptions.timeoutMs
            : defaultTimeout;

        const payload = `C${sequence}|${command}${commandTerminator}`;

        return new Promise<FlexCommandResponse>((resolve, reject) => {
          const timeoutHandle =
            timeoutMs > 0
              ? setTimeout(() => {
                  pending.delete(sequence);
                  reject(new Error(`Command timed out after ${timeoutMs}ms`));
                }, timeoutMs)
              : undefined;

          pending.set(sequence, {
            command,
            sequence,
            timeoutHandle,
            resolve,
            reject,
          });

          transport
            .send(payload)
            .catch((error) => {
              if (timeoutHandle) clearTimeout(timeoutHandle);
              pending.delete(sequence);
              reject(error);
            });
        });
      };

      const channel: FlexControlChannel = {
        async send(command, sendOptions) {
          return sendCommand(command, sendOptions);
        },
        onMessage(listener) {
          if (closed) throw new FlexClientClosedError();
          listeners.add(listener);
          return {
            unsubscribe: () => {
              listeners.delete(listener);
            },
          } as Subscription;
        },
        onRawLine(listener) {
          if (closed) throw new FlexClientClosedError();
          rawLineListeners.add(listener);
          return {
            unsubscribe: () => {
              rawLineListeners.delete(listener);
            },
          } as Subscription;
        },
        async close() {
          if (closed || closing) return;
          closing = true;
          try {
            await transport.close();
          } finally {
            handleTransportClose();
          }
        },
      };

      return channel;
    },
  };
}

function createDecoder(
  factory?: () => WireTextDecoder,
): WireTextDecoder {
  if (factory) return factory();
  const Decoder = (globalThis as {
    TextDecoder?: { new (): WireTextDecoder };
  }).TextDecoder;
  if (Decoder) {
    return new Decoder();
  }
  throw new Error(
    "Flex wire control requires TextDecoder support in the current environment",
  );
}
