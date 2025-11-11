import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type {
  RadioFilterSharpnessMode,
  RadioOscillatorSetting,
  RadioProperties,
  RadioScreensaverMode,
  RadioStatusContext,
} from "./radio-state.js";
import { FlexError } from "./errors.js";
import {
  buildRadioListAttributes,
  parseRadioInfoReply,
  parseRadioVersionReply,
} from "./radio-replies.js";

interface RadioControllerSession {
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): void;
}

const EMPTY_STRING_LIST = Object.freeze([]) as readonly string[];

export interface RadioController {
  snapshot(): RadioProperties | undefined;
  get model(): string;
  get serial(): string;
  get nickname(): string;
  get callsign(): string;
  get version(): string;
  get macAddress(): string;
  get ipAddress(): string;
  get netmask(): string;
  get gateway(): string;
  get location(): string;
  get region(): string;
  get screensaverMode(): RadioScreensaverMode;
  get radioOptions(): string;
  get tx1750ToneBurst(): boolean;
  get diversityAllowed(): boolean;
  get atuPresent(): boolean;
  get scuCount(): number;
  get sliceCount(): number;
  get txCount(): number;
  get rxAntennaList(): readonly string[];
  get micInputList(): readonly string[];
  get versionsRaw(): string;
  get trxPsocVersion(): string;
  get paPsocVersion(): string;
  get fpgaVersion(): string;
  get gpsLock(): boolean;
  get fullDuplexEnabled(): boolean;
  get enforcePrivateIpConnections(): boolean;
  get bandPersistenceEnabled(): boolean;
  get lowLatencyDigitalModes(): boolean;
  get mfEnabled(): boolean;
  get profileAutoSave(): boolean;
  get maxInternalPaPower(): number;
  get externalPaAllowed(): boolean;
  get lineoutGain(): number;
  get lineoutMute(): boolean;
  get headphoneGain(): number;
  get headphoneMute(): boolean;
  get backlightLevel(): number;
  get remoteOnEnabled(): boolean;
  get pllDone(): boolean;
  get tnfEnabled(): boolean;
  get binauralRx(): boolean;
  get muteLocalAudioWhenRemote(): boolean;
  get rttyMarkDefaultHz(): number;
  get alpha(): number;
  get calibrationFrequencyMhz(): number;
  get frequencyErrorPpb(): number;
  get daxIqCapacity(): number;
  get gpsInstalled(): boolean;
  get gpsLatitude(): number | undefined;
  get gpsLongitude(): number | undefined;
  get gpsGrid(): string | undefined;
  get gpsAltitude(): string | undefined;
  get gpsSatellitesTracked(): number | undefined;
  get gpsSatellitesVisible(): number | undefined;
  get gpsSpeed(): string | undefined;
  get gpsFreqError(): string | undefined;
  get gpsStatus(): string | undefined;
  get gpsUtcTime(): string | undefined;
  get gpsTrack(): number | undefined;
  get gpsGnssPoweredAntenna(): boolean | undefined;
  get filterSharpnessVoice(): number;
  get filterSharpnessVoiceAuto(): boolean;
  get filterSharpnessCw(): number;
  get filterSharpnessCwAuto(): boolean;
  get filterSharpnessDigital(): number;
  get filterSharpnessDigitalAuto(): boolean;
  get staticIp(): string | undefined;
  get staticGateway(): string | undefined;
  get staticNetmask(): string | undefined;
  get oscillatorState(): string | undefined;
  get oscillatorSetting(): RadioOscillatorSetting | undefined;
  get oscillatorLocked(): boolean;
  get oscillatorExternalPresent(): boolean;
  get oscillatorGnssPresent(): boolean;
  get oscillatorGpsdoPresent(): boolean;
  get oscillatorTcxoPresent(): boolean;
  refreshInfo(): Promise<void>;
  refreshVersions(): Promise<void>;
  refreshRxAntennaList(): Promise<void>;
  refreshMicList(): Promise<void>;
  setNickname(nickname: string): Promise<void>;
  setCallsign(callsign: string): Promise<void>;
  setFullDuplexEnabled(enabled: boolean): Promise<void>;
  setEnforcePrivateIpConnections(enabled: boolean): Promise<void>;
  setLowLatencyDigitalModes(enabled: boolean): Promise<void>;
  setMfEnabled(enabled: boolean): Promise<void>;
  setProfileAutoSave(enabled: boolean): Promise<void>;
  setLineoutGain(gain: number): Promise<void>;
  setLineoutMute(muted: boolean): Promise<void>;
  setHeadphoneGain(gain: number): Promise<void>;
  setHeadphoneMute(muted: boolean): Promise<void>;
  setBacklightLevel(level: number): Promise<void>;
  setRemoteOnEnabled(enabled: boolean): Promise<void>;
  setTnfEnabled(enabled: boolean): Promise<void>;
  setBinauralRx(enabled: boolean): Promise<void>;
  setMuteLocalAudioWhenRemote(enabled: boolean): Promise<void>;
  setRttyMarkDefaultHz(value: number): Promise<void>;
  setFrequencyErrorPpb(value: number): Promise<void>;
  setCalibrationFrequencyMhz(value: number): Promise<void>;
  setFilterSharpnessLevel(
    mode: RadioFilterSharpnessMode,
    level: number,
  ): Promise<void>;
  setFilterSharpnessAutoLevel(
    mode: RadioFilterSharpnessMode,
    enabled: boolean,
  ): Promise<void>;
  setStaticNetworkParams(params: {
    ip: string;
    gateway: string;
    netmask: string;
  }): Promise<void>;
  resetStaticNetworkParams(): Promise<void>;
  setOscillatorSetting(setting: RadioOscillatorSetting): Promise<void>;
}

