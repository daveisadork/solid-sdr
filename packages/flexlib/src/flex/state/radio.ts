import { clampNumber } from "../controller-helpers.js";
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
  parseIntegerHex,
} from "./common.js";

const EMPTY_STRING_LIST = Object.freeze([]) as readonly string[];
const EMPTY_PROFILE_LIST = EMPTY_STRING_LIST;

export interface RadioLogModule {
  readonly name: string;
  readonly level: string;
}

const EMPTY_LOG_MODULES = Object.freeze(
  [],
) as readonly RadioLogModule[];

export type RadioFilterSharpnessMode = "voice" | "cw" | "digital";

export type RadioOscillatorSetting = "auto" | "external" | "gpsdo" | "tcxo";

export type RadioScreensaverMode = "model" | "name" | "callsign" | "none";

export type RadioInterlockState =
  | "NONE"
  | "RECEIVE"
  | "READY"
  | "NOT_READY"
  | "PTT_REQUESTED"
  | "TRANSMITTING"
  | "TX_FAULT"
  | "TIMEOUT"
  | "STUCK_INPUT"
  | "UNKEY_REQUESTED";

export type RadioInterlockReason =
  | "RCA_TXREQ"
  | "ACC_TXREQ"
  | "BAD_MODE"
  | "TUNED_TOO_FAR"
  | "OUT_OF_BAND"
  | "OUT_OF_PA_RANGE"
  | "CLIENT_TX_INHIBIT"
  | "XVTR_RX_ONLY"
  | "NO_TX_ASSIGNED"
  | "TGXL";

export type RadioPttSource = "SW" | "MIC" | "ACC" | "RCA" | "TUNE";

export type RadioCwIambicMode = "a" | "b" | "strict_b" | "bug";

export type RadioAtuTuneStatus =
  | "NONE"
  | "TUNE_NOT_STARTED"
  | "TUNE_IN_PROGRESS"
  | "TUNE_BYPASS"
  | "TUNE_SUCCESSFUL"
  | "TUNE_OK"
  | "TUNE_FAIL_BYPASS"
  | "TUNE_FAIL"
  | "TUNE_ABORTED"
  | "TUNE_MANUAL_BYPASS"
  | "TGXL_IN_PROGRESS"
  | "TGXL_OK"
  | "TGXL_ABORTED";

export interface RadioStatusContext {
  readonly source?: string;
  readonly identifier?: string;
  readonly positional?: readonly string[];
}

