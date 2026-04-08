import type { DiscoveredGuiClient } from "./gui-client.js";
import type { RadioSnapshot } from "./state/radio.js";

export interface Logger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

type DescriptorKeys =
  | "serial"
  | "model"
  | "nickname"
  | "callsign"
  | "availableSlices"
  | "availablePanadapters"
  | "version";

export type FlexRadioDescriptor = Pick<RadioSnapshot, DescriptorKeys> & {
  readonly host: string;
  readonly port: number;
  readonly protocol: "tcp" | "tls";
  readonly discoveryMeta?: Record<string, string | number | boolean>;
  readonly guiClients?: readonly DiscoveredGuiClient[];
};
