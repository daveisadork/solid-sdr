export interface BaseGuiClientInfo {
  readonly clientHandle: number;
  readonly program?: string;
  readonly station?: string;
  readonly isLocalPtt: boolean;
  readonly isAvailable: boolean;
}

export interface DiscoveredGuiClient extends BaseGuiClientInfo {}

export interface ParseGuiClientLists {
  readonly programs?: readonly string[];
  readonly stations?: readonly string[];
  readonly handles?: readonly string[];
}

export function parseDiscoveredGuiClients(
  lists: ParseGuiClientLists,
): readonly DiscoveredGuiClient[] {
  const programs = lists.programs ?? [];
  const stations = lists.stations ?? [];
  const handles = lists.handles ?? [];
  if (
    programs.length === 0 ||
    programs.length !== stations.length ||
    programs.length !== handles.length
  ) {
    return [];
  }
  const clients: DiscoveredGuiClient[] = [];
  for (let index = 0; index < programs.length; index += 1) {
    const clientHandle = parseClientHandle(handles[index]);
    if (clientHandle === undefined) continue;
    clients.push(
      Object.freeze({
        clientHandle,
        program: normalizeToken(programs[index]),
        station: normalizeStation(stations[index]),
        isLocalPtt: false,
        isAvailable: true,
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
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStation(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const replaced = value.replace(/\u007f/g, " ");
  return normalizeToken(replaced);
}