export interface RadioSnapshot {
  readonly model: string;
  readonly serial: string;
  readonly nickname: string;
  readonly callsign: string;
  readonly version: string;
  readonly macAddress: string;
  readonly ipAddress: string;
  readonly netmask: string;
  readonly gateway: string;
  readonly networkMtu: number;
  readonly location: string;
  readonly region: string;
  readonly screensaverMode: RadioScreensaverMode;
  readonly radioOptions: string;
  readonly tx1750ToneBurst: boolean;
  readonly diversityAllowed: boolean;
  readonly atuPresent: boolean;
  readonly atuEnabled: boolean;
  readonly atuMemoriesEnabled: boolean;
  readonly atuUsingMemory: boolean;
  readonly atuTuneStatus: RadioAtuTuneStatus;
  readonly scuCount: number;
  readonly sliceCount: number;
  readonly txCount: number;
  readonly rxAntennaList: readonly string[];
  readonly micInputList: readonly string[];
  readonly profileMicList: readonly string[];
  readonly profileTxList: readonly string[];
  readonly profileDisplayList: readonly string[];
  readonly profileGlobalList: readonly string[];
  readonly profileMicSelection?: string;
  readonly profileTxSelection?: string;
  readonly profileDisplaySelection?: string;
  readonly profileGlobalSelection?: string;
  readonly profileImportInProgress: boolean;
  readonly profileExportInProgress: boolean;
  readonly profileUnsavedChangesTx: boolean;
  readonly profileUnsavedChangesMic: boolean;
  readonly versionsRaw: string;
  readonly trxPsocVersion: string;
  readonly paPsocVersion: string;
  readonly fpgaVersion: string;
  readonly availableSlices: number;
  readonly availablePanadapters: number;
  readonly availableDaxIq: number;
  readonly availableDaxAudio: number;
  readonly gpsLock: boolean;
  readonly fullDuplexEnabled: boolean;
  readonly enforcePrivateIpConnections: boolean;
  readonly bandPersistenceEnabled: boolean;
  readonly lowLatencyDigitalModes: boolean;
  readonly mfEnabled: boolean;
  readonly profileAutoSave: boolean;
  readonly maxInternalPaPower: number;
  readonly externalPaAllowed: boolean;
  readonly lineoutGain: number;
  readonly lineoutMute: boolean;
  readonly headphoneGain: number;
  readonly headphoneMute: boolean;
  readonly backlightLevel: number;
  readonly remoteOnEnabled: boolean;
  readonly pllDone: boolean;
  readonly tnfEnabled: boolean;
  readonly binauralRx: boolean;
  readonly muteLocalAudioWhenRemote: boolean;
  readonly rttyMarkDefaultHz: number;
  readonly alpha: number;
  readonly calibrationFrequencyMhz: number;
  readonly frequencyErrorPpb: number;
  readonly daxIqCapacity: number;
  readonly gpsInstalled: boolean;
  readonly gpsLatitude?: number;
  readonly gpsLongitude?: number;
  readonly gpsGrid?: string;
  readonly gpsAltitude?: string;
  readonly gpsSatellitesTracked?: number;
  readonly gpsSatellitesVisible?: number;
  readonly gpsSpeed?: string;
  readonly gpsFreqError?: string;
  readonly gpsStatus?: string;
  readonly gpsUtcTime?: string;
  readonly gpsTrack?: number;
  readonly gpsGnssPoweredAntenna?: boolean;
  readonly filterSharpnessVoice: number;
  readonly filterSharpnessVoiceAuto: boolean;
  readonly filterSharpnessCw: number;
  readonly filterSharpnessCwAuto: boolean;
  readonly filterSharpnessDigital: number;
  readonly filterSharpnessDigitalAuto: boolean;
  readonly staticIp?: string;
  readonly staticGateway?: string;
  readonly staticNetmask?: string;
  readonly oscillatorState?: string;
  readonly oscillatorSetting?: RadioOscillatorSetting;
  readonly oscillatorLocked: boolean;
  readonly oscillatorExternalPresent: boolean;
  readonly oscillatorGnssPresent: boolean;
  readonly oscillatorGpsdoPresent: boolean;
  readonly oscillatorTcxoPresent: boolean;
  readonly interlockState?: RadioInterlockState;
  readonly interlockReason?: RadioInterlockReason;
  readonly interlockPttSource?: RadioPttSource;
  readonly interlockTimeoutMs?: number;
  readonly interlockTxClientHandle?: number;
  readonly interlockAccTxReqEnabled?: boolean;
  readonly interlockRcaTxReqEnabled?: boolean;
  readonly interlockAccTxReqPolarityHigh?: boolean;
  readonly interlockRcaTxReqPolarityHigh?: boolean;
  readonly interlockTx1Enabled?: boolean;
  readonly interlockTx2Enabled?: boolean;
  readonly interlockTx3Enabled?: boolean;
  readonly interlockAccTxEnabled?: boolean;
  readonly interlockTx1DelayMs?: number;
  readonly interlockTx2DelayMs?: number;
  readonly interlockTx3DelayMs?: number;
  readonly interlockAccTxDelayMs?: number;
  readonly interlockTxDelayMs?: number;
  readonly interlockAmplifierHandles?: readonly string[];
  readonly txAllowed?: boolean;
  readonly mox?: boolean;
  readonly maxPowerLevel?: number;
  readonly rfPower?: number;
  readonly tunePower?: number;
  readonly txFilterLowHz?: number;
  readonly txFilterHighHz?: number;
  readonly txFilterChangesAllowed?: boolean;
  readonly txRfPowerChangesAllowed?: boolean;
  readonly amCarrierLevel?: number;
  readonly micLevel?: number;
  readonly micSelection?: string;
  readonly micBoost?: boolean;
  readonly micBias?: boolean;
  readonly micAccessoryEnabled?: boolean;
  readonly daxEnabled?: boolean;
  readonly hwAlcEnabled?: boolean;
  readonly txInhibit?: boolean;
  readonly companderEnabled?: boolean;
  readonly companderLevel?: number;
  readonly speechProcessorEnabled?: boolean;
  readonly speechProcessorLevel?: number;
  readonly voxEnabled?: boolean;
  readonly voxLevel?: number;
  readonly voxDelay?: number;
  readonly txMonitorAvailable?: boolean;
  readonly txMonitorEnabled?: boolean;
  readonly txCwMonitorGain?: number;
  readonly txSbMonitorGain?: number;
  readonly txCwMonitorPan?: number;
  readonly txSbMonitorPan?: number;
  readonly txTune?: boolean;
  readonly tuneMode?: "single_tone" | "two_tone";
  readonly meterInRx?: boolean;
  readonly showTxInWaterfall?: boolean;
  readonly txRawIqEnabled?: boolean;
  /** Maximum internal PA power in watts (e.g. 100W for standard radios). */
  readonly maxInternalPaPowerWatts?: number;
  readonly cwPitchHz?: number;
  readonly cwSpeedWpm?: number;
  readonly syncCwx?: boolean;
  readonly cwIambic?: boolean;
  readonly cwIambicMode?: RadioCwIambicMode;
  readonly cwSwapPaddles?: boolean;
  readonly cwBreakIn?: boolean;
  readonly cwSidetone?: boolean;
  readonly cwLeftEnabled?: boolean;
  readonly cwBreakInDelayMs?: number;
  readonly logLevels: readonly string[];
  readonly logModules: readonly RadioLogModule[];
  readonly raw: Readonly<Record<string, string>>;
}

