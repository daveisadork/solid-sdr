import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  EMPTY_ATTRIBUTES,
  freezeArray,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseCsv,
  parseFloatSafe,
  parseInteger,
} from "./common.js";

export type RadioFilterSharpnessMode = "voice" | "cw" | "digital";

export type RadioOscillatorSetting = "auto" | "external" | "gpsdo" | "tcxo";

export type RadioScreensaverMode = "model" | "name" | "callsign" | "none";

const EMPTY_STRING_LIST: readonly string[] = Object.freeze([]);

export interface RadioStatusContext {
  readonly source?: string;
  readonly identifier?: string;
  readonly positional?: readonly string[];
}

export interface RadioProperties {
  readonly model: string;
  readonly serial: string;
  readonly nickname: string;
  readonly callsign: string;
  readonly version: string;
  readonly macAddress: string;
  readonly ipAddress: string;
  readonly netmask: string;
  readonly gateway: string;
  readonly location: string;
  readonly region: string;
  readonly screensaverMode: RadioScreensaverMode;
  readonly radioOptions: string;
  readonly tx1750ToneBurst: boolean;
  readonly diversityAllowed: boolean;
  readonly atuPresent: boolean;
  readonly scuCount: number;
  readonly sliceCount: number;
  readonly txCount: number;
  readonly rxAntennaList: readonly string[];
  readonly micInputList: readonly string[];
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
  readonly raw: Readonly<Record<string, string>>;
}

export function createDefaultRadioProperties(): RadioProperties {
  return {
    model: "",
    serial: "",
    nickname: "",
    callsign: "",
    version: "",
    macAddress: "",
    ipAddress: "",
    netmask: "",
    gateway: "",
    location: "",
    region: "",
    screensaverMode: "none",
    radioOptions: "",
    tx1750ToneBurst: false,
    diversityAllowed: false,
    atuPresent: false,
    scuCount: 0,
    sliceCount: 0,
    txCount: 0,
    rxAntennaList: EMPTY_STRING_LIST,
    micInputList: EMPTY_STRING_LIST,
    versionsRaw: "",
    trxPsocVersion: "",
    paPsocVersion: "",
    fpgaVersion: "",
    availableSlices: 0,
    availablePanadapters: 0,
    availableDaxIq: 0,
    availableDaxAudio: 0,
    gpsLock: false,
    fullDuplexEnabled: false,
    enforcePrivateIpConnections: false,
    bandPersistenceEnabled: false,
    lowLatencyDigitalModes: false,
    mfEnabled: false,
    profileAutoSave: false,
    maxInternalPaPower: 0,
    externalPaAllowed: false,
    lineoutGain: 0,
    lineoutMute: false,
    headphoneGain: 0,
    headphoneMute: false,
    backlightLevel: 0,
    remoteOnEnabled: false,
    pllDone: false,
    tnfEnabled: false,
    binauralRx: false,
    muteLocalAudioWhenRemote: false,
    rttyMarkDefaultHz: 0,
    alpha: 0,
    calibrationFrequencyMhz: 0,
    frequencyErrorPpb: 0,
    daxIqCapacity: 0,
    gpsInstalled: false,
    gpsLatitude: undefined,
    gpsLongitude: undefined,
    gpsGrid: undefined,
    gpsAltitude: undefined,
    gpsSatellitesTracked: undefined,
    gpsSatellitesVisible: undefined,
    gpsSpeed: undefined,
    gpsFreqError: undefined,
    gpsStatus: undefined,
    gpsUtcTime: undefined,
    gpsTrack: undefined,
    gpsGnssPoweredAntenna: undefined,
    filterSharpnessVoice: 0,
    filterSharpnessVoiceAuto: false,
    filterSharpnessCw: 0,
    filterSharpnessCwAuto: false,
    filterSharpnessDigital: 0,
    filterSharpnessDigitalAuto: false,
    staticIp: undefined,
    staticGateway: undefined,
    staticNetmask: undefined,
    oscillatorState: undefined,
    oscillatorSetting: undefined,
    oscillatorLocked: false,
    oscillatorExternalPresent: false,
    oscillatorGnssPresent: false,
    oscillatorGpsdoPresent: false,
    oscillatorTcxoPresent: false,
    raw: EMPTY_ATTRIBUTES,
  };
}

export function createRadioProperties(
  attributes: Record<string, string>,
  previous?: RadioProperties,
  context?: RadioStatusContext,
): SnapshotUpdate<RadioProperties> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<RadioProperties>> = {};
  switch (resolveRadioContext(context)) {
    case "gps":
      applyGpsStatusAttributes(attributes, partial);
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
    default:
      applyRadioSourceAttributes(attributes, partial, previous);
      break;
  }

  const base = previous ?? createDefaultRadioProperties();
  const snapshot = Object.freeze({
    ...base,
    ...partial,
    raw: Object.freeze({
      ...base.raw,
      ...attributes,
    }),
  }) as RadioProperties;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

function applyRadioSourceAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioProperties>>,
  previous?: RadioProperties,
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
        partial.rxAntennaList = freezeArray(parsed, previous?.rxAntennaList);
        break;
      }
      case "mic_list": {
        const parsed = parseCsv(value) ?? [];
        partial.micInputList = freezeArray(parsed, previous?.micInputList);
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

function parseScreensaverMode(value: string | undefined): RadioScreensaverMode {
  if (!value) return "none";
  const normalized = value.trim().toLowerCase();
  if (normalized === "model") return "model";
  if (normalized === "name") return "name";
  if (normalized === "callsign") return "callsign";
  return "none";
}

function applyFilterSharpnessAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<RadioProperties>>,
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
      const clamped = clamp(
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
  partial: Mutable<Partial<RadioProperties>>,
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
  partial: Mutable<Partial<RadioProperties>>,
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
  partial: Mutable<Partial<RadioProperties>>,
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
  | "filter_sharpness"
  | "static_net_params"
  | "oscillator";

function resolveRadioContext(context?: RadioStatusContext): RadioContextKind {
  const identifier = context?.identifier?.toLowerCase();
  if (identifier === "gps") return "gps";
  if (identifier === "filter_sharpness") return "filter_sharpness";
  if (identifier === "static_net_params") return "static_net_params";
  if (identifier === "oscillator") return "oscillator";

  const source = context?.source?.toLowerCase();
  if (source === "gps") return "gps";

  return "radio";
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
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
  partial: Mutable<Partial<RadioProperties>>,
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
  partial: Mutable<Partial<RadioProperties>>,
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