export class RadioControllerImpl implements RadioController {
  constructor(
    private readonly session: RadioControllerSession,
    private readonly getRadio: () => RadioProperties | undefined,
  ) {}

  snapshot(): RadioProperties | undefined {
    return this.getRadio();
  }

  private current(): RadioProperties | undefined {
    return this.getRadio();
  }

  get model(): string {
    return this.current()?.model ?? "";
  }

  get serial(): string {
    return this.current()?.serial ?? "";
  }

  get nickname(): string {
    return this.current()?.nickname ?? "";
  }

  get callsign(): string {
    return this.current()?.callsign ?? "";
  }

  get version(): string {
    return this.current()?.version ?? "";
  }

  get macAddress(): string {
    return this.current()?.macAddress ?? "";
  }

  get ipAddress(): string {
    return this.current()?.ipAddress ?? "";
  }

  get netmask(): string {
    return this.current()?.netmask ?? "";
  }

  get gateway(): string {
    return this.current()?.gateway ?? "";
  }

  get location(): string {
    return this.current()?.location ?? "";
  }

  get region(): string {
    return this.current()?.region ?? "";
  }

  get screensaverMode(): RadioScreensaverMode {
    return this.current()?.screensaverMode ?? "none";
  }

  get radioOptions(): string {
    return this.current()?.radioOptions ?? "";
  }

  get tx1750ToneBurst(): boolean {
    return this.current()?.tx1750ToneBurst ?? false;
  }

  get diversityAllowed(): boolean {
    return this.current()?.diversityAllowed ?? false;
  }

  get atuPresent(): boolean {
    return this.current()?.atuPresent ?? false;
  }

  get scuCount(): number {
    return this.current()?.scuCount ?? 0;
  }

  get sliceCount(): number {
    return this.current()?.sliceCount ?? 0;
  }

  get txCount(): number {
    return this.current()?.txCount ?? 0;
  }

  get rxAntennaList(): readonly string[] {
    return this.current()?.rxAntennaList ?? EMPTY_STRING_LIST;
  }

  get micInputList(): readonly string[] {
    return this.current()?.micInputList ?? EMPTY_STRING_LIST;
  }

  get versionsRaw(): string {
    return this.current()?.versionsRaw ?? "";
  }

  get trxPsocVersion(): string {
    return this.current()?.trxPsocVersion ?? "";
  }

  get paPsocVersion(): string {
    return this.current()?.paPsocVersion ?? "";
  }

  get fpgaVersion(): string {
    return this.current()?.fpgaVersion ?? "";
  }

  get gpsLock(): boolean {
    return this.current()?.gpsLock ?? false;
  }

  get fullDuplexEnabled(): boolean {
    return this.current()?.fullDuplexEnabled ?? false;
  }

  get enforcePrivateIpConnections(): boolean {
    return this.current()?.enforcePrivateIpConnections ?? false;
  }

  get bandPersistenceEnabled(): boolean {
    return this.current()?.bandPersistenceEnabled ?? false;
  }

  get lowLatencyDigitalModes(): boolean {
    return this.current()?.lowLatencyDigitalModes ?? false;
  }

  get mfEnabled(): boolean {
    return this.current()?.mfEnabled ?? false;
  }

  get profileAutoSave(): boolean {
    return this.current()?.profileAutoSave ?? false;
  }

  get maxInternalPaPower(): number {
    return this.current()?.maxInternalPaPower ?? 0;
  }