export function createRadioSnapshot(
  attributes: Record<string, string>,
  previous?: RadioSnapshot,
  context?: RadioStatusContext,
): SnapshotUpdate<RadioSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<RadioSnapshot>> = {};
  switch (resolveRadioContext(context)) {
    case "gps":
      applyGpsStatusAttributes(attributes, partial);
      break;
    case "interlock":
      applyInterlockAttributes(attributes, partial, previous);
      break;
    case "transmit":
      applyTransmitAttributes(attributes, partial);
      break;
    case "filter_sharpness":
      if (context) {
        applyFilterSharpnessAttributes(attributes, partial, context);
      }
      break;
    case "static_net_params":
      applyStaticNetworkParams(attributes, partial);
      break;
    case "oscillator":
      applyOscillatorAttributes(attributes, partial);
      break;
    case "profile":
      if (context) {
        applyProfileAttributes(attributes, partial, context);
      } else {
        logParseError("profile", "context", "");
      }
      break;
    case "log":
      applyLogAttributes(attributes, partial, previous);
      break;
    case "atu":
      applyAtuStatusAttributes(attributes, partial);
      break;
    default:
      applyRadioSourceAttributes(attributes, partial, previous);
      break;
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as RadioSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

function applyRadioSourceAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
  previous?: RadioSnapshot,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "model":
        partial.model = value;
        break;
      case "chassis_serial":
        partial.serial = value;
        break;
      case "name":
      case "nickname":
        partial.nickname = value;
        break;
      case "callsign":
        partial.callsign = value;
        break;
      case "software_ver":
      case "version":
        partial.version = value;
        break;
      case "mac":
        partial.macAddress = value;
        break;
      case "ip":
        partial.ipAddress = value;
        break;
      case "netmask":
        partial.netmask = value;
        break;
      case "gateway":
        partial.gateway = value;
        break;
      case "network_mtu": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.networkMtu = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "location":
        partial.location = value;
        break;
      case "region":
        partial.region = value;
        break;
      case "screensaver":
        partial.screensaverMode = parseScreensaverMode(value);
        break;
      case "options":
        partial.radioOptions = value;
        break;
      case "1750_tone_burst":
        partial.tx1750ToneBurst = isTruthy(value);
        break;
      case "diversity_allowed":
        partial.diversityAllowed = isTruthy(value);
        break;
      case "atu_present":
        partial.atuPresent = isTruthy(value);
        break;
      case "num_scu": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.scuCount = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "num_slice": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.sliceCount = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "num_tx": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.txCount = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "rx_ant_list": {
        const parsed = parseCsv(value) ?? [];
        if (!arraysShallowEqual(previous?.rxAntennaList, parsed)) {
          partial.rxAntennaList = Object.freeze(parsed);
        }
        break;
      }
      case "mic_list": {
        const parsed = parseCsv(value) ?? [];
        if (!arraysShallowEqual(previous?.micInputList, parsed)) {
          partial.micInputList = Object.freeze(parsed);
        }
        break;
      }
      case "versions_raw":
        partial.versionsRaw = value;
        break;
      case "SmartSDR-MB":
        partial.version = value;
        break;
      case "PSoC-MBTRX":
        partial.trxPsocVersion = value;
        break;
      case "PSoC-MBPA100":
        partial.paPsocVersion = value;
        break;
      case "FPGA-MB":
        partial.fpgaVersion = value;
        break;
      case "gps": {
        const normalized = value?.trim().toLowerCase();
        if (normalized) {
          partial.gpsInstalled = normalized !== "not present";
          if (normalized === "locked") partial.gpsLock = true;
          if (normalized === "not present") partial.gpsLock = false;
          partial.gpsStatus = value;
        }
        break;
      }
      case "gps_installed":
        partial.gpsInstalled = isTruthy(value);
        break;
      case "gps_status":
        partial.gpsStatus = value;
        break;
      case "slices": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availableSlices = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "panadapters": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availablePanadapters = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "daxiq_available": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availableDaxIq = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "full_duplex_enabled":
        partial.fullDuplexEnabled = isTruthy(value);
        break;
      case "enforce_private_ip_connections":
        partial.enforcePrivateIpConnections = isTruthy(value);
        break;
      case "band_persistence_enabled":
        partial.bandPersistenceEnabled = isTruthy(value);
        break;
      case "low_latency_digital_modes":
        partial.lowLatencyDigitalModes = isTruthy(value);
        break;
      case "mf_enable":
        partial.mfEnabled = isTruthy(value);
        break;
      case "auto_save":
        partial.profileAutoSave = isTruthy(value);
        break;
      case "max_internal_pa_power": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.maxInternalPaPower = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "external_pa_allowed":
        partial.externalPaAllowed = isTruthy(value);
        break;
      case "lineout_gain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.lineoutGain = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "lineout_mute":
        partial.lineoutMute = isTruthy(value);
        break;
      case "headphone_gain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.headphoneGain = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "headphone_mute":
        partial.headphoneMute = isTruthy(value);
        break;
      case "backlight": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.backlightLevel = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "remote_on_enabled":
        partial.remoteOnEnabled = isTruthy(value);
        break;
      case "pll_done":
        partial.pllDone = isTruthy(value);
        break;
      case "tnf_enabled":
        partial.tnfEnabled = isTruthy(value);
        break;
      case "binaural_rx":
        partial.binauralRx = isTruthy(value);
        break;
      case "mute_local_audio_when_remote":
        partial.muteLocalAudioWhenRemote = isTruthy(value);
        break;
      case "rtty_mark_default": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rttyMarkDefaultHz = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "alpha": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.alpha = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "cal_freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.calibrationFrequencyMhz = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "freq_error_ppb": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.frequencyErrorPpb = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "daxiq_capacity": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.daxIqCapacity = parsed;
        else logParseError("radio", key, value);
        break;
      }
      default: {
        logUnknownAttribute("radio", key, value);
        break;
      }
    }
  }
}

function applyAtuStatusAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "status": {
        const parsed = parseAtuTuneStatus(value);
        if (parsed) partial.atuTuneStatus = parsed;
        else logParseError("atu", key, value ?? "");
        break;
      }
      case "atu_enabled":
        partial.atuEnabled = isTruthy(value);
        break;
      case "memories_enabled":
        partial.atuMemoriesEnabled = isTruthy(value);
        break;
      case "using_mem":
        partial.atuUsingMemory = isTruthy(value);
        break;
      default:
        logUnknownAttribute("atu", key, value);
        break;
    }
  }
}

function applyInterlockAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
  previous?: RadioSnapshot,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "state": {
        const parsed = parseInterlockState(value);
        if (parsed) {
          partial.interlockState = parsed;
        } else {
          logParseError("interlock", key, value ?? "");
        }
        break;
      }
      case "reason": {
        const parsed = parseInterlockReason(value);
        if (parsed) partial.interlockReason = parsed;
        else if (value && !value.includes("PG-XL")) {
          logParseError("interlock", key, value);
        }
        break;
      }
      case "source": {
        const parsed = parsePttSource(value);
        if (parsed) partial.interlockPttSource = parsed;
        else if (value) logParseError("interlock", key, value);
        break;
      }
      case "timeout": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.interlockTimeoutMs = parsed;
        else logParseError("interlock", key, value ?? "");
        break;
      }
      case "tx_client_handle": {
        const parsed = parseClientHandle(value);
        if (parsed !== undefined) partial.interlockTxClientHandle = parsed;
        else logParseError("interlock", key, value ?? "");
        break;
      }
      case "amplifier":
        partial.interlockAmplifierHandles = parseAmplifierHandles(value);
        break;
      case "tx_allowed":
        partial.txAllowed = isTruthy(value);
        break;
      case "acc_txreq_enable":
        partial.interlockAccTxReqEnabled = isTruthy(value);
        break;
      case "rca_txreq_enable":
        partial.interlockRcaTxReqEnabled = isTruthy(value);
        break;
      case "acc_txreq_polarity":
        partial.interlockAccTxReqPolarityHigh = isTruthy(value);
        break;
      case "rca_txreq_polarity":
        partial.interlockRcaTxReqPolarityHigh = isTruthy(value);
        break;
      case "tx1_enabled":
        partial.interlockTx1Enabled = isTruthy(value);
        break;
      case "tx2_enabled":
        partial.interlockTx2Enabled = isTruthy(value);
        break;
      case "tx3_enabled":
        partial.interlockTx3Enabled = isTruthy(value);
        break;
      case "acc_tx_enabled":
        partial.interlockAccTxEnabled = isTruthy(value);
        break;
      case "tx1_delay":
        partial.interlockTx1DelayMs = parseInterlockDelay(value, key);
        break;
      case "tx2_delay":
        partial.interlockTx2DelayMs = parseInterlockDelay(value, key);
        break;
      case "tx3_delay":
        partial.interlockTx3DelayMs = parseInterlockDelay(value, key);
        break;
      case "acc_tx_delay":
        partial.interlockAccTxDelayMs = parseInterlockDelay(value, key);
        break;
      case "tx_delay":
        partial.interlockTxDelayMs = parseInterlockDelay(value, key);
        break;
      case "mox":
        partial.mox = isTruthy(value);
        break;
      default:
        logUnknownAttribute("interlock", key, value);
        break;
    }
  }

  if (partial.mox === undefined) {
    const nextState = partial.interlockState ?? previous?.interlockState;
    if (nextState) {
      partial.mox = INTERLOCK_MOX_STATES.has(nextState);
    }
  }
}

function applyTransmitAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "max_power_level":
        partial.maxPowerLevel = parseBoundedInteger(
          value,
          0,
          100,
          "transmit",
          key,
        );
        break;
      case "rfpower":
        partial.rfPower = parseBoundedInteger(value, 0, 100, "transmit", key);
        break;
      case "tunepower":
        partial.tunePower = parseBoundedInteger(value, 0, 100, "transmit", key);
        break;
      case "lo":
        partial.txFilterLowHz = parseIntegerAttribute(value, "transmit", key);
        break;
      case "hi":
        partial.txFilterHighHz = parseIntegerAttribute(value, "transmit", key);
        break;
      case "tx_filter_changes_allowed":
        partial.txFilterChangesAllowed = isTruthy(value);
        break;
      case "tx_rf_power_changes_allowed":
        partial.txRfPowerChangesAllowed = isTruthy(value);
        break;
      case "am_carrier_level":
        partial.amCarrierLevel = parseBoundedInteger(
          value,
          0,
          100,
          "transmit",
          key,
        );
        break;
      case "mic_level":
        partial.micLevel = parseBoundedInteger(value, 0, 100, "transmit", key);
        break;
      case "mic_selection":
        partial.micSelection = value;
        break;
      case "mic_boost":
        partial.micBoost = isTruthy(value);
        break;
      case "mon_available":
        partial.txMonitorAvailable = isTruthy(value);
        break;
      case "hwalc_enabled":
        partial.hwAlcEnabled = isTruthy(value);
        break;
      case "inhibit":
        partial.txInhibit = isTruthy(value);
        break;
      case "mic_bias":
        partial.micBias = isTruthy(value);
        break;
      case "mic_acc":
        partial.micAccessoryEnabled = isTruthy(value);
        break;
      case "dax":
        partial.daxEnabled = isTruthy(value);
        break;
      case "compander":
        partial.companderEnabled = isTruthy(value);
        break;
      case "compander_level":
        partial.companderLevel = parseBoundedInteger(
          value,
          0,
          100,
          "transmit",
          key,
        );
        break;
      case "pitch":
        partial.cwPitchHz = parseBoundedInteger(
          value,
          100,
          6000,
          "transmit",
          key,
        );
        break;
      case "speed":
        partial.cwSpeedWpm = parseBoundedInteger(
          value,
          1,
          100,
          "transmit",
          key,
        );
        break;
      case "synccwx":
        partial.syncCwx = isTruthy(value);
        break;
      case "iambic":
        partial.cwIambic = isTruthy(value);
        break;
      case "iambic_mode": {
        const parsed = parseInteger(value);
        if (parsed === undefined) {
          logParseError("transmit", key, value ?? "");
          break;
        }
        partial.cwIambicMode = parseIambicMode(parsed);
        break;
      }
      case "swap_paddles":
        partial.cwSwapPaddles = isTruthy(value);
        break;
      case "break_in":
        partial.cwBreakIn = isTruthy(value);
        break;
      case "sidetone":
        partial.cwSidetone = isTruthy(value);
        break;
      case "cwl_enabled":
        partial.cwLeftEnabled = isTruthy(value);
        break;
      case "break_in_delay":
        partial.cwBreakInDelayMs = parseBoundedInteger(
          value,
          0,
          2000,
          "transmit",
          key,
        );
        break;
      case "sb_monitor":
        partial.txMonitorEnabled = isTruthy(value);
        break;
      case "mon_gain_cw":
        partial.txCwMonitorGain = parseIntegerAttribute(
          value,
          "transmit",
          key,
        );
        break;
      case "mon_gain_sb":
        partial.txSbMonitorGain = parseIntegerAttribute(
          value,
          "transmit",
          key,
        );
        break;
      case "mon_pan_cw":
        partial.txCwMonitorPan = parseIntegerAttribute(
          value,
          "transmit",
          key,
        );
        break;
      case "mon_pan_sb":
        partial.txSbMonitorPan = parseIntegerAttribute(
          value,
          "transmit",
          key,
        );
        break;
      case "speech_processor_enable":
        partial.speechProcessorEnabled = isTruthy(value);
        break;
      case "speech_processor_level":
        partial.speechProcessorLevel = parseBoundedInteger(
          value,
          0,
          100,
          "transmit",
          key,
        );
        break;
      case "vox_enable":
        partial.voxEnabled = isTruthy(value);
        break;
      case "vox_level":
        partial.voxLevel = parseBoundedInteger(
          value,
          0,
          100,
          "transmit",
          key,
        );
        break;
      case "vox_delay":
        partial.voxDelay = parseBoundedInteger(
          value,
          0,
          100,
          "transmit",
          key,
        );
        break;
      case "tune":
        partial.txTune = isTruthy(value);
        break;
      case "tune_mode":
        partial.tuneMode = parseTuneMode(value);
        break;
      case "met_in_rx":
        partial.meterInRx = isTruthy(value);
        break;
      case "show_tx_in_waterfall":
        partial.showTxInWaterfall = isTruthy(value);
        break;
      case "raw_iq_enable":
        partial.txRawIqEnabled = isTruthy(value);
        break;
      case "max_internal_pa_power":
        partial.maxInternalPaPowerWatts = parseIntegerAttribute(
          value,
          "transmit",
          key,
        );
        break;
      case "freq":
      case "tx_slice_mode":
      case "tx_antenna":
        // Informational fields handled elsewhere; ignore to keep logs clean.
        break;
      default:
        logUnknownAttribute("transmit", key, value);
        break;
    }
  }
}

function applyLogAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
  previous?: RadioSnapshot,
): void {
  if ("available_levels" in attributes) {
    const parsed = parseCsv(attributes["available_levels"]) ?? [];
    if (!arraysShallowEqual(previous?.logLevels, parsed)) {
      partial.logLevels = Object.freeze(parsed);
    }
  }

  if ("module" in attributes) {
    assignLogModule(
      attributes["module"] ?? "",
      attributes["level"],
      partial,
      previous,
    );
  }

  for (const [key, value] of Object.entries(attributes)) {
    if (key === "available_levels" || key === "module" || key === "level") {
      continue;
    }
    logUnknownAttribute("log", key, value);
  }
}

function assignLogModule(
  moduleName: string,
  levelValue: string | undefined,
  partial: Mutable<Partial<RadioSnapshot>>,
  previous?: RadioSnapshot,
): void {
  const trimmed = moduleName.trim();
  if (!trimmed) {
    logParseError("log", "module", moduleName);
    return;
  }
  if (levelValue === undefined) {
    logParseError("log", "level", "");
  }
  const level = levelValue ?? "";
  const existing =
    partial.logModules ?? previous?.logModules ?? EMPTY_LOG_MODULES;
  const index = existing.findIndex((module) => module.name === trimmed);
  if (index >= 0 && existing[index]?.level === level) {
    return;
  }
  const updated = existing.slice();
  const snapshot = Object.freeze({
    name: trimmed,
    level,
  }) as RadioLogModule;
  if (index >= 0) updated[index] = snapshot;
  else updated.push(snapshot);
  partial.logModules = Object.freeze(updated);
}

