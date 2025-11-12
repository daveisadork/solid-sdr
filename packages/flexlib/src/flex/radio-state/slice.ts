import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  arraysShallowEqual,
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

export interface SliceSnapshot {
  readonly id: string;
  readonly frequencyMHz: number;
  readonly mode: string;
  readonly sampleRateHz: number;
  readonly indexLetter: string;
  readonly isInUse: boolean;
  readonly isActive: boolean;
  readonly isTransmitEnabled: boolean;
  readonly isWide: boolean;
  readonly isQskEnabled: boolean;
  readonly rxAntenna: string;
  readonly txAntenna: string;
  readonly panadapterStreamId?: string;
  readonly daxChannel: number;
  readonly daxIqChannel: number;
  readonly daxClientCount: number;
  readonly isLocked: boolean;
  readonly rfGain: number;
  readonly filterLowHz: number;
  readonly filterHighHz: number;
  readonly rttyMarkHz: number;
  readonly rttyShiftHz: number;
  readonly diglOffsetHz: number;
  readonly diguOffsetHz: number;
  readonly audioPan: number;
  readonly audioGain: number;
  readonly isMuted: boolean;
  readonly anfEnabled: boolean;
  readonly anfLevel: number;
  readonly apfEnabled: boolean;
  readonly apfLevel: number;
  readonly wnbEnabled: boolean;
  readonly wnbLevel: number;
  readonly nbEnabled: boolean;
  readonly nbLevel: number;
  readonly nrEnabled: boolean;
  readonly nrLevel: number;
  readonly nrlEnabled: boolean;
  readonly nrlLevel: number;
  readonly anflEnabled: boolean;
  readonly anflLevel: number;
  readonly nrsEnabled: boolean;
  readonly nrsLevel: number;
  readonly rnnEnabled: boolean;
  readonly anftEnabled: boolean;
  readonly nrfEnabled: boolean;
  readonly nrfLevel: number;
  readonly escEnabled: boolean;
  readonly escGain: number;
  readonly escPhaseShift: number;
  readonly agcMode: string;
  readonly agcThreshold: number;
  readonly agcOffLevel: number;
  readonly loopAEnabled: boolean;
  readonly loopBEnabled: boolean;
  readonly ritEnabled: boolean;
  readonly ritOffsetHz: number;
  readonly xitEnabled: boolean;
  readonly xitOffsetHz: number;
  readonly tuneStepHz: number;
  readonly tuneStepListHz: readonly number[];
  readonly postDemodLowHz: number;
  readonly postDemodHighHz: number;
  readonly postDemodBypass: boolean;
  readonly recordingEnabled: boolean;
  readonly playbackAvailable: boolean;
  readonly playbackEnabled: boolean;
  readonly recordTimeSeconds: number;
  readonly fmToneMode: string;
  readonly fmToneValue: string;
  readonly fmDeviation: number;
  readonly fmToneBurstEnabled: boolean;
  readonly fmPreDeEmphasisEnabled: boolean;
  readonly squelchEnabled: boolean;
  readonly squelchLevel: number;
  readonly squelchTriggeredWeight: number;
  readonly squelchAverageFactor: number;
  readonly squelchHangDelayMs: number;
  readonly txOffsetFrequencyMHz: number;
  readonly fmRepeaterOffsetMHz: number;
  readonly repeaterOffsetDirection: string;
  readonly diversityEnabled: boolean;
  readonly diversityChild: boolean;
  readonly diversityParent: boolean;
  readonly diversityIndex: number;
  readonly isDetached: boolean;
  readonly availableRxAntennas: readonly string[];
  readonly availableTxAntennas: readonly string[];
  readonly modeList: readonly string[];
  readonly rxErrorMilliHz: number;
  readonly meterIds: readonly string[];
  readonly owner: string;
  readonly clientHandle: number;
  readonly raw: Readonly<Record<string, string>>;
}

