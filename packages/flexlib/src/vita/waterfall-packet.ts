// VITA-49 Extended Data packet for waterfall tiles — performance tuned

import {
  VitaHeader,
  VitaClassId,
  VitaTrailer,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  emptyTrailer,
  readBigUint64BE as readU64,
  writeBigUint64BE as writeU64,
  readBigInt64BE as readI64,
  writeBigInt64BE as writeI64,
  readHeaderBE,
  writeHeaderBE,
  readClassIdBE,
  writeClassIdBE,
  readTrailerAtEndBE,
  writeTrailerBE,
} from "./common";
import type { WaterfallTile } from "@util/waterfall-tile";
import { VitaFrequency } from "@util/vita-frequency";

const TILE_HEADER_BYTES = 36; // 8+8+4+2+2+4+4+2+2

export class VitaWaterfallPacket {
  header: VitaHeader;
  streamId = 0;
  classId: VitaClassId;

  timestampInt = 0;
  timestampFrac = 0n;

  tile: WaterfallTile;
  trailer: VitaTrailer;

  constructor(data?: Uint8Array) {
    this.header = {
      packetType: VitaPacketType.ExtDataWithStream,
      hasClassId: true,
      hasTrailer: true,
      timestampIntegerType: VitaTimeStampIntegerType.Other,
      timestampFractionalType: VitaTimeStampFractionalType.RealTime,
      packetCount: 0,
      packetSize: 0,
    };
    this.classId = { oui: 0, informationClassCode: 0, packetClassCode: 0 };
    this.tile = {
      dateTime: new Date(),
      frameLowFreq: VitaFrequency.fromHz(0),
      binBandwidth: VitaFrequency.fromHz(0),
      lineDurationMs: 0,
      width: 0,
      height: 0,
      timecode: 0,
      autoBlackLevel: 0,
      totalBinsInFrame: 0,
      firstBinIndex: 0,
      isFrameComplete: false,
      data: new Uint16Array(0),
    };
    this.trailer = emptyTrailer();

    if (data) this.parse(data);
  }

  /**
   * Parse a full waterfall packet.
   * @param data raw bytes
   * @param out optional reusable buffer for tile data (to avoid allocations)
   */
  parse(data: Uint8Array, out?: { data?: Uint16Array }): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const parsed = readHeaderBE(view, 0, this.header);
    let off = parsed.off;
    const totalBytes = Math.min(parsed.totalBytes, view.byteLength);
    const trailerPos =
      this.header.hasTrailer && parsed.trailerPos >= 0
        ? Math.min(parsed.trailerPos, view.byteLength - 4)
        : -1;
    const hasTrailer = trailerPos >= 0;

    // Stream ID if present
    if (
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream
    ) {
      this.streamId = view.getUint32(off, false);
      off += 4;
    } else {
      this.streamId = 0;
    }

    // Class ID
    ({ classId: this.classId, off } = readClassIdBE(
      view,
      off,
      this.header.hasClassId,
      this.classId,
    ));