function parseInterlockState(
  value: string | undefined,
): RadioInterlockState | undefined {
  if (!value) return undefined;
  return INTERLOCK_STATE_BY_TOKEN[value.toUpperCase()];
}

function parseInterlockReason(
  value: string | undefined,
): RadioInterlockReason | undefined {
  if (!value) return undefined;
  return INTERLOCK_REASON_BY_TOKEN[value.toUpperCase()];
}

function parsePttSource(
  value: string | undefined,
): RadioPttSource | undefined {
  if (!value) return undefined;
  return PTT_SOURCE_BY_TOKEN[value.toUpperCase()];
}

function parseInterlockDelay(
  value: string | undefined,
  key: string,
): number | undefined {
  const parsed = parseInteger(value);
  if (parsed !== undefined) return parsed;
  logParseError("interlock", key, value ?? "");
  return undefined;
}

function parseAmplifierHandles(
  value: string | undefined,
): readonly string[] | undefined {
  if (!value) return undefined;
  if (!value.trim()) return Object.freeze([]) as readonly string[];
  const handles = value
    .split(",")
    .map((handle) => handle.trim())
    .filter((handle) => handle.length > 0);
  return Object.freeze(handles) as readonly string[];
}

function parseClientHandle(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return parseIntegerHex(normalized);
}

function parseBoundedInteger(
  value: string | undefined,
  min: number,
  max: number,
  entity: string,
  key: string,
): number | undefined {
  const parsed = parseInteger(value);
  if (parsed === undefined) {
    logParseError(entity, key, value ?? "");
    return undefined;
  }
  return clampRange(parsed, min, max);
}

function parseIntegerAttribute(
  value: string | undefined,
  entity: string,
  key: string,
): number | undefined {
  const parsed = parseInteger(value);
  if (parsed === undefined) {
    logParseError(entity, key, value ?? "");
    return undefined;
  }
  return parsed;
}

function parseIambicMode(value: number): RadioCwIambicMode {
  switch (value) {
    case 0:
      return "a";
    case 1:
      return "b";
    case 2:
      return "strict_b";
    case 3:
      return "bug";
    default:
      return "a";
  }
}

function parseTuneMode(
  value: string | undefined,
): "single_tone" | "two_tone" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "two_tone") return "two_tone";
  if (normalized === "single_tone") return "single_tone";
  return undefined;
}

function clampRange(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

const INTERLOCK_STATE_BY_TOKEN: Record<string, RadioInterlockState> = {
  NONE: "NONE",
  RECEIVE: "RECEIVE",
  READY: "READY",
  NOT_READY: "NOT_READY",
  PTT_REQUESTED: "PTT_REQUESTED",
  TRANSMITTING: "TRANSMITTING",
  TX_FAULT: "TX_FAULT",
  TIMEOUT: "TIMEOUT",
  STUCK_INPUT: "STUCK_INPUT",
  UNKEY_REQUESTED: "UNKEY_REQUESTED",
};

const INTERLOCK_REASON_BY_TOKEN: Record<string, RadioInterlockReason> = {
  RCA_TXREQ: "RCA_TXREQ",
  ACC_TXREQ: "ACC_TXREQ",
  BAD_MODE: "BAD_MODE",
  TUNED_TOO_FAR: "TUNED_TOO_FAR",
  OUT_OF_BAND: "OUT_OF_BAND",
  OUT_OF_PA_RANGE: "OUT_OF_PA_RANGE",
  CLIENT_TX_INHIBIT: "CLIENT_TX_INHIBIT",
  XVTR_RX_ONLY: "XVTR_RX_ONLY",
  NO_TX_ASSIGNED: "NO_TX_ASSIGNED",
  "AMP:TG": "TGXL",
};

const PTT_SOURCE_BY_TOKEN: Record<string, RadioPttSource> = {
  SW: "SW",
  MIC: "MIC",
  ACC: "ACC",
  RCA: "RCA",
  TUNE: "TUNE",
};

const INTERLOCK_MOX_STATES = new Set<RadioInterlockState>([
  "TRANSMITTING",
  "PTT_REQUESTED",
  "UNKEY_REQUESTED",
]);

function parseScreensaverMode(value: string | undefined): RadioScreensaverMode {
  if (!value) return "none";
  const normalized = value.trim().toLowerCase();
  if (normalized === "model") return "model";
  if (normalized === "name") return "name";
  if (normalized === "callsign") return "callsign";
  return "none";
}

const ATU_TUNE_STATUS_BY_TOKEN: Record<string, RadioAtuTuneStatus> = {
  NONE: "NONE",
  TUNE_NOT_STARTED: "TUNE_NOT_STARTED",
  TUNE_IN_PROGRESS: "TUNE_IN_PROGRESS",
  TUNE_BYPASS: "TUNE_BYPASS",
  TUNE_SUCCESSFUL: "TUNE_SUCCESSFUL",
  TUNE_OK: "TUNE_OK",
  TUNE_FAIL_BYPASS: "TUNE_FAIL_BYPASS",
  TUNE_FAIL: "TUNE_FAIL",
  TUNE_ABORTED: "TUNE_ABORTED",
  TUNE_MANUAL_BYPASS: "TUNE_MANUAL_BYPASS",
  TGXL_IN_PROGRESS: "TGXL_IN_PROGRESS",
  TGXL_OK: "TGXL_OK",
  TGXL_ABORTED: "TGXL_ABORTED",
};

function parseAtuTuneStatus(
  value: string | undefined,
): RadioAtuTuneStatus | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  return ATU_TUNE_STATUS_BY_TOKEN[normalized];
}

function applyFilterSharpnessAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
  context: RadioStatusContext,
): void {
  const modeToken = context.positional?.[0];
  const mode = parseFilterSharpnessMode(modeToken);
  if (!mode) {
    const reported = modeToken ?? "";
    logParseError("radio", "filter_sharpness_mode", reported);
    return;
  }

  const levelValue = attributes["level"];
  if (levelValue !== undefined) {
    const parsed = parseInteger(levelValue);
    if (parsed !== undefined) {
      const clamped = clampNumber(
        parsed,
        FILTER_SHARPNESS_MIN_LEVEL,
        FILTER_SHARPNESS_MAX_LEVEL,
      );
      assignFilterSharpnessLevel(partial, mode, clamped);
    } else {
      logParseError("radio", "filter_sharpness.level", levelValue);
    }
  }

  const autoValue = attributes["auto_level"];
  if (autoValue !== undefined) {
    assignFilterSharpnessAuto(partial, mode, isTruthy(autoValue));
  }
}

function applyStaticNetworkParams(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
): void {
  if ("ip" in attributes) {
    const parsed = parseIpAddress(attributes["ip"]);
    if (parsed === undefined && attributes["ip"]) {
      logParseError("radio", "static_net_params.ip", attributes["ip"]);
    }
    partial.staticIp = parsed;
  }
  if ("gateway" in attributes) {
    const parsed = parseIpAddress(attributes["gateway"]);
    if (parsed === undefined && attributes["gateway"]) {
      logParseError(
        "radio",
        "static_net_params.gateway",
        attributes["gateway"],
      );
    }
    partial.staticGateway = parsed;
  }
  if ("netmask" in attributes) {
    const parsed = parseIpAddress(attributes["netmask"]);
    if (parsed === undefined && attributes["netmask"]) {
      logParseError(
        "radio",
        "static_net_params.netmask",
        attributes["netmask"],
      );
    }
    partial.staticNetmask = parsed;
  }
}

function applyOscillatorAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "state":
        partial.oscillatorState = value || undefined;
        break;
      case "setting": {
        const parsed = parseOscillatorSetting(value);
        if (parsed) partial.oscillatorSetting = parsed;
        else if (value) logParseError("radio", "oscillator.setting", value);
        break;
      }
      case "locked":
        partial.oscillatorLocked = isTruthy(value);
        break;
      case "ext_present":
        partial.oscillatorExternalPresent = isTruthy(value);
        break;
      case "gnss_present":
        partial.oscillatorGnssPresent = isTruthy(value);
        break;
      case "gpsdo_present":
        partial.oscillatorGpsdoPresent = isTruthy(value);
        break;
      case "tcxo_present":
        partial.oscillatorTcxoPresent = isTruthy(value);
        break;
      default:
        logUnknownAttribute("radio", key, value);
    }
  }
}

function applyGpsStatusAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "lat": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.gpsLatitude = parsed;
        else logParseError("gps", key, value);
        break;
      }
      case "lon": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.gpsLongitude = parsed;
        else logParseError("gps", key, value);
        break;
      }
      case "grid":
        partial.gpsGrid = value;
        break;
      case "altitude":
        partial.gpsAltitude = value;
        break;
      case "tracked": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.gpsSatellitesTracked = parsed;
        else logParseError("gps", key, value);
        break;
      }
      case "visible": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.gpsSatellitesVisible = parsed;
        else logParseError("gps", key, value);
        break;
      }
      case "speed":
        partial.gpsSpeed = value;
        break;
      case "freq_error":
        partial.gpsFreqError = value;
        break;
      case "status":
        partial.gpsStatus = value;
        break;
      case "time":
        partial.gpsUtcTime = value;
        break;
      case "track": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.gpsTrack = parsed;
        else logParseError("gps", key, value);
        break;
      }
      case "gnss_powered_ant":
        partial.gpsGnssPoweredAntenna = isTruthy(value);
        break;
      case "gps": {
        const normalized = value?.trim().toLowerCase();
        if (normalized) {
          partial.gpsInstalled = normalized !== "not present";
          if (normalized === "locked") partial.gpsLock = true;
          partial.gpsStatus = value;
        }
        break;
      }
      default: {
        logUnknownAttribute("gps", key, value);
        break;
      }
    }
  }
}

const FILTER_SHARPNESS_MIN_LEVEL = 0;
const FILTER_SHARPNESS_MAX_LEVEL = 3;

type RadioContextKind =
  | "radio"
  | "gps"
  | "interlock"
  | "transmit"
  | "filter_sharpness"
  | "static_net_params"
  | "oscillator"
  | "profile"
  | "log"
  | "atu";

