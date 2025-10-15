import {
  VitaHeader,
  VitaClassId,
  VitaTrailer,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  emptyTrailer,
  padToWordBoundary,
  readBigUint64BE,
  writeBigUint64BE,
  readHeaderBE,
  writeHeaderBE,
  readClassIdBE,
  writeClassIdBE,
  readTrailerAtEndBE,
  writeTrailerBE,
} from "./common";

// Reuse singletons
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

export class VitaDiscoveryPacket {
  header: VitaHeader;
  streamId = 0;
  classId: VitaClassId;
  timestampInt = 0;
  timestampFrac = 0n;
  trailer: VitaTrailer;

  private _payload = "";
  private _payloadBytes: Uint8Array = new Uint8Array(0); // cached, padded
  private _payloadDirty = false;

  constructor(data?: Uint8Array) {
    this.header = {
      packetType: VitaPacketType.ExtDataWithStream,
      hasClassId: true,
      hasTrailer: true,
      timestampIntegerType: VitaTimeStampIntegerType.None,
      timestampFractionalType: VitaTimeStampFractionalType.None,
      packetCount: 0,
      packetSize: 0,
    };
    this.classId = { oui: 0, informationClassCode: 0, packetClassCode: 0 };
    this.trailer = emptyTrailer();

    if (data) this.parse(data);
  }

  get payload(): string {
    return this._payload;
  }

  set payload(value: string) {
    if (this._payload !== value) {
      this._payload = padToWordBoundary(value);
      // re-encode once; cache
      this._payloadBytes = UTF8_ENCODER.encode(this._payload);
      this._payloadDirty = false;
      this.updateHeaderPacketSize(); // uses cached length
    }
  }

  /**
   * If you get discovery text as bytes from the wire (already padded),
   * this avoids a UTF-8 encode roundtrip when re-serializing.
   */
  setPayloadFromBytes(bytes: Uint8Array) {
    // Enforce 4-byte alignment: pad with spaces if needed
    const rem = bytes.length % 4;
    this._payloadBytes =
      rem === 0
        ? bytes.slice()
        : ((): Uint8Array => {
            const out = new Uint8Array(bytes.length + (4 - rem));
            out.set(bytes, 0);
            // pad with ASCII space
            out.fill(0x20, bytes.length);
            return out;
          })();

    // Decode string view once (no copy) for user-facing property
    this._payload = UTF8_DECODER.decode(this._payloadBytes);
    this._payloadDirty = false;
    this.updateHeaderPacketSize();
  }

  private updateHeaderPacketSize() {
    let size = 1; // header
    if (this.header.hasClassId) size += 2;
    if (this.header.hasTrailer) size += 1;
    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None)
      size += 1;
    if (
      this.header.timestampFractionalType !== VitaTimeStampFractionalType.None
    )
      size += 2;

    if (
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream
    )
      size += 1;

    // payload expressed in 32-bit words
    size += Math.ceil(this._payloadBytes.length / 4);
    this.header.packetSize = size;
  }

  parse(data: Uint8Array): void {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const parsed = readHeaderBE(view, 0, this.header);
    let off = parsed.off;
    const totalBytes = Math.min(parsed.totalBytes, view.byteLength);
    const trailerPos =
      this.header.hasTrailer && parsed.trailerPos >= 0
        ? Math.min(parsed.trailerPos, view.byteLength - 4)
        : -1;

    const hasStream =
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream;
    if (hasStream) {
      this.streamId = view.getUint32(off, false);
      off += 4;
    } else {
      this.streamId = 0;
    }

    ({ classId: this.classId, off } = readClassIdBE(
      view,
      off,
      this.header.hasClassId,
      this.classId,
    ));

    if (this.header.timestampIntegerType !== VitaTimeStampIntegerType.None) {
      this.timestampInt = view.getUint32(off, false);
      off += 4;
    } else {
      this.timestampInt = 0;
    }

    if (this.header.timestampFractionalType !== VitaTimeStampFractionalType.None) {
      this.timestampFrac = readBigUint64BE(view, off);
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

    this._payloadBytes = data.subarray(off, off + payloadBytes);
    this._payload = UTF8_DECODER.decode(this._payloadBytes);
    this._payloadDirty = false;

    this.trailer = readTrailerAtEndBE(view, trailerPos);
  }

  /**
   * Serialize to bytes. If you pass an output buffer (from a pool),
   * it will be used; otherwise a new Uint8Array is allocated.
   */
  toBytes(out?: Uint8Array): Uint8Array {
    // Ensure payload is encoded (setters keep it up-to-date)
    if (this._payloadDirty) {
      this._payloadBytes = UTF8_ENCODER.encode(this._payload);
      this._payloadDirty = false;
      this.updateHeaderPacketSize();
    }

    const totalBytes = this.header.packetSize * 4;
    const buf =
      out && out.byteLength >= totalBytes
        ? out.subarray(0, totalBytes)
        : new Uint8Array(totalBytes);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let off = writeHeaderBE(view, 0, this.header);

    const hasStream =
      this.header.packetType === VitaPacketType.IFDataWithStream ||
      this.header.packetType === VitaPacketType.ExtDataWithStream;
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
      writeBigUint64BE(view, off, this.timestampFrac);
      off += 8;
    }

    buf.set(this._payloadBytes, off);
    off += this._payloadBytes.length;

    const payloadEnd = this.header.hasTrailer
      ? buf.byteLength - 4
      : buf.byteLength;
    if (off < payloadEnd) {
      buf.fill(0x20, off, payloadEnd);
      off = payloadEnd;
    } else {
      off = payloadEnd;
    }

    writeTrailerBE(view, off, this.header, this.trailer);

    return buf;
  }
}
