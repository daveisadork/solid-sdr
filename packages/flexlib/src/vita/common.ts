// *****************************************************************************
// Description: Common Vita Utility Functions, Enums, Definitions
// Author: Ported from C# by OpenAI (original author: Eric Wachsmann, KE5DTO)
// *****************************************************************************

//
// Enums
//

/**
 * From VITA 49 Standard Table 6.1.1-1
 */
export enum VitaPacketType {
  IFData = 0,
  IFDataWithStream = 1,
  ExtData = 2,
  ExtDataWithStream = 3,
  IFContext = 4,
  ExtContext = 5,
}

/**
 * From VITA 49 Standard Table 6.1.1-2
 */
export enum VitaTimeStampIntegerType {
  None = 0,
  UTC = 1,
  GPS = 2,
  Other = 3,
}

/**
 * From VITA 49 Standard Table 6.1.1-3
 */
export enum VitaTimeStampFractionalType {
  None = 0,
  SampleCount = 1,
  RealTime = 2, // Picoseconds
  FreeRunning = 3,
}

//
// Interfaces
//

/**
 * VITA-49 packet header (section 6.1.1)
 */
export interface VitaHeader {
  packetType: VitaPacketType;
  hasClassId: boolean;
  hasTrailer: boolean;
  timestampIntegerType: VitaTimeStampIntegerType;
  timestampFractionalType: VitaTimeStampFractionalType;
  packetCount: number; // 0–15
  packetSize: number; // 32-bit word count
}

/**
 * VITA-49 class ID (section 7.1.3)
 */
export interface VitaClassId {
  oui: number; // 24-bit IEEE OUI
  informationClassCode: number;
  packetClassCode: number;
}

/**
 * VITA-49 IF data packet trailer (section 6.1.7)
 */
export interface VitaTrailer {
  calibratedTimeEnable: boolean;
  validDataEnable: boolean;
  referenceLockEnable: boolean;
  agcMgcEnable: boolean;
  detectedSignalEnable: boolean;
  spectralInversionEnable: boolean;
  overrangeEnable: boolean;
  sampleLossEnable: boolean;

  calibratedTimeIndicator: boolean;
  validDataIndicator: boolean;
  referenceLockIndicator: boolean;
  agcMgcIndicator: boolean;
  detectedSignalIndicator: boolean;
  spectralInversionIndicator: boolean;
  overrangeIndicator: boolean;
  sampleLossIndicator: boolean;

  contextPacketCountEnabled: boolean;
  associatedContextPacketCount: number; // 0–127
}

//
// Utilities
//

/**
 * Convert a 16-bit VITA integer value (signed) to dB.
 * Assumes the value is in the lower 16 bits of a 32-bit word.
 * @param raw - 32-bit unsigned integer containing a 16-bit signed value
 * @returns dB as a float (value / 128.0)
 */
export function convertVitaToDb(raw: number): number {
  const value16 = raw & 0xffff;
  const signed = value16 & 0x8000 ? value16 - 0x10000 : value16;
  return signed / 128.0;
}

/**
 * Pad a UTF-8 string to a multiple of 4 bytes (VITA word alignment)
 */
export function padToWordBoundary(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const remainder = bytes.length % 4;
  if (remainder === 0) return str;
  const padLength = 4 - remainder;
  return str + " ".repeat(padLength);
}

type DataViewBigInt = DataView & {
  getBigUint64(byteOffset: number, littleEndian?: boolean): bigint;
  setBigUint64(byteOffset: number, value: bigint, littleEndian?: boolean): void;
};

const HAS_GET_BIG_UINT64: boolean =
  "getBigUint64" in (DataView.prototype as object);

export const readBigUint64BE: (view: DataView, offset: number) => bigint =
  HAS_GET_BIG_UINT64
    ? (view, offset) => (view as DataViewBigInt).getBigUint64(offset, false)
    : (view, offset) => {
        const hi = view.getUint32(offset, false);
        const lo = view.getUint32(offset + 4, false);
        return (BigInt(hi) << 32n) | BigInt(lo);
      };

export const writeBigUint64BE: (
  view: DataView,
  offset: number,
  value: bigint,
) => void = HAS_GET_BIG_UINT64
  ? (view, offset, value) => {
      (view as DataViewBigInt).setBigUint64(offset, value, false);
    }
  : (view, offset, value) => {
      const hi = Number((value >> 32n) & 0xffffffffn);
      const lo = Number(value & 0xffffffffn);
      view.setUint32(offset, hi >>> 0, false);
      view.setUint32(offset + 4, lo >>> 0, false);
    };

// --- BigInt64 (signed) helpers with one-time feature detection ---