function resolveRadioContext(context?: RadioStatusContext): RadioContextKind {
  const identifier = context?.identifier?.toLowerCase();
  if (identifier === "gps") return "gps";
  if (identifier === "filter_sharpness") return "filter_sharpness";
  if (identifier === "static_net_params") return "static_net_params";
  if (identifier === "oscillator") return "oscillator";

  const source = context?.source?.toLowerCase();
  if (source === "gps") return "gps";
  if (source === "interlock") return "interlock";
  if (source === "transmit") return "transmit";
  if (source === "profile") return "profile";
  if (source === "log") return "log";
  if (source === "atu") return "atu";

  return "radio";
}

type ProfileDomain = "global" | "tx" | "mic" | "display";

function applyProfileAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioSnapshot>>,
  context: RadioStatusContext,
): void {
  const domain = parseProfileDomain(context.identifier);
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "list": {
        if (!domain) {
          logParseError("profile", "type", context.identifier ?? "");
          break;
        }
        assignProfileList(partial, domain, parseProfileList(value));
        break;
      }
      case "current": {
        if (!domain) {
          logParseError("profile", "type", context.identifier ?? "");
          break;
        }
        assignProfileSelection(
          partial,
          domain,
          normalizeProfileSelection(value),
        );
        break;
      }
      case "importing":
        partial.profileImportInProgress = isTruthy(value);
        break;
      case "exporting":
        partial.profileExportInProgress = isTruthy(value);
        break;
      case "unsaved_changes_tx":
        partial.profileUnsavedChangesTx = isTruthy(value);
        break;
      case "unsaved_changes_mic":
        partial.profileUnsavedChangesMic = isTruthy(value);
        break;
      default:
        logUnknownAttribute("profile", key, value);
        break;
    }
  }
}

function parseProfileDomain(identifier?: string): ProfileDomain | undefined {
  if (!identifier) return undefined;
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "displays") return "display";
  if (
    normalized === "global" ||
    normalized === "tx" ||
    normalized === "mic" ||
    normalized === "display"
  ) {
    return normalized;
  }
  return undefined;
}

function parseProfileList(value: string | undefined): readonly string[] {
  if (!value) return EMPTY_PROFILE_LIST;
  const entries = value
    .split("^")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (entries.length === 0) return EMPTY_PROFILE_LIST;
  return Object.freeze(entries);
}

function assignProfileList(
  partial: Mutable<Partial<RadioSnapshot>>,
  domain: ProfileDomain,
  list: readonly string[],
): void {
  switch (domain) {
    case "mic":
      partial.profileMicList = list;
      break;
    case "tx":
      partial.profileTxList = list;
      break;
    case "display":
      partial.profileDisplayList = list;
      break;
    case "global":
      partial.profileGlobalList = list;
      break;
  }
}

function assignProfileSelection(
  partial: Mutable<Partial<RadioSnapshot>>,
  domain: ProfileDomain,
  selection: string | undefined,
): void {
  switch (domain) {
    case "mic":
      partial.profileMicSelection = selection;
      break;
    case "tx":
      partial.profileTxSelection = selection;
      break;
    case "display":
      partial.profileDisplaySelection = selection;
      break;
    case "global":
      partial.profileGlobalSelection = selection;
      break;
  }
}

function normalizeProfileSelection(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function parseFilterSharpnessMode(
  token: string | undefined,
): RadioFilterSharpnessMode | undefined {
  if (!token) return undefined;
  const normalized = token.trim().toLowerCase();
  if (normalized === "voice") return "voice";
  if (normalized === "cw") return "cw";
  if (normalized === "digital") return "digital";
  return undefined;
}

function parseIpAddress(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.includes(":")) {
    // Basic validation for IPv6 literals.
    return /^[0-9a-fA-F:]+$/.test(normalized) ? normalized : undefined;
  }
  const parts = normalized.split(".");
  if (parts.length !== 4) return undefined;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return undefined;
    const octet = Number.parseInt(part, 10);
    if (!Number.isFinite(octet) || octet < 0 || octet > 255) return undefined;
  }
  return normalized;
}

function parseOscillatorSetting(
  value: string | undefined,
): RadioOscillatorSetting | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  if (normalized === "external") return "external";
  if (normalized === "gpsdo") return "gpsdo";
  if (normalized === "tcxo") return "tcxo";
  return undefined;
}

function assignFilterSharpnessLevel(
  partial: Mutable<Partial<RadioSnapshot>>,
  mode: RadioFilterSharpnessMode,
  value: number,
): void {
  switch (mode) {
    case "voice":
      partial.filterSharpnessVoice = value;
      break;
    case "cw":
      partial.filterSharpnessCw = value;
      break;
    case "digital":
      partial.filterSharpnessDigital = value;
      break;
  }
}

function assignFilterSharpnessAuto(
  partial: Mutable<Partial<RadioSnapshot>>,
  mode: RadioFilterSharpnessMode,
  value: boolean,
): void {
  switch (mode) {
    case "voice":
      partial.filterSharpnessVoiceAuto = value;
      break;
    case "cw":
      partial.filterSharpnessCwAuto = value;
      break;
    case "digital":
      partial.filterSharpnessDigitalAuto = value;
      break;
  }
}
