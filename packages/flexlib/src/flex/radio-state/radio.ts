import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  EMPTY_ATTRIBUTES,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
} from "./common.js";

export interface RadioProperties {
  readonly nickname: string;
  readonly callsign: string;
  readonly firmware: string;
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
  readonly raw: Readonly<Record<string, string>>;
}

export function createDefaultRadioProperties(): RadioProperties {
  return {
    nickname: "",
    callsign: "",
    firmware: "",
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
    raw: EMPTY_ATTRIBUTES,
  };
}

export function createRadioProperties(
  attributes: Record<string, string>,
  previous?: RadioProperties,
  source?: string,
): SnapshotUpdate<RadioProperties> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<RadioProperties>> = {};
  if (source === "gps") applyGpsStatusAttributes(attributes, partial);
  else applyRadioSourceAttributes(attributes, partial);

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
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "nickname":
        partial.nickname = value;
        break;
      case "callsign":
        partial.callsign = value;
        break;
      case "version":
      case "firmware":
        partial.firmware = value;
        break;
      case "available_slices":
      case "slices": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availableSlices = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "available_panadapters":
      case "panadapters": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availablePanadapters = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "available_daxiq":
      case "daxiq_available": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availableDaxIq = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "available_dax":
      case "dax_available": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.availableDaxAudio = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "gps_lock":
        partial.gpsLock = isTruthy(value);
        break;
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
        const handled = applyGpsSharedAttribute(partial, key, value, "radio", {
          allowInstalledKey: false,
        });
        if (!handled) logUnknownAttribute("radio", key, value);
        break;
      }
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
      case "satellites_tracked":
      case "tracked": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.gpsSatellitesTracked = parsed;
        else logParseError("gps", key, value);
        break;
      }
      case "satellites_visible":
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
      default: {
        const handled = applyGpsSharedAttribute(partial, key, value, "gps", {
          allowInstalledKey: true,
        });
        if (!handled) logUnknownAttribute("gps", key, value);
        break;
      }
    }
  }
}

function applyGpsSharedAttribute(
  partial: Mutable<Partial<RadioProperties>>,
  key: string,
  value: string,
  entity: string,
  options?: { allowInstalledKey?: boolean },
): boolean {
  switch (key) {
    case "gps":
    case "gps_installed": {
      const parsed = parseGpsInstalled(value);
      if (parsed !== undefined) partial.gpsInstalled = parsed;
      else logUnknownAttribute(entity, key, value);
      return true;
    }
    case "installed": {
      if (!options?.allowInstalledKey) return false;
      const parsed = parseGpsInstalled(value);
      if (parsed !== undefined) partial.gpsInstalled = parsed;
      else logUnknownAttribute(entity, key, value);
      return true;
    }
    case "gnss_powered_ant":
      partial.gpsGnssPoweredAntenna = isTruthy(value);
      return true;
    default:
      return false;
  }
}

function parseGpsInstalled(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "not present") return false;
  if (normalized === "present") return true;
  if (normalized === "installed") return true;
  if (normalized === "removed") return false;
  if (normalized === "enabled") return true;
  if (normalized === "disabled") return false;
  if (normalized === "true" || normalized === "yes" || normalized === "1")
    return true;
  if (normalized === "false" || normalized === "no" || normalized === "0")
    return false;
  return undefined;
}
