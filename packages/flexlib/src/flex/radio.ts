import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type {
  RadioAtuTuneStatus,
  RadioFilterSharpnessMode,
  RadioLogModule,
  RadioInterlockState,
  RadioInterlockReason,
  RadioOscillatorSetting,
  RadioSnapshot,
  RadioScreensaverMode,
  RadioStatusContext,
} from "./state/index.js";
import { FlexError } from "./errors.js";
import {
  buildRadioListAttributes,
  parseRadioInfoReply,
  parseRadioVersionReply,
} from "./radio-replies.js";
import {
  clampInteger,
  ensureFinite,
  formatBooleanFlag,
  toInteger,
} from "./controller-helpers.js";

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
const EMPTY_LOG_MODULES = Object.freeze([]) as readonly RadioLogModule[];
const DEFAULT_NETWORK_MTU = 1_500;

export interface RadioController {
  snapshot(): RadioSnapshot | undefined;
  get model(): string;
  get serial(): string;
  get nickname(): string;
  get callsign(): string;
  get version(): string;
  get macAddress(): string;
  get ipAddress(): string;
  get netmask(): string;
  get gateway(): string;
  get networkMtu(): number;
  get location(): string;
  get region(): string;
  get screensaverMode(): RadioScreensaverMode;
  get radioOptions(): string;
  get tx1750ToneBurst(): boolean;
  get diversityAllowed(): boolean;
  get atuPresent(): boolean;
  get atuEnabled(): boolean;
  get atuMemoriesEnabled(): boolean;
  get atuUsingMemory(): boolean;
  get atuTuneStatus(): RadioAtuTuneStatus;
  get scuCount(): number;
  get sliceCount(): number;
  get txCount(): number;
  get rxAntennaList(): readonly string[];
  get micInputList(): readonly string[];
  get profileMicList(): readonly string[];
  get profileTxList(): readonly string[];
  get profileDisplayList(): readonly string[];
  get profileGlobalList(): readonly string[];
  get logLevels(): readonly string[];
  get logModules(): readonly RadioLogModule[];
  getLogModule(name: string): RadioLogModule | undefined;
  get profileMicSelection(): string | undefined;
  get profileTxSelection(): string | undefined;
  get profileDisplaySelection(): string | undefined;
  get profileGlobalSelection(): string | undefined;
  get profileImportInProgress(): boolean;
  get profileExportInProgress(): boolean;
  get profileUnsavedChangesTx(): boolean;
  get profileUnsavedChangesMic(): boolean;
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
  get mox(): boolean;
  get txAllowed(): boolean;
  get interlockState(): RadioInterlockState | undefined;
  get interlockReason(): RadioInterlockReason | undefined;
  get interlockTimeoutMs(): number;
  get txDelayMs(): number;
  get maxPowerLevel(): number;
  get rfPower(): number;
  get tunePower(): number;
  get txFilterLowHz(): number;
  get txFilterHighHz(): number;
  get txTune(): boolean;
  get tuneMode(): "single_tone" | "two_tone" | undefined;
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
  refreshProfileLists(): Promise<void>;
  /** Set the GUI client station name announced to the radio. */
  setClientStationName(stationName: string): Promise<void>;
  setNickname(nickname: string): Promise<void>;
  setCallsign(callsign: string): Promise<void>;
  setFullDuplexEnabled(enabled: boolean): Promise<void>;
  setEnforcePrivateIpConnections(enabled: boolean): Promise<void>;
  setNetworkMtu(value: number): Promise<void>;
  setLowLatencyDigitalModes(enabled: boolean): Promise<void>;
  setMfEnabled(enabled: boolean): Promise<void>;
  setProfileAutoSave(enabled: boolean): Promise<void>;
  setAtuMemoriesEnabled(enabled: boolean): Promise<void>;
  startAtuTune(): Promise<void>;
  bypassAtu(): Promise<void>;
  clearAtuMemories(): Promise<void>;
  setLineoutGain(gain: number): Promise<void>;
  setLineoutMute(muted: boolean): Promise<void>;
  setHeadphoneGain(gain: number): Promise<void>;
  setHeadphoneMute(muted: boolean): Promise<void>;
  setBacklightLevel(level: number): Promise<void>;
  setRemoteOnEnabled(enabled: boolean): Promise<void>;
  setMox(enabled: boolean): Promise<void>;
  setTxTune(enabled: boolean): Promise<void>;
  setTuneMode(mode: "single_tone" | "two_tone"): Promise<void>;
  setInterlockTimeoutMs(timeoutMs: number): Promise<void>;
  setTxDelayMs(delayMs: number): Promise<void>;
  setTxReqRcaEnabled(enabled: boolean): Promise<void>;
  setTxReqAccEnabled(enabled: boolean): Promise<void>;
  setTxReqRcaPolarityHigh(enabled: boolean): Promise<void>;
  setTxReqAccPolarityHigh(enabled: boolean): Promise<void>;
  setTx1Enabled(enabled: boolean): Promise<void>;
  setTx2Enabled(enabled: boolean): Promise<void>;
  setTx3Enabled(enabled: boolean): Promise<void>;
  setAccTxEnabled(enabled: boolean): Promise<void>;
  setTx1DelayMs(delayMs: number): Promise<void>;
  setTx2DelayMs(delayMs: number): Promise<void>;
  setTx3DelayMs(delayMs: number): Promise<void>;
  setAccTxDelayMs(delayMs: number): Promise<void>;
  setMaxPowerLevel(level: number): Promise<void>;
  setRfPower(level: number): Promise<void>;
  setTunePower(level: number): Promise<void>;
  setTxFilter(lowHz: number, highHz: number): Promise<void>;
  setTxFilterLowHz(lowHz: number): Promise<void>;
  setTxFilterHighHz(highHz: number): Promise<void>;
  setAmCarrierLevel(level: number): Promise<void>;
  setMicLevel(level: number): Promise<void>;
  setMicBoost(enabled: boolean): Promise<void>;
  setHwAlcEnabled(enabled: boolean): Promise<void>;
  setTxInhibit(enabled: boolean): Promise<void>;
  setMicBias(enabled: boolean): Promise<void>;
  setMicAccessoryEnabled(enabled: boolean): Promise<void>;
  setDaxEnabled(enabled: boolean): Promise<void>;
  setCompanderEnabled(enabled: boolean): Promise<void>;
  setCompanderLevel(level: number): Promise<void>;
  setSpeechProcessorEnabled(enabled: boolean): Promise<void>;
  setSpeechProcessorLevel(level: number): Promise<void>;
  setVoxEnabled(enabled: boolean): Promise<void>;
  setVoxLevel(level: number): Promise<void>;
  setVoxDelay(level: number): Promise<void>;
  setTxMonitorEnabled(enabled: boolean): Promise<void>;
  setTxCwMonitorGain(gain: number): Promise<void>;
  setTxSbMonitorGain(gain: number): Promise<void>;
  setTxCwMonitorPan(pan: number): Promise<void>;
  setTxSbMonitorPan(pan: number): Promise<void>;
  setShowTxInWaterfall(enabled: boolean): Promise<void>;
  setTxRawIqEnabled(enabled: boolean): Promise<void>;
  setMeterInRxEnabled(enabled: boolean): Promise<void>;
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
  setLogModuleLevel(module: string, level: string): Promise<void>;
  loadMicProfile(name: string): Promise<void>;
  loadTxProfile(name: string): Promise<void>;
  loadDisplayProfile(name: string): Promise<void>;
  loadGlobalProfile(name: string): Promise<void>;
  createTxProfile(name: string): Promise<void>;
  resetTxProfile(name: string): Promise<void>;
  deleteTxProfile(name: string): Promise<void>;
  createMicProfile(name: string): Promise<void>;
  resetMicProfile(name: string): Promise<void>;
  deleteMicProfile(name: string): Promise<void>;
  saveGlobalProfile(name: string): Promise<void>;
  deleteGlobalProfile(name: string): Promise<void>;
}

