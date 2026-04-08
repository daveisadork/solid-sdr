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
  const text = payload.trim();
  if (!text) return map;
  const entries = text.split(/\s+/);
  for (const pair of entries) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const key = pair.slice(0, eq).trim().toLowerCase();
    const value = pair.slice(eq + 1).trim();
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
  };

  const meta: Record<string, string | number | boolean> = {};
  assignIf(meta, "status", valueOrUndefined(fields.get("status")));
  assignIf(
    meta,
    "discoveryProtocolVersion",
    valueOrUndefined(fields.get("discovery_protocol_version")),
  );
  assignIf(
    meta,
    "maxLicensedVersion",
    valueOrUndefined(fields.get("max_licensed_version")),
  );
  assignIf(
    meta,
    "radioLicenseId",
    valueOrUndefined(fields.get("radio_license_id")),
  );
  assignIf(
    meta,
    "minSoftwareVersion",
    valueOrUndefined(fields.get("min_software_version")),
  );

  // v4.1+ uses license_is_unknown; older firmware uses requires_additional_license
  const hasUnknownRadioLicense = parseBooleanFlag(
    fields.get("license_is_unknown"),
  );
  if (hasUnknownRadioLicense !== undefined) {
    meta.hasUnknownRadioLicense = hasUnknownRadioLicense;
  }

  // Deprecated in v4.1, but keep for backward compatibility with older firmware
  const requiresAdditionalLicense = parseBooleanFlag(
    fields.get("requires_additional_license"),
  );
  if (requiresAdditionalLicense !== undefined) {
    meta.requiresAdditionalLicense = requiresAdditionalLicense;
  }

  const wanConnected = parseBooleanFlag(fields.get("wan_connected"));
  if (wanConnected !== undefined) {
    meta.wanConnected = wanConnected;
  }

  const externalPortLink = parseBooleanFlag(fields.get("external_port_link"));
  if (externalPortLink !== undefined) {
    meta.externalPortLink = externalPortLink;
  }

  const licensedClients = parseInteger(
    fields.get("licensed_clients"),
    "licensed_clients",
  );
  if (licensedClients !== undefined) {
    meta.licensedClients = licensedClients;
  }

  const availableClients = parseInteger(
    fields.get("available_clients"),
    "available_clients",
  );
  if (availableClients !== undefined) {
    meta.availableClients = availableClients;
  }

  const maxSlices = parseInteger(fields.get("max_slices"), "max_slices");
  if (maxSlices !== undefined) {
    meta.maxSlices = maxSlices;
  }

  const maxPanadapters = parseInteger(
    fields.get("max_panadapters"),
    "max_panadapters",
  );
  if (maxPanadapters !== undefined) {
    meta.maxPanadapters = maxPanadapters;
  }

  const fpcMac = valueOrUndefined(fields.get("fpc_mac"));
  if (fpcMac) meta.fpcMac = fpcMac.replace(/-/g, ":");

  const inUseIps = parseCsvList(fields.get("inuse_ip"));
  if (inUseIps.length > 0) {
    meta.inUseIps = inUseIps.join(",");
  }

  const inUseHosts = parseCsvList(fields.get("inuse_host"));
  if (inUseHosts.length > 0) {
    meta.inUseHosts = inUseHosts.join(",");
  }

  const guiClientIps = parseCsvList(fields.get("gui_client_ips"));
  if (guiClientIps.length > 0) {
    meta.guiClientIps = guiClientIps.join(",");
  }

  const guiClientHosts = parseCsvList(fields.get("gui_client_hosts"));
  if (guiClientHosts.length > 0) {
    meta.guiClientHosts = guiClientHosts.join(",");
  }

  const guiClientPrograms = parseCsvList(fields.get("gui_client_programs"));
  if (guiClientPrograms.length > 0) {
    meta.guiClientPrograms = guiClientPrograms.join(",");
  }

  const guiClientStations = parseCsvList(
    normalizeStations(fields.get("gui_client_stations")),
  );
  if (guiClientStations.length > 0) {
    meta.guiClientStations = guiClientStations.join(",");
  }

  const guiClientHandles = parseCsvList(fields.get("gui_client_handles"));
  if (guiClientHandles.length > 0) {
    meta.guiClientHandles = guiClientHandles.join(",");
  }

  const discoveredGuiClients = parseDiscoveredGuiClients({
    programs: guiClientPrograms,
    stations: guiClientStations,
    handles: guiClientHandles,
  });

  meta.lastSeen = timestamp;

  let enrichedDescriptor = descriptor;
  if (Object.keys(meta).length > 0) {
    enrichedDescriptor = { ...enrichedDescriptor, discoveryMeta: meta };
  }
  if (discoveredGuiClients.length > 0) {
    enrichedDescriptor = {
      ...enrichedDescriptor,
      guiClients: discoveredGuiClients,
    };
  }
  return enrichedDescriptor;
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

function assignIf(
  target: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined,
) {
  if (value === undefined || value === "") return;
  target[key] = value;
}
