import type { Mutable, SnapshotUpdate } from "./common.js";
import { lineSpeedToDurationMs } from "../waterfall-line-speed.js";
import {
  arraysShallowEqual,
  freezeArray,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
  parseIntegerList,
  parseIntegerMaybeHex,
  parseMegahertz,
} from "./common.js";

export interface WaterfallSnapshot {
  readonly id: string;
  readonly streamId: string;
  readonly panadapterStreamId: string;
  readonly centerFrequencyMHz: number;
  readonly bandwidthMHz: number;
  readonly lowDbm: number;
  readonly highDbm: number;
  readonly fps: number;
  readonly average: number;
  readonly weightedAverage: boolean;
  readonly rxAntenna: string;
  readonly rfGain: number;
  readonly rfGainLow: number;
  readonly rfGainHigh: number;
  readonly rfGainStep: number;
  readonly rfGainMarkers: readonly number[];
  readonly daxIqChannel: number;
  readonly isBandZoomOn: boolean;
  readonly isSegmentZoomOn: boolean;
  readonly loopAEnabled: boolean;
  readonly loopBEnabled: boolean;
  readonly wideEnabled: boolean;
  readonly band: string;
  readonly width: number;
  readonly height: number;
  /** Raw 0-100 line speed mirrored from the radio. */
  readonly lineSpeed?: number;
  /** Derived milliseconds value computed from lineSpeed. */
  readonly lineDurationMs?: number;
  readonly blackLevel: number;
  readonly colorGain: number;
  readonly autoBlackLevelEnabled: boolean;
  readonly gradientIndex: number;
  readonly clientHandle: number;
  readonly xvtr: string;
  readonly raw: Readonly<Record<string, string>>;
}

export function createWaterfallSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: WaterfallSnapshot,
): SnapshotUpdate<WaterfallSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<WaterfallSnapshot>> = {};

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "stream_id":
        partial.streamId = value || partial.streamId;
        break;
      case "pan":
      case "panadapter":
        partial.panadapterStreamId = value ?? "";
        break;
      case "center": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.centerFrequencyMHz = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "bandwidth": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.bandwidthMHz = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "min_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.lowDbm = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "max_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.highDbm = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "fps": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.fps = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "average": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.average = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "weighted_average":
        partial.weightedAverage = isTruthy(value);
        break;
      case "band_zoom":
        partial.isBandZoomOn = isTruthy(value);
        break;
      case "segment_zoom":
        partial.isSegmentZoomOn = isTruthy(value);
        break;
      case "rxant":
        partial.rxAntenna = value;
        break;
      case "rfgain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGain = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGainLow = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGainHigh = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_step": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGainStep = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_markers": {
        const parsed = value === "" ? [] : parseIntegerList(value);
        if (parsed === undefined) {
          logParseError("waterfall", key, value);
        } else if (!arraysShallowEqual(previous?.rfGainMarkers, parsed)) {
          // Only update if the markers have changed.
          partial.rfGainMarkers = freezeArray(parsed, previous?.rfGainMarkers);
        }
        break;
      }
      case "daxiq_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxIqChannel = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "loopa":
        partial.loopAEnabled = isTruthy(value);
        break;
      case "loopb":
        partial.loopBEnabled = isTruthy(value);
        break;
      case "wide":
        partial.wideEnabled = isTruthy(value);
        break;
      case "band":
        partial.band = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) partial.clientHandle = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "xvtr":
        partial.xvtr = value;
        break;
      case "xpixels":
      case "x_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.width = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "ypixels":
      case "y_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.height = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "line_duration": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) {
          partial.lineSpeed = parsed;
          partial.lineDurationMs = lineSpeedToDurationMs(parsed);
        } else logParseError("waterfall", key, value);
        break;
      }
      case "black_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.blackLevel = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "color_gain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.colorGain = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "auto_black":
        partial.autoBlackLevelEnabled = isTruthy(value);
        break;
      case "gradient_index": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.gradientIndex = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      default:
        logUnknownAttribute("waterfall", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? { id, rfGainMarkers: Object.freeze([]) }),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as WaterfallSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