export class RadioControllerImpl implements RadioController {
  constructor(
    private readonly session: RadioControllerSession,
    private readonly getRadio: () => RadioSnapshot | undefined,
  ) {}

  snapshot(): RadioSnapshot | undefined {
    return this.getRadio();
  }

  private current(): RadioSnapshot | undefined {
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

  get networkMtu(): number {
    return this.current()?.networkMtu ?? DEFAULT_NETWORK_MTU;
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

  get atuEnabled(): boolean {
    return this.current()?.atuEnabled ?? false;
  }

  get atuMemoriesEnabled(): boolean {
    return this.current()?.atuMemoriesEnabled ?? false;
  }

  get atuUsingMemory(): boolean {
    return this.current()?.atuUsingMemory ?? false;
  }

  get atuTuneStatus(): RadioAtuTuneStatus {
    return this.current()?.atuTuneStatus ?? "NONE";
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

  get profileMicList(): readonly string[] {
    return this.current()?.profileMicList ?? EMPTY_STRING_LIST;
  }

  get profileTxList(): readonly string[] {
    return this.current()?.profileTxList ?? EMPTY_STRING_LIST;
  }

  get profileDisplayList(): readonly string[] {
    return this.current()?.profileDisplayList ?? EMPTY_STRING_LIST;
  }

  get profileGlobalList(): readonly string[] {
    return this.current()?.profileGlobalList ?? EMPTY_STRING_LIST;
  }

  get logLevels(): readonly string[] {
    return this.current()?.logLevels ?? EMPTY_STRING_LIST;
  }

  get logModules(): readonly RadioLogModule[] {
    return this.current()?.logModules ?? EMPTY_LOG_MODULES;
  }

  getLogModule(name: string): RadioLogModule | undefined {
    const normalized = name.trim();
    if (!normalized) return undefined;
    return this.logModules.find((module) => module.name === normalized);
  }

  get profileMicSelection(): string | undefined {
    return this.current()?.profileMicSelection;
  }

  get profileTxSelection(): string | undefined {
    return this.current()?.profileTxSelection;
  }

  get profileDisplaySelection(): string | undefined {
    return this.current()?.profileDisplaySelection;
  }

  get profileGlobalSelection(): string | undefined {
    return this.current()?.profileGlobalSelection;
  }

  get profileImportInProgress(): boolean {
    return this.current()?.profileImportInProgress ?? false;
  }

  get profileExportInProgress(): boolean {
    return this.current()?.profileExportInProgress ?? false;
  }

  get profileUnsavedChangesTx(): boolean {
    return this.current()?.profileUnsavedChangesTx ?? false;
  }

  get profileUnsavedChangesMic(): boolean {
    return this.current()?.profileUnsavedChangesMic ?? false;
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

  get mox(): boolean {
    const snapshot = this.current();
    if (!snapshot) return false;
    if (snapshot.mox !== undefined) return snapshot.mox;
    return isInterlockMoxState(snapshot.interlockState);
  }

  get txAllowed(): boolean {
    const snapshot = this.current();
    return snapshot?.txAllowed ?? true;
  }

  get interlockState(): RadioInterlockState | undefined {
    return this.current()?.interlockState;
  }

  get interlockReason(): RadioInterlockReason | undefined {
    return this.current()?.interlockReason;
  }

  get interlockTimeoutMs(): number {
    return this.current()?.interlockTimeoutMs ?? 0;
  }

  get txDelayMs(): number {
    return this.current()?.interlockTxDelayMs ?? 0;
  }

  get maxPowerLevel(): number {
    return this.current()?.maxPowerLevel ?? 0;
  }

  get rfPower(): number {
    return this.current()?.rfPower ?? 0;
  }

  get tunePower(): number {
    return this.current()?.tunePower ?? 0;
  }

  get txFilterLowHz(): number {
    return this.current()?.txFilterLowHz ?? 0;
  }

  get txFilterHighHz(): number {
    return this.current()?.txFilterHighHz ?? 10_000;
  }

  get txTune(): boolean {
    return this.current()?.txTune ?? false;
  }

  get tuneMode(): "single_tone" | "two_tone" | undefined {
    return this.current()?.tuneMode;
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

  async refreshProfileLists(): Promise<void> {
    await Promise.all([
      this.session.command("profile global info"),
      this.session.command("profile tx info"),
      this.session.command("profile mic info"),
      this.session.command("profile display info"),
    ]);
  }

  async setClientStationName(stationName: string): Promise<void> {
    const sanitized = sanitizeClientStationName(stationName);
    const encoded = sanitized.replace(/ /g, "\u007f");
    await this.session.command(`client station ${encoded}`);
  }

  async setNickname(nickname: string): Promise<void> {
    const sanitized = sanitizeNickname(nickname);
    await this.commandAndPatch(`radio name ${sanitized}`, {
      nickname: sanitized,
    });
  }

  async setCallsign(callsign: string): Promise<void> {
    const sanitized = sanitizeCallsign(callsign);
    await this.commandAndPatch(`radio callsign ${sanitized}`, {
      callsign: sanitized,
    });
  }

  async setFullDuplexEnabled(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set full_duplex_enabled=${formatBooleanFlag(enabled)}`,
      { full_duplex_enabled: formatBooleanFlag(enabled) },
    );
  }

  async setEnforcePrivateIpConnections(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set enforce_private_ip_connections=${formatBooleanFlag(enabled)}`,
      { enforce_private_ip_connections: formatBooleanFlag(enabled) },
    );
  }

  async setNetworkMtu(value: number): Promise<void> {
    const mtu = toInteger(value, "network MTU");
    const encodedMtu = mtu.toString(10);
    await this.commandAndPatch(
      `client set enforce_network_mtu=1 network_mtu=${encodedMtu}`,
      { network_mtu: encodedMtu },
    );
  }

  async setLowLatencyDigitalModes(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set low_latency_digital_modes=${formatBooleanFlag(enabled)}`,
      { low_latency_digital_modes: formatBooleanFlag(enabled) },
    );
  }

  async setMfEnabled(enabled: boolean): Promise<void> {
    await this.commandAndPatch(
      `radio set mf_enable=${formatBooleanFlag(enabled)}`,
      { mf_enable: formatBooleanFlag(enabled) },
    );
  }

  async setProfileAutoSave(enabled: boolean): Promise<void> {
    await this.commandAndPatch(`profile autosave ${enabled ? "on" : "off"}`, {
      auto_save: formatBooleanFlag(enabled),
    });
  }

  async setAtuMemoriesEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `atu set memories_enabled=${encoded}`,
      { memories_enabled: encoded },
      { source: "atu" },
    );
  }

  async startAtuTune(): Promise<void> {
    await this.session.command("atu start");
  }

  async bypassAtu(): Promise<void> {
    await this.session.command("atu bypass");
  }

  async clearAtuMemories(): Promise<void> {
    await this.session.command("atu clear");
  }

  async setLineoutGain(gain: number): Promise<void> {
    const clamped = clampInteger(gain, 0, 100);
    await this.commandAndPatch(`mixer lineout gain ${clamped}`, {
      lineout_gain: clamped.toString(10),
    });
  }

  async setLineoutMute(muted: boolean): Promise<void> {
    const encoded = formatBooleanFlag(muted);
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
    const encoded = formatBooleanFlag(muted);
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
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(`radio set remote_on_enabled=${encoded}`, {
      remote_on_enabled: encoded,
    });
  }

  async setMox(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `xmit ${encoded}`,
      { mox: encoded },
      { source: "interlock" },
    );
  }

  async setTxTune(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `transmit tune ${encoded}`,
      { tune: encoded },
      { source: "transmit" },
    );
  }

  async setTuneMode(mode: "single_tone" | "two_tone"): Promise<void> {
    const normalized = mode === "two_tone" ? "two_tone" : "single_tone";
    await this.commandAndPatch(
      `transmit set tune_mode=${normalized}`,
      { tune_mode: normalized },
      { source: "transmit" },
    );
  }

  async setInterlockTimeoutMs(timeoutMs: number): Promise<void> {
    await this.setInterlockInteger(
      "timeout",
      timeoutMs,
      0,
      600_000,
      "Interlock timeout",
    );
  }

  async setTxDelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger(
      "tx_delay",
      delayMs,
      0,
      60_000,
      "TX delay",
    );
  }

  async setTxReqRcaEnabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("rca_txreq_enable", enabled);
  }

  async setTxReqAccEnabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("acc_txreq_enable", enabled);
  }

  async setTxReqRcaPolarityHigh(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("rca_txreq_polarity", enabled);
  }

  async setTxReqAccPolarityHigh(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("acc_txreq_polarity", enabled);
  }

  async setTx1Enabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("tx1_enabled", enabled);
  }

  async setTx2Enabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("tx2_enabled", enabled);
  }

  async setTx3Enabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("tx3_enabled", enabled);
  }

  async setAccTxEnabled(enabled: boolean): Promise<void> {
    await this.setInterlockBoolean("acc_tx_enabled", enabled);
  }

  async setTx1DelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger(
      "tx1_delay",
      delayMs,
      0,
      6_000,
      "TX1 delay",
    );
  }

  async setTx2DelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger(
      "tx2_delay",
      delayMs,
      0,
      6_000,
      "TX2 delay",
    );
  }

  async setTx3DelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger(
      "tx3_delay",
      delayMs,
      0,
      6_000,
      "TX3 delay",
    );
  }

  async setAccTxDelayMs(delayMs: number): Promise<void> {
    await this.setInterlockInteger(
      "acc_tx_delay",
      delayMs,
      0,
      6_000,
      "ACC TX delay",
    );
  }

  async setMaxPowerLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "max_power_level",
      level,
      0,
      100,
      "max power level",
    );
  }

  async setRfPower(level: number): Promise<void> {
    await this.setTransmitInteger("rfpower", level, 0, 100, "RF power");
  }

  async setTunePower(level: number): Promise<void> {
    await this.setTransmitInteger("tunepower", level, 0, 100, "Tune power");
  }

  async setTxFilter(lowHz: number, highHz: number): Promise<void> {
    const low = clampInteger(lowHz, 0, 10_000, "TX filter low");
    let high = clampInteger(highHz, 0, 10_000, "TX filter high");
    const minimumHigh = low + 50;
    if (high < minimumHigh) high = minimumHigh;
    if (high > 10_000) {
      high = 10_000;
      if (high < minimumHigh) {
        const adjustedLow = Math.max(0, high - 50);
        await this.setTxFilter(adjustedLow, high);
        return;
      }
    }
    await this.commandAndPatch(
      `transmit set filter_low=${low} filter_high=${high}`,
      {
        filter_low: low.toString(10),
        filter_high: high.toString(10),
      },
      { source: "transmit" },
    );
  }

  async setTxFilterLowHz(lowHz: number): Promise<void> {
    const currentHigh = this.current()?.txFilterHighHz ?? 10_000;
    await this.setTxFilter(lowHz, currentHigh);
  }

  async setTxFilterHighHz(highHz: number): Promise<void> {
    const currentLow = this.current()?.txFilterLowHz ?? 0;
    await this.setTxFilter(currentLow, highHz);
  }

  async setAmCarrierLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "am_carrier_level",
      level,
      0,
      100,
      "AM carrier level",
    );
  }

  async setMicLevel(level: number): Promise<void> {
    await this.setTransmitInteger("mic_level", level, 0, 100, "Mic level");
  }

  async setMicBoost(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("mic_boost", enabled);
  }

  async setHwAlcEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("hwalc_enabled", enabled);
  }

  async setTxInhibit(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("inhibit", enabled);
  }

  async setMicBias(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("mic_bias", enabled);
  }

  async setMicAccessoryEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("mic_acc", enabled);
  }

  async setDaxEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("dax", enabled);
  }

  async setCompanderEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("compander", enabled);
  }

  async setCompanderLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "compander_level",
      level,
      0,
      100,
      "Compander level",
    );
  }

  async setSpeechProcessorEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("speech_processor_enable", enabled);
  }

  async setSpeechProcessorLevel(level: number): Promise<void> {
    await this.setTransmitInteger(
      "speech_processor_level",
      level,
      0,
      100,
      "Speech processor level",
    );
  }

  async setVoxEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("vox_enable", enabled);
  }

  async setVoxLevel(level: number): Promise<void> {
    await this.setTransmitInteger("vox_level", level, 0, 100, "VOX level");
  }

  async setVoxDelay(delay: number): Promise<void> {
    await this.setTransmitInteger("vox_delay", delay, 0, 100, "VOX delay");
  }

  async setTxMonitorEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(
      `transmit set mon=${encoded}`,
      { sb_monitor: encoded },
      { source: "transmit" },
    );
  }

  async setTxCwMonitorGain(gain: number): Promise<void> {
    await this.setTransmitInteger(
      "mon_gain_cw",
      gain,
      0,
      100,
      "CW monitor gain",
    );
  }

  async setTxSbMonitorGain(gain: number): Promise<void> {
    await this.setTransmitInteger(
      "mon_gain_sb",
      gain,
      0,
      100,
      "SSB monitor gain",
    );
  }

  async setTxCwMonitorPan(pan: number): Promise<void> {
    await this.setTransmitInteger("mon_pan_cw", pan, 0, 100, "CW monitor pan");
  }

  async setTxSbMonitorPan(pan: number): Promise<void> {
    await this.setTransmitInteger("mon_pan_sb", pan, 0, 100, "SSB monitor pan");
  }

  async setShowTxInWaterfall(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("show_tx_in_waterfall", enabled);
  }

  async setTxRawIqEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("raw_iq_enable", enabled);
  }

  async setMeterInRxEnabled(enabled: boolean): Promise<void> {
    await this.setTransmitBoolean("met_in_rx", enabled);
  }

  async setTnfEnabled(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(`radio set tnf_enabled=${encoded}`, {
      tnf_enabled: encoded,
    });
  }

  async setBinauralRx(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
    await this.commandAndPatch(`radio set binaural_rx=${encoded}`, {
      binaural_rx: encoded,
    });
  }

  async setMuteLocalAudioWhenRemote(enabled: boolean): Promise<void> {
    const encoded = formatBooleanFlag(enabled);
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
    const encoded = formatBooleanFlag(enabled);
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

  async setLogModuleLevel(module: string, level: string): Promise<void> {
    const moduleName = normalizeLogModuleName(module);
    const moduleLevel = normalizeLogLevel(level);
    await this.commandAndPatch(
      `log module=${moduleName} level=${moduleLevel}`,
      { module: moduleName, level: moduleLevel },
      { source: "log", identifier: moduleName },
    );
  }

  async loadMicProfile(name: string): Promise<void> {
    await this.loadProfileSelection("mic", name);
  }

  async loadTxProfile(name: string): Promise<void> {
    await this.loadProfileSelection("tx", name);
  }

  async loadDisplayProfile(name: string): Promise<void> {
    await this.loadProfileSelection("display", name);
  }

  async loadGlobalProfile(name: string): Promise<void> {
    await this.loadProfileSelection("global", name);
  }

  async createTxProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile transmit create", name);
  }

  async resetTxProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile transmit reset", name);
  }

  async deleteTxProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile transmit delete", name);
  }

  async createMicProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile mic create", name);
  }

  async resetMicProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile mic reset", name);
  }

  async deleteMicProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile mic delete", name);
  }

  async saveGlobalProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile global save", name);
  }

  async deleteGlobalProfile(name: string): Promise<void> {
    await this.sendProfileCommand("profile global delete", name);
  }

  private async setInterlockBoolean(
    key: string,
    enabled: boolean,
  ): Promise<void> {
    await this.sendInterlockValue(key, formatBooleanFlag(enabled));
  }

  private async setInterlockInteger(
    key: string,
    value: number,
    min: number,
    max: number,
    label: string,
  ): Promise<void> {
    const clamped = clampInteger(value, min, max, label);
    await this.sendInterlockValue(key, clamped.toString(10));
  }

  private async sendInterlockValue(
    key: string,
    value: string,
  ): Promise<void> {
    await this.commandAndPatch(
      `interlock ${key}=${value}`,
      { [key]: value },
      { source: "interlock" },
    );
  }

  private async setTransmitBoolean(
    key: string,
    enabled: boolean,
  ): Promise<void> {
    await this.sendTransmitEntries({
      [key]: formatBooleanFlag(enabled),
    });
  }

  private async setTransmitInteger(
    key: string,
    value: number,
    min: number,
    max: number,
    label: string,
  ): Promise<void> {
    const clamped = clampInteger(value, min, max, label);
    await this.sendTransmitEntries({
      [key]: clamped.toString(10),
    });
  }

  private async sendTransmitEntries(
    entries: Record<string, string>,
  ): Promise<void> {
    const segments = Object.entries(entries).map(
      ([entryKey, entryValue]) => `${entryKey}=${entryValue}`,
    );
    if (segments.length === 0) return;
    await this.commandAndPatch(
      `transmit set ${segments.join(" ")}`,
      entries,
      { source: "transmit" },
    );
  }

  private async commandAndPatch(
    command: string,
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): Promise<void> {
    this.session.patchRadio(attributes, context);
    try {
      await this.session.command(command);
    } catch (error) {
      try {
        await this.refreshInfo();
      } catch {
        // ignore refresh failures; original rejection is what matters
      }
      throw error;
    }
  }

  private async loadProfileSelection(
    domain: ProfileLoadDomain,
    name: string,
  ): Promise<void> {
    const prepared = prepareProfileNameInput(name);
    await this.commandAndPatch(
      `profile ${domain} load ${prepared.encoded}`,
      { current: prepared.normalized },
      { source: "profile", identifier: domain },
    );
  }

  private async sendProfileCommand(
    command: string,
    name: string,
  ): Promise<void> {
    const { encoded } = prepareProfileNameInput(name);
    await this.session.command(`${command} ${encoded}`);
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

const INVALID_CLIENT_STATION_CHARS =
  /[\*#@!%^&.,;:?\"\)(+=`'~<>|\\[\]{}]+/g;

function sanitizeClientStationName(value: string): string {
  return value.replace(INVALID_CLIENT_STATION_CHARS, "");
}

const INTERLOCK_MOX_STATE_SET = new Set<RadioInterlockState>([
  "PTT_REQUESTED",
  "TRANSMITTING",
  "UNKEY_REQUESTED",
]);

function isInterlockMoxState(
  state: RadioInterlockState | undefined,
): boolean {
  if (!state) return false;
  return INTERLOCK_MOX_STATE_SET.has(state);
}

function normalizeLogModuleName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new FlexError("Log module name cannot be empty");
  }
  return trimmed;
}

function normalizeLogLevel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new FlexError("Log level cannot be empty");
  }
  return trimmed;
}

const FILTER_SHARPNESS_MIN_LEVEL = 0;
const FILTER_SHARPNESS_MAX_LEVEL = 3;

type ProfileLoadDomain = "global" | "tx" | "mic" | "display";

type PreparedProfileName = {
  readonly normalized: string;
  readonly encoded: string;
};

function prepareProfileNameInput(raw: string): PreparedProfileName {
  const normalized = normalizeProfileName(raw);
  return {
    normalized,
    encoded: `"${escapeProfileName(normalized)}"`,
  };
}

function normalizeProfileName(raw: string): string {
  const trimmed = raw.trim();
  const withoutMarker = trimmed.replace(/\*/g, "").trim();
  if (!withoutMarker) {
    throw new FlexError("Profile name cannot be empty");
  }
  return withoutMarker;
}

function escapeProfileName(value: string): string {
  return value.replace(/(["\\])/g, "\\$1");
}
