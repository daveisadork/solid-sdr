// WaterfallTile model (ported from Flex.Util.WaterfallTile)
import { VitaFrequency } from "./vita-frequency";

/**
 * Represents a single Waterfall Tile object.
 * Mirrors the C# class, using idiomatic TS names and types.
 */
export interface WaterfallTile {
  /** The frequency (Hz) represented by the first bin in the frame. */
  frameLowFreq: VitaFrequency;

  /**
   * The index of the first bin covered by this tile within the full frame.
   * If the frame is split across multiple tiles, this indicates the segment start.
   */
  firstBinIndex: number; // uint32

  /**
   * Total number of FFT bins in the full frame (may exceed this tile's data length).
   */
  totalBinsInFrame: number; // uint32

  /** Width of each bin in Hz (Hz/bin). */
  binBandwidth: VitaFrequency;

  /** Duration represented by the tile line, in milliseconds. */
  lineDurationMs: number; // uint32

  /** Number of bins wide described by the tile. */
  width: number; // uint16

  /** Number of bins tall described by the tile. */
  height: number; // uint16

  /** Relative time-base index for this tile. */
  timecode: number; // uint32

  /** Auto-black (noise floor) level used by the renderer. */
  autoBlackLevel: number; // uint32

  /**
   * If the frame spans multiple packets, this becomes true when all have arrived.
   */
  isFrameComplete: boolean;

  /** Waterfall bin data; length is typically width * height. */
  data: Uint16Array;

  /** Arrival timestamp (UTC) assigned by the receiver. */
  dateTime: Date;
}

/** Create a tile with sensible defaults; pass any fields to override. */
export function createWaterfallTile(
  init: Partial<WaterfallTile> = {},
): WaterfallTile {
  return {
    frameLowFreq: init.frameLowFreq ?? VitaFrequency.fromHz(0),
    firstBinIndex: init.firstBinIndex ?? 0,
    totalBinsInFrame: init.totalBinsInFrame ?? 0,
    binBandwidth: init.binBandwidth ?? VitaFrequency.fromHz(0),
    lineDurationMs: init.lineDurationMs ?? 0,
    width: init.width ?? 0,
    height: init.height ?? 0,
    timecode: init.timecode ?? 0,
    autoBlackLevel: init.autoBlackLevel ?? 0,
    isFrameComplete: init.isFrameComplete ?? false,
    data: init.data ?? new Uint16Array(0),
    dateTime: init.dateTime ?? new Date(),
  };
}

/**
 * Format like the C# ToString():
 *   Timecode + ": " + FrameLowFreq(f6) + "  " + WxH + " " + LineDurationMS + "ms " + hh:mm:ss.fff
 * Uses UTC clock (the C# used DateTime.UtcNow for assignment).
 */
export function formatWaterfallTile(t: WaterfallTile): string {
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const three = (n: number) => n.toString().padStart(3, "0");
  const d = t.dateTime;
  const hours12 = ((d.getUTCHours() + 11) % 12) + 1;
  const hh = two(hours12);
  const mm = two(d.getUTCMinutes());
  const ss = two(d.getUTCSeconds());
  const fff = three(d.getUTCMilliseconds());
  return `${t.timecode}: ${t.frameLowFreq.freqMhz.toFixed(6)}  ${t.width}x${t.height} ${t.lineDurationMs}ms ${hh}:${mm}:${ss}.${fff}`;
}
