// VITA-49 DAX audio packets for FlexRadio — stereo float32 and reduced-bandwidth mono int16

import {
  type VitaHeader,
  type VitaClassId,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  writeBigUint64BE as writeU64,
  writeHeaderBE,
  writeClassIdBE,
  createPacketContext,
  type VitaPacketContext,
  VITA_FLEX_OUI,
  VITA_FLEX_INFO_CLASS,
} from "./common";

/** Packet class code for DAX stereo audio (float32 interleaved L/R). */
export const VITA_FLEX_DAX_AUDIO_CLASS = 0x03e3;

/** Packet class code for DAX reduced-bandwidth audio (int16 mono). */
export const VITA_FLEX_DAX_REDUCED_BW_CLASS = 0x0123;

// Preamble layout (bytes):
//   header(4) + streamId(4) + classId(8) + timestampInt(4) + timestampFrac(8) = 28
const PREAMBLE_BYTES = 28;

function defaultDaxHeader(): VitaHeader {
  return {
    packetType: VitaPacketType.IFDataWithStream,
    hasClassId: true,
    hasTrailer: false,
    timestampIntegerType: VitaTimeStampIntegerType.Other,
    timestampFractionalType: VitaTimeStampFractionalType.SampleCount,
    packetCount: 0,
    packetSize: 0,
  };
}

/**
 * Write the fixed 28-byte DAX preamble (header + streamId + classId + timestamps)
 * into `view` starting at offset 0. Returns the offset after the preamble (28).
 */
function writePreamble(
  view: DataView,
  pkt: {
    header: VitaHeader;
    streamId: number;
    classId: VitaClassId;
    timestampInt: number;
    timestampFrac: bigint;
  },
): number {
  let off = writeHeaderBE(view, 0, pkt.header);
  view.setUint32(off, pkt.streamId >>> 0, false);
  off += 4;
  off = writeClassIdBE(view, off, true, pkt.classId);
  view.setUint32(off, pkt.timestampInt >>> 0, false);
  off += 4;
  writeU64(view, off, pkt.timestampFrac);
  return off + 8;
}

/**
 * VITA-49 DAX stereo audio packet (FlexRadio class 0x03e3).
 *
 * Payload is stereo 32-bit float samples written as big-endian interleaved L/R pairs:
 * `[L0, R0, L1, R1, …]`. The frame count is `min(left.length, right.length)`.
 *
 * Typical use: 128-frame blocks at 24 kHz (~5.3 ms latency) on a DAX audio channel.
 */
export class VitaDaxAudioPacket {
  readonly kind = "daxAudio" as const;
  /** VITA-49 header word fields. */
  header: VitaHeader;
  /** Stream identifier (uint32). */
  streamId = 0;
  /** VITA-49 class identifier. Defaults to FlexRadio DAX audio class. */
  classId: VitaClassId;
  /** Integer timestamp (always 0 for FlexRadio DAX). */
  timestampInt = 0;
  /** Fractional timestamp / sample count (always 0n for FlexRadio DAX). */
  timestampFrac = 0n;

  /** Left-channel samples, nominal range [−1, 1]. */
  left: Float32Array = new Float32Array(0);
  /** Right-channel samples, nominal range [−1, 1]. */
  right: Float32Array = new Float32Array(0);

  constructor(data?: Uint8Array) {
    this.header = defaultDaxHeader();
    this.classId = {
      oui: VITA_FLEX_OUI,
      informationClassCode: VITA_FLEX_INFO_CLASS,
      packetClassCode: VITA_FLEX_DAX_AUDIO_CLASS,
    };
    if (data) this.parse(data);
  }

  /** Number of stereo frames: `min(left.length, right.length)`. */
  get numFrames(): number {
    return Math.min(this.left.length, this.right.length);
  }

  /**
   * Parse a full DAX stereo audio packet.
   * @param data Raw VITA packet bytes.
   * @param out Optional reusable typed arrays (length ≥ frame count) to avoid allocations.
   */
  parse(
    data: Uint8Array,
    out?: { left?: Float32Array; right?: Float32Array },
  ): void {
    const ctx = createPacketContext(data, this.header, this.classId);
    if (!ctx) throw new Error("Invalid VITA DAX audio packet");
    this.parseWithContext(ctx, out);
  }

  /**
   * Serialize the packet to bytes.
   * Recomputes `header.packetSize`; payload is 32-bit aligned (zero-padded if needed).
   */
  toBytes(): Uint8Array {
    const frames = this.numFrames;
    const payloadBytes = frames * 8; // float32 L + float32 R per frame
    const pad = payloadBytes & 0x03 ? 4 - (payloadBytes & 0x03) : 0;
    const totalBytes = PREAMBLE_BYTES + payloadBytes + pad;
    this.header.packetSize = totalBytes >>> 2;

    const buf = new Uint8Array(totalBytes);
    const view = new DataView(buf.buffer);
    let off = writePreamble(view, this);

    for (let i = 0; i < frames; i++) {
      view.setFloat32(off, this.left[i], false);
      off += 4;
      view.setFloat32(off, this.right[i], false);
      off += 4;
    }

    return buf;
  }

