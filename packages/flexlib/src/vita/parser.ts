import {
  createPacketContext,
  type VitaPacketContext,
  type VitaHeader,
  type VitaClassId,
} from "./common";
import { VitaMeterPacket } from "./meter-packet";
import { VitaFFTPacket } from "./fft-packet";
import { VitaWaterfallPacket } from "./waterfall-packet";
import { VitaDiscoveryPacket } from "./discovery";
import {
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
  VITA_FLEX_DAX_AUDIO_CLASS,
  VITA_FLEX_DAX_REDUCED_BW_CLASS,
} from "./dax-audio-packet";

export type VitaPacketKind =
  | "meter"
  | "panadapter"
  | "waterfall"
  | "discovery"
  | "opus"
  | "daxReducedBw"
  | "daxIq24"
  | "daxIq48"
  | "daxIq96"
  | "daxIq192"
  | "daxAudio";

export interface VitaPacketMetadata {
  header: VitaHeader;
  classId: VitaClassId;
  streamId: number;
  timestampInt: number;
  timestampFrac: bigint;
}

export interface VitaParsedPacketMap {
  meter: VitaPacketMetadata & { kind: "meter"; packet: VitaMeterPacket };
  panadapter: VitaPacketMetadata & {
    kind: "panadapter";
    packet: VitaFFTPacket;
  };
  waterfall: VitaPacketMetadata & {
    kind: "waterfall";
    packet: VitaWaterfallPacket;
  };
  discovery: VitaPacketMetadata & {
    kind: "discovery";
    packet: VitaDiscoveryPacket;
  };
  opus: VitaPacketMetadata & { kind: "opus"; packet: Uint8Array };
  daxReducedBw: VitaPacketMetadata & {
    kind: "daxReducedBw";
    packet: VitaDaxReducedBwPacket;
  };
  daxIq24: VitaPacketMetadata & { kind: "daxIq24"; packet: Uint8Array };
  daxIq48: VitaPacketMetadata & { kind: "daxIq48"; packet: Uint8Array };
  daxIq96: VitaPacketMetadata & { kind: "daxIq96"; packet: Uint8Array };
  daxIq192: VitaPacketMetadata & { kind: "daxIq192"; packet: Uint8Array };
  daxAudio: VitaPacketMetadata & {
    kind: "daxAudio";
    packet: VitaDaxAudioPacket;
  };
}

export type VitaParsedPacket<
  TKind extends VitaPacketKind = VitaPacketKind,
> = VitaParsedPacketMap[TKind];

export interface ParseVitaPacketOptions {
  meter?: { ids?: Uint16Array; values?: Int16Array };
  panadapter?: { payload?: Uint16Array };
  waterfall?: { data?: Uint16Array };
}

const PACKET_CLASS_METER = 0x8002;
const PACKET_CLASS_FFT = 0x8003;
const PACKET_CLASS_WATERFALL = 0x8004;
const PACKET_CLASS_OPUS = 0x8005;
const PACKET_CLASS_DAX_IQ24 = 0x02e3;
const PACKET_CLASS_DAX_IQ48 = 0x02e4;
const PACKET_CLASS_DAX_IQ96 = 0x02e5;
const PACKET_CLASS_DAX_IQ192 = 0x02e6;
const PACKET_CLASS_DISCOVERY = 0xffff;

export function parseVitaPacket(
  data: Uint8Array,
  options: ParseVitaPacketOptions = {},
): VitaParsedPacket | null {
  const ctx = createPacketContext(data);
  if (!ctx) return null;

  const metadata: VitaPacketMetadata = {
    header: ctx.header,
    classId: ctx.classId,
    streamId: ctx.streamId,
    timestampInt: ctx.timestampInt,
    timestampFrac: ctx.timestampFrac,
  };

  switch (ctx.classId.packetClassCode) {
    case PACKET_CLASS_METER: {
      const packet = new VitaMeterPacket();
      packet.parseWithContext(ctx, options.meter);
      return { kind: "meter", packet, ...metadata };
    }
    case PACKET_CLASS_FFT: {
      const packet = new VitaFFTPacket();
      packet.parseWithContext(ctx, options.panadapter);
      return { kind: "panadapter", packet, ...metadata };
    }
    case PACKET_CLASS_WATERFALL: {
      const packet = new VitaWaterfallPacket();
      packet.parseWithContext(ctx, options.waterfall);
      return { kind: "waterfall", packet, ...metadata };
    }
    case PACKET_CLASS_DISCOVERY: {
      const packet = new VitaDiscoveryPacket();
      packet.parseWithContext(ctx);
      return { kind: "discovery", packet, ...metadata };
    }
    case PACKET_CLASS_OPUS:
      return {
        kind: "opus",
        packet: slicePayload(ctx, data),
        ...metadata,
      };
    case VITA_FLEX_DAX_REDUCED_BW_CLASS: {
      const packet = new VitaDaxReducedBwPacket();
      packet.parseWithContext(ctx);
      return { kind: "daxReducedBw", packet, ...metadata };
    }
    case PACKET_CLASS_DAX_IQ24:
      return {
        kind: "daxIq24",
        packet: slicePayload(ctx, data),
        ...metadata,
      };
    case PACKET_CLASS_DAX_IQ48:
      return {
        kind: "daxIq48",
        packet: slicePayload(ctx, data),
        ...metadata,
      };
    case PACKET_CLASS_DAX_IQ96:
      return {
        kind: "daxIq96",
        packet: slicePayload(ctx, data),
        ...metadata,
      };
    case PACKET_CLASS_DAX_IQ192:
      return {
        kind: "daxIq192",
        packet: slicePayload(ctx, data),
        ...metadata,
      };
    case VITA_FLEX_DAX_AUDIO_CLASS: {
      const packet = new VitaDaxAudioPacket();
      packet.parseWithContext(ctx);
      return { kind: "daxAudio", packet, ...metadata };
    }
    default:
      return null;
  }
}

function slicePayload(ctx: VitaPacketContext, data: Uint8Array): Uint8Array {
  const start = ctx.payloadOffset;
  const end = start + ctx.payloadLength;
  return data.subarray(start, end);
}
