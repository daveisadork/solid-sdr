// Per-frame waterfall metadata parsed from a VITA waterfall packet.
//
// NOTE: This is *not* the buffered/timestamped "tile" of the C# Flex.Util
// library — we render each packet straight to the offscreen canvas as it
// arrives and never assemble or retain completed frames. This is just the
// flat set of header fields the renderer reads off each packet.
import type { VitaFrequency } from "./vita-frequency";

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

  /** Waterfall bin data; length is typically width * height. */
  data: Uint16Array;
}
