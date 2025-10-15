// VITA-49 Extended Data packet for Meters (id:uint16, value:int16 pairs)

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
  readHeaderBE,
  writeHeaderBE,
  readClassIdBE,
  writeClassIdBE,
  readTrailerAtEndBE,
  writeTrailerBE,
} from "./common";

export class VitaMeterPacket {
  header: VitaHeader;
  streamId = 0;
  classId: VitaClassId;

  timestampInt = 0;
  timestampFrac = 0n;

  trailer: VitaTrailer;

  /** Meter IDs (uint16). Backed by the arrays you pass in (if any). */
  ids: Uint16Array = new Uint16Array(0);
  /** Meter values (int16). Backed by the arrays you pass in (if any). */
  values: Int16Array = new Int16Array(0);

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

  /** Number of (id,value) pairs in the payload. */
  get numMeters(): number {
    return Math.min(this.ids.length, this.values.length);
  }

  /**
   * Parse a full meter packet.
   * @param data - raw VITA packet bytes
   * @param out  - optional reusable arrays to avoid allocations
   *               (must be sized for the *maximum* expected meters)
   */
  parse(
    data: Uint8Array,
    out?: { ids?: Uint16Array; values?: Int16Array },
  ): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const parsed = readHeaderBE(view, 0, this.header);
    let off = parsed.off;
    const totalBytes = Math.min(parsed.totalBytes, view.byteLength);
    const trailerPos =
      this.header.hasTrailer && parsed.trailerPos >= 0
        ? Math.min(parsed.trailerPos, view.byteLength - 4)
        : -1;

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

    // Class ID if present
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

    const payloadEnd =
      this.header.hasTrailer && trailerPos >= 0 ? trailerPos : totalBytes;
    const payloadBytes = Math.max(
      0,
      Math.min(payloadEnd, view.byteLength) - off,
    );

    // Each meter is 4 bytes (id:uint16 + value:int16), BE.
    const meters = Math.max(0, payloadBytes >> 2);

    // Prepare output arrays (reuse if provided & large enough)
    let idsOut = out?.ids;
    let valsOut = out?.values;
    if (!idsOut || idsOut.length < meters) idsOut = new Uint16Array(meters);
    if (!valsOut || valsOut.length < meters) valsOut = new Int16Array(meters);

    // Fast single loop; DataView handles BE so no byte swaps needed.
    for (let i = 0; i < meters; i++) {
      idsOut[i] = view.getUint16(off, false);
      valsOut[i] = view.getInt16(off + 2, false);
      off += 4;
    }

    // Install views sliced to the actual count (no copy)
    this.ids = idsOut.subarray(0, meters);
    this.values = valsOut.subarray(0, meters);

    // --- Trailer (absolute final word)
    this.trailer = readTrailerAtEndBE(view, trailerPos);
  }

  /**
   * Serialize full packet (header + meters + trailer).
   * - Recomputes `header.packetSize`.
   * - Writes exactly `ids.length` items (paired with `values[i]`).
   */
  toBytes(): Uint8Array {
    const meters = this.numMeters;
    const hasStream =
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream;

    let bytes = 4;
    if (hasStream) bytes += 4;
    if (this.header.hasClassId) bytes += 8;
    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None)
      bytes += 4;
    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    )
      bytes += 8;

    const payloadBytes = meters << 2;
    bytes += payloadBytes;
    if (this.header.hasTrailer) bytes += 4;

    this.header.packetSize = Math.ceil(bytes / 4);
    const totalBytes = this.header.packetSize << 2;

    const buf =
      bytes === totalBytes ? new Uint8Array(bytes) : new Uint8Array(totalBytes);
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

    for (let i = 0; i < meters; i++) {
      view.setUint16(off, this.ids[i], false);
      view.setInt16(off + 2, this.values[i], false);
      off += 4;
    }

    const payloadEnd = this.header.hasTrailer
      ? buf.byteLength - 4
      : buf.byteLength;
    if (off < payloadEnd) {
      buf.fill(0, off, payloadEnd);
      off = payloadEnd;
    }

    writeTrailerBE(view, off, this.header, this.trailer);

    return buf;
  }
}