type DataViewBigIntSigned = DataView & {
  getBigInt64(byteOffset: number, littleEndian?: boolean): bigint;
  setBigInt64(byteOffset: number, value: bigint, littleEndian?: boolean): void;
};

const HAS_GET_BIG_INT64: boolean =
  "getBigInt64" in (DataView.prototype as object);

export const readBigInt64BE: (view: DataView, offset: number) => bigint =
  HAS_GET_BIG_INT64
    ? (view, offset) =>
        (view as DataViewBigIntSigned).getBigInt64(offset, false)
    : (view, offset) => {
        const hi = view.getInt32(offset, false);
        const lo = view.getUint32(offset + 4, false);
        return (BigInt(hi) << 32n) | BigInt(lo);
      };

export const writeBigInt64BE: (
  view: DataView,
  offset: number,
  value: bigint,
) => void = HAS_GET_BIG_INT64
  ? (view, offset, value) => {
      (view as DataViewBigIntSigned).setBigInt64(offset, value, false);
    }
  : (view, offset, value) => {
      const hi = Number((value >> 32n) & 0xffffffffn);
      const lo = Number(value & 0xffffffffn);
      view.setInt32(offset, hi | 0, false);
      view.setUint32(offset + 4, lo >>> 0, false);
    };

/**
 * Create an empty VitaTrailer object
 */
export function emptyTrailer(): VitaTrailer {
  return {
    calibratedTimeEnable: false,
    validDataEnable: false,
    referenceLockEnable: false,
    agcMgcEnable: false,
    detectedSignalEnable: false,
    spectralInversionEnable: false,
    overrangeEnable: false,
    sampleLossEnable: false,

    calibratedTimeIndicator: false,
    validDataIndicator: false,
    referenceLockIndicator: false,
    agcMgcIndicator: false,
    detectedSignalIndicator: false,
    spectralInversionIndicator: false,
    overrangeIndicator: false,
    sampleLossIndicator: false,

    contextPacketCountEnabled: false,
    associatedContextPacketCount: 0,
  };
}

// --- Header / Trailer helpers (big-endian, perf-friendly) ---

export interface ParsedHeader {
  header: VitaHeader;
  off: number; // offset right after the 4-byte header word
  totalBytes: number; // header.packetSize * 4
  trailerPos: number; // absolute offset of trailer (last 4 bytes) or -1 if none
}

/**
 * Read the 32-bit VITA header word at `off` and return parsed fields.
 * Mutates `out` if provided (to avoid new object allocs).
 */
export function readHeaderBE(
  view: DataView,
  off = 0,
  out?: VitaHeader,
): ParsedHeader {
  const w0 = view.getUint32(off, false);
  off += 4;

  const packetType = ((w0 >>> 28) & 0x0f) as VitaPacketType;
  const hasClassId = !!(w0 & 0x08000000);
  const hasTrailer = !!(w0 & 0x04000000);
  const timestampIntegerType = ((w0 >>> 22) & 0x03) as VitaTimeStampIntegerType;
  const timestampFractionalType = ((w0 >>> 20) &
    0x03) as VitaTimeStampFractionalType;
  const packetCount = (w0 >>> 16) & 0x0f;
  const packetSize = w0 & 0xffff;

  const header = out ?? {
    packetType,
    hasClassId,
    hasTrailer,
    timestampIntegerType,
    timestampFractionalType,
    packetCount,
    packetSize,
  };
  // mutate when reusing
  header.packetType = packetType;
  header.hasClassId = hasClassId;
  header.hasTrailer = hasTrailer;
  header.timestampIntegerType = timestampIntegerType;
  header.timestampFractionalType = timestampFractionalType;
  header.packetCount = packetCount;
  header.packetSize = packetSize;

  const totalBytes = packetSize << 2;
  const trailerPos = hasTrailer ? totalBytes - 4 : -1;

  return { header, off, totalBytes, trailerPos };
}

/** Write the 32-bit VITA header word at `off` and return new offset. */
export function writeHeaderBE(
  view: DataView,
  off: number,
  header: VitaHeader,
): number {
  const w0 =
    (header.packetType << 28) |
    (header.hasClassId ? 0x08000000 : 0) |
    (header.hasTrailer ? 0x04000000 : 0) |
    (header.timestampIntegerType << 22) |
    (header.timestampFractionalType << 20) |
    (header.packetCount << 16) |
    (header.packetSize & 0xffff);
  view.setUint32(off, w0 >>> 0, false);
  return off + 4;
}

