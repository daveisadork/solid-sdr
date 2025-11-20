import {
  type FlexControlFactory,
  type FlexRadioDescriptor,
  type UdpSession,
  type FlexWireTransport,
  type FlexWireTransportFactory,
  type Logger,
  createControlChannelFactory,
} from "@repo/flexlib";

export interface WebSocketControlConnectionParams {
  onControlLine?(line: string): void;
}

export interface WebSocketFlexControlFactoryOptions {
  makeSocket(descriptor: FlexRadioDescriptor): WebSocket;
  logger?: Logger;
  commandTerminator?: string;
  udpSession?: UdpSession;
}

export function createWebSocketFlexControlFactory(
  options: WebSocketFlexControlFactoryOptions,
): FlexControlFactory {
  const transportFactory = createWebSocketTransportFactory(options);
  return createControlChannelFactory({
    transportFactory,
    logger: options.logger,
    commandTerminator: options.commandTerminator,
  });
}

function createWebSocketTransportFactory(
  options: WebSocketFlexControlFactoryOptions,
): FlexWireTransportFactory {
  const udpSession = options.udpSession;
  return {
    async connect(radio, handlers, connectOptions) {
      const params = connectOptions as
        | WebSocketControlConnectionParams
        | undefined;
      const socket = options.makeSocket(radio);
      socket.binaryType = "arraybuffer";

      await waitForOpen(socket);

      let closed = false;

      const handleError = (event: Event) => {
        if (closed) return;
        const error =
          event instanceof ErrorEvent
            ? (event.error ?? new Error(event.message))
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
          udpSession?.ingest(data);
          return;
        }

        if (data instanceof Uint8Array) {
          udpSession?.ingest(data);
          return;
        }

        if (data instanceof Blob) {
          data
            .arrayBuffer()
            .then((buffer) => {
              if (closed) return;
              udpSession?.ingest(buffer);
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
          const maybeBinary: unknown = payload;
          if (maybeBinary instanceof Uint8Array) {
            socket.send(maybeBinary);
            return;
          }
          if (maybeBinary instanceof ArrayBuffer) {
            socket.send(maybeBinary);
            return;
          }
          if (ArrayBuffer.isView(maybeBinary)) {
            const view = maybeBinary as ArrayBufferView;
            socket.send(view);
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
  if (
    socket.readyState === WebSocket.CLOSING ||
    socket.readyState === WebSocket.CLOSED
  ) {
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
          ? (event.error ?? new Error(event.message))
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
