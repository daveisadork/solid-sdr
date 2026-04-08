/**
 * Zero-config entry point for WebRTC bridge connections.
 *
 * @example
 * ```ts
 * import { FlexClient } from "@repo/flexlib/bridge";
 *
 * const pc = new RTCPeerConnection();
 * // ... establish WebRTC session with bridge server ...
 *
 * const client = new FlexClient(pc);
 * await client.startDiscovery();
 *
 * client.on("radioDiscovered", async (radio) => {
 *   await radio.connect();
 * });
 * ```
 *
 * @module
 */

export { FlexClient, type FlexClientOptions } from "./flex/flex-client.js";
export { Radio } from "./flex/radio-core.js";
export * from "./flex/transport.js";
import { FlexClient } from "./flex/flex-client.js";
import {
  BridgeTransport,
  type BridgePeerConnection,
} from "./flex/bridge-transport.js";

/**
 * Create a FlexClient pre-wired with WebRTC bridge transport.
 *
 * @param peerConnection - An established RTCPeerConnection to the bridge server.
 */
export function createFlexClient(
  peerConnection: BridgePeerConnection,
): FlexClient {
  return new FlexClient({
    transport: new BridgeTransport(peerConnection),
  });
}

export type { BridgePeerConnection } from "./flex/bridge-transport.js";