  get externalPaAllowed(): boolean {
    return this.current()?.externalPaAllowed ?? false;
  }

  get lineoutGain(): number {
    return this.current()?.lineoutGain ?? 0;
  }

  get lineoutMute(): boolean {
    return this.current()?.lineoutMute ?? false;
  }

  get headphoneGain(): number {
    return this.current()?.headphoneGain ?? 0;
  }

  get headphoneMute(): boolean {
    return this.current()?.headphoneMute ?? false;
  }

  get backlightLevel(): number {
    return this.current()?.backlightLevel ?? 0;
  }

  get remoteOnEnabled(): boolean {
    return this.current()?.remoteOnEnabled ?? false;
  }

  get pllDone(): boolean {
    return this.current()?.pllDone ?? false;
  }

  get tnfEnabled(): boolean {
    return this.current()?.tnfEnabled ?? false;
  }

  get binauralRx(): boolean {
    return this.current()?.binauralRx ?? false;
  }

  get muteLocalAudioWhenRemote(): boolean {
    return this.current()?.muteLocalAudioWhenRemote ?? false;
  }

  get rttyMarkDefaultHz(): number {
    return this.current()?.rttyMarkDefaultHz ?? 0;
  }

  get alpha(): number {
    return this.current()?.alpha ?? 0;
  }

  get calibrationFrequencyMhz(): number {
    return this.current()?.calibrationFrequencyMhz ?? 0;
  }

  get frequencyErrorPpb(): number {
    return this.current()?.frequencyErrorPpb ?? 0;
  }

  get daxIqCapacity(): number {
    return this.current()?.daxIqCapacity ?? 0;
  }

  get gpsInstalled(): boolean {
    return this.current()?.gpsInstalled ?? false;
  }

  get gpsLatitude(): number | undefined {
    return this.current()?.gpsLatitude;
  }

  get gpsLongitude(): number | undefined {
    return this.current()?.gpsLongitude;
  }

  get gpsGrid(): string | undefined {
    return this.current()?.gpsGrid;
  }

  get gpsAltitude(): string | undefined {
    return this.current()?.gpsAltitude;
  }

  get gpsSatellitesTracked(): number | undefined {
    return this.current()?.gpsSatellitesTracked;
  }

  get gpsSatellitesVisible(): number | undefined {
    return this.current()?.gpsSatellitesVisible;
  }

  get gpsSpeed(): string | undefined {
    return this.current()?.gpsSpeed;
  }

  get gpsFreqError(): string | undefined {
    return this.current()?.gpsFreqError;
  }

  get gpsStatus(): string | undefined {
    return this.current()?.gpsStatus;
  }

  get gpsUtcTime(): string | undefined {
    return this.current()?.gpsUtcTime;
  }

  get gpsTrack(): number | undefined {
    return this.current()?.gpsTrack;
  }

  get gpsGnssPoweredAntenna(): boolean | undefined {
    return this.current()?.gpsGnssPoweredAntenna;
  }

  get filterSharpnessVoice(): number {
    return this.current()?.filterSharpnessVoice ?? 0;
  }

  get filterSharpnessVoiceAuto(): boolean {
    return this.current()?.filterSharpnessVoiceAuto ?? false;
  }

  get filterSharpnessCw(): number {
    return this.current()?.filterSharpnessCw ?? 0;
  }

  get filterSharpnessCwAuto(): boolean {
    return this.current()?.filterSharpnessCwAuto ?? false;
  }

  get filterSharpnessDigital(): number {
    return this.current()?.filterSharpnessDigital ?? 0;
  }

  get filterSharpnessDigitalAuto(): boolean {
    return this.current()?.filterSharpnessDigitalAuto ?? false;
  }

  get staticIp(): string | undefined {
    return this.current()?.staticIp;
  }

  get staticGateway(): string | undefined {
    return this.current()?.staticGateway;
  }

  get staticNetmask(): string | undefined {
    return this.current()?.staticNetmask;
  }

  get oscillatorState(): string | undefined {
    return this.current()?.oscillatorState;
  }

  get oscillatorSetting(): RadioOscillatorSetting | undefined {
    return this.current()?.oscillatorSetting;
  }

  get oscillatorLocked(): boolean {
    return this.current()?.oscillatorLocked ?? false;
  }

  get oscillatorExternalPresent(): boolean {
    return this.current()?.oscillatorExternalPresent ?? false;
  }

  get oscillatorGnssPresent(): boolean {
    return this.current()?.oscillatorGnssPresent ?? false;
  }

