// VITA-49 "preamble" (header + optional streamId, classId, timestamps)

import {
  type VitaHeader,
  type VitaClassId,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  readBigUint64BE,
  writeBigUint64BE,
} from "./common";

export class VitaPacketPreamble {
  header: VitaHeader;
  streamId = 0;
  classId: VitaClassId = {
    oui: 0,
    informationClassCode: 0,
    packetClassCode: 0,
  };
  timestampInt = 0;
  timestampFrac = 0n;

  constructor(data?: Uint8Array) {
    // Sensible defaults; caller usually sets these before serialize
    this.header = {
      packetType: VitaPacketType.IFDataWithStream,
      hasClassId: true,
      hasTrailer: true, // preamble doesn’t include trailer bytes; this flag just reflects the packet
      timestampIntegerType: VitaTimeStampIntegerType.Other,
      timestampFractionalType: VitaTimeStampFractionalType.RealTime,
      packetCount: 0,
      packetSize: 0, // caller should set full packet size (in 32-bit words)
    };

    if (data) this.parse(data);
  }

  /**
   * Parse a VITA preamble from bytes (header + optional fields).
   * Does not read any payload or trailer bytes.
   */
  parse(data: Uint8Array): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let off = 0;

    // Header (big-endian)
    const w0 = view.getUint32(off, false);
    off += 4;
    this.header.packetType = ((w0 >>> 28) & 0x0f) as VitaPacketType;
    this.header.hasClassId = !!(w0 & 0x08000000);
    this.header.hasTrailer = !!(w0 & 0x04000000); // trailer not parsed here
    this.header.timestampIntegerType = ((w0 >>> 22) &
      0x03) as VitaTimeStampIntegerType;
    this.header.timestampFractionalType = ((w0 >>> 20) &
      0x03) as VitaTimeStampFractionalType;
    this.header.packetCount = (w0 >>> 16) & 0x0f;
    this.header.packetSize = w0 & 0xffff;

    // Stream ID (if present)
    if (
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream
    ) {
      this.streamId = view.getUint32(off, false);
      off += 4;
    } else {
      this.streamId = 0;
    }

    // Class ID (if present)
    if (this.header.hasClassId) {
      const cid1 = view.getUint32(off, false);
      off += 4;
      const cid2 = view.getUint32(off, false);
      off += 4;
      this.classId = {
        oui: cid1 & 0x00ff_ffff,
        informationClassCode: (cid2 >>> 16) & 0xffff,
        packetClassCode: cid2 & 0xffff,
      };
    } else {
      this.classId = { oui: 0, informationClassCode: 0, packetClassCode: 0 };
    }

    // Timestamps (optional)
    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None) {
      this.timestampInt = view.getUint32(off, false);
      off += 4;
    } else {
      this.timestampInt = 0;
    }

    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    ) {
      this.timestampFrac = readBigUint64BE(view, off);
      off += 8;
    } else {
      this.timestampFrac = 0n;
    }
  }

  /**
   * Serialize the preamble only (no payload or trailer).
   * Uses `header.packetSize` as provided by the caller; this method does not recompute it.
   */
  toBytes(): Uint8Array {
    // Compute only what we need to emit for the preamble segment
    let numBytes = 4; // header
    if (
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream
    )
      numBytes += 4;
    if (this.header.hasClassId) numBytes += 8;
    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None)
      numBytes += 4;
    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    )
      numBytes += 8;

    const buf = new Uint8Array(numBytes);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let off = 0;

    // Header word (BE)
    const w0 =
      (this.header.packetType << 28) |
      (this.header.hasClassId ? 0x08000000 : 0) |
      (this.header.hasTrailer ? 0x04000000 : 0) |
      (this.header.timestampIntegerType << 22) |
      (this.header.timestampFractionalType << 20) |
      (this.header.packetCount << 16) |
      (this.header.packetSize & 0xffff);
    view.setUint32(off, w0 >>> 0, false);
    off += 4;

    // Stream ID (if present)
    if (
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream
    ) {
      view.setUint32(off, this.streamId >>> 0, false);
      off += 4;
    }

    // Class ID (if present)
    if (this.header.hasClassId) {
      const word1 = this.classId.oui & 0x00ff_ffff;
      const word2 =
        ((this.classId.informationClassCode & 0xffff) << 16) |
        (this.classId.packetClassCode & 0xffff);
      view.setUint32(off, word1 >>> 0, false);
      off += 4;
      view.setUint32(off, word2 >>> 0, false);
      off += 4;
    }

    // Timestamps (optional)
    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None) {
      view.setUint32(off, this.timestampInt >>> 0, false);
      off += 4;
    }
    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    ) {
      writeBigUint64BE(view, off, this.timestampFrac);
      off += 8;
    }

    return buf;
  }
}
