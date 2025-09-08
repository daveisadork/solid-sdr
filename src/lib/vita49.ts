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

export interface ClassId<T = PacketClass> {
  information_class_code: number;
  packet_class_code: T;
  word_1: number;
}

export interface PacketHeader {
  hword_1: number;
  packet_size: number;
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

export interface VitaPacket<T extends PacketClass = PacketClass> {
  class_id: ClassId<T>;
  header: PacketHeader;
  fractional_timestamp: number;
  integer_timestamp: number;
  stream_id: number;
  payload: VitaPayloadMap[T];
  trailer: number | null;
}

const FLOAT_SCALE = 1024 * 1024;
const decoder = new TextDecoder("utf-8");

export function decodeDiscoveryPayload(data: Uint8Array): DiscoveryPayload {
  const obj: Partial<DiscoveryPayload> = {};
  decoder
    .decode(data)
    .split(" ")
    .forEach((item: string) => {
      const [key, value] = item
        .replace("\u007f", " ")
        .replace("\u0000", "")
        .split("=");
      switch (key) {
        case "port":
        case "licensed_clients":
        case "available_clients":
        case "max_panadapters":
        case "available_panadapters":
        case "max_slices":
        case "available_slices":
          obj[key] = parseInt(value);
          break;
        case "requires_additional_license":
        case "external_port_link":
        case "wan_connected":
          obj[key] = !!parseInt(value);
          break;
        case "inuse_ip":
        case "inuse_host":
        case "gui_client_ips":
        case "gui_client_hosts":
        case "gui_client_programs":
        case "gui_client_stations":
        case "gui_client_handles":
          obj[key] = value.length ? value.split(",") : [];
          break;
        case "model":
        case "serial":
        case "version":
        case "nickname":
        case "callsign":
        case "ip":
        case "status":
        case "max_licensed_version":
        case "radio_license_id":
        case "fpc_mac":
        case "min_software_version":
        case "discovery_protocol_version":
          obj[key] = value;
          break;
        default:
          console.warn(`Unknown discovery item: ${key}=${value}`);
      }
    });
  return obj as DiscoveryPayload;
}

export function decodeMeterPayload(data: Uint8Array): MeterPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const payload: MeterPayload = [];
  for (let offset = 0; offset < view.byteLength; offset += 4) {
    payload.push({
      id: view.getUint16(offset),
      value: view.getInt16(offset + 2),
    });
  }
  return payload;
}

export function decodePanadapterPayload(data: Uint8Array): PanadapterPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const startingBin = view.getUint16(0);
  const binsInThisFrame = view.getUint16(2);
  const binSize = view.getUint16(4);
  const totalBins = view.getUint16(6);
  const frame = view.getUint32(8);
  const bins: number[] = [];
  for (let i = 0; i < binsInThisFrame; i++) {
    bins.push(view.getUint16(12 + i * 2));
  }
  return {
    startingBin,
    binsInThisFrame,
    binSize,
    totalBins,
    frame,
    bins,
  };
}

export function decodeWaterfallPayload(data: Uint8Array): WaterfallPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const firstBinFreq = Number(view.getBigInt64(0)) / FLOAT_SCALE;
  const binBandwidth = Number(view.getBigInt64(8)) / FLOAT_SCALE;
  const lineDuration = view.getUint32(16);
  const binsInThisFrame = view.getUint16(20);
  const height = view.getUint16(22);
  const frame = view.getUint32(24);
  const autoBlackLevel = view.getUint32(28);
  const totalBins = view.getUint16(32);
  const startingBin = view.getUint16(34);

  const bins: number[] = [];
  for (let i = 0; i < binsInThisFrame; i++) {
    bins.push(view.getUint16(36 + i * 2));
  }
  return {
    binBandwidth,
    firstBinFreq,
    lineDuration,
    binsInThisFrame,
    height,
    frame,
    autoBlackLevel,
    totalBins,
    startingBin,
    bins,
  };
}

export function decodeDaxAudioPayload(data: Uint8Array): DaxAudioPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const samples = data.byteLength / 8;
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);

  let offset = 0;
  for (let i = 0; i < samples; i++) {
    left[i] = view.getFloat32(offset);
    offset += 4; // big-endian
    right[i] = view.getFloat32(offset);
    offset += 4;
  }

  return {
    numberOfSamples: 0,
    daxChannel: -1,
    data: [left, right],
  };
}

export function decodePayload<T extends PacketClass = PacketClass>(
  packetClass: T,
  data: Uint8Array,
): VitaPayloadMap[T] {
  switch (packetClass) {
    case PacketClass.discovery:
      return decodeDiscoveryPayload(data) as VitaPayloadMap[T];
    case PacketClass.meter:
      return decodeMeterPayload(data) as VitaPayloadMap[T];
    case PacketClass.panadapter:
      return decodePanadapterPayload(data) as VitaPayloadMap[T];
    case PacketClass.waterfall:
      return decodeWaterfallPayload(data) as VitaPayloadMap[T];
    case PacketClass.daxAudio:
      return decodeDaxAudioPayload(data) as VitaPayloadMap[T];
    default:
      return data as VitaPayloadMap[T];
  }
}