  get oscillatorGpsdoPresent(): boolean {
    return this.current()?.oscillatorGpsdoPresent ?? false;
  }

  get oscillatorTcxoPresent(): boolean {
    return this.current()?.oscillatorTcxoPresent ?? false;
  }

  async refreshInfo(): Promise<void> {
    const response = await this.session.command("info");
    const message = response.message;
    if (!message) {
      throw new FlexError("Flex radio returned no info data");
    }
    const attributes = parseRadioInfoReply(message);
    if (Object.keys(attributes).length === 0) {
      throw new FlexError("Flex radio returned an unrecognized info payload");
    }
    this.session.patchRadio(attributes, { source: "info" });
  }

  async refreshVersions(): Promise<void> {
    const response = await this.session.command("version");
    const message = response.message;
    if (!message) {
      throw new FlexError("Flex radio returned no version data");
    }
    const attributes = parseRadioVersionReply(message);
    if (Object.keys(attributes).length === 0) {
      throw new FlexError(
        "Flex radio returned an unrecognized version payload",
      );
    }
    this.session.patchRadio(attributes, { source: "version" });
  }

  async refreshRxAntennaList(): Promise<void> {
    const response = await this.session.command("ant list");
    const attributes = buildRadioListAttributes(
      "rx_ant_list",
      response.message,
    );
    this.session.patchRadio(attributes);
  }

  async refreshMicList(): Promise<void> {
    const response = await this.session.command("mic list");
    const attributes = buildRadioListAttributes("mic_list", response.message);
    this.session.patchRadio(attributes);
  }

  async setNickname(nickname: string): Promise<void> {
    const sanitized = sanitizeNickname(nickname);
    await this.session.command(`radio name ${sanitized}`);
    this.session.patchRadio({ nickname: sanitized });
  }

  async setCallsign(callsign: string): Promise<void> {
    const sanitized = sanitizeCallsign(callsign);
    await this.session.command(`radio callsign ${sanitized}`);
    this.session.patchRadio({ callsign: sanitized });
  }

