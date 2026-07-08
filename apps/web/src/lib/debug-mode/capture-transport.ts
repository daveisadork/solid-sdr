import type {
  FlexConnection,
  FlexConnectionEvents,
  FlexTransport,
  RadioEndpoint,
  Subscription,
} from "@repo/flexlib";
import type { CaptureBuffers } from "./buffers";

export function wrapTransport(
  inner: FlexTransport,
  buffers: CaptureBuffers,
): FlexTransport {
  return {
    on: (event, handler) => inner.on(event, handler),
    startDiscovery: () => inner.startDiscovery(),
    stopDiscovery: () => inner.stopDiscovery(),
    createConnection: () => wrapConnection(inner.createConnection(), buffers),
    close: () => inner.close(),
  };
}

function wrapConnection(
  inner: FlexConnection,
  buffers: CaptureBuffers,
): FlexConnection {
  let pending = "";
  let decoder: TextDecoder | undefined;

  const recordChunk = (data: string | Uint8Array) => {
    let chunk: string;
    if (typeof data === "string") {
      chunk = data;
    } else {
      decoder = decoder ?? new TextDecoder();
      chunk = decoder.decode(data, { stream: true });
    }
    pending += chunk;
    while (true) {
      const newlineIndex = pending.indexOf("\n");
      if (newlineIndex === -1) break;
      const line = pending.slice(0, newlineIndex).replace(/\r$/, "");
      pending = pending.slice(newlineIndex + 1);
      if (line.length > 0) buffers.recordMessage("in", line);
    }
  };

  return {
    on<K extends keyof FlexConnectionEvents>(
      event: K,
      handler: (payload: FlexConnectionEvents[K]) => void,
    ): Subscription {
      if (event === "tcpData") {
        return inner.on(event, (payload) => {
          recordChunk(payload as string | Uint8Array);
          handler(payload);
        });
      }
      return inner.on(event, handler);
    },
    once<K extends keyof FlexConnectionEvents>(
      event: K,
      handler: (payload: FlexConnectionEvents[K]) => void,
    ): Subscription {
      if (event === "tcpData") {
        return inner.once(event, (payload) => {
          recordChunk(payload as string | Uint8Array);
          handler(payload);
        });
      }
      return inner.once(event, handler);
    },
    connectTcp: (endpoint: RadioEndpoint) => inner.connectTcp(endpoint),
    connectUdp: (endpoint: RadioEndpoint) => inner.connectUdp(endpoint),
    sendTcp: async (data: string) => {
      const line = data.replace(/\r?\n$/, "");
      if (line.length > 0) buffers.recordMessage("out", line);
      return inner.sendTcp(data);
    },
    sendUdp: (data: Uint8Array) => inner.sendUdp(data),
    openUpload: (endpoint: RadioEndpoint, data: AsyncIterable<Uint8Array>) =>
      inner.openUpload(endpoint, data),
    prepareDownload: (endpoint: RadioEndpoint) =>
      inner.prepareDownload(endpoint),
    close: () => inner.close(),
  };
}
