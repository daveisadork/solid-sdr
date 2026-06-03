import {
  makeWS,
  ReconnectingWebSocket,
  WSMessage,
  WSReconnectOptions,
} from "@solid-primitives/websocket";
import { onCleanup } from "solid-js";

/**
 * Returns a WebSocket-like object that under the hood opens new connections on disconnect:
 * ```ts
 * const ws = makeReconnectingWS("ws:localhost:5000");
 * createEffect(() => ws.send(serverMessage()));
 * onCleanup(() => ws.close());
 * ```
 * Will not throw if you attempt to send messages before the connection opened; instead, it will enqueue the message to be sent when the connection opens.
 *
 * It will not close the connection on cleanup. To do that, use `createReconnectingWS`.
 */
export const makeReconnectingWS = (
  url: string,
  protocols?: string | string[],
  options: WSReconnectOptions = {},
) => {
  let retries = options.retries || Infinity;
  let ws: ReconnectingWebSocket;
  const queue: WSMessage[] = [];
  let events: Parameters<WebSocket["addEventListener"]>[] = [
    [
      "close",
      () => {
        retries-- > 0 && setTimeout(getWS, options.delay || 3000);
      },
    ],
  ];
  const getWS = () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (ws && ws.readyState < 2) ws.close();
    ws = Object.assign(makeWS(url, protocols, queue), {
      reconnect: () => ws.close(),
    });
    events.forEach((args) => ws.addEventListener(...args));
  };
  getWS();
  const wws: Partial<ReconnectingWebSocket> = {
    close: (...args: Parameters<WebSocket["close"]>) => {
      retries = 0;
      return ws.close(...args);
    },
    addEventListener: (...args: Parameters<WebSocket["addEventListener"]>) => {
      events.push(args);
      return ws.addEventListener(...args);
    },
    removeEventListener: (
      ...args: Parameters<WebSocket["removeEventListener"]>
    ) => {
      events = events.filter((ev) => args[0] !== ev[0] || args[1] !== ev[1]);
      return ws.removeEventListener(...args);
    },
    send: (msg: WSMessage) => {
      wws.send!.before?.();
      return ws.send(msg);
    },
  };
  for (const name in ws!)
    wws[name as keyof typeof wws] == null &&
      Object.defineProperty(wws, name, {
        enumerable: true,
        get: () =>
          typeof ws[name as keyof typeof ws] === "function"
            ? (ws[name as keyof typeof ws] as Function).bind(ws)
            : ws[name as keyof typeof ws],
      });
  return wws as ReconnectingWebSocket;
};

/**
 * Returns a WebSocket-like object that under the hood opens new connections on disconnect and closes on cleanup:
 * ```ts
 * const ws = makeReconnectingWS("ws:localhost:5000");
 * createEffect(() => ws.send(serverMessage()));
 * ```
 * Will not throw if you attempt to send messages before the connection opened; instead, it will enqueue the message to be sent when the connection opens.
 */
export const createReconnectingWS: typeof makeReconnectingWS = (
  url,
  protocols,
  options,
) => {
  const ws = makeReconnectingWS(url, protocols, options);
  onCleanup(() => ws.close());
  return ws;
};