export function createSliceSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: SliceSnapshot,
): SnapshotUpdate<SliceSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<SliceSnapshot>> = {};

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "freq":
      case "rf_frequency":
      case "RF_frequency": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.frequencyMHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "mode":
        partial.mode = value;
        break;
      case "sample_rate": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.sampleRateHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "index_letter":
        partial.indexLetter = value;
        break;
      case "active":
        partial.isActive = isTruthy(value);
        break;
      case "in_use":
        partial.isInUse = isTruthy(value);
        break;
      case "tx":
        partial.isTransmitEnabled = isTruthy(value);
        break;
      case "wide":
        partial.isWide = isTruthy(value);
        break;
      case "qsk":
        partial.isQskEnabled = isTruthy(value);
        break;
      case "rxant":
        partial.rxAntenna = value;
        break;
      case "txant":
        partial.txAntenna = value;
        break;
      case "pan":
      case "panadapter":
        partial.panadapterStreamId = value || undefined;
        break;
      case "dax": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxChannel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "dax_iq_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxIqChannel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "dax_clients": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxClientCount = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rfgain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfGain = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "filter_lo": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.filterLowHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "filter_hi": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.filterHighHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rtty_mark": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rttyMarkHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rtty_shift": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rttyShiftHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "digl_offset": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.diglOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "digu_offset": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.diguOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "audio_pan": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.audioPan = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "audio_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.audioGain = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "audio_mute":
        partial.isMuted = isTruthy(value);
        break;
      case "lock":
        partial.isLocked = isTruthy(value);
        break;
      case "anf":
        partial.anfEnabled = isTruthy(value);
        break;
      case "anf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.anfLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "apf":
        partial.apfEnabled = isTruthy(value);
        break;
      case "apf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.apfLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "wnb":
        partial.wnbEnabled = isTruthy(value);
        break;
      case "wnb_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.wnbLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nb":
        partial.nbEnabled = isTruthy(value);
        break;
      case "nb_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.nbLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nr":
        partial.nrEnabled = isTruthy(value);
        break;
      case "nr_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.nrLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "lms_nr":
      case "nrl":
        partial.nrlEnabled = isTruthy(value);
        break;
      case "lms_nr_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.nrlLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nrl_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.nrlLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "lms_anf":
      case "anfl":
        partial.anflEnabled = isTruthy(value);
        break;
      case "lms_anf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.anflLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "anfl_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.anflLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "speex_nr":
      case "nrs":
        partial.nrsEnabled = isTruthy(value);
        break;
      case "speex_nr_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.nrsLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nrs_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.nrsLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rnnoise":
      case "rnn":
        partial.rnnEnabled = isTruthy(value);
        break;
      case "anft":
        partial.anftEnabled = isTruthy(value);
        break;
      case "nrf":
        partial.nrfEnabled = isTruthy(value);
        break;
      case "nrf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.nrfLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "esc":
        partial.escEnabled = isTruthy(value);
        break;
      case "esc_gain": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.escGain = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "esc_phase_shift": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.escPhaseShift = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nr_wlen":
      case "nr_delay":
      case "nr_adapt_mode":
      case "nr_isdft_mode":
      case "nrl_filter_size":
      case "nrl_delay":
      case "nrl_leakage_level":
      case "nrf_winc":
      case "nrf_wlen":
      case "anf_wlen":
      case "anf_delay":
      case "anf_adapt_mode":
      case "anf_isdft_mode":
      case "anfl_filter_size":
      case "anfl_delay":
      case "anfl_leakage_level":
        // Advanced DSP parameters exposed on 4.x radios; tracked via raw map only.
        break;
      case "agc_mode":
        partial.agcMode = value;
        break;
      case "agc_threshold": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.agcThreshold = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "agc_off_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.agcOffLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "loopa":
        partial.loopAEnabled = isTruthy(value);
        break;
      case "loopb":
        partial.loopBEnabled = isTruthy(value);
        break;
      case "rit_on":
        partial.ritEnabled = isTruthy(value);
        break;
      case "rit_freq": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.ritOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "xit_on":
        partial.xitEnabled = isTruthy(value);
        break;
      case "xit_freq": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.xitOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "step": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.tuneStepHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "step_list": {
        const parsed = parseIntegerList(value);
        if (!parsed) {
          logParseError("slice", key, value);
        } else if (!arraysShallowEqual(previous?.tuneStepListHz, parsed)) {
          partial.tuneStepListHz = Object.freeze(parsed);
        }
        break;
      }
      case "post_demod_low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.postDemodLowHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "post_demod_high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.postDemodHighHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "post_demod_bypass":
        partial.postDemodBypass = isTruthy(value);
        break;
      case "record":
        partial.recordingEnabled = isTruthy(value);
        break;
      case "play": {
        const normalized = value?.trim().toLowerCase();
        if (!value || normalized === "disabled") {
          partial.playbackAvailable = false;
          partial.playbackEnabled = false;
          break;
        }
        const parsed = parseInteger(value);
        if (parsed !== undefined) {
          partial.playbackAvailable = true;
          partial.playbackEnabled = parsed === 1;
        } else {
          partial.playbackAvailable = true;
          partial.playbackEnabled = isTruthy(value);
        }
        break;
      }
      case "record_time": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.recordTimeSeconds = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "fm_tone_mode":
        partial.fmToneMode = value;
        break;
      case "fm_tone_value":
        partial.fmToneValue = value;
        break;
      case "fm_deviation": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.fmDeviation = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "fm_tone_burst":
        partial.fmToneBurstEnabled = isTruthy(value);
        break;
      case "dfm_pre_de_emphasis":
        partial.fmPreDeEmphasisEnabled = isTruthy(value);
        break;
      case "squelch":
        partial.squelchEnabled = isTruthy(value);
        break;
      case "squelch_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.squelchLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "squelch_triggered_weight": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.squelchTriggeredWeight = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "squelch_avg_factor": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.squelchAverageFactor = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "squelch_hang_delay_ms": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.squelchHangDelayMs = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "tx_offset_freq": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.txOffsetFrequencyMHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "fm_repeater_offset_freq": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) partial.fmRepeaterOffsetMHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "repeater_offset_dir":
        partial.repeaterOffsetDirection = value;
        break;
      case "diversity":
        partial.diversityEnabled = isTruthy(value);
        break;
      case "diversity_child":
        partial.diversityChild = isTruthy(value);
        break;
      case "diversity_parent":
        partial.diversityParent = isTruthy(value);
        break;
      case "diversity_index": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.diversityIndex = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "detached":
        partial.isDetached = isTruthy(value);
        break;
      case "ant_list": {
        const parsed = parseCsv(value);
        if (!parsed) {
          logParseError("slice", key, value);
        } else if (!arraysShallowEqual(previous?.availableRxAntennas, parsed)) {
          partial.availableRxAntennas = Object.freeze(parsed);
        }
        break;
      }
      case "tx_ant_list": {
        const parsed = parseCsv(value);
        if (!parsed) {
          logParseError("slice", key, value);
        } else if (!arraysShallowEqual(previous?.availableTxAntennas, parsed)) {
          partial.availableTxAntennas = Object.freeze(parsed);
        }
        break;
      }
      case "mode_list": {
        const parsed = parseCsv(value);
        if (!parsed) {
          logParseError("slice", key, value);
        } else if (!arraysShallowEqual(previous?.modeList, parsed)) {
          partial.modeList = Object.freeze(parsed);
        }
        break;
      }
      case "rx_error_mHz": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.rxErrorMilliHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "meter_list": {
        const parsed = parseCsv(value);
        if (!parsed) {
          logParseError("slice", key, value);
        } else if (!arraysShallowEqual(previous?.meterIds, parsed)) {
          partial.meterIds = Object.freeze(parsed);
        }
        break;
      }
      case "owner":
        partial.owner = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) partial.clientHandle = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "index":
        break;
      default:
        logUnknownAttribute("slice", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? { id }),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as SliceSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}
