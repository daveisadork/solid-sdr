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

  /** Whether discovery reports this as a system model radio. */
  readonly isSystemModel?: boolean;
  /** Turf/region string reported in discovery metadata. */
  readonly turfRegion?: string;
  /** Radio status from discovery, e.g. "Available", "In Use". */
  readonly status?: string;
  /** Discovery protocol version string. */
  readonly discoveryProtocolVersion?: string;
  /** Maximum licensed SmartSDR version. */
  readonly maxLicensedVersion?: string;
  /** Radio license identifier. */
  readonly radioLicenseId?: string;
  /** Minimum compatible software version. */
  readonly minSoftwareVersion?: string;
  /** True if the radio's license status is unknown (v4.1+). */
  readonly hasUnknownRadioLicense?: boolean;
  /** True if the radio requires an additional license (pre-v4.1). */
  readonly requiresAdditionalLicense?: boolean;
  /** Whether the radio is connected to SmartLink (WAN). */
  readonly wanConnected?: boolean;
  /** Whether an external port link is detected. */
  readonly externalPortLink?: boolean;
  /** Number of licensed client connections. */
  readonly licensedClients?: number;
  /** Number of available (unused) client connections. */
  readonly availableClients?: number;
  /** Maximum number of slices supported. */
  readonly maxSlices?: number;
  /** Maximum number of panadapters supported. */
  readonly maxPanadapters?: number;
  /** Front-panel controller MAC address. */
  readonly fpcMac?: string;
  /** IP addresses of currently connected clients. */
  readonly inUseIps?: readonly string[];
  /** Hostnames of currently connected clients. */
  readonly inUseHosts?: readonly string[];
  /** IP addresses of connected GUI clients. */
  readonly guiClientIps?: readonly string[];
  /** Hostnames of connected GUI clients. */
  readonly guiClientHosts?: readonly string[];
  /** Program names of connected GUI clients. */
  readonly guiClientPrograms?: readonly string[];
  /** Station names of connected GUI clients. */
  readonly guiClientStations?: readonly string[];
  /** Client handles of connected GUI clients (hex strings). */
  readonly guiClientHandles?: readonly string[];
  /** Parsed GUI client objects combining program/station/handle info. */
  readonly guiClients?: readonly DiscoveredGuiClient[];
  /** Timestamp (ms since epoch) when this discovery packet was received. */
  readonly lastSeen: number;
};
