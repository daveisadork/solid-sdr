import {
  type FlexControlFactory,
  type FlexRadioDescriptor,
  type FlexWireTransport,
  type FlexWireTransportFactory,
  type FlexWireTransportHandlers,
  type Logger,
  createFlexWireControlFactory,
} from "@repo/flexlib";

export interface WebSocketControlConnectionParams {
  onControlLine?(line: string): void;
  onBinaryMessage?(event: MessageEvent<ArrayBuffer>): void;
}

export interface WebSocketFlexControlFactoryOptions {
  makeSocket(descriptor: FlexRadioDescriptor): WebSocket;
  logger?: Logger;
  commandTerminator?: string;
}

export function createWebSocketFlexControlFactory(
  options: WebSocketFlexControlFactoryOptions,
): FlexControlFactory {
  const transportFactory = createWebSocketTransportFactory(options);
  return createFlexWireControlFactory({
    transportFactory,
    logger: options.logger,
    commandTerminator: options.commandTerminator,
  });
}

function createWebSocketTransportFactory(
  options: WebSocketFlexControlFactoryOptions,
): FlexWireTransportFactory {
  return {
    async connect(radio, handlers, connectOptions) {
      const params =
        connectOptions as WebSocketControlConnectionParams | undefined;
      const socket = options.makeSocket(radio);
      socket.binaryType = "arraybuffer";

      await waitForOpen(socket);

      let closed = false;

      const handleError = (event: Event) => {
        if (closed) return;
        const error =
          event instanceof ErrorEvent
            ? event.error ?? new Error(event.message)
            : new Error("WebSocket error");
        handlers.onError?.(error);
      };

      const handleClose = (event: CloseEvent) => {
        if (closed) return;
        closed = true;
        removeListeners();
        handlers.onClose?.(event);
      };

      const handleMessage = (event: MessageEvent) => {
        if (closed) return;
        const { data } = event;
        if (typeof data === "string") {
          if (params?.onControlLine) {
            for (const line of data.split(/\r?\n/)) {
              if (!line) continue;
              const prefix = line[0];
              if (prefix !== "S" && prefix !== "R" && prefix !== "M") {
                params.onControlLine(line);
              }
            }
          }
          handlers.onData(data.endsWith("\n") ? data : `${data}\n`);
          return;
        }

        if (data instanceof ArrayBuffer) {
          params?.onBinaryMessage?.(event as MessageEvent<ArrayBuffer>);
          return;
        }

        if (data instanceof Uint8Array) {
          const buffer =
            data.byteLength === data.buffer.byteLength && data.byteOffset === 0
              ? data.buffer
              : data.buffer.slice(
                  data.byteOffset,
                  data.byteOffset + data.byteLength,
                );
          params?.onBinaryMessage?.(
            new MessageEvent("message", { data: buffer, origin: event.origin }),
          );
          return;
        }

        if (data instanceof Blob) {
          data
            .arrayBuffer()
            .then((buffer) => {
              if (closed) return;
              params?.onBinaryMessage?.(
                new MessageEvent("message", { data: buffer, origin: event.origin }),
              );
            })
            .catch((error) => handlers.onError?.(error));
          return;
        }

        handlers.onError?.(
          new Error(`Unsupported WebSocket message type: ${typeof data}`),
        );
      };

      const removeListeners = () => {
        socket.removeEventListener("error", handleError);
        socket.removeEventListener("close", handleClose);
        socket.removeEventListener("message", handleMessage);
      };

      socket.addEventListener("error", handleError);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("message", handleMessage);

      const transport: FlexWireTransport = {
        async send(payload) {
          if (closed) throw new Error("Flex control transport is closed");
          if (socket.readyState !== WebSocket.OPEN) {
            throw new Error("Flex control socket is not open");
          }
          if (typeof payload === "string") {
            socket.send(payload);
            return;
          }
          if (payload instanceof Uint8Array) {
            socket.send(payload);
            return;
          }
          if (payload instanceof ArrayBuffer) {
            socket.send(payload);
            return;
          }
          if (ArrayBuffer.isView(payload)) {
            socket.send(
              payload.byteLength === payload.buffer.byteLength &&
                payload.byteOffset === 0
                ? payload.buffer
                : payload.buffer.slice(
                    payload.byteOffset,
                    payload.byteOffset + payload.byteLength,
                  ),
            );
            return;
          }
          throw new Error("Unsupported payload for Flex control transport");
        },
        async close() {
          if (closed) return;
          closed = true;
          removeListeners();
          try {
            if (
              socket.readyState === WebSocket.OPEN ||
              socket.readyState === WebSocket.CONNECTING
            ) {
              socket.close();
            }
          } catch (error) {
            handlers.onError?.(error);
          }
          handlers.onClose?.();
        },
      };

      return transport;
    },
  };
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
    return Promise.reject(new Error("WebSocket is not open"));
  }
  return new Promise<void>((resolve, reject) => {
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (event: Event) => {
      cleanup();
      const error =
        event instanceof ErrorEvent
          ? event.error ?? new Error(event.message)
          : new Error("WebSocket failed to open");
      reject(error);
    };
    const cleanup = () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("error", handleError);
    };

    socket.addEventListener("open", handleOpen, { once: true });
    socket.addEventListener("error", handleError, { once: true });
  });
}