    // Timestamps
    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None) {
      this.timestampInt = view.getUint32(off, false);
      off += 4;
    } else {
      this.timestampInt = 0;
    }
    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    ) {
      this.timestampFrac = readU64(view, off);
      off += 8;
    } else {
      this.timestampFrac = 0n;
    }

    // --- Tile header
    this.tile.dateTime = new Date();

    const rawLow = readI64(view, off);
    off += 8;
    this.tile.frameLowFreq = VitaFrequency.fromRaw(rawLow);

    const rawBw = readI64(view, off);
    off += 8;
    this.tile.binBandwidth = VitaFrequency.fromRaw(rawBw);

    this.tile.lineDurationMs = view.getUint32(off, false);
    off += 4;
    const width = view.getUint16(off, false);
    off += 2;
    const height = view.getUint16(off, false);
    off += 2;
    this.tile.width = width;
    this.tile.height = height;

    this.tile.timecode = view.getUint32(off, false);
    off += 4;
    this.tile.autoBlackLevel = view.getUint32(off, false);
    off += 4;

    this.tile.totalBinsInFrame = view.getUint16(off, false);
    off += 2;
    this.tile.firstBinIndex = view.getUint16(off, false);
    off += 2;

    // --- Tile data
    const wordsExpected = (width * height) >>> 0;
    const payloadEnd = hasTrailer ? trailerPos : totalBytes;
    const clampedEnd = Math.min(payloadEnd, view.byteLength);
    const readableBytes = Math.max(0, clampedEnd - off);
    const readableWords = Math.min(wordsExpected, readableBytes >> 1);

    // zero-alloc fast path
    let arr =
      out?.data && out.data.length >= wordsExpected
        ? out.data
        : new Uint16Array(wordsExpected);

    // tight BE loop
    for (let i = 0; i < readableWords; i++) {
      arr[i] = view.getUint16(off + (i << 1), false);
    }
    // zero-fill tail if truncated
    for (let i = readableWords; i < wordsExpected; i++) arr[i] = 0;

    this.tile.data =
      arr.length === wordsExpected ? arr : arr.subarray(0, wordsExpected);

    // --- Trailer (absolute final word)
    this.trailer = readTrailerAtEndBE(view, trailerPos);
  }

  /**
   * Serialize packet (header + tile header + data + optional trailer).
   * Recomputes packetSize and 32-bit aligns payload.
   */
  toBytes(): Uint8Array {
    const hasStream =
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream;

    // fixed before payload
    let bytes = 4;
    if (hasStream) bytes += 4;
    if (this.header.hasClassId) bytes += 8;
    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None)
      bytes += 4;
    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    )
      bytes += 8;

    // payload (tile header + data) + pad
    const dataBytes = this.tile.data.byteLength; // width*height*2
    const payloadBytes = TILE_HEADER_BYTES + dataBytes;
    const pad = (payloadBytes & 0x03) === 2 ? 2 : 0;

    bytes += payloadBytes + pad;
    if (this.header.hasTrailer) bytes += 4;

    this.header.packetSize = Math.ceil(bytes / 4);

    const totalBytes = this.header.packetSize << 2;
    const buf = new Uint8Array(totalBytes);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let off = writeHeaderBE(view, 0, this.header);

    if (hasStream) {
      view.setUint32(off, this.streamId >>> 0, false);
      off += 4;
    }

    off = writeClassIdBE(
      view,
      off,
      this.header.hasClassId,
      this.classId,
    );

    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None) {
      view.setUint32(off, this.timestampInt >>> 0, false);
      off += 4;
    }
    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    ) {
      writeU64(view, off, this.timestampFrac);
      off += 8;
    }

    // --- Tile header (BE)
    writeI64(view, off, this.tile.frameLowFreq.raw);
    off += 8;
    writeI64(view, off, this.tile.binBandwidth.raw);
    off += 8;

    view.setUint32(off, this.tile.lineDurationMs >>> 0, false);
    off += 4;
    view.setUint16(off, this.tile.width & 0xffff, false);
    off += 2;
    view.setUint16(off, this.tile.height & 0xffff, false);
    off += 2;

    view.setUint32(off, this.tile.timecode >>> 0, false);
    off += 4;
    view.setUint32(off, this.tile.autoBlackLevel >>> 0, false);
    off += 4;

    view.setUint16(off, this.tile.totalBinsInFrame & 0xffff, false);
    off += 2;
    view.setUint16(off, this.tile.firstBinIndex & 0xffff, false);
    off += 2;

    // --- Tile data (uint16 BE)
    const data = this.tile.data;
    for (let i = 0; i < data.length; i++) {
      view.setUint16(off + (i << 1), data[i], false);
    }
    off += data.byteLength;

    // pad (if needed; buffer is zero-initialized)
    off += pad;

    writeTrailerBE(view, off, this.header, this.trailer);

    return buf;
  }
}
