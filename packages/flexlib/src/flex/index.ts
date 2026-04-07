// ---------------------------------------------------------------------------
// New architecture — primary public API
// ---------------------------------------------------------------------------

// FlexClient + Radio
export * from "./flex-client.js";
export * from "./radio-core.js";

// Transport abstraction
export * from "./transport.js";
// Note: node-transport.js and bridge-transport.js are NOT exported here.
// They contain platform-specific code and are only available through
// the @repo/flexlib/node and @repo/flexlib/bridge entry points.

// Controllers
export * from "./slice.js";
export * from "./panadapter.js";
export * from "./meter.js";
export * from "./waterfall.js";
export * from "./audio-stream.js";
export * from "./equalizer.js";
export * from "./apd.js";
export * from "./feature-license.js";
export * from "./gui-client.js";
export * from "./tx-band-settings.js";
export * from "./waterfall-line-speed.js";
export * from "./radio.js";

// State/snapshot types
export * from "./state/index.js";

// Protocol and errors
export * from "./errors.js";
export * from "./protocol.js";
export * from "./response-codes.js";

// Shared types from adapters that are still needed
export type { Logger, Clock, FlexRadioDescriptor } from "./adapters.js";

// Discovery parsing (used by FlexClient, also useful standalone)
export { decodeDiscoveryPayload, parseDiscoveryPayload } from "./discovery.js";
