// VITA-49 Extended Data packet for FFT bins — performance tuned

import {
  type VitaHeader,
  type VitaClassId,
  type VitaTrailer,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  emptyTrailer,
  writeBigUint64BE as writeU64,
  writeHeaderBE,
  writeClassIdBE,
  readTrailerAtEndBE,
  writeTrailerBE,
  createPacketContext,
  type VitaPacketContext,
} from "./common";

const FFT_META_BYTES = 12; // start(2) + num(2) + binSize(2) + total(2) + frameIndex(4)

export class VitaFFTPacket {
  header: VitaHeader;
  streamId = 0;
  classId: VitaClassId;

  timestampInt = 0;
  timestampFrac = 0n;

  startBinIndex = 0; // uint16
  numBins = 0; // uint16
  /** Size of each bin in BYTES (Flex: 2). */
  binSize = 2; // uint16
  frameIndex = 0; // uint32
  totalBinsInFrame = 0; // uint16

  /** FFT bin payload (magnitudes). */
  payload: Uint16Array = new Uint16Array(0);

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
    this.trailer = emptyTrailer();

    if (data) this.parse(data);
  }

  /**
   * Parse a full FFT packet.
   * @param data raw bytes
   * @param out optional reusable payload buffer to avoid allocations
   *            (length must be >= numBins)
   */
  parse(data: Uint8Array, out?: { payload?: Uint16Array }): void {
    const ctx = createPacketContext(data, this.header, this.classId);
    if (!ctx) {
      throw new Error("Invalid VITA FFT packet");
    }
    this.parseWithContext(ctx, out);
  }

  /**
   * Serialize full packet.
   * Recomputes packetSize and 32-bit aligns payload (padding with zeros).
   * Writes at most `numBins` values from `payload`.
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

    bytes += FFT_META_BYTES;

    // payload + pad
    const bins = this.numBins >>> 0;
    const bsize = this.binSize >>> 0;
    const payloadBytes = bins * bsize;
    const preTrailer = bytes + payloadBytes;
    const pad = preTrailer & 0x03 ? 4 - (preTrailer & 0x03) : 0;

    bytes = preTrailer + pad;
    if (this.header.hasTrailer) bytes += 4;

    this.header.packetSize = Math.ceil(bytes / 4);

    const buf = new Uint8Array(bytes);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let off = 0;
    off = writeHeaderBE(view, off, this.header);
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

    // meta
    view.setUint16(off, this.startBinIndex & 0xffff, false);
    off += 2;
    view.setUint16(off, bins & 0xffff, false);
    off += 2;
    view.setUint16(off, bsize & 0xffff, false);
    off += 2;
    view.setUint16(off, this.totalBinsInFrame & 0xffff, false);
    off += 2;
    view.setUint32(off, this.frameIndex >>> 0, false);
    off += 4;

    // payload
    const writeWords = Math.min(this.payload.length, bins);

    if (bsize === 2) {
      for (let i = 0; i < writeWords; i++) {
        view.setUint16(off + (i << 1), this.payload[i], false);
      }
      // zero remaining bins (if payload shorter)
      for (let i = writeWords; i < bins; i++) {
        view.setUint16(off + (i << 1), 0, false);
      }
      off += bins * 2;
    } else if (bsize >= 2) {
      // generic: place 16-bit value into the last two bytes of each bin slot
      // clear bin slots (only when needed)
      const bytesToWrite = bins * bsize;
      // buffer is zeroed by default in JS, so we can skip explicit clear
      for (let i = 0; i < writeWords; i++) {
        const base = off + i * bsize + (bsize - 2);
        view.setUint16(base, this.payload[i], false);
      }
      off += bytesToWrite;
    } else {
      // bsize === 1
      for (let i = 0; i < writeWords; i++) {
        buf[off + i] = this.payload[i] & 0xff;
      }
      // remainder already zero
      off += bins;
    }

    // pad (already zero)
    off += pad;

    // trailer
    off = writeTrailerBE(view, off, this.header, this.trailer);
    return buf;
  }

  parseWithContext(
    ctx: VitaPacketContext,
    out?: { payload?: Uint16Array },
  ): void {
    this.header = ctx.header;
    this.streamId = ctx.streamId;
    this.classId = ctx.classId;
    this.timestampInt = ctx.timestampInt;
    this.timestampFrac = ctx.timestampFrac;

    const view = ctx.view;
    let off = ctx.payloadOffset;
    const payloadEnd = ctx.payloadOffset + ctx.payloadLength;

    if (off + FFT_META_BYTES > payloadEnd) {
      this.startBinIndex = 0;
      this.numBins = 0;
      this.binSize = 0;
      this.totalBinsInFrame = 0;
      this.frameIndex = 0;
      this.payload =
        out?.payload && out.payload.length
          ? out.payload.subarray(0, 0)
          : new Uint16Array(0);
      this.trailer =
        ctx.trailerPos >= 0
          ? readTrailerAtEndBE(view, ctx.trailerPos)
          : emptyTrailer();
      return;
    }

    this.startBinIndex = view.getUint16(off, false);
    off += 2;
    const num = view.getUint16(off, false);
    off += 2;
    const bsize = view.getUint16(off, false);
    off += 2;
    const total = view.getUint16(off, false);
    off += 2;
    const frameIdx = view.getUint32(off, false);
    off += 4;
    this.numBins = num;
    this.binSize = bsize;
    this.totalBinsInFrame = total;
    this.frameIndex = frameIdx;

    const expectedPayloadBytes = num * bsize;
    const available = Math.max(
      0,
      Math.min(expectedPayloadBytes, payloadEnd - off),
    );

    const arr =
      out?.payload && out.payload.length >= num
        ? out.payload
        : new Uint16Array(num);
    if (out) out.payload = arr;

    if (bsize === 2) {
      const words = Math.min(num, available >> 1);
      for (let i = 0; i < words; i++) {
        arr[i] = view.getUint16(off + (i << 1), false);
      }
      for (let i = words; i < num; i++) arr[i] = 0;
      off += words << 1;
    } else if (bsize >= 2) {
      const binsReadable = Math.min(num, Math.floor(available / bsize));
      const tail = bsize - 2;
      for (let i = 0; i < binsReadable; i++) {
        arr[i] = view.getUint16(off + i * bsize + tail, false);
      }
      for (let i = binsReadable; i < num; i++) arr[i] = 0;
      off += binsReadable * bsize;
    } else {
      const binsReadable = Math.min(num, available);
      for (let i = 0; i < binsReadable; i++) {
        arr[i] = view.getUint8(off + i);
      }
      for (let i = binsReadable; i < num; i++) arr[i] = 0;
      off += binsReadable;
    }

    this.payload = arr.length === num ? arr : arr.subarray(0, num);

    this.trailer =
      ctx.trailerPos >= 0
        ? readTrailerAtEndBE(view, ctx.trailerPos)
        : emptyTrailer();
  }
}
