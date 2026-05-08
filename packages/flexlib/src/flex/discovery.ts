import type { FlexRadioDescriptor } from "./adapters.js";
import { parseDiscoveredGuiClients } from "./gui-client.js";
import {
  parseBooleanFlag,
  parseCsvList,
  parseInteger as parseOptionalInteger,
  valueOrUndefined,
} from "../util/parsers.js";

export function parseDiscoveryPayload(payload: string): Map<string, string> {
  const map = new Map<string, string>();
  const text = payload.replace(/\0+$/g, "").trim();
  if (!text) return map;
  const entries = text.split(/\s+/);
  for (const pair of entries) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const key = pair.slice(0, eq).trim().toLowerCase();
    const value = pair
      .slice(eq + 1)
      .replace(/\0+$/g, "")
      .trim();
    if (!key) continue;
    map.set(key, value);
  }
  return map;
}

export function decodeDiscoveryPayload(
  payload: string,
  timestamp: number,
  defaultProtocol: "tcp" | "tls" = "tcp",
): FlexRadioDescriptor {
  const fields = parseDiscoveryPayload(payload);

  const serial = valueOrUndefined(fields.get("serial"));
  const model = valueOrUndefined(fields.get("model"));
  const nickname = valueOrUndefined(fields.get("nickname")) ?? "";
  const callsign = valueOrUndefined(fields.get("callsign")) ?? "";
  const version = valueOrUndefined(fields.get("version"));
  const host = valueOrUndefined(fields.get("ip"));
  const port = parseInteger(fields.get("port"), "port");
  const availableSlices =
    parseInteger(fields.get("available_slices"), "available_slices") ?? 0;
  const availablePanadapters =
    parseInteger(
      fields.get("available_panadapters"),
      "available_panadapters",
    ) ?? 0;

  if (!serial) throw new Error("Discovery payload missing serial");
  if (!model) throw new Error("Discovery payload missing model");
  if (!version) throw new Error("Discovery payload missing version");
  if (!host) throw new Error("Discovery payload missing ip");
  if (port === undefined) throw new Error("Discovery payload missing port");

  const inUseIps = parseCsvList(fields.get("inuse_ip"));
  const inUseHosts = parseCsvList(fields.get("inuse_host"));
  const guiClientIps = parseCsvList(fields.get("gui_client_ips"));
  const guiClientHosts = parseCsvList(fields.get("gui_client_hosts"));
  const guiClientPrograms = parseCsvList(fields.get("gui_client_programs"));
  const guiClientStations = parseCsvList(
    normalizeStations(fields.get("gui_client_stations")),
  );
  const guiClientHandles = parseCsvList(fields.get("gui_client_handles"));

  const guiClients = parseDiscoveredGuiClients({
    programs: guiClientPrograms,
    stations: guiClientStations,
    handles: guiClientHandles,
    hosts: guiClientHosts,
    ips: guiClientIps,
  });

  const fpcMacRaw = valueOrUndefined(fields.get("fpc_mac"));

  const descriptor: FlexRadioDescriptor = {
    serial,
    model,
    nickname,
    callsign,
    availableSlices,
    availablePanadapters,
    version,
    host,
    port,
    protocol: resolveProtocol(fields, defaultProtocol),
    lastSeen: timestamp,

    isSystemModel: parseBooleanFlag(fields.get("is_system_model")) ?? undefined,
    turfRegion: valueOrUndefined(fields.get("turf_region")),
    status: valueOrUndefined(fields.get("status")),
    discoveryProtocolVersion: valueOrUndefined(
      fields.get("discovery_protocol_version"),
    ),
    maxLicensedVersion: valueOrUndefined(fields.get("max_licensed_version")),
    radioLicenseId: valueOrUndefined(fields.get("radio_license_id")),
    minSoftwareVersion: valueOrUndefined(fields.get("min_software_version")),
    hasUnknownRadioLicense:
      parseBooleanFlag(fields.get("license_is_unknown")) ?? undefined,
    requiresAdditionalLicense:
      parseBooleanFlag(fields.get("requires_additional_license")) ?? undefined,
    wanConnected: parseBooleanFlag(fields.get("wan_connected")) ?? undefined,
    externalPortLink:
      parseBooleanFlag(fields.get("external_port_link")) ?? undefined,
    licensedClients: parseInteger(
      fields.get("licensed_clients"),
      "licensed_clients",
    ),
    availableClients: parseInteger(
      fields.get("available_clients"),
      "available_clients",
    ),
    maxSlices: parseInteger(fields.get("max_slices"), "max_slices"),
    maxPanadapters: parseInteger(
      fields.get("max_panadapters"),
      "max_panadapters",
    ),
    fpcMac: fpcMacRaw ? fpcMacRaw.replace(/-/g, ":") : undefined,
    inUseIps: inUseIps.length > 0 ? inUseIps : undefined,
    inUseHosts: inUseHosts.length > 0 ? inUseHosts : undefined,
    guiClientIps: guiClientIps.length > 0 ? guiClientIps : undefined,
    guiClientHosts: guiClientHosts.length > 0 ? guiClientHosts : undefined,
    guiClientPrograms:
      guiClientPrograms.length > 0 ? guiClientPrograms : undefined,
    guiClientStations:
      guiClientStations.length > 0 ? guiClientStations : undefined,
    guiClientHandles:
      guiClientHandles.length > 0 ? guiClientHandles : undefined,
    guiClients: guiClients.length > 0 ? guiClients : undefined,
  };

  return descriptor;
}

function resolveProtocol(
  fields: Map<string, string>,
  defaultProtocol: "tcp" | "tls",
): "tcp" | "tls" {
  const protocol = valueOrUndefined(fields.get("protocol"));
  if (protocol === "tcp" || protocol === "tls") return protocol;
  const tlsFlag = parseBooleanFlag(fields.get("tls"));
  if (tlsFlag === true) return "tls";
  return defaultProtocol;
}

function parseInteger(
  value: string | undefined,
  field: string,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseOptionalInteger(value);
  if (parsed === undefined) {
    throw new Error(`Discovery payload has invalid integer for ${field}`);
  }
  return parsed;
}

function normalizeStations(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/\u007f/g, " ");
}
