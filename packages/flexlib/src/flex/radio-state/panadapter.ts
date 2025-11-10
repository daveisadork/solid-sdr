import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  arraysShallowEqual,
  freezeArray,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseCsv,
  parseFloatSafe,
  parseInteger,
  parseIntegerList,
  parseIntegerMaybeHex,
  parseMegahertz,
} from "./common.js";

export interface PanadapterSnapshot {
  readonly id: string;
  readonly streamId: string;
  readonly centerFrequencyMHz: number;
  readonly bandwidthMHz: number;
  readonly autoCenterEnabled: boolean;
  readonly minBandwidthMHz: number;
  readonly maxBandwidthMHz: number;
  readonly lowDbm: number;
  readonly highDbm: number;
  readonly rxAntenna: string;
  readonly daxIqChannel: number;
  readonly daxIqRate: number;
  readonly rfGain: number;
  readonly rfGainLow: number;
  readonly rfGainHigh: number;
  readonly rfGainStep: number;
  readonly rfGainMarkers: readonly number[];
  readonly isBandZoomOn: boolean;
  readonly isSegmentZoomOn: boolean;
  readonly wnbEnabled: boolean;
  readonly wnbLevel: number;
  readonly wnbUpdating: boolean;
  readonly noiseFloorPosition: number;
  readonly noiseFloorPositionEnabled: boolean;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly average: number;
  readonly weightedAverage: boolean;
  readonly wideEnabled: boolean;
  readonly loopAEnabled: boolean;
  readonly loopBEnabled: boolean;
  readonly band: string;
  readonly rxAntennas: readonly string[];
  readonly loggerDisplayEnabled: boolean;
  readonly loggerDisplayAddress: string;
  readonly loggerDisplayPort: number;
  readonly loggerDisplayRadioNum: number;
  readonly waterfallStreamId: string;
  readonly attachedSlices: readonly string[];
  readonly clientHandle: number;
  readonly xvtr: string;
  readonly preampSetting: string;
  readonly raw: Readonly<Record<string, string>>;
}

export function createPanadapterSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: PanadapterSnapshot,
): SnapshotUpdate<PanadapterSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<PanadapterSnapshot>> = {};

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "stream_id":
      case "stream":
        partial.streamId = value || partial.streamId;
        break;
      case "center": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.centerFrequencyMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "bandwidth": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.bandwidthMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "auto_center":
      case "autocenter":
        partial.autoCenterEnabled = isTruthy(value);
        break;
      case "min_bw": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.minBandwidthMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "max_bw": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.maxBandwidthMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "min_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.lowDbm = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "max_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.highDbm = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "band":
        partial.band = value;
        break;
      case "rxant":
        partial.rxAntenna = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) partial.clientHandle = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "xvtr":
        partial.xvtr = value;
        break;
      case "pre":
        partial.preampSetting = value;
        break;
      case "daxiq_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxIqChannel = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "daxiq_rate": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxIqRate = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rfgain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGain = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rf_gain_low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGainLow = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rf_gain_high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGainHigh = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rf_gain_step": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGainStep = parsed;
        else logParseError("panadapter", key, value);
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
      case "band_zoom":
        partial.isBandZoomOn = isTruthy(value);
        break;
      case "segment_zoom":
        partial.isSegmentZoomOn = isTruthy(value);
        break;
      case "wnb":
        partial.wnbEnabled = isTruthy(value);
        break;
      case "wnb_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.wnbLevel = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "wnb_updating":
        partial.wnbUpdating = isTruthy(value);
        break;
      case "pan_position":
      case "noise_floor_position": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.noiseFloorPosition = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "pan_position_enable":
      case "noise_floor_position_enable":
        partial.noiseFloorPositionEnabled = isTruthy(value);
        break;
      case "xpixels":
      case "x_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.width = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "ypixels":
      case "y_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.height = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "fps": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.fps = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "average": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.average = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "weighted_average":
        partial.weightedAverage = isTruthy(value);
        break;
      case "wide":
        partial.wideEnabled = isTruthy(value);
        break;
      case "loopa":
        partial.loopAEnabled = isTruthy(value);
        break;
      case "loopb":
        partial.loopBEnabled = isTruthy(value);
        break;
      case "n1mm_spectrum_enable":
        partial.loggerDisplayEnabled = isTruthy(value);
        break;
      case "n1mm_address":
        partial.loggerDisplayAddress = value;
        break;
      case "n1mm_port": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.loggerDisplayPort = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "n1mm_radio": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.loggerDisplayRadioNum = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "waterfall":
        partial.waterfallStreamId = value;
        break;
      case "ant_list": {
        const parsed = parseCsv(value);
        if (parsed === undefined) {
          logParseError("panadapter", key, value);
        } else if (!arraysShallowEqual(previous?.rxAntennas, parsed)) {
          partial.rxAntennas = freezeArray(parsed, previous?.rxAntennas);
        }
        break;
      }
      default:
        logUnknownAttribute("panadapter", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {
      id,
      autoCenterEnabled: false,
      attachedSlices: Object.freeze([]),
      rfGainMarkers: Object.freeze([]),
      rfGainLow: 0,
      rfGainHigh: 0,
      rfGainStep: 0,
    }),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as PanadapterSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
