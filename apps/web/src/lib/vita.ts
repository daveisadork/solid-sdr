import {
  parseVita,
  parseDiscoveryPayload,
  parseMeterPayload,
  parseDaxAudioPayload,
  parseWaterfallPayload,
  parsePanadapterPayload,
} from "@repo/flex-vita";

export enum PacketClass {
  meter = 0x8002,
  panadapter = 0x8003,
  waterfall = 0x8004,
  opus = 0x8005,
  daxReducedBw = 0x0123,
  daxIq24 = 0x02e3,
  daxIq48 = 0x02e4,
  daxIq96 = 0x02e5,
  daxIq192 = 0x02e6,
  daxAudio = 0x03e3,
  discovery = 0xffff,
}

export type MeterPayload = { id: number; value: number }[];

export interface PanadapterPayload {
  startingBin: number;
  binsInThisFrame: number;
  binSize: number;
  totalBins: number;
  frame: number;
  bins: number[];
}

export interface WaterfallPayload {
  binBandwidth: number;
  firstBinFreq: number;
  lineDuration: number;
  binsInThisFrame: number;
  height: number;
  frame: number;
  autoBlackLevel: number;
  totalBins: number;
  startingBin: number;
  bins: number[];
}

export interface DaxAudioPayload {
  numberOfSamples: number;
  daxChannel: number;
  data: Float32Array[];
}

export interface DiscoveryPayload {
  model: string; // "FLEX-8600"
  serial: string; // "1225-1213-8600-7918"
  version: string; // "3.8.23.35640"
  nickname: string; // "FlexRadio"
  callsign: string; // "KF0SMY"
  ip: string; // "10.16.83.234";
  port: number; // 4992
  status: string; // "Available"
  inuse_ip: string[]; // ""
  inuse_host: string[]; // ""
  max_licensed_version: string; // "v3"
  radio_license_id: string; // "00-1C-2D-05-33-BA"
  requires_additional_license: boolean; //
  fpc_mac: string; //""
  wan_connected: boolean;
  licensed_clients: number;
  available_clients: number;
  max_panadapters: number;
  available_panadapters: number;
  max_slices: number;
  available_slices: number;
  gui_client_ips: string[]; //""
  gui_client_hosts: string[]; // ""
  gui_client_programs: string[]; // ""
  gui_client_stations: string[]; // ""
  gui_client_handles: string[]; // ""
  min_software_version: string; // "3.8.0.0"
  discovery_protocol_version: string; // "3.0.0.3"
  external_port_link: boolean; // "1"
}

type VitaPayloadMap = {
  [PacketClass.meter]: MeterPayload;
  [PacketClass.panadapter]: PanadapterPayload;
  [PacketClass.waterfall]: WaterfallPayload;
  [PacketClass.opus]: Uint8Array;
  [PacketClass.daxReducedBw]: Uint8Array;
  [PacketClass.daxIq24]: Uint8Array;
  [PacketClass.daxIq48]: Uint8Array;
  [PacketClass.daxIq96]: Uint8Array;
  [PacketClass.daxIq192]: Uint8Array;
  [PacketClass.daxAudio]: DaxAudioPayload;
  [PacketClass.discovery]: DiscoveryPayload;
};

type VitaPayload =
  | DiscoveryPayload
  | MeterPayload
  | PanadapterPayload
  | WaterfallPayload
  | DaxAudioPayload
  | Uint8Array;

export interface ClassId<T = PacketClass> {
  information_class_code: number;
  packet_class_code: T;
  word_1: number;
}

export interface PacketHeader {
  hword_1: number;
  packet_size: number;
}

export type RawVitaPacket<T = PacketClass> = {
  class_id: ClassId<T>;
  header: PacketHeader;
  fractional_timestamp: number;
  integer_timestamp: number;
  stream_id: number;
  payload: Uint8Array;
  trailer: number | null;
};

export type VitaPacket<T extends PacketClass> = Omit<
  RawVitaPacket<T>,
  "payload"
> & {
  payload: VitaPayloadMap[T];
};

export function decodeVita<T extends PacketClass>(
  data: Uint8Array,
): VitaPacket<T> | null {
  const parsed = parseVita(data) as RawVitaPacket<T> | null;
  if (!parsed) return null;

  let payload = parsed.payload as VitaPayload;

  switch (parsed.class_id.packet_class_code) {
    case PacketClass.discovery:
      payload = parseDiscoveryPayload(parsed.payload);
      break;
    case PacketClass.meter:
      payload = parseMeterPayload(parsed.payload);
      break;
    case PacketClass.panadapter:
      payload = parsePanadapterPayload(parsed.payload);
      break;
    case PacketClass.waterfall:
      payload = parseWaterfallPayload(parsed.payload);
      break;
    case PacketClass.daxAudio:
      payload = parseDaxAudioPayload(parsed.payload);
      break;
    default:
      return parsed as VitaPacket<T>;
  }

  return { ...parsed, payload } as VitaPacket<T>;
}
