/**
 * VITA-49 Opus audio packet for FlexRadio remote audio TX.
 *
 * Wraps an Opus-encoded audio frame in a VITA-49 packet with the
 * correct class ID (0x8005) for transmission to the radio.
 *
 * @module
 */

import {
  type VitaHeader,
  type VitaClassId,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  writeBigUint64BE as writeU64,
  writeHeaderBE,
  writeClassIdBE,
} from "./common";

const VITA_FLEX_OUI = 0x001c2d;
const VITA_FLEX_INFO_CLASS = 0x534c;
const VITA_FLEX_OPUS_CLASS = 0x8005;

/**
 * VITA-49 Opus audio packet for FlexRadio (class 0x8005).
 *
 * Payload is a single Opus-encoded audio frame. The radio decodes it
 * for remote audio playback.
 */
export class VitaOpusPacket {
  header: VitaHeader;
  streamId = 0;
  classId: VitaClassId;
  timestampInt = 0;
  timestampFrac = 0n;
  payload: Uint8Array = new Uint8Array(0);

  private packetCount = 0;

  constructor() {
    this.header = {
      packetType: VitaPacketType.IFDataWithStream,
      hasClassId: true,
      hasTrailer: false,
      timestampIntegerType: VitaTimeStampIntegerType.Other,
      timestampFractionalType: VitaTimeStampFractionalType.SampleCount,
      packetCount: 0,
      packetSize: 0,
    };
    this.classId = {
      oui: VITA_FLEX_OUI,
      informationClassCode: VITA_FLEX_INFO_CLASS,
      packetClassCode: VITA_FLEX_OPUS_CLASS,
    };
  }

  /**
   * Serialize the packet to bytes.
   * Recomputes header.packetSize; payload is 32-bit aligned (zero-padded if needed).
   */
  toBytes(): Uint8Array {
    const payloadBytes = this.payload.length;
    const pad = payloadBytes & 0x03 ? 4 - (payloadBytes & 0x03) : 0;

    // header(4) + streamId(4) + classId(8) + tsInt(4) + tsFrac(8) + payload + pad
    const preambleBytes = 28;
    const totalBytes = preambleBytes + payloadBytes + pad;

    this.header.packetCount = this.packetCount;
    this.packetCount = (this.packetCount + 1) & 0xf;
    this.header.packetSize = totalBytes >>> 2;

    const buf = new Uint8Array(totalBytes);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    let off = writeHeaderBE(view, 0, this.header);
    view.setUint32(off, this.streamId >>> 0, false);
    off += 4;
    off = writeClassIdBE(view, off, true, this.classId);
    view.setUint32(off, this.timestampInt >>> 0, false);
    off += 4;
    writeU64(view, off, this.timestampFrac);
    off += 8;

    buf.set(this.payload, off);

    return buf;
  }
}
