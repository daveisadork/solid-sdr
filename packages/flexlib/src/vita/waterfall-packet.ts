// VITA-49 Extended Data packet for waterfall tiles — performance tuned

import {
  type VitaHeader,
  type VitaClassId,
  type VitaTrailer,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  emptyTrailer,
  readBigInt64BE as readI64,
  writeBigInt64BE as writeI64,
  writeBigUint64BE as writeU64,
  writeHeaderBE,
  writeClassIdBE,
  readTrailerAtEndBE,
  writeTrailerBE,
  createPacketContext,
  type VitaPacketContext,
} from "./common";
import type { WaterfallTile } from "../util/waterfall-tile";
import { VitaFrequency } from "../util/vita-frequency";

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
    const ctx = createPacketContext(data, this.header, this.classId);
    if (!ctx) {
      throw new Error("Invalid VITA waterfall packet");
    }
    this.parseWithContext(ctx, out);
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

    off = writeClassIdBE(view, off, this.header.hasClassId, this.classId);

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

  parseWithContext(ctx: VitaPacketContext, out?: { data?: Uint16Array }): void {
    this.header = ctx.header;
    this.streamId = ctx.streamId;
    this.classId = ctx.classId;
    this.timestampInt = ctx.timestampInt;
    this.timestampFrac = ctx.timestampFrac;

    const view = ctx.view;
    let off = ctx.payloadOffset;
    const payloadEnd = ctx.payloadOffset + ctx.payloadLength;

    const tile = this.tile;
    tile.dateTime = new Date();

    if (off + TILE_HEADER_BYTES > payloadEnd) {
      tile.frameLowFreq = VitaFrequency.fromHz(0);
      tile.binBandwidth = VitaFrequency.fromHz(0);
      tile.lineDurationMs = 0;
      tile.width = 0;
      tile.height = 0;
      tile.timecode = 0;
      tile.autoBlackLevel = 0;
      tile.totalBinsInFrame = 0;
      tile.firstBinIndex = 0;
      tile.isFrameComplete = false;
      tile.data =
        out?.data && out.data.length
          ? out.data.subarray(0, 0)
          : new Uint16Array(0);
      this.trailer =
        ctx.trailerPos >= 0
          ? readTrailerAtEndBE(view, ctx.trailerPos)
          : emptyTrailer();
      return;
    }

    const rawLow = readI64(view, off);
    off += 8;
    tile.frameLowFreq = VitaFrequency.fromRaw(rawLow);

    const rawBw = readI64(view, off);
    off += 8;
    tile.binBandwidth = VitaFrequency.fromRaw(rawBw);

    tile.lineDurationMs = view.getUint32(off, false);
    off += 4;
    const width = view.getUint16(off, false);
    off += 2;
    const height = view.getUint16(off, false);
    off += 2;
    tile.width = width;
    tile.height = height;

    tile.timecode = view.getUint32(off, false);
    off += 4;
    tile.autoBlackLevel = view.getUint32(off, false);
    off += 4;

    tile.totalBinsInFrame = view.getUint16(off, false);
    off += 2;
    tile.firstBinIndex = view.getUint16(off, false);
    off += 2;

    const wordsExpected = (width * height) >>> 0;
    const readableBytes = Math.max(
      0,
      Math.min(payloadEnd - off, view.byteLength - off),
    );
    const readableWords = Math.min(wordsExpected, readableBytes >> 1);

    const arr =
      out?.data && out.data.length >= wordsExpected
        ? out.data
        : new Uint16Array(wordsExpected);
    if (out) out.data = arr;

    for (let i = 0; i < readableWords; i++) {
      arr[i] = view.getUint16(off + (i << 1), false);
    }
    for (let i = readableWords; i < wordsExpected; i++) arr[i] = 0;

    tile.data =
      arr.length === wordsExpected ? arr : arr.subarray(0, wordsExpected);

    this.trailer =
      ctx.trailerPos >= 0
        ? readTrailerAtEndBE(view, ctx.trailerPos)
        : emptyTrailer();
  }
}
