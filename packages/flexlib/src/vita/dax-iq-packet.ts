// VITA-49 DAX IQ packets for FlexRadio — stereo float32 I/Q, LE on the wire,
// scaled by 1/32768 to match the official ONE_OVER_ZERO_DBFS reference.

import {
  type VitaHeader,
  type VitaClassId,
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  createPacketContext,
  type VitaPacketContext,
  VITA_FLEX_OUI,
  VITA_FLEX_INFO_CLASS,
} from "./common";

/** DAX IQ packet class codes (one per supported sample rate). */
export const VITA_FLEX_DAX_IQ_24_CLASS = 0x02e3;
export const VITA_FLEX_DAX_IQ_48_CLASS = 0x02e4;
export const VITA_FLEX_DAX_IQ_96_CLASS = 0x02e5;
export const VITA_FLEX_DAX_IQ_192_CLASS = 0x02e6;

export const DAX_IQ_CLASS_CODES = new Set<number>([
  VITA_FLEX_DAX_IQ_24_CLASS,
  VITA_FLEX_DAX_IQ_48_CLASS,
  VITA_FLEX_DAX_IQ_96_CLASS,
  VITA_FLEX_DAX_IQ_192_CLASS,
]);

const ONE_OVER_ZERO_DBFS = 1 / (1 << 15);

export function sampleRateForClass(classCode: number): number {
  switch (classCode) {
    case VITA_FLEX_DAX_IQ_24_CLASS:
      return 24_000;
    case VITA_FLEX_DAX_IQ_48_CLASS:
      return 48_000;
    case VITA_FLEX_DAX_IQ_96_CLASS:
      return 96_000;
    case VITA_FLEX_DAX_IQ_192_CLASS:
      return 192_000;
    default:
      throw new Error(
        `Not a DAX IQ class code: 0x${classCode.toString(16).padStart(4, "0")}`,
      );
  }
}

function defaultDaxIqHeader(): VitaHeader {
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
 * VITA-49 DAX IQ packet (FlexRadio classes 0x02E3..0x02E6 = 24/48/96/192 kHz).
 *
 * Payload is stereo 32-bit float little-endian (unlike DAX audio which is BE)
 * with interleaved I/Q pairs. The radio sends samples scaled to +/-32768 dBFS;
 * this decoder divides by 32768 so the output range is [-1, 1].
 *
 * I -> `left`, Q -> `right`. Sample rate is determined by the packet class code.
 */
export class VitaDaxIqPacket {
  readonly kind = "daxIq" as const;
  header: VitaHeader;
  streamId = 0;
  classId: VitaClassId;
  timestampInt = 0;
  timestampFrac = 0n;

  left: Float32Array = new Float32Array(0);
  right: Float32Array = new Float32Array(0);

  constructor(data?: Uint8Array) {
    this.header = defaultDaxIqHeader();
    this.classId = {
      oui: VITA_FLEX_OUI,
      informationClassCode: VITA_FLEX_INFO_CLASS,
      packetClassCode: VITA_FLEX_DAX_IQ_24_CLASS,
    };
    if (data) this.parse(data);
  }

  get sampleRate(): number {
    return sampleRateForClass(this.classId.packetClassCode);
  }

  get numFrames(): number {
    return Math.min(this.left.length, this.right.length);
  }

  parse(
    data: Uint8Array,
    out?: { left?: Float32Array; right?: Float32Array },
  ): void {
    const ctx = createPacketContext(data, this.header, this.classId);
    if (!ctx) throw new Error("Invalid VITA DAX IQ packet");
    if (!DAX_IQ_CLASS_CODES.has(ctx.classId.packetClassCode)) {
      throw new Error(
        `Not a DAX IQ packet class: 0x${ctx.classId.packetClassCode
          .toString(16)
          .padStart(4, "0")}`,
      );
    }
    this.parseWithContext(ctx, out);
  }

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
    const frames = Math.max(0, ctx.payloadLength >>> 3); // 8 bytes per frame (I+Q float32)
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

    // IQ payload is LE on the wire (unlike DAX audio which is BE).
    for (let i = 0; i < frames; i++) {
      leftOut[i] = view.getFloat32(off, true) * ONE_OVER_ZERO_DBFS;
      off += 4;
      rightOut[i] = view.getFloat32(off, true) * ONE_OVER_ZERO_DBFS;
      off += 4;
    }

    this.left =
      leftOut.length === frames ? leftOut : leftOut.subarray(0, frames);
    this.right =
      rightOut.length === frames ? rightOut : rightOut.subarray(0, frames);
  }
}
