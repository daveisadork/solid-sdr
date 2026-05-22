export interface BaseGuiClientInfo {
  readonly clientHandle: string;
  readonly clientHandleInt: number;
  readonly host?: string;
  readonly ip?: string;
  readonly isLocalPtt: boolean;
  readonly program?: string;
  readonly station?: string;
}

export type DiscoveredGuiClient = BaseGuiClientInfo;

export interface ParseGuiClientLists {
  readonly handles?: readonly string[];
  readonly hosts?: readonly string[];
  readonly ips?: readonly string[];
  readonly programs?: readonly string[];
  readonly stations?: readonly string[];
}

export function parseDiscoveredGuiClients(
  lists: ParseGuiClientLists,
): readonly DiscoveredGuiClient[] {
  const programs = lists.programs ?? [];
  const stations = lists.stations ?? [];
  const handles = lists.handles ?? [];
  const hosts = lists.hosts ?? [];
  const ips = lists.ips ?? [];
  const clients: DiscoveredGuiClient[] = [];
  for (let index = 0; index < handles.length; index += 1) {
    const clientHandle = handles[index];
    const clientHandleInt = parseClientHandle(clientHandle);
    if (clientHandleInt === undefined) continue;
    clients.push(
      Object.freeze({
        clientHandle,
        clientHandleInt,
        program: normalizeToken(programs[index]),
        station: normalizeToken(stations[index]),
        host: normalizeToken(hosts[index]),
        ip: normalizeToken(ips[index]),
        isLocalPtt: false,
      }),
    );
  }
  return Object.freeze(clients);
}

function parseClientHandle(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    const parsed = Number.parseInt(trimmed.slice(2), 16);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\u007f/g, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