  /**
   * Parse from an already-decoded packet context (avoids re-parsing the preamble).
   * @param ctx Context produced by `createPacketContext`.
   * @param out Optional reusable typed arrays (length ≥ frame count) to avoid allocations.
   */
  parseWithContext(
    ctx: VitaPacketContext,
    out?: { left?: Float32Array; right?: Float32Array },
  ): void {
    this.header = ctx.header;
    this.streamId = ctx.streamId;
    this.classId = ctx.classId;
    this.timestampInt = ctx.timestampInt;
    this.timestampFrac = ctx.timestampFrac;

    const view = ctx.view;
    const frames = Math.max(0, ctx.payloadLength >>> 3); // 8 bytes per frame
    let off = ctx.payloadOffset;

    let leftOut = out?.left;
    let rightOut = out?.right;
    if (!leftOut || leftOut.length < frames) leftOut = new Float32Array(frames);
    if (!rightOut || rightOut.length < frames)
      rightOut = new Float32Array(frames);
    if (out) {
      out.left = leftOut;
      out.right = rightOut;
    }

    for (let i = 0; i < frames; i++) {
      leftOut[i] = view.getFloat32(off, false);
      off += 4;
      rightOut[i] = view.getFloat32(off, false);
      off += 4;
    }

    this.left =
      leftOut.length === frames ? leftOut : leftOut.subarray(0, frames);
    this.right =
      rightOut.length === frames ? rightOut : rightOut.subarray(0, frames);
  }
}

/**
 * VITA-49 DAX reduced-bandwidth audio packet (FlexRadio class 0x0123).
 *
 * Payload is mono 16-bit signed integer samples (range [−32768, 32767]).
 *
 * Same 24 kHz sample rate and 128-frame cadence as the stereo float32 variant —
 * the "reduced bandwidth" comes from the encoding (mono int16 = 2 bytes/frame vs
 * stereo float32 = 8 bytes/frame), giving 4× lower wire bandwidth.
 */
export class VitaDaxReducedBwPacket {
  readonly kind = "daxReducedBw" as const;
  /** VITA-49 header word fields. */
  header: VitaHeader;
  /** Stream identifier (uint32). */
  streamId = 0;
  /** VITA-49 class identifier. Defaults to FlexRadio DAX reduced-bandwidth class. */
  classId: VitaClassId;
  /** Integer timestamp (always 0 for FlexRadio DAX). */
  timestampInt = 0;
  /** Fractional timestamp / sample count (always 0n for FlexRadio DAX). */
  timestampFrac = 0n;

  /** Mono int16 samples, range [−32768, 32767]. */
  samples: Int16Array = new Int16Array(0);

  constructor(data?: Uint8Array) {
    this.header = defaultDaxHeader();
    this.classId = {
      oui: VITA_FLEX_OUI,
      informationClassCode: VITA_FLEX_INFO_CLASS,
      packetClassCode: VITA_FLEX_DAX_REDUCED_BW_CLASS,
    };
    if (data) this.parse(data);
  }

  /** Number of mono frames: `samples.length`. */
  get numFrames(): number {
    return this.samples.length;
  }

  /**
   * Parse a full DAX reduced-bandwidth audio packet.
   * @param data Raw VITA packet bytes.
   * @param out Optional reusable typed array (length ≥ frame count) to avoid allocations.
   */
  parse(data: Uint8Array, out?: { samples?: Int16Array }): void {
    const ctx = createPacketContext(data, this.header, this.classId);
    if (!ctx) throw new Error("Invalid VITA DAX reduced-bandwidth packet");
    this.parseWithContext(ctx, out);
  }

  /**
   * Serialize the packet to bytes.
   * Recomputes `header.packetSize`; payload is 32-bit aligned (zero-padded if needed).
   */
  toBytes(): Uint8Array {
    const frames = this.samples.length;
    const payloadBytes = frames * 2; // int16 per frame
    const pad = payloadBytes & 0x03 ? 4 - (payloadBytes & 0x03) : 0;
    const totalBytes = PREAMBLE_BYTES + payloadBytes + pad;
    this.header.packetSize = totalBytes >>> 2;

    const buf = new Uint8Array(totalBytes);
    const view = new DataView(buf.buffer);
    let off = writePreamble(view, this);

    for (let i = 0; i < frames; i++) {
      view.setInt16(off, this.samples[i], false);
      off += 2;
    }

    return buf;
  }

  /**
   * Parse from an already-decoded packet context (avoids re-parsing the preamble).
   * @param ctx Context produced by `createPacketContext`.
   * @param out Optional reusable typed array (length ≥ frame count) to avoid allocations.
   */
  parseWithContext(
    ctx: VitaPacketContext,
    out?: { samples?: Int16Array },
  ): void {
    this.header = ctx.header;
    this.streamId = ctx.streamId;
    this.classId = ctx.classId;
    this.timestampInt = ctx.timestampInt;
    this.timestampFrac = ctx.timestampFrac;

    const view = ctx.view;
    const frames = Math.max(0, ctx.payloadLength >>> 1); // 2 bytes per frame
    let off = ctx.payloadOffset;

    let samplesOut = out?.samples;
    if (!samplesOut || samplesOut.length < frames)
      samplesOut = new Int16Array(frames);
    if (out) out.samples = samplesOut;

    for (let i = 0; i < frames; i++) {
      samplesOut[i] = view.getInt16(off, false);
      off += 2;
    }

    this.samples =
      samplesOut.length === frames ? samplesOut : samplesOut.subarray(0, frames);
  }
}