/** Read ClassId if present; returns new offset. (no-op if !hasClassId) */
export function readClassIdBE(
  view: DataView,
  off: number,
  hasClassId: boolean,
  out?: VitaClassId,
): { classId: VitaClassId; off: number } {
  if (!hasClassId) {
    const cid = out ?? { oui: 0, informationClassCode: 0, packetClassCode: 0 };
    cid.oui = 0;
    cid.informationClassCode = 0;
    cid.packetClassCode = 0;
    return { classId: cid, off };
  }
  const cid1 = view.getUint32(off, false);
  off += 4;
  const cid2 = view.getUint32(off, false);
  off += 4;
  const cid = out ?? { oui: 0, informationClassCode: 0, packetClassCode: 0 };
  cid.oui = cid1 & 0x00ff_ffff;
  cid.informationClassCode = (cid2 >>> 16) & 0xffff;
  cid.packetClassCode = cid2 & 0xffff;
  return { classId: cid, off };
}

/** Write ClassId if present; returns new offset. (no-op if !hasClassId) */
export function writeClassIdBE(
  view: DataView,
  off: number,
  hasClassId: boolean,
  classId: VitaClassId,
): number {
  if (!hasClassId) return off;
  const word1 = classId.oui & 0x00ff_ffff;
  const word2 =
    ((classId.informationClassCode & 0xffff) << 16) |
    (classId.packetClassCode & 0xffff);
  view.setUint32(off, word1 >>> 0, false);
  off += 4;
  view.setUint32(off, word2 >>> 0, false);
  off += 4;
  return off;
}

/** Read trailer at absolute `trailerPos`. If `trailerPos < 0`, returns emptyTrailer(). */
export function readTrailerAtEndBE(
  view: DataView,
  trailerPos: number,
): VitaTrailer {
  if (trailerPos < 0) return emptyTrailer();
  const tw = view.getUint32(trailerPos, false);
  return {
    calibratedTimeEnable: !!(tw & 0x80000000),
    validDataEnable: !!(tw & 0x40000000),
    referenceLockEnable: !!(tw & 0x20000000),
    agcMgcEnable: !!(tw & 0x10000000),
    detectedSignalEnable: !!(tw & 0x08000000),
    spectralInversionEnable: !!(tw & 0x04000000),
    overrangeEnable: !!(tw & 0x02000000),
    sampleLossEnable: !!(tw & 0x01000000),

    calibratedTimeIndicator: !!(tw & 0x00080000),
    validDataIndicator: !!(tw & 0x00040000),
    referenceLockIndicator: !!(tw & 0x00020000),
    agcMgcIndicator: !!(tw & 0x00010000),
    detectedSignalIndicator: !!(tw & 0x00008000),
    spectralInversionIndicator: !!(tw & 0x00004000),
    overrangeIndicator: !!(tw & 0x00002000),
    sampleLossIndicator: !!(tw & 0x00001000),

    contextPacketCountEnabled: !!(tw & 0x80),
    associatedContextPacketCount: tw & 0x7f,
  };
}

/** Write trailer at current `off` and return new offset. (no-op if !header.hasTrailer) */
export function writeTrailerBE(
  view: DataView,
  off: number,
  header: VitaHeader,
  trailer: VitaTrailer,
): number {
  if (!header.hasTrailer) return off;
  const tw =
    (trailer.calibratedTimeEnable ? 0x80000000 : 0) |
    (trailer.validDataEnable ? 0x40000000 : 0) |
    (trailer.referenceLockEnable ? 0x20000000 : 0) |
    (trailer.agcMgcEnable ? 0x10000000 : 0) |
    (trailer.detectedSignalEnable ? 0x08000000 : 0) |
    (trailer.spectralInversionEnable ? 0x04000000 : 0) |
    (trailer.overrangeEnable ? 0x02000000 : 0) |
    (trailer.sampleLossEnable ? 0x01000000 : 0) |
    (trailer.calibratedTimeIndicator ? 0x00080000 : 0) |
    (trailer.validDataIndicator ? 0x00040000 : 0) |
    (trailer.referenceLockIndicator ? 0x00020000 : 0) |
    (trailer.agcMgcIndicator ? 0x00010000 : 0) |
    (trailer.detectedSignalIndicator ? 0x00008000 : 0) |
    (trailer.spectralInversionIndicator ? 0x00004000 : 0) |
    (trailer.overrangeIndicator ? 0x00002000 : 0) |
    (trailer.sampleLossIndicator ? 0x00001000 : 0) |
    (trailer.contextPacketCountEnabled ? 0x80 : 0) |
    (trailer.associatedContextPacketCount & 0x7f);
  view.setUint32(off, tw >>> 0, false);
  return off + 4;
}