/**
 * Decode a VITA-49-ish packet.
 * Assumptions (typical VITA-49):
 * - packetDesc: bits 7..4 = packetType
 *     0x1 (IF Data w/ Stream ID), 0x5 (Ext Data w/ Stream ID) => stream ID present
 * - packetDesc bit 3: class ID present
 * - packetDesc bit 2: trailer present
 * - timeStampDesc: bits 7..6 = TSI, bits 5..4 = TSF, bits 3..0 = sequence
 * - packetSize is big-endian words (×4 bytes)
 */
export function decodeVita<T extends PacketClass = PacketClass>(
  data: Uint8Array,
): VitaPacket<T> | null {
  // --- constants (Swift parity) ---
  const kVitaMinimumBytes = 28;
  const kClassIdPresentMask = 0x08;
  const kTrailerPresentMask = 0x04;
  const kTsiTypeMask = 0xc0;
  const kTsfTypeMask = 0x30;
  const kInformationClassCodeMask = 0xffff0000 >>> 0;
  const kPacketClassCodeMask = 0x0000ffff;
  const kOffsetOptionals = 4; // optionals start after first 4 bytes
  const kTrailerSize = 4;

  if (data.length < kVitaMinimumBytes) return null;

  // Header (fixed 4 bytes)
  let dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const packetDesc = dv.getUint8(0);
  const timeStampDesc = dv.getUint8(1);
  const packetSizeWords = dv.getUint16(2, false); // big-endian
  const packetSizeBytes = packetSizeWords * 4;

  // Validate size and restrict to the single packet
  if (packetSizeBytes < kVitaMinimumBytes || packetSizeBytes > data.length)
    return null;
  dv = new DataView(data.buffer, data.byteOffset, packetSizeBytes);

  const classIdPresent = (packetDesc & kClassIdPresentMask) !== 0;
  const trailerPresent = (packetDesc & kTrailerPresentMask) !== 0;
  const tsiType = (timeStampDesc & kTsiTypeMask) >>> 6; // 0 = none
  const tsfType = (timeStampDesc & kTsfTypeMask) >>> 4; // 0 = none

  // Helper to read optional 32-bit words (big-endian) by index from the optionals area
  let optWordIndex = 0;
  const readOpt32 = (i32: number): number | null => {
    const off = kOffsetOptionals + i32 * 4;
    if (off + 4 > packetSizeBytes) return null;
    return dv.getUint32(off, false) >>> 0;
  };

  // ---- Optionals in fixed order, ASSUMING Stream ID is present ----
  // Stream ID (always present by assumption)
  const wStream = readOpt32(optWordIndex);
  if (wStream == null) return null;
  const stream_id = wStream;
  optWordIndex += 1;

  // Class ID (if bit says present): OUI word + info/class word
  let class_word1 = 0;
  let information_class_code = 0;
  let packet_class_codeNum: number = 0;

  if (classIdPresent) {
    const w0 = readOpt32(optWordIndex);
    const w1 = readOpt32(optWordIndex + 1);
    if (w0 == null || w1 == null) return null;

    class_word1 = w0; // full 32 bits; OUI is typically (w0 & 0x00ffffff)
    information_class_code = (w1 & kInformationClassCodeMask) >>> 16;
    packet_class_codeNum = (w1 & kPacketClassCodeMask) >>> 0;

    optWordIndex += 2;
  }

  // Integer timestamp (if tsiType != none)
  let integer_timestamp = 0;
  if (tsiType !== 0) {
    const ts = readOpt32(optWordIndex);
    if (ts == null) return null;
    integer_timestamp = ts;
    optWordIndex += 1;
  }

  // Fractional timestamp (if tsfType != none): MSB, LSB — we expose LSB per your interface
  let fractional_timestamp = 0;
  if (tsfType !== 0) {
    const msb = readOpt32(optWordIndex);
    const lsb = readOpt32(optWordIndex + 1);
    if (msb == null || lsb == null) return null;
    fractional_timestamp = lsb >>> 0;
    optWordIndex += 2;
  }

  // Compute sizes from the packet slice (never from data.length)
  const headerSize = 4 * (1 + optWordIndex); // base 4 bytes + 4 per optional word consumed
  const trailerBytes = trailerPresent ? kTrailerSize : 0;
  const payloadSize = packetSizeBytes - headerSize - trailerBytes;
  if (payloadSize < 0) return null;

  const payloadBytes = new Uint8Array(
    data.buffer,
    data.byteOffset + headerSize,
    payloadSize,
  );

  // Trailer (last 4 bytes of the packet)
  let trailer: number | null = null;
  if (trailerPresent) {
    trailer = dv.getUint32(packetSizeBytes - 4, false) >>> 0;
  }

  // Build your shapes (keep the two header bytes raw in hword_1 for inspection)
  return {
    class_id: {
      information_class_code,
      packet_class_code: packet_class_codeNum as unknown as T,
      word_1: class_word1,
    },
    header: {
      hword_1: ((packetDesc << 8) | timeStampDesc) >>> 0,
      packet_size: packetSizeBytes,
    },
    fractional_timestamp,
    integer_timestamp,
    stream_id,
    payload: decodePayload(packet_class_codeNum, payloadBytes),
    trailer,
  } as VitaPacket<T>;
}
