/**
 * Zero-config entry point for Node.js users.
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
 *
 * @module
 */

export { FlexClient, type FlexClientOptions } from "./flex/flex-client.js";
export { Radio } from "./flex/radio-core.js";
export * from "./flex/transport.js";
import { FlexClient } from "./flex/flex-client.js";
import { NodeTransport } from "./flex/node-transport.js";

/**
 * Create a FlexClient pre-wired with Node.js socket transport.
 * Equivalent to `new FlexClient({ transport: new NodeTransport() })`.
 */
export function createFlexClient(): FlexClient {
  return new FlexClient({ transport: new NodeTransport() });
}