  async setFullDuplexEnabled(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set full_duplex_enabled=${booleanToNumeric(enabled)}`,
      { full_duplex_enabled: booleanToNumeric(enabled) },
    );
  }

  async setEnforcePrivateIpConnections(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set enforce_private_ip_connections=${booleanToNumeric(enabled)}`,
      { enforce_private_ip_connections: booleanToNumeric(enabled) },
    );
  }

  async setLowLatencyDigitalModes(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set low_latency_digital_modes=${booleanToNumeric(enabled)}`,
      { low_latency_digital_modes: booleanToNumeric(enabled) },
    );
  }

  async setMfEnabled(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set mf_enable=${booleanToNumeric(enabled)}`,
      { mf_enable: booleanToNumeric(enabled) },
    );
  }

  async setProfileAutoSave(enabled: boolean): Promise<void> {
    await this.commandAndPatch(`profile autosave ${enabled ? "on" : "off"}`, {
      auto_save: booleanToNumeric(enabled),
    });
  }

  async setLineoutGain(gain: number): Promise<void> {
    const clamped = clampInteger(gain, 0, 100);
    await this.commandAndPatch(`mixer lineout gain ${clamped}`, {
      lineout_gain: clamped.toString(10),
    });
  }

  async setLineoutMute(muted: boolean): Promise<void> {
    const encoded = booleanToNumeric(muted);
    await this.commandAndPatch(`mixer lineout mute ${encoded}`, {
      lineout_mute: encoded,
    });
  }

  async setHeadphoneGain(gain: number): Promise<void> {
    const clamped = clampInteger(gain, 0, 100);
    await this.commandAndPatch(`mixer headphone gain ${clamped}`, {
      headphone_gain: clamped.toString(10),
    });
  }

  async setHeadphoneMute(muted: boolean): Promise<void> {
    const encoded = booleanToNumeric(muted);
    await this.commandAndPatch(`mixer headphone mute ${encoded}`, {
      headphone_mute: encoded,
    });
  }

  async setBacklightLevel(level: number): Promise<void> {
    const clamped = clampInteger(level, 0, 100);
    await this.commandAndPatch(`radio backlight ${clamped}`, {
      backlight: clamped.toString(10),
    });
  }

  async setRemoteOnEnabled(enabled: boolean): Promise<void> {
    const encoded = booleanToNumeric(enabled);
    await this.commandAndPatch(`radio set remote_on_enabled=${encoded}`, {
      remote_on_enabled: encoded,
    });
  }

  async setTnfEnabled(enabled: boolean): Promise<void> {
    const encoded = booleanToNumeric(enabled);
    await this.commandAndPatch(`radio set tnf_enabled=${encoded}`, {
      tnf_enabled: encoded,
    });
  }

  async setBinauralRx(enabled: boolean): Promise<void> {
    const encoded = booleanToNumeric(enabled);
    await this.commandAndPatch(`radio set binaural_rx=${encoded}`, {
      binaural_rx: encoded,
    });
  }

  async setMuteLocalAudioWhenRemote(enabled: boolean): Promise<void> {
    const encoded = booleanToNumeric(enabled);
    await this.commandAndPatch(
      `radio set mute_local_audio_when_remote=${encoded}`,
      { mute_local_audio_when_remote: encoded },
    );
  }

  async setRttyMarkDefaultHz(value: number): Promise<void> {
    const rounded = toInteger(value, "RTTY mark");
    await this.commandAndPatch(`radio set rtty_mark_default=${rounded}`, {
      rtty_mark_default: rounded.toString(10),
    });
  }

  async setFrequencyErrorPpb(value: number): Promise<void> {
    const rounded = toInteger(value, "frequency error");
    await this.commandAndPatch(`radio set freq_error_ppb=${rounded}`, {
      freq_error_ppb: rounded.toString(10),
    });
  }

  async setCalibrationFrequencyMhz(value: number): Promise<void> {
    const normalized = ensureFinite(value, "calibration frequency");
    const formatted = normalized.toFixed(6);
    await this.commandAndPatch(`radio set cal_freq=${formatted}`, {
      cal_freq: formatted,
    });
  }

  async setFilterSharpnessLevel(
    mode: RadioFilterSharpnessMode,
    level: number,
  ): Promise<void> {
    const normalizedMode = mode;
    const clamped = clampInteger(
      level,
      FILTER_SHARPNESS_MIN_LEVEL,
      FILTER_SHARPNESS_MAX_LEVEL,
    );
    const encodedLevel = clamped.toString(10);
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "filter_sharpness",
      positional: [normalizedMode.toUpperCase()] as readonly string[],
    };
    await this.commandAndPatch(
      `radio filter_sharpness ${normalizedMode} level=${encodedLevel}`,
      { level: encodedLevel },
      context,
    );
  }

  async setFilterSharpnessAutoLevel(
    mode: RadioFilterSharpnessMode,
    enabled: boolean,
  ): Promise<void> {
    const normalizedMode = mode;
    const encoded = booleanToNumeric(enabled);
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "filter_sharpness",
      positional: [normalizedMode.toUpperCase()] as readonly string[],
    };
    await this.commandAndPatch(
      `radio filter_sharpness ${normalizedMode} auto_level=${encoded}`,
      { auto_level: encoded },
      context,
    );
  }

  async setStaticNetworkParams(params: {
    ip: string;
    gateway: string;
    netmask: string;
  }): Promise<void> {
    const payload = {
      ip: params.ip.trim(),
      gateway: params.gateway.trim(),
      netmask: params.netmask.trim(),
    };
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "static_net_params",
    };
    await this.commandAndPatch(
      `radio static_net_params ip=${payload.ip} gateway=${payload.gateway} netmask=${payload.netmask}`,
      payload,
      context,
    );
  }

  async resetStaticNetworkParams(): Promise<void> {
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "static_net_params",
    };
    await this.commandAndPatch(
      "radio static_net_params reset",
      { ip: "", gateway: "", netmask: "" },
      context,
    );
  }

  async setOscillatorSetting(setting: RadioOscillatorSetting): Promise<void> {
    const normalized = setting.toLowerCase() as RadioOscillatorSetting;
    const context: RadioStatusContext = {
      source: "radio",
      identifier: "oscillator",
    };
    await this.commandAndPatch(
      `radio oscillator ${normalized}`,
      { setting: normalized },
      context,
    );
  }

  private async commandAndPatch(
    command: string,
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): Promise<void> {
    await this.session.command(command);
    this.session.patchRadio(attributes, context);
  }
}

function sanitizeNickname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCallsign(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

const FILTER_SHARPNESS_MIN_LEVEL = 0;
const FILTER_SHARPNESS_MAX_LEVEL = 3;

function booleanToNumeric(value: boolean): string {
  return value ? "1" : "0";
}

function clampInteger(value: number, min: number, max: number): number {
  const normalized = ensureFinite(value, "value");
  const clamped = Math.min(max, Math.max(min, Math.round(normalized)));
  return clamped;
}

function toInteger(value: number, label: string): number {
  return Math.round(ensureFinite(value, label));
}

function ensureFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}
