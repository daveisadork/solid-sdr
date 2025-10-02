export * from "./daxaudio";
export * from "./discovery";
export * from "./meters";
export * from "./panadapter";
export * from "./waterfall";
export * from "./opus";

// -------------------- enums & base types --------------------
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

export enum PacketType {
  /// Signal data packet without a stream ID.
  SignalDataWithoutStreamId = 0x0,
  /// Signal data packet *with* a stream ID.
  SignalData = 0x1,
  /// Extension data packet without a stream ID.
  ExtensionDataWithoutStreamId = 0x2,
  /// Extension data packet *with* a stream ID.
  ExtensionData = 0x3,
  /// Context packet.
  Context = 0x4,
  /// Extension context packet.
  ExtensionContext = 0x5,
  /// Command packet.
  Command = 0x6,
  /// Extension command packet.
  ExtensionCommand = 0x7,
}

class ClassId {
  information_class_code: u32 = 0;
  packet_class_code: u32 = 0;
  word_1: u32 = 0;
}

class PacketHeader {
  hword_1: u32 = 0;
  packet_size: u32 = 0;
}

class VitaPacket {
  header: PacketHeader = new PacketHeader();
  class_id: ClassId = new ClassId();
  fractional_timestamp: u32 = 0;
  integer_timestamp: u32 = 0;
  stream_id: u32 = 0;
  trailer: u32 = 0; // 0 if none
  payload: Uint8Array = new Uint8Array(0);
}

// ---- constants ----
const kVitaMinimumBytes: i32 = 28;
const kClassIdPresentMask: u8 = 0x08;
const kTrailerPresentMask: u8 = 0x04;
const kTsiTypeMask: u8 = 0xc0;
const kTsfTypeMask: u8 = 0x30;
const kInformationClassCodeMask: u32 = 0xffff0000;
const kPacketClassCodeMask: u32 = 0x0000ffff;
const kOffsetOptionals: i32 = 4;
const kTrailerSize: i32 = 4;

export function parseVita(data: Uint8Array): VitaPacket | null {
  if (data.length < kVitaMinimumBytes) return null;

  // header (big-endian)
  let dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const packetDesc: u8 = dv.getUint8(0);
  const timeStampDesc: u8 = dv.getUint8(1);
  const packetSizeWords: u16 = dv.getUint16(2);
  const packetSizeBytes: i32 = data.byteLength;
  if (packetSizeBytes < kVitaMinimumBytes || packetSizeBytes > data.length)
    return null;

  // restrict DV to the exact packet slice
  dv = new DataView(data.buffer, data.byteOffset, packetSizeBytes);

  const classIdPresent: bool = (packetDesc & kClassIdPresentMask) != 0;
  const trailerPresent: bool = (packetDesc & kTrailerPresentMask) != 0;
  const tsiType: u8 = (timeStampDesc & kTsiTypeMask) >>> 6;
  const tsfType: u8 = (timeStampDesc & kTsfTypeMask) >>> 4;

  // optionals
  let optWordIndex: i32 = 0;

  // Stream ID (assumed present)
  {
    const off = kOffsetOptionals + (optWordIndex << 2);
    if (off + 4 > packetSizeBytes) return null;
  }
  const stream_id: u32 = dv.getUint32(
    kOffsetOptionals + (optWordIndex << 2),
    false,
  );
  optWordIndex += 1;

  // Class ID
  let class_word1: u32 = 0;
  let information_class_code: u32 = 0;
  let packet_class_codeNum: u32 = 0;

  if (classIdPresent) {
    const off0 = kOffsetOptionals + (optWordIndex << 2);
    const off1 = off0 + 4;
    if (off1 + 4 > packetSizeBytes) return null;
    class_word1 = dv.getUint32(off0);
    const w1 = dv.getUint32(off1);
    information_class_code = (w1 & kInformationClassCodeMask) >>> 16;
    packet_class_codeNum = w1 & kPacketClassCodeMask;
    optWordIndex += 2;
  }

  // Timestamps
  let integer_timestamp: u32 = 0;
  if (tsiType != 0) {
    const off = kOffsetOptionals + (optWordIndex << 2);
    if (off + 4 > packetSizeBytes) return null;
    integer_timestamp = dv.getUint32(off);
    optWordIndex += 1;
  }

  let fractional_timestamp: u32 = 0;
  if (tsfType != 0) {
    const offMSB = kOffsetOptionals + (optWordIndex << 2);
    const offLSB = offMSB + 4;
    if (offLSB + 4 > packetSizeBytes) return null;
    // const msb = dv.getUint32(offMSB);
    const lsb = dv.getUint32(offLSB);
    fractional_timestamp = lsb;
    optWordIndex += 2;
  }

  // sizes
  const headerSize: i32 = 4 * (1 + optWordIndex);
  const trailerBytes: i32 = trailerPresent ? kTrailerSize : 0;
  const payloadSize: i32 = packetSizeBytes - headerSize - trailerBytes;
  if (payloadSize < 0) return null;

  // payload slice (raw)
  const payloadBytes = Uint8Array.wrap(
    data.buffer,
    data.byteOffset + headerSize,
    payloadSize,
  );

  // trailer
  let trailer: u32 = trailerPresent
    ? dv.getUint32(packetSizeBytes - kTrailerSize)
    : 0;

  // ---- build base fields once ----
  const h = new PacketHeader();
  h.hword_1 = <u32>(((<u32>packetDesc) << 8) | (<u32>timeStampDesc));
  h.packet_size = <u32>packetSizeBytes;

  const cid = new ClassId();
  cid.information_class_code = information_class_code;
  cid.packet_class_code = packet_class_codeNum;
  cid.word_1 = class_word1;

  const pkt = new VitaPacket();
  pkt.header = h;
  pkt.class_id = cid;
  pkt.fractional_timestamp = fractional_timestamp;
  pkt.integer_timestamp = integer_timestamp;
  pkt.stream_id = stream_id;
  pkt.trailer = trailer;
  pkt.payload = payloadBytes; // leave as raw
  return pkt;
}
