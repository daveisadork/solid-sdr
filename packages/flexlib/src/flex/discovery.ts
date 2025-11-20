import type {
  Clock,
  DiscoveryAdapter,
  FlexRadioDescriptor,
  Logger,
} from "./adapters.js";
import { parseVitaPacket } from "../vita/parser.js";
import { parseDiscoveredGuiClients } from "./gui-client.js";

const DEFAULT_CLOCK: Clock = { now: () => Date.now() };

export interface DiscoveryTransport {
  close(): Promise<void>;
}

export interface DiscoveryTransportHandlers {
  onMessage(data: Uint8Array): void;
  onError?(error: unknown): void;
}

export interface DiscoveryTransportFactory {
  start(handlers: DiscoveryTransportHandlers): Promise<DiscoveryTransport>;
}

export interface VitaDiscoveryAdapterOptions {
  transportFactory: DiscoveryTransportFactory;
  clock?: Clock;
  logger?: Logger;
  offlineTimeoutMs?: number;
  defaultProtocol?: "tcp" | "tls";
}

export function createVitaDiscoveryAdapter(
  options: VitaDiscoveryAdapterOptions,
): DiscoveryAdapter {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const logger = options.logger;
  const offlineTimeout =
    options.offlineTimeoutMs !== undefined ? options.offlineTimeoutMs : 20_000;
  const defaultProtocol = options.defaultProtocol ?? "tcp";

  return {
    async start(callbacks) {
      const timers = new Map<string, ReturnType<typeof setTimeout>>();
      let stopped = false;

      const clearTimers = () => {
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
      };

      const scheduleOffline =
        offlineTimeout > 0 && callbacks.onOffline
          ? (serial: string) => {
              const existing = timers.get(serial);
              if (existing !== undefined) clearTimeout(existing);
              const timeoutId = setTimeout(() => {
                timers.delete(serial);
                if (!stopped) callbacks.onOffline?.(serial);
              }, offlineTimeout);
              timers.set(serial, timeoutId);
            }
          : undefined;

      const handleError = (error: unknown) => {
        if (stopped) return;
        if (callbacks.onError) callbacks.onError(error);
        else logger?.warn?.("discovery adapter error", { error });
      };

      const handleMessage = (data: Uint8Array) => {
        if (stopped) return;

        try {
          const parsed = parseVitaPacket(
            data instanceof Uint8Array ? data : new Uint8Array(data),
          );
          if (!parsed || parsed.kind !== "discovery") return;

          const now = clock.now();
          const descriptor = decodeDiscoveryPayload(
            parsed.packet.payload,
            now,
            defaultProtocol,
          );

          scheduleOffline?.(descriptor.serial);
          callbacks.onOnline(descriptor);
        } catch (error) {
          handleError(error);
        }
      };

      let transport: DiscoveryTransport;
      try {
        transport = await options.transportFactory.start({
          onMessage: handleMessage,
          onError: handleError,
        });
      } catch (error) {
        handleError(error);
        throw error;
      }

      return {
        async stop() {
          if (stopped) return;
          stopped = true;
          clearTimers();
          await transport.close();
        },
      };
    },
  };
}

export function parseDiscoveryPayload(
  payload: string,
): Map<string, string> {
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
  const nickname = valueOrUndefined(fields.get("nickname"));
  const callsign = valueOrUndefined(fields.get("callsign"));
  const firmware = valueOrUndefined(fields.get("version"));
  const host = valueOrUndefined(fields.get("ip"));
  const port = parseInteger(fields.get("port"), "port");
  const availableSlices =
    parseInteger(fields.get("available_slices"), "available_slices") ?? 0;
  const availablePanadapters =
    parseInteger(fields.get("available_panadapters"), "available_panadapters") ??
    0;

  if (!serial) throw new Error("Discovery payload missing serial");
  if (!model) throw new Error("Discovery payload missing model");
  if (!firmware) throw new Error("Discovery payload missing version");
  if (!host) throw new Error("Discovery payload missing ip");
  if (port === undefined) throw new Error("Discovery payload missing port");

  const descriptor: FlexRadioDescriptor = {
    serial,
    model,
    nickname,
    callsign,
    availableSlices,
    availablePanadapters,
    firmware,
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

function valueOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function parseInteger(
  value: string | undefined,
  field: string,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Discovery payload has invalid integer for ${field}`);
  }
  return parsed;
}

function parseBooleanFlag(
  value: string | undefined,
): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized === "1" || normalized.toLowerCase() === "true") return true;
  if (normalized === "0" || normalized.toLowerCase() === "false") return false;
  return undefined;
}

function parseCsvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
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
