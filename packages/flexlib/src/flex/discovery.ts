import {
  parseBooleanFlag,
  parseCsvList,
  parseInteger,
} from "../util/parsers.js";
import type { FlexRadioDescriptor } from "./adapters.js";
import { parseDiscoveredGuiClients } from "./gui-client.js";
import type { Mutable } from "./state/common.js";
import { logParseError, logUnknownAttribute } from "./state/common.js";

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
  const partial: Mutable<Partial<FlexRadioDescriptor>> = {};

  let protocolField: "tcp" | "tls" | undefined;
  let tlsFlag: boolean | undefined;
  let inUseIps: string[] = [];
  let inUseHosts: string[] = [];
  let guiClientIps: string[] = [];
  let guiClientHosts: string[] = [];
  let guiClientPrograms: string[] = [];
  let guiClientStations: string[] = [];
  let guiClientHandles: string[] = [];

  for (const [key, value] of fields) {
    switch (key) {
      case "serial":
        partial.serial = value;
        break;
      case "model":
        partial.model = value;
        break;
      case "nickname":
        partial.nickname = value;
        break;
      case "callsign":
        partial.callsign = value;
        break;
      case "version":
        partial.version = value;
        break;
      case "ip":
        partial.host = value;
        break;
      case "port": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.port = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "available_slices": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availableSlices = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "available_panadapters": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availablePanadapters = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "protocol":
        if (value === "tcp" || value === "tls") protocolField = value;
        else logParseError("discovery", key, value);
        break;
      case "tls":
        tlsFlag = parseBooleanFlag(value);
        break;
      case "is_system_model": {
        const parsed = parseBooleanFlag(value);
        if (parsed !== undefined) partial.isSystemModel = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "turf_region":
        partial.turfRegion = value;
        break;
      case "status":
        partial.status = value;
        break;
      case "discovery_protocol_version":
        partial.discoveryProtocolVersion = value;
        break;
      case "max_licensed_version":
        partial.maxLicensedVersion = value;
        break;
      case "radio_license_id":
        partial.radioLicenseId = value;
        break;
      case "min_software_version":
        partial.minSoftwareVersion = value;
        break;
      case "license_is_unknown": {
        const parsed = parseBooleanFlag(value);
        if (parsed !== undefined) partial.hasUnknownRadioLicense = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "requires_additional_license": {
        const parsed = parseBooleanFlag(value);
        if (parsed !== undefined) partial.requiresAdditionalLicense = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "wan_connected": {
        const parsed = parseBooleanFlag(value);
        if (parsed !== undefined) partial.wanConnected = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "external_port_link": {
        const parsed = parseBooleanFlag(value);
        if (parsed !== undefined) partial.externalPortLink = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "licensed_clients": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.licensedClients = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "available_clients": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availableClients = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "max_slices": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.maxSlices = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "max_panadapters": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.maxPanadapters = parsed;
        else logParseError("discovery", key, value);
        break;
      }
      case "fpc_mac":
        if (value) partial.fpcMac = value.replace(/-/g, ":");
        break;
      case "inuse_ip":
        inUseIps = parseCsvList(value);
        break;
      case "inuse_host":
        inUseHosts = parseCsvList(value);
        break;
      case "gui_client_ips":
        guiClientIps = parseCsvList(value);
        break;
      case "gui_client_hosts":
        guiClientHosts = parseCsvList(value);
        break;
      case "gui_client_programs":
        guiClientPrograms = parseCsvList(value);
        break;
      case "gui_client_stations":
        // 0x7f encodes spaces inside station names on the wire
        guiClientStations = parseCsvList(value.replace(/\u007f/g, " "));
        break;
      case "gui_client_handles":
        guiClientHandles = parseCsvList(value);
        break;
      default:
        logUnknownAttribute("discovery", key, value);
        break;
    }
  }

  const guiClients = parseDiscoveredGuiClients({
    programs: guiClientPrograms,
    stations: guiClientStations,
    handles: guiClientHandles,
    hosts: guiClientHosts,
    ips: guiClientIps,
  });

  if (inUseIps.length > 0) partial.inUseIps = inUseIps;
  if (inUseHosts.length > 0) partial.inUseHosts = inUseHosts;
  if (guiClientIps.length > 0) partial.guiClientIps = guiClientIps;
  if (guiClientHosts.length > 0) partial.guiClientHosts = guiClientHosts;
  if (guiClientPrograms.length > 0)
    partial.guiClientPrograms = guiClientPrograms;
  if (guiClientStations.length > 0)
    partial.guiClientStations = guiClientStations;
  if (guiClientHandles.length > 0) partial.guiClientHandles = guiClientHandles;
  if (guiClients.length > 0) partial.guiClients = guiClients;

  partial.protocol =
    protocolField ?? (tlsFlag === true ? "tls" : defaultProtocol);
  partial.lastSeen = timestamp;

  return partial as FlexRadioDescriptor;
}
