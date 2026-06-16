import { createPacketContext } from "./common";
import { VitaMeterPacket } from "./meter-packet";
import { VitaFFTPacket } from "./fft-packet";
import { VitaWaterfallPacket } from "./waterfall-packet";
import { VitaDiscoveryPacket } from "./discovery";
import { VitaOpusPacket } from "./opus-packet";
import {
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
  VITA_FLEX_DAX_AUDIO_CLASS,
  VITA_FLEX_DAX_REDUCED_BW_CLASS,
} from "./dax-audio-packet";
import {
  VitaDaxIqPacket,
  VITA_FLEX_DAX_IQ_24_CLASS,
  VITA_FLEX_DAX_IQ_48_CLASS,
  VITA_FLEX_DAX_IQ_96_CLASS,
  VITA_FLEX_DAX_IQ_192_CLASS,
} from "./dax-iq-packet";

export type VitaPacket =
  | VitaMeterPacket
  | VitaFFTPacket
  | VitaWaterfallPacket
  | VitaDiscoveryPacket
  | VitaOpusPacket
  | VitaDaxAudioPacket
  | VitaDaxReducedBwPacket
  | VitaDaxIqPacket;

export type VitaPacketKind = VitaPacket["kind"];

export type VitaPacketOfKind<K extends VitaPacketKind> = Extract<
  VitaPacket,
  { kind: K }
>;

export interface ParseVitaPacketOptions {
  meter?: { ids?: Uint16Array; values?: Int16Array };
  panadapter?: { payload?: Uint16Array };
  waterfall?: { data?: Uint16Array };
}

const PACKET_CLASS_METER = 0x8002;
const PACKET_CLASS_FFT = 0x8003;
const PACKET_CLASS_WATERFALL = 0x8004;
const PACKET_CLASS_OPUS = 0x8005;
const PACKET_CLASS_DISCOVERY = 0xffff;

export function parseVitaPacket(
  data: Uint8Array,
  options: ParseVitaPacketOptions = {},
): VitaPacket | null {
  const ctx = createPacketContext(data);
  if (!ctx) return null;

  switch (ctx.classId.packetClassCode) {
    case PACKET_CLASS_METER: {
      const packet = new VitaMeterPacket();
      packet.parseWithContext(ctx, options.meter);
      return packet;
    }
    case PACKET_CLASS_FFT: {
      const packet = new VitaFFTPacket();
      packet.parseWithContext(ctx, options.panadapter);
      return packet;
    }
    case PACKET_CLASS_WATERFALL: {
      const packet = new VitaWaterfallPacket();
      packet.parseWithContext(ctx, options.waterfall);
      return packet;
    }
    case PACKET_CLASS_DISCOVERY: {
      const packet = new VitaDiscoveryPacket();
      packet.parseWithContext(ctx);
      return packet;
    }
    case PACKET_CLASS_OPUS: {
      const packet = new VitaOpusPacket();
      packet.parseWithContext(ctx);
      return packet;
    }
    case VITA_FLEX_DAX_REDUCED_BW_CLASS: {
      const packet = new VitaDaxReducedBwPacket();
      packet.parseWithContext(ctx);
      return packet;
    }
    case VITA_FLEX_DAX_IQ_24_CLASS:
    case VITA_FLEX_DAX_IQ_48_CLASS:
    case VITA_FLEX_DAX_IQ_96_CLASS:
    case VITA_FLEX_DAX_IQ_192_CLASS: {
      const packet = new VitaDaxIqPacket();
      packet.parseWithContext(ctx);
      return packet;
    }
    case VITA_FLEX_DAX_AUDIO_CLASS: {
      const packet = new VitaDaxAudioPacket();
      packet.parseWithContext(ctx);
      return packet;
    }
    default:
      return null;
  }
}
