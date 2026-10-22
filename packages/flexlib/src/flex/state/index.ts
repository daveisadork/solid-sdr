import type { Logger } from "../adapters.js";
import type { FlexStatusMessage } from "../protocol.js";
import type { RfGainInfo } from "../rf-gain.js";
import { type ApdSnapshot, createApdSnapshot } from "./apd.js";
import type { AudioStreamKind, AudioStreamSnapshot } from "./audio-stream.js";
import {
  AUDIO_STREAM_TYPES,
  createAudioStreamSnapshot,
} from "./audio-stream.js";
import { type AutoDxSnapshot, createAutoDxSnapshot } from "./autodx.js";
import type { SnapshotDiff, SnapshotUpdate } from "./common.js";
import {
  parseInteger,
  parseIntegerHex,
  setRadioStateLogger,
} from "./common.js";
import {
  type CwDecoderSnapshot,
  createCwDecoderSnapshot,
} from "./cw-decoder.js";
import {
  type CwxProgressEvent,
  type CwxSnapshot,
  createCwxSnapshot,
  parseCwxProgressEvents,
} from "./cwx.js";
import {
  createDisplayMarkerSnapshot,
  type DisplayMarkerSnapshot,
} from "./display-marker.js";
import { createDvkSnapshot, type DvkSnapshot } from "./dvk.js";
import {
  createEqualizerSnapshot,
  type EqualizerId,
  type EqualizerSnapshot,
} from "./equalizer.js";
import {
  createFeatureLicenseSnapshot,
  type FeatureLicenseSnapshot,
} from "./feature-license.js";
import {
  createFilterPresetSnapshot,
  FILTER_PRESET_COUNT,
  type FilterPresetModeGroup,
  type FilterPresetSnapshot,
  parseFilterPresetModeGroup,
} from "./filter-preset.js";
import {
  createGuiClientSnapshot,
  type GuiClientSnapshot,
} from "./gui-client.js";
import { createMemorySnapshot, type MemorySnapshot } from "./memory.js";
import { createMeterSnapshot, type MeterSnapshot } from "./meter.js";
import {
  createNtpSourceSnapshot,
  type NtpSourceSnapshot,
} from "./ntp-source.js";
import {
  createPanadapterSnapshot,
  type PanadapterSnapshot,
} from "./panadapter.js";
import { createPresetSnapshot, type PresetSnapshot } from "./preset.js";
import {
  createRadioSnapshot,
  type RadioSnapshot,
  type RadioStatusContext,
} from "./radio.js";
import { createSliceSnapshot, type SliceSnapshot } from "./slice.js";
import { createSpotSnapshot, type SpotSnapshot } from "./spot.js";
import { createTnfSnapshot, type TnfSnapshot } from "./tnf.js";
import {
  createTxBandSettingSnapshot,
  type TxBandSettingSnapshot,
} from "./tx-band-settings.js";
import {
  createWaterfallSnapshot,
  type WaterfallSnapshot,
} from "./waterfall.js";
import {
  createWaveformId,
  createWaveformSnapshot,
  parseLegacyWaveformList,
  type WaveformSnapshot,
} from "./waveform.js";
import { createXvtrSnapshot, type XvtrSnapshot } from "./xvtr.js";

export type {
  ApdLifecycleState,
  ApdSamplerPort,
  ApdSnapshot,
  ApdTxAntenna,
} from "./apd.js";
export type { AudioStreamKind, AudioStreamSnapshot } from "./audio-stream.js";
export type {
  AutoDxSnapshot,
  AutoDxState,
  AutoDxTrigger,
} from "./autodx.js";
export type { SnapshotDiff } from "./common.js";
export type { CwDecoderSnapshot } from "./cw-decoder.js";
export type { CwxProgressEvent, CwxSnapshot } from "./cwx.js";
export type { DisplayMarkerSnapshot } from "./display-marker.js";
export type { DvkRecording, DvkSnapshot, DvkStatus } from "./dvk.js";
export type { EqualizerId, EqualizerSnapshot } from "./equalizer.js";
export type { FeatureLicenseSnapshot } from "./feature-license.js";
export type {
  FilterPresetEntry,
  FilterPresetModeGroup,
  FilterPresetSnapshot,
} from "./filter-preset.js";
export {
  FILTER_PRESET_COUNT,
  filterPresetModeGroupFromSliceMode,
} from "./filter-preset.js";
export type { GuiClientSnapshot } from "./gui-client.js";
export type { MemorySnapshot } from "./memory.js";
export type { KnownMeterUnits, MeterSnapshot, MeterUnits } from "./meter.js";
export { KNOWN_METER_UNITS } from "./meter.js";
export type {
  NtpDirective,
  NtpSourceSnapshot,
  NtpSourceState,
} from "./ntp-source.js";
export type { PanadapterSnapshot } from "./panadapter.js";
export type { PresetSnapshot } from "./preset.js";
export type {
  RadioAtuTuneStatus,
  RadioCwIambicMode,
  RadioFilterSharpnessMode,
  RadioInterlockReason,
  RadioInterlockState,
  RadioLogModule,
  RadioOscillatorSetting,
  RadioPttSource,
  RadioScreensaverMode,
  RadioSnapshot,
  RadioStatusContext,
} from "./radio.js";
export type {
  SliceAgcMode,
  SliceAgcThresholdMode,
  SliceDspAdaptMode,
  SliceDspIsdftMode,
  SliceRepeaterOffsetDirection,
  SliceSnapshot,
  SliceToneMode,
} from "./slice.js";
export type { SpotSnapshot } from "./spot.js";
export type { TnfSnapshot } from "./tnf.js";
export type { TxBandSettingSnapshot } from "./tx-band-settings.js";
export type { WaterfallSnapshot } from "./waterfall.js";
export type { WaveformSnapshot } from "./waveform.js";
export type { XvtrSnapshot } from "./xvtr.js";

type ChangeMetadata<TSnapshot> =
  | { readonly removed: false; readonly diff: SnapshotDiff<TSnapshot> }
  | { readonly removed: true; readonly diff?: undefined };

export type DisplayMarkerStateChange = {
  readonly entity: "displayMarker";
  readonly group: string;
  readonly id: string;
} & ChangeMetadata<DisplayMarkerSnapshot>;

export type RadioStateChange =
  | ({ entity: "slice"; id: string } & ChangeMetadata<SliceSnapshot>)
  | ({ entity: "panadapter"; id: string } & ChangeMetadata<PanadapterSnapshot>)
  | ({ entity: "waterfall"; id: string } & ChangeMetadata<WaterfallSnapshot>)
  | ({ entity: "meter"; id: string } & ChangeMetadata<MeterSnapshot>)
  | ({
      entity: "equalizer";
      id: EqualizerId;
    } & ChangeMetadata<EqualizerSnapshot>)
  | ({
      entity: "audioStream";
      id: string;
    } & ChangeMetadata<AudioStreamSnapshot>)
  | ({
      entity: "txBandSetting";
      id: string;
    } & ChangeMetadata<TxBandSettingSnapshot>)
  | ({ entity: "guiClient"; id: string } & ChangeMetadata<GuiClientSnapshot>)
  | ({ entity: "xvtr"; id: string } & ChangeMetadata<XvtrSnapshot>)
  | ({ entity: "cwDecoder"; id: string } & ChangeMetadata<CwDecoderSnapshot>)
  | ({ entity: "autoDx"; id: string } & ChangeMetadata<AutoDxSnapshot>)
  | ({ entity: "preset"; id: string } & ChangeMetadata<PresetSnapshot>)
  | ({ entity: "ntpSource"; id: string } & ChangeMetadata<NtpSourceSnapshot>)
  | ({ entity: "spot"; id: string } & ChangeMetadata<SpotSnapshot>)
  | DisplayMarkerStateChange
  | ({ entity: "tnf"; id: string } & ChangeMetadata<TnfSnapshot>)
  | ({ entity: "memory"; id: string } & ChangeMetadata<MemorySnapshot>)
  | ({ entity: "waveform"; id: string } & ChangeMetadata<WaveformSnapshot>)
  | ({ entity: "radio" } & ChangeMetadata<RadioSnapshot>)
  | ({ entity: "featureLicense" } & ChangeMetadata<FeatureLicenseSnapshot>)
  | ({ entity: "filterPreset" } & ChangeMetadata<FilterPresetSnapshot>)
  | ({ entity: "apd" } & ChangeMetadata<ApdSnapshot>)
  | ({
      entity: "cwx";
      /** Transient transmit-progress events carried by this status line. */
      readonly progress?: readonly CwxProgressEvent[];
    } & ChangeMetadata<CwxSnapshot>)
  | ({ entity: "dvk" } & ChangeMetadata<DvkSnapshot>)
  | {
      entity: "unknown";
      source: string;
      id?: string;
      attributes: Readonly<Record<string, string>>;
    };

export type SliceStateChange = Extract<RadioStateChange, { entity: "slice" }>;
export type PanadapterStateChange = Extract<
  RadioStateChange,
  { entity: "panadapter" }
>;
export type WaterfallStateChange = Extract<
  RadioStateChange,
  { entity: "waterfall" }
>;
export type MeterStateChange = Extract<RadioStateChange, { entity: "meter" }>;
export type ApdStateChange = Extract<RadioStateChange, { entity: "apd" }>;
export type FilterPresetStateChange = Extract<
  RadioStateChange,
  { entity: "filterPreset" }
>;
export type EqualizerStateChange = Extract<
  RadioStateChange,
  { entity: "equalizer" }
>;
export type AudioStreamStateChange = Extract<
  RadioStateChange,
  { entity: "audioStream" }
>;
export type GuiClientStateChange = Extract<
  RadioStateChange,
  { entity: "guiClient" }
>;
export type TxBandSettingStateChange = Extract<
  RadioStateChange,
  { entity: "txBandSetting" }
>;
export type XvtrStateChange = Extract<RadioStateChange, { entity: "xvtr" }>;
export type CwDecoderStateChange = Extract<
  RadioStateChange,
  { entity: "cwDecoder" }
>;
export type AutoDxStateChange = Extract<RadioStateChange, { entity: "autoDx" }>;
export type PresetStateChange = Extract<RadioStateChange, { entity: "preset" }>;
export type NtpSourceStateChange = Extract<
  RadioStateChange,
  { entity: "ntpSource" }
>;
export type SpotStateChange = Extract<RadioStateChange, { entity: "spot" }>;
export type CwxStateChange = Extract<RadioStateChange, { entity: "cwx" }>;
export type DvkStateChange = Extract<RadioStateChange, { entity: "dvk" }>;
export type TnfStateChange = Extract<RadioStateChange, { entity: "tnf" }>;
export type MemoryStateChange = Extract<RadioStateChange, { entity: "memory" }>;
export type WaveformStateChange = Extract<
  RadioStateChange,
  { entity: "waveform" }
>;

export interface RadioStateSnapshot {
  readonly slices: readonly SliceSnapshot[];
  readonly panadapters: readonly PanadapterSnapshot[];
  readonly waterfalls: readonly WaterfallSnapshot[];
  readonly meters: readonly MeterSnapshot[];
  readonly audioStreams: readonly AudioStreamSnapshot[];
  readonly guiClients: readonly GuiClientSnapshot[];
  readonly equalizers: readonly EqualizerSnapshot[];
  readonly txBandSettings: readonly TxBandSettingSnapshot[];
  readonly xvtrs: readonly XvtrSnapshot[];
  readonly cwDecoders: readonly CwDecoderSnapshot[];
  readonly autoDxes: readonly AutoDxSnapshot[];
  readonly presets: readonly PresetSnapshot[];
  readonly ntpSources: readonly NtpSourceSnapshot[];
  readonly spots: readonly SpotSnapshot[];
  readonly displayMarkers: readonly DisplayMarkerSnapshot[];
  readonly tnfs: readonly TnfSnapshot[];
  readonly memories: readonly MemorySnapshot[];
  readonly waveforms: readonly WaveformSnapshot[];
  readonly radio: RadioSnapshot;
  readonly featureLicense?: FeatureLicenseSnapshot;
  readonly filterPresets?: FilterPresetSnapshot;
  readonly apd?: ApdSnapshot;
  readonly cwx?: CwxSnapshot;
  readonly dvk?: DvkSnapshot;
}

export interface RadioStateStore {
  /** Clear all state, returning the store to its initial empty state. */
  reset(): void;
  apply(message: FlexStatusMessage): RadioStateChange[];
  snapshot(): RadioStateSnapshot;
  getSlice(id: string): SliceSnapshot | undefined;
  getSlices(): SliceSnapshot[];
  getPanadapter(id: string): PanadapterSnapshot | undefined;
  getWaterfall(id: string): WaterfallSnapshot | undefined;
  getMeter(id: string): MeterSnapshot | undefined;
  getAudioStream(id: string): AudioStreamSnapshot | undefined;
  getGuiClient(id: string): GuiClientSnapshot | undefined;
  getGuiClients(): readonly GuiClientSnapshot[];
  getEqualizer(id: EqualizerId): EqualizerSnapshot | undefined;
  getEqualizers(): readonly EqualizerSnapshot[];
  getTxBandSetting(id: string): TxBandSettingSnapshot | undefined;
  getTxBandSettings(): readonly TxBandSettingSnapshot[];
  /** CW decoder state for a slice, keyed by slice id. */
  getCwDecoder(sliceId: string): CwDecoderSnapshot | undefined;
  /** AutoDX state for a slice, keyed by slice id. Absent until the radio reports it or a setter runs. */
  getAutoDx(sliceId: string): AutoDxSnapshot | undefined;
  /**
   * Writes AutoDX fields for a live slice, creating the default state first
   * when none exists. Returns nothing when the slice is gone.
   */
  patchAutoDx(
    sliceId: string,
    attributes: Record<string, string>,
  ): AutoDxStateChange | undefined;
  /** Drops the CW decoder and AutoDX state of a removed slice. */
  removeSliceChildren(sliceId: string): readonly RadioStateChange[];
  getPreset(id: string): PresetSnapshot | undefined;
  getPresets(): readonly PresetSnapshot[];
  /** Id of the last preset the radio confirmed applying since connect, if any. */
  getActivePresetId(): string | undefined;
  getNtpSource(id: string): NtpSourceSnapshot | undefined;
  getNtpSources(): readonly NtpSourceSnapshot[];
  patchNtpSource(
    id: string,
    attributes: Record<string, string>,
  ): NtpSourceStateChange | undefined;
  getXvtr(id: string): XvtrSnapshot | undefined;
  getXvtrs(): readonly XvtrSnapshot[];
  getSpot(id: string): SpotSnapshot | undefined;
  getSpots(): readonly SpotSnapshot[];
  getDisplayMarker(
    group: string,
    id: string,
  ): DisplayMarkerSnapshot | undefined;
  getDisplayMarkers(): readonly DisplayMarkerSnapshot[];
  getTnf(id: string): TnfSnapshot | undefined;
  getTnfs(): readonly TnfSnapshot[];
  getMemory(id: string): MemorySnapshot | undefined;
  getMemories(): readonly MemorySnapshot[];
  getWaveform(id: string): WaveformSnapshot | undefined;
  getWaveforms(): readonly WaveformSnapshot[];
  patchMemory(
    id: string,
    attributes: Record<string, string>,
  ): MemoryStateChange | undefined;
  removeMemory(id: string): MemoryStateChange | undefined;
  getApd(): ApdSnapshot | undefined;
  getFilterPresets(): FilterPresetSnapshot | undefined;
  getCwx(): CwxSnapshot | undefined;
  getDvk(): DvkSnapshot | undefined;
  getRadio(): RadioSnapshot | undefined;
  getFeatureLicense(): FeatureLicenseSnapshot | undefined;
  patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): RadioStateChange | undefined;
  patchSlice(
    id: string,
    attributes: Record<string, string>,
  ): SliceStateChange | undefined;
  removeSlice(id: string): readonly RadioStateChange[] | undefined;
  patchPanadapter(
    id: string,
    attributes: Record<string, string>,
  ): PanadapterStateChange | undefined;
  removePanadapter(id: string): readonly RadioStateChange[] | undefined;
  patchWaterfall(
    id: string,
    attributes: Record<string, string>,
  ): WaterfallStateChange | undefined;
  removeWaterfall(id: string): readonly RadioStateChange[] | undefined;
  patchAudioStream(
    id: string,
    attributes: Record<string, string>,
  ): AudioStreamStateChange | undefined;
  removeAudioStream(id: string): AudioStreamStateChange | undefined;
  setAudioStreamSampleRate(
    id: string,
    sampleRateHz: number,
  ): AudioStreamStateChange | undefined;
  /**
   * Record the GUI client this connection is bound to. DAX RX and DAX TX
   * streams then follow that client's slices instead of their own client's.
   */
  setBoundClientId(clientId: string | undefined): readonly RadioStateChange[];
  patchEqualizer(
    id: EqualizerId,
    attributes: Record<string, string>,
  ): EqualizerStateChange | undefined;
  patchTxBandSetting(
    id: string,
    attributes: Record<string, string>,
  ): TxBandSettingStateChange | undefined;
  patchXvtr(
    id: string,
    attributes: Record<string, string>,
  ): XvtrStateChange | undefined;
  removeXvtr(id: string): XvtrStateChange | undefined;
  patchSpot(
    id: string,
    attributes: Record<string, string>,
  ): SpotStateChange | undefined;
  removeSpot(id: string): SpotStateChange | undefined;
  patchDisplayMarker(
    group: string,
    id: string,
    attributes: Record<string, string>,
  ): DisplayMarkerStateChange | undefined;
  removeDisplayMarker(
    group: string,
    id: string,
  ): DisplayMarkerStateChange | undefined;
  patchTnf(
    id: string,
    attributes: Record<string, string>,
  ): TnfStateChange | undefined;
  removeTnf(id: string): TnfStateChange | undefined;
  patchCwx(attributes: Record<string, string>): CwxStateChange | undefined;
  patchDvk(attributes: Record<string, string>): DvkStateChange | undefined;
  patchApd(attributes: Record<string, string>): ApdStateChange | undefined;
  patchFilterPreset(
    modeGroup: FilterPresetModeGroup,
    index: number,
    attributes: Record<string, string>,
  ): FilterPresetStateChange | undefined;
  applyPanadapterRfGainInfo(
    id: string,
    info: RfGainInfo,
  ): PanadapterStateChange | undefined;
  applyWaterfallRfGainInfo(
    id: string,
    info: RfGainInfo,
  ): WaterfallStateChange | undefined;
  setLocalClientHandle(
    handle: string | number | undefined,
  ): readonly RadioStateChange[];
  getBoundClientId(): string | undefined;
}

export interface RadioStateStoreOptions {
  readonly logger?: Pick<Logger, "debug" | "warn">;
}

/** Meter source code shared by amplifiers and tuners. */
const AMPLIFIER_METER_SOURCE = "AMP";

export function createRadioStateStore(
  options: RadioStateStoreOptions = {},
): RadioStateStore {
  setRadioStateLogger(options.logger);
  const slices = new Map<string, SliceSnapshot>();
  const panadapters = new Map<string, PanadapterSnapshot>();
  const waterfalls = new Map<string, WaterfallSnapshot>();
  const meters = new Map<string, MeterSnapshot>();
  const audioStreams = new Map<string, AudioStreamSnapshot>();
  const guiClients = new Map<string, GuiClientSnapshot>();
  const guiClientsByHandle = new Map<number, string>();
  const equalizers = new Map<EqualizerId, EqualizerSnapshot>();
  const txBandSettings = new Map<string, TxBandSettingSnapshot>();
  const xvtrs = new Map<string, XvtrSnapshot>();
  const presets = new Map<string, PresetSnapshot>();
  const cwDecoders = new Map<string, CwDecoderSnapshot>();
  const autoDxes = new Map<string, AutoDxSnapshot>();
  const ntpSources = new Map<string, NtpSourceSnapshot>();
  let activePresetId: string | undefined;
  const spots = new Map<string, SpotSnapshot>();
  const displayMarkers = new Map<string, Map<string, DisplayMarkerSnapshot>>();
  const tnfs = new Map<string, TnfSnapshot>();
  const memories = new Map<string, MemorySnapshot>();
  const waveforms = new Map<string, WaveformSnapshot>();
  let radio: RadioSnapshot;
  let featureLicense: FeatureLicenseSnapshot | undefined;
  let filterPresets: FilterPresetSnapshot | undefined;
  let apd: ApdSnapshot | undefined;
  let cwx: CwxSnapshot | undefined;
  let dvk: DvkSnapshot | undefined;
  let localClientHandle: number | undefined;
  let boundClientId: string | undefined;

  function getDisplayMarkerGroup(
    group: string,
    create = false,
  ): Map<string, DisplayMarkerSnapshot> | undefined {
    let markers = displayMarkers.get(group);
    if (!markers && create) {
      markers = new Map<string, DisplayMarkerSnapshot>();
      displayMarkers.set(group, markers);
    }
    return markers;
  }

  function flattenDisplayMarkers(): DisplayMarkerSnapshot[] {
    return Array.from(displayMarkers.values()).flatMap((markers) =>
      Array.from(markers.values()),
    );
  }

  function reset(): void {
    slices.clear();
    panadapters.clear();
    waterfalls.clear();
    meters.clear();
    audioStreams.clear();
    guiClients.clear();
    guiClientsByHandle.clear();
    equalizers.clear();
    txBandSettings.clear();
    xvtrs.clear();
    presets.clear();
    cwDecoders.clear();
    autoDxes.clear();
    ntpSources.clear();
    activePresetId = undefined;
    spots.clear();
    displayMarkers.clear();
    tnfs.clear();
    memories.clear();
    waveforms.clear();
    radio = undefined as unknown as RadioSnapshot;
    featureLicense = undefined;
    filterPresets = undefined;
    apd = undefined;
    cwx = undefined;
    dvk = undefined;
    localClientHandle = undefined;
    boundClientId = undefined;
  }

  return {
    reset,
    apply(message) {
      switch (message.source) {
        case "slice":
          return handleSlice(message);
        case "pan":
          return [handlePanadapter(message)];
        case "stream":
          return [handleStream(message)];
        case "meter":
          return handleMeter(message);
        case "radio":
        case "gps":
          return [handleRadio(message)];
        case "ha_api":
          return message.identifier === "system" ? [handleRadio(message)] : [];
        case "interlock":
        case "transmit": {
          if (message.identifier === "band") {
            const change = handleTxBandSetting(message);
            if (change) return [change];
            return [];
          }
          return [handleRadio(message)];
        }
        case "client":
          return handleClient(message);
        case "eq": {
          const change = handleEqualizer(message);
          if (change) return [change];
          return [];
        }
        case "xvtr":
          return [handleXvtr(message)];
        case "cw":
          return handleCwDecoder(message);
        case "autodx":
          return handleAutoDx(message);
        case "preset":
          return handlePreset(message);
        case "ntp_sources":
          return [handleNtpSource(message)];
        case "tnf":
          return [handleTnf(message)];
        case "memory":
          return [handleMemory(message)];
        case "spot": {
          const spotChange = handleSpot(message);
          if (spotChange) return [spotChange];
          return [];
        }
        case "display_marker":
          return [handleDisplayMarker(message)];
        case "filt_preset": {
          const change = handleFilterPreset(message);
          if (change) return [change];
          return [];
        }
        case "cwx": {
          const change = handleCwx(message);
          if (change) return [change];
          return [];
        }
        case "dvk": {
          const change = handleDvk(message);
          if (change) return [change];
          return [];
        }
        case "waveform":
          return handleWaveform(message);
        case "apd": {
          const change = handleApd(message);
          if (change) return [change];
          return [];
        }
        case "license": {
          const change = handleLicense(message);
          if (change) return [change];
          return [];
        }
        case "log": {
          const change = handleLog(message);
          if (change) return [change];
          return [];
        }
        case "profile": {
          const change = handleProfile(message);
          if (change) return [change];
          return [];
        }
        case "atu": {
          const change = handleAtu(message);
          if (change) return [change];
          return [];
        }
        case "display": {
          switch (message.identifier) {
            case "pan":
              return [handlePanadapter(message, message.positional[0])];
            case "waterfall":
              return [handleDisplay(message, message.positional[0])];
          }
        }
      }
      return [
        {
          entity: "unknown",
          source: message.source,
          id: message.identifier,
          attributes: message.attributes,
        },
      ];
    },
    snapshot() {
      return {
        slices: Array.from(slices.values()),
        panadapters: Array.from(panadapters.values()),
        waterfalls: Array.from(waterfalls.values()),
        meters: Array.from(meters.values()),
        audioStreams: Array.from(audioStreams.values()),
        guiClients: Array.from(guiClients.values()),
        equalizers: Array.from(equalizers.values()),
        txBandSettings: Array.from(txBandSettings.values()),
        xvtrs: Array.from(xvtrs.values()),
        cwDecoders: Array.from(cwDecoders.values()),
        autoDxes: Array.from(autoDxes.values()),
        presets: Array.from(presets.values()),
        ntpSources: Array.from(ntpSources.values()),
        spots: Array.from(spots.values()),
        displayMarkers: flattenDisplayMarkers(),
        tnfs: Array.from(tnfs.values()),
        memories: Array.from(memories.values()),
        waveforms: Array.from(waveforms.values()),
        radio,
        featureLicense,
        filterPresets,
        apd,
        cwx,
        dvk,
      };
    },
    getSlice(id) {
      return slices.get(id);
    },
    getSlices() {
      return Array.from(slices.values());
    },
    getPanadapter(id) {
      return panadapters.get(id);
    },
    getWaterfall(id) {
      return waterfalls.get(id);
    },
    getMeter(id) {
      return meters.get(id);
    },
    getAudioStream(id) {
      return audioStreams.get(id);
    },
    getGuiClient(id) {
      return guiClients.get(id);
    },
    getGuiClients() {
      return Array.from(guiClients.values());
    },
    getEqualizer(id) {
      return equalizers.get(id);
    },
    getEqualizers() {
      return Array.from(equalizers.values());
    },
    getTxBandSetting(id) {
      return txBandSettings.get(id);
    },
    getTxBandSettings() {
      return Array.from(txBandSettings.values());
    },
    getCwDecoder(sliceId) {
      return cwDecoders.get(sliceId);
    },
    getAutoDx(sliceId) {
      return autoDxes.get(sliceId);
    },
    patchAutoDx(sliceId, attributes) {
      return patchAutoDx(sliceId, attributes);
    },
    removeSliceChildren(sliceId) {
      const changes: RadioStateChange[] = [];
      if (cwDecoders.delete(sliceId)) {
        changes.push({ entity: "cwDecoder", id: sliceId, removed: true });
      }
      if (autoDxes.delete(sliceId)) {
        changes.push({ entity: "autoDx", id: sliceId, removed: true });
      }
      return changes;
    },
    getPreset(id) {
      return presets.get(id);
    },
    getPresets() {
      return Array.from(presets.values());
    },
    getActivePresetId() {
      return activePresetId;
    },
    getNtpSource(id) {
      return ntpSources.get(id);
    },
    getNtpSources() {
      return Array.from(ntpSources.values());
    },
    patchNtpSource(id, attributes) {
      return patchNtpSource(id, attributes);
    },
    getXvtr(id) {
      return xvtrs.get(id);
    },
    getXvtrs() {
      return Array.from(xvtrs.values());
    },
    getSpot(id) {
      return spots.get(id);
    },
    getSpots() {
      return Array.from(spots.values());
    },
    getDisplayMarker(group, id) {
      return getDisplayMarkerGroup(group)?.get(id);
    },
    getDisplayMarkers() {
      return flattenDisplayMarkers();
    },
    getTnf(id) {
      return tnfs.get(id);
    },
    getTnfs() {
      return Array.from(tnfs.values());
    },
    getMemory(id) {
      return memories.get(id);
    },
    getMemories() {
      return Array.from(memories.values());
    },
    getWaveform(id) {
      return waveforms.get(id);
    },
    getWaveforms() {
      return Array.from(waveforms.values());
    },
    patchMemory(id, attributes) {
      return patchMemory(id, attributes);
    },
    removeMemory(id) {
      return removeMemory(id);
    },
    getApd() {
      return apd;
    },
    getFilterPresets() {
      return filterPresets;
    },
    getCwx() {
      return cwx;
    },
    getDvk() {
      return dvk;
    },
    getRadio() {
      return radio;
    },
    getFeatureLicense() {
      return featureLicense;
    },
    patchRadio(attributes, context) {
      return patchRadio(attributes, context);
    },
    patchSlice(id, attributes) {
      return patchSlice(id, attributes);
    },
    removeSlice(id) {
      return removeSlice(id);
    },
    patchPanadapter(id, attributes) {
      return patchPanadapter(id, attributes);
    },
    removePanadapter(id) {
      return removePanadapter(id);
    },
    patchWaterfall(id, attributes) {
      return patchWaterfall(id, attributes);
    },
    removeWaterfall(id) {
      return removeWaterfall(id);
    },
    patchAudioStream(id, attributes) {
      return patchAudioStream(id, attributes);
    },
    removeAudioStream(id) {
      return removeAudioStream(id);
    },
    setAudioStreamSampleRate(id, sampleRateHz) {
      return setAudioStreamSampleRate(id, sampleRateHz);
    },
    getBoundClientId() {
      return boundClientId;
    },
    setBoundClientId(clientId) {
      if (clientId === boundClientId) return [];
      boundClientId = clientId;
      return recomputeDaxStreamRates();
    },
    patchEqualizer(id, attributes) {
      return patchEqualizer(id, attributes);
    },
    patchTxBandSetting(id, attributes) {
      return patchTxBandSetting(id, attributes);
    },
    patchXvtr(id, attributes) {
      return patchXvtr(id, attributes);
    },
    removeXvtr(id) {
      return removeXvtr(id);
    },
    patchSpot(id, attributes) {
      return patchSpot(id, attributes);
    },
    removeSpot(id) {
      return removeSpot(id);
    },
    patchDisplayMarker(group, id, attributes) {
      return patchDisplayMarker(group, id, attributes);
    },
    removeDisplayMarker(group, id) {
      return removeDisplayMarker(group, id);
    },
    patchTnf(id, attributes) {
      return patchTnf(id, attributes);
    },
    removeTnf(id) {
      return removeTnf(id);
    },
    patchCwx(attributes) {
      return patchCwx(attributes);
    },
    patchDvk(attributes) {
      return patchDvk(attributes);
    },
    patchApd(attributes) {
      return patchApd(attributes);
    },
    patchFilterPreset(modeGroup, index, attributes) {
      return patchFilterPreset(modeGroup, index, attributes);
    },
    applyPanadapterRfGainInfo(id, info) {
      return applyPanadapterRfGainInfo(id, info);
    },
    applyWaterfallRfGainInfo(id, info) {
      return applyWaterfallRfGainInfo(id, info);
    },
    setLocalClientHandle(handle) {
      return updateLocalClientHandle(handle);
    },
  };

  function handleSlice(message: FlexStatusMessage): RadioStateChange[] {
    const id = resolveIdentifier(message, message.attributes.index);
    if (!id) {
      return [
        {
          entity: "unknown",
          source: message.source,
          attributes: message.attributes,
        },
      ];
    }

    if (isMarkedDeleted(message)) {
      const previous = slices.get(id);
      slices.delete(id);
      updatePanadapterSliceMembership(
        id,
        undefined,
        previous?.panadapterStreamId,
      );
      const changes: RadioStateChange[] = [
        {
          entity: "slice",
          id,
          removed: true,
        },
      ];
      changes.push(
        ...recomputeGuiClientTransmitSlices([previous?.clientHandle]),
        ...recomputeDaxStreamRates(),
      );
      return changes;
    }

    const previous = slices.get(id);
    const { snapshot, diff } = createSliceSnapshot(
      id,
      message.attributes,
      previous,
    );
    slices.set(id, snapshot);
    updatePanadapterSliceMembership(
      id,
      snapshot.panadapterStreamId,
      previous?.panadapterStreamId,
    );
    const changes: RadioStateChange[] = [
      {
        entity: "slice",
        id,
        removed: false,
        diff,
      },
    ];
    changes.push(
      ...recomputeGuiClientTransmitSlices([
        snapshot.clientHandle,
        previous?.clientHandle,
      ]),
    );
    if (
      !previous ||
      diff.isTransmitEnabled !== undefined ||
      diff.sampleRateHz !== undefined
    ) {
      changes.push(...recomputeDaxStreamRates());
    }
    return changes;
  }

  function removeSlice(id: string): readonly RadioStateChange[] | undefined {
    const previous = slices.get(id);
    if (!previous) return undefined;
    slices.delete(id);
    updatePanadapterSliceMembership(id, undefined, previous.panadapterStreamId);
    const changes: RadioStateChange[] = [
      {
        entity: "slice",
        id,
        removed: true,
      },
    ];
    changes.push(
      ...recomputeGuiClientTransmitSlices([previous.clientHandle]),
      ...recomputeDaxStreamRates(),
    );
    return changes;
  }

  function handleEqualizer(
    message: FlexStatusMessage,
  ): RadioStateChange | undefined {
    const id = resolveEqualizerId(message.identifier, message.positional);
    if (!id) return undefined;
    const previous = equalizers.get(id);
    const { snapshot, diff } = createEqualizerSnapshot(
      id,
      message.attributes,
      previous,
    );
    equalizers.set(id, snapshot);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "equalizer",
      id,
      removed: false,
      diff,
    };
  }

  function handleApd(message: FlexStatusMessage): RadioStateChange | undefined {
    if (!shouldAcceptApdStatus(message.attributes)) return undefined;
    const attributes: Record<string, string> = {
      ...message.attributes,
    };
    const hasResetToken =
      "equalizer_reset" in attributes ||
      message.positional.some((token) => token === "equalizer_reset") ||
      message.identifier === "equalizer_reset";
    if (hasResetToken && !("equalizer_reset" in attributes)) {
      attributes.equalizer_reset = "";
    }
    const { snapshot, diff } = createApdSnapshot(attributes, apd);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    apd = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "apd",
      removed: false,
      diff,
    };
  }

  function shouldAcceptApdStatus(attributes: Record<string, string>): boolean {
    const parsed = parseIntegerHex(attributes.client_handle);
    return parsed ? localClientHandle === parsed : true;
  }

  function patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): RadioStateChange | undefined {
    const { snapshot, diff } = createRadioSnapshot(attributes, radio, context);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    if (diffKeys.length === 0) {
      radio = snapshot;
      return undefined;
    }
    radio = snapshot;
    return {
      entity: "radio",
      diff,
      removed: false,
    };
  }

  function handlePanadapter(
    message: FlexStatusMessage,
    streamHint?: string,
  ): RadioStateChange {
    const id = resolveIdentifier(
      message,
      streamHint,
      message.attributes.stream_id,
      message.attributes.stream,
      message.attributes.client_handle,
    );
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    if (isMarkedDeleted(message)) {
      panadapters.delete(id);
      detachSlicesFromPanadapter(id);
      return {
        entity: "panadapter",
        id,
        removed: true,
      };
    }

    const previous = panadapters.get(id);
    const { snapshot, diff } = createPanadapterSnapshot(
      id,
      message.attributes,
      previous,
    );
    panadapters.set(id, snapshot);
    return {
      entity: "panadapter",
      id,
      diff,
      removed: false,
    };
  }

  function handleStream(message: FlexStatusMessage): RadioStateChange {
    const id = resolveIdentifier(
      message,
      message.attributes.stream_id,
      message.attributes.stream,
    );
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    if (isMarkedDeleted(message)) {
      audioStreams.delete(id);
      return {
        entity: "audioStream",
        id,
        removed: true,
      };
    }

    const existing = audioStreams.get(id);
    const typeToken = message.attributes.type ?? existing?.type;
    const normalizedType = typeToken?.toLowerCase() as
      | AudioStreamKind
      | undefined;

    if (!normalizedType || !AUDIO_STREAM_TYPES.has(normalizedType)) {
      return {
        entity: "unknown",
        source: message.source,
        id,
        attributes: message.attributes,
      };
    }

    const previous = audioStreams.get(id);
    const attributePatch: Record<string, string> = {
      ...message.attributes,
    };
    if (typeToken && attributePatch.type === undefined) {
      attributePatch.type = typeToken;
    }
    if (attributePatch.stream_id === undefined && id) {
      attributePatch.stream_id = id;
    }
    const { snapshot, diff } = withDaxSampleRate(
      createAudioStreamSnapshot(id, attributePatch, previous),
    );
    audioStreams.set(id, snapshot);
    return {
      entity: "audioStream",
      id,
      diff,
      removed: false,
    };
  }

  function handleTxBandSetting(
    message: FlexStatusMessage,
  ): RadioStateChange | undefined {
    const id =
      message.positional[0] ??
      message.attributes.band_id ??
      message.attributes.id;
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        id: message.identifier,
        attributes: message.attributes,
      };
    }

    const removed =
      message.positional.some((token) => token === "removed") ||
      "removed" in message.attributes;
    if (removed) {
      if (!txBandSettings.has(id)) {
        return {
          entity: "txBandSetting",
          id,
          removed: true,
        };
      }
      txBandSettings.delete(id);
      return {
        entity: "txBandSetting",
        id,
        removed: true,
      };
    }

    const previous = txBandSettings.get(id);
    const baseAttributes: Record<string, string> = previous
      ? {}
      : { band_id: id };
    const { snapshot, diff } = createTxBandSettingSnapshot(
      id,
      { ...baseAttributes, ...message.attributes },
      previous,
    );
    txBandSettings.set(id, snapshot);
    return {
      entity: "txBandSetting",
      id,
      diff,
      removed: false,
    };
  }

  function handleClient(message: FlexStatusMessage): RadioStateChange[] {
    const id = resolveIdentifier(message, message.identifier);
    if (!id) {
      return [
        {
          entity: "unknown",
          source: message.source,
          attributes: message.attributes,
        },
      ];
    }

    const action = message.positional[0]?.toLowerCase();
    if (action === "disconnected") {
      const existing = guiClients.get(id);
      if (!existing) {
        return [
          {
            entity: "unknown",
            source: message.source,
            id,
            attributes: message.attributes,
          },
        ];
      }
      guiClients.delete(id);
      guiClientsByHandle.delete(existing.clientHandleInt);
      return [
        {
          entity: "guiClient",
          id,
          removed: true,
        },
        ...recomputeDaxStreamRates(),
      ];
    }

    if (action === "connected") {
      const clientIdAttr = message.attributes.client_id;
      if (!clientIdAttr) {
        return [
          {
            entity: "unknown",
            source: message.source,
            id,
            attributes: message.attributes,
          },
        ];
      }
      const previous = guiClients.get(id);
      const { snapshot, diff } = createGuiClientSnapshot(
        id,
        message.attributes,
        previous,
        { localClientHandle },
      );
      guiClients.set(id, snapshot);
      if (!previous || previous.clientHandleInt !== snapshot.clientHandleInt) {
        if (previous) guiClientsByHandle.delete(previous.clientHandleInt);
        guiClientsByHandle.set(snapshot.clientHandleInt, id);
      }
      const changes: RadioStateChange[] = [
        {
          entity: "guiClient",
          id,
          diff,
          removed: false,
        },
      ];
      const transmitChange = updateGuiClientTransmitSlice(
        snapshot.clientHandleInt,
      );
      if (transmitChange) changes.push(transmitChange);
      changes.push(...recomputeDaxStreamRates());
      return changes;
    }

    return [
      {
        entity: "unknown",
        source: message.source,
        id,
        attributes: message.attributes,
      },
    ];
  }

  function handleDisplay(
    message: FlexStatusMessage,
    streamHint?: string,
  ): RadioStateChange {
    const id = resolveIdentifier(
      message,
      streamHint,
      message.attributes.stream_id,
      message.attributes.stream,
    );
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        id: message.identifier,
        attributes: message.attributes,
      };
    }

    if (message.identifier === "waterfall" || message.attributes.pan) {
      if (isMarkedDeleted(message)) {
        waterfalls.delete(id);
        return {
          entity: "waterfall",
          id,
          removed: true,
        };
      }
      const previous = waterfalls.get(id);
      const attributes = streamHint
        ? { stream_id: streamHint, ...message.attributes }
        : message.attributes;
      const { snapshot, diff } = createWaterfallSnapshot(
        id,
        attributes,
        previous,
      );
      waterfalls.set(id, snapshot);
      return {
        entity: "waterfall",
        id,
        diff,
        removed: false,
      };
    }

    return {
      entity: "unknown",
      source: message.source,
      id,
      attributes: message.attributes,
    };
  }

  function handleMeter(message: FlexStatusMessage): RadioStateChange[] {
    const id = resolveIdentifier(
      message,
      message.identifier,
      message.attributes.num,
    );
    if (!id) {
      return [
        {
          entity: "unknown",
          source: message.source,
          attributes: message.attributes,
        },
      ];
    }

    if (isMarkedDeleted(message)) {
      meters.delete(id);
      return [{ entity: "meter", id, removed: true }];
    }

    const previous = meters.get(id);
    const { snapshot, diff } = createMeterSnapshot(
      id,
      message.attributes,
      previous,
    );
    meters.set(id, snapshot);

    const changes: RadioStateChange[] = [];
    const superseded = findSupersededMeters(id, snapshot);
    for (const supersededId of superseded) {
      meters.delete(supersededId);
      changes.push({ entity: "meter", id: supersededId, removed: true });
    }
    if (!superseded.includes(id)) {
      changes.unshift({ entity: "meter", id, diff, removed: false });
    }
    return changes;
  }

  /**
   * An amplifier or tuner that registers a second meter under a name it
   * already used gets a higher meter number, and the radio streams only the
   * newest. Returns the ids of the older duplicates, which may include `id`
   * itself when a newer one already exists. Slice meters are exempt: every
   * slice has a meter with the same name.
   */
  function findSupersededMeters(id: string, meter: MeterSnapshot): string[] {
    if (
      meter.source.toUpperCase() !== AMPLIFIER_METER_SOURCE ||
      meter.sourceIndex === undefined ||
      !meter.name
    ) {
      return [];
    }
    const superseded: string[] = [];
    for (const [otherId, other] of meters) {
      if (
        otherId === id ||
        other.source.toUpperCase() !== AMPLIFIER_METER_SOURCE ||
        other.sourceIndex !== meter.sourceIndex ||
        other.name !== meter.name
      ) {
        continue;
      }
      if (Number(otherId) > Number(id)) return [id];
      superseded.push(otherId);
    }
    return superseded;
  }

  function handleLicense(
    message: FlexStatusMessage,
  ): RadioStateChange | undefined {
    const update = createFeatureLicenseSnapshot(
      message.attributes,
      { identifier: message.identifier },
      featureLicense,
    );
    if (!update) return undefined;
    featureLicense = update.snapshot;
    return {
      entity: "featureLicense",
      diff: update.diff,
      removed: false,
    };
  }

  function handleAtu(message: FlexStatusMessage): RadioStateChange | undefined {
    return patchRadio(message.attributes, {
      source: message.source,
      identifier: message.identifier,
      positional: message.positional,
    });
  }

  function handleLog(message: FlexStatusMessage): RadioStateChange | undefined {
    return patchRadio(message.attributes, {
      source: message.source,
      identifier: message.identifier,
      positional: message.positional,
    });
  }

  function handleRadio(message: FlexStatusMessage): RadioStateChange {
    const { snapshot, diff } = createRadioSnapshot(message.attributes, radio, {
      source: message.source,
      identifier: message.identifier,
      positional: message.positional,
    });
    radio = snapshot;
    return {
      entity: "radio",
      diff,
      removed: false,
    };
  }

  function handleProfile(
    message: FlexStatusMessage,
  ): RadioStateChange | undefined {
    const context: RadioStatusContext = {
      source: message.source,
      identifier: message.identifier,
      positional: message.positional,
    };
    const { snapshot, diff } = createRadioSnapshot(
      message.attributes,
      radio,
      context,
    );
    radio = snapshot;
    return {
      entity: "radio",
      diff,
      removed: false,
    };
  }

  function updatePanadapterSliceMembership(
    sliceId: string,
    nextPan?: string,
    prevPan?: string,
  ): void {
    if (prevPan && prevPan !== nextPan) {
      const pan = panadapters.get(prevPan);
      if (pan?.attachedSlices.includes(sliceId)) {
        const filtered = pan.attachedSlices.filter(
          (attachedId: string) => attachedId !== sliceId,
        );
        const updated = Object.freeze({
          ...pan,
          attachedSlices: Object.freeze(filtered),
        });
        panadapters.set(prevPan, updated);
      }
    }
    if (!nextPan) return;
    const pan = panadapters.get(nextPan);
    if (!pan) return;
    if (!pan.attachedSlices.includes(sliceId)) {
      const next = {
        ...pan,
        attachedSlices: Object.freeze([...pan.attachedSlices, sliceId]),
      };
      panadapters.set(nextPan, Object.freeze(next));
    }
  }

  function recomputeGuiClientTransmitSlices(
    handles: readonly (number | undefined)[],
  ): RadioStateChange[] {
    const updates: RadioStateChange[] = [];
    const seen = new Set<number>();
    for (const handle of handles) {
      if (handle === undefined || seen.has(handle)) continue;
      seen.add(handle);
      const change = updateGuiClientTransmitSlice(handle);
      if (change) updates.push(change);
    }
    return updates;
  }

  function updateGuiClientTransmitSlice(
    handle: number,
  ): RadioStateChange | undefined {
    const clientId = guiClientsByHandle.get(handle);
    if (!clientId) return undefined;
    const client = guiClients.get(clientId);
    if (!client) return undefined;
    const nextSliceId = findTransmitSliceId(handle);
    if (client.transmitSliceId === nextSliceId) return undefined;
    const updated = Object.freeze({
      ...client,
      transmitSliceId: nextSliceId,
    });
    guiClients.set(clientId, updated);
    return {
      entity: "guiClient",
      id: clientId,
      removed: false,
      diff: Object.freeze({ transmitSliceId: nextSliceId }),
    };
  }

  function findTransmitSliceId(handle: number): string | undefined {
    for (const slice of slices.values()) {
      if (slice.clientHandle === handle && slice.isTransmitEnabled) {
        return slice.id;
      }
    }
    return undefined;
  }

  function detachSlicesFromPanadapter(panId: string): void {
    for (const slice of slices.values()) {
      if (slice.panadapterStreamId === panId) {
        const updated = Object.freeze({
          ...slice,
          panadapterStreamId: undefined,
        });
        slices.set(slice.id, updated);
      }
    }
  }

  function patchSlice(
    id: string,
    attributes: Record<string, string>,
  ): SliceStateChange | undefined {
    const previous = slices.get(id);
    const baseAttributes: Record<string, string> = previous
      ? {}
      : { index: id };
    const { snapshot, diff } = createSliceSnapshot(
      id,
      { ...baseAttributes, ...attributes },
      previous,
    );
    slices.set(id, snapshot);
    updatePanadapterSliceMembership(
      id,
      snapshot.panadapterStreamId,
      previous?.panadapterStreamId,
    );
    return {
      entity: "slice",
      id,
      diff,
      removed: false,
    };
  }

  function patchPanadapter(
    id: string,
    attributes: Record<string, string>,
  ): PanadapterStateChange | undefined {
    const previous = panadapters.get(id);
    const stream = attributes.stream_id ?? previous?.streamId ?? id;
    const { snapshot, diff } = createPanadapterSnapshot(
      id,
      { stream_id: stream, ...attributes },
      previous,
    );
    panadapters.set(id, snapshot);
    return {
      entity: "panadapter",
      id,
      diff,
      removed: false,
    };
  }

  function removePanadapter(
    id: string,
  ): readonly RadioStateChange[] | undefined {
    const previous = panadapters.get(id);
    if (!previous) return undefined;
    panadapters.delete(id);
    waterfalls.delete(previous.waterfallStreamId);
    previous.attachedSlices.forEach(slices.delete);
    const changes: RadioStateChange[] = [
      {
        entity: "panadapter",
        id,
        removed: true,
      },
      {
        entity: "waterfall",
        id: previous.waterfallStreamId,
        removed: true,
      },
      ...previous.attachedSlices.map(
        (id) =>
          ({
            entity: "slice",
            id,
            removed: true,
          }) as RadioStateChange,
      ),
    ];
    return changes;
  }

  function patchWaterfall(
    id: string,
    attributes: Record<string, string>,
  ): WaterfallStateChange | undefined {
    const previous = waterfalls.get(id);
    const stream = attributes.stream_id ?? previous?.streamId ?? id;
    const { snapshot, diff } = createWaterfallSnapshot(
      id,
      { stream_id: stream, ...attributes },
      previous,
    );
    waterfalls.set(id, snapshot);
    return {
      entity: "waterfall",
      id,
      diff,
      removed: false,
    };
  }

  function removeWaterfall(
    id: string,
  ): readonly RadioStateChange[] | undefined {
    const panadapterStreamId = waterfalls.get(id)?.panadapterStreamId;
    return panadapterStreamId
      ? removePanadapter(panadapterStreamId)
      : undefined;
  }

  function patchAudioStream(
    id: string,
    attributes: Record<string, string>,
  ): AudioStreamStateChange | undefined {
    const previous = audioStreams.get(id);
    const typeToken = attributes.type ?? previous?.type;
    const attributePatch: Record<string, string> =
      typeToken && attributes.type === undefined
        ? { ...attributes, type: typeToken }
        : { ...attributes };
    if (attributePatch.stream_id === undefined) {
      attributePatch.stream_id = previous?.streamId ?? id;
    }
    const { snapshot, diff } = withDaxSampleRate(
      createAudioStreamSnapshot(id, attributePatch, previous),
    );
    audioStreams.set(id, snapshot);
    return {
      entity: "audioStream",
      id,
      diff,
      removed: false,
    };
  }

  function setAudioStreamSampleRate(
    id: string,
    sampleRateHz: number,
  ): AudioStreamStateChange | undefined {
    const stream = audioStreams.get(id);
    if (!stream || stream.sampleRateHz === sampleRateHz) return undefined;
    audioStreams.set(id, Object.freeze({ ...stream, sampleRateHz }));
    return {
      entity: "audioStream",
      id,
      removed: false,
      diff: Object.freeze({ sampleRateHz }),
    };
  }

  function followsSliceRate(stream: AudioStreamSnapshot): boolean {
    return stream.type === "dax_rx" || stream.type === "dax_tx";
  }

  function daxSliceOwner(stream: AudioStreamSnapshot): number | undefined {
    if (boundClientId !== undefined) {
      for (const client of guiClients.values()) {
        if (client.clientId === boundClientId) return client.clientHandleInt;
      }
    }
    return stream.clientHandle;
  }

  // DAX RX follows the slice it names; DAX TX follows its owner's transmit
  // slice. Slice letters are per client, so both match on the owner too.
  function daxSampleRate(stream: AudioStreamSnapshot): number {
    const owner = daxSliceOwner(stream);
    if (owner === undefined) return 0;
    for (const slice of slices.values()) {
      if (slice.clientHandle !== owner) continue;
      const followed =
        stream.type === "dax_tx"
          ? slice.isTransmitEnabled
          : slice.indexLetter === stream.slice;
      if (followed) return slice.sampleRateHz;
    }
    return 0;
  }

  function withDaxSampleRate(
    update: SnapshotUpdate<AudioStreamSnapshot>,
  ): Pick<SnapshotUpdate<AudioStreamSnapshot>, "snapshot" | "diff"> {
    const { snapshot, diff } = update;
    if (!followsSliceRate(snapshot)) return { snapshot, diff };
    const sampleRateHz = daxSampleRate(snapshot);
    if (sampleRateHz === snapshot.sampleRateHz) return { snapshot, diff };
    return {
      snapshot: Object.freeze({ ...snapshot, sampleRateHz }),
      diff: Object.freeze({ ...diff, sampleRateHz }),
    };
  }

  function recomputeDaxStreamRates(): RadioStateChange[] {
    const changes: RadioStateChange[] = [];
    for (const id of audioStreams.keys()) {
      const stream = audioStreams.get(id);
      if (!stream || !followsSliceRate(stream)) continue;
      const change = setAudioStreamSampleRate(id, daxSampleRate(stream));
      if (change) changes.push(change);
    }
    return changes;
  }

  function removeAudioStream(id: string): AudioStreamStateChange | undefined {
    if (!audioStreams.has(id)) return undefined;
    audioStreams.delete(id);
    return {
      entity: "audioStream",
      id,
      removed: true,
    };
  }

  function patchEqualizer(
    id: EqualizerId,
    attributes: Record<string, string>,
  ): EqualizerStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = equalizers.get(id);
    const { snapshot, diff } = createEqualizerSnapshot(
      id,
      attributes,
      previous,
    );
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    equalizers.set(id, snapshot);
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "equalizer",
      id,
      diff,
      removed: false,
    };
  }

  function patchTxBandSetting(
    id: string,
    attributes: Record<string, string>,
  ): TxBandSettingStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = txBandSettings.get(id);
    const baseAttributes: Record<string, string> = previous
      ? {}
      : { band_id: id };
    const { snapshot, diff } = createTxBandSettingSnapshot(
      id,
      { ...baseAttributes, ...attributes },
      previous,
    );
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    txBandSettings.set(id, snapshot);
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "txBandSetting",
      id,
      diff,
      removed: false,
    };
  }

  function handleXvtr(message: FlexStatusMessage): RadioStateChange {
    const id = resolveIdentifier(message, message.identifier);
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    if (isMarkedDeleted(message)) {
      xvtrs.delete(id);
      return {
        entity: "xvtr",
        id,
        removed: true,
      };
    }

    const previous = xvtrs.get(id);
    const { snapshot, diff } = createXvtrSnapshot(
      id,
      message.attributes,
      previous,
    );
    xvtrs.set(id, snapshot);
    return {
      entity: "xvtr",
      id,
      diff,
      removed: false,
    };
  }

  function patchXvtr(
    id: string,
    attributes: Record<string, string>,
  ): XvtrStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = xvtrs.get(id);
    const { snapshot, diff } = createXvtrSnapshot(id, attributes, previous);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    xvtrs.set(id, snapshot);
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "xvtr",
      id,
      diff,
      removed: false,
    };
  }

  function removeXvtr(id: string): XvtrStateChange | undefined {
    if (!xvtrs.has(id)) return undefined;
    xvtrs.delete(id);
    return {
      entity: "xvtr",
      id,
      removed: true,
    };
  }

  /** Status for a slice that is gone is ignored, so no state outlives its slice. */
  function liveSliceId(message: FlexStatusMessage): string | undefined {
    const sliceId = message.attributes.slice;
    return sliceId && slices.has(sliceId) ? sliceId : undefined;
  }

  function handleCwDecoder(message: FlexStatusMessage): RadioStateChange[] {
    const sliceId = liveSliceId(message);
    if (!sliceId) return [];
    const previous = cwDecoders.get(sliceId);
    const { snapshot, diff } = createCwDecoderSnapshot(
      sliceId,
      message.attributes,
      previous,
    );
    cwDecoders.set(sliceId, snapshot);
    return [{ entity: "cwDecoder", id: sliceId, diff, removed: false }];
  }

  function handleAutoDx(message: FlexStatusMessage): RadioStateChange[] {
    const sliceId = liveSliceId(message);
    if (!sliceId) return [];
    const previous = autoDxes.get(sliceId);
    const { snapshot, diff } = createAutoDxSnapshot(
      sliceId,
      message.attributes,
      previous,
    );
    autoDxes.set(sliceId, snapshot);
    return [{ entity: "autoDx", id: sliceId, diff, removed: false }];
  }

  function patchAutoDx(
    sliceId: string,
    attributes: Record<string, string>,
  ): AutoDxStateChange | undefined {
    if (!slices.has(sliceId)) return undefined;
    const previous = autoDxes.get(sliceId);
    const { snapshot, diff } = createAutoDxSnapshot(
      sliceId,
      attributes,
      previous,
    );
    autoDxes.set(sliceId, snapshot);
    if (Object.keys(diff as Record<string, unknown>).length === 0) {
      return undefined;
    }
    return { entity: "autoDx", id: sliceId, diff, removed: false };
  }

  function handlePreset(message: FlexStatusMessage): RadioStateChange[] {
    const id = message.attributes.id;
    if (!id) {
      return [
        {
          entity: "unknown",
          source: message.source,
          attributes: message.attributes,
        },
      ];
    }

    if ("removed" in message.attributes) {
      if (!presets.delete(id)) return [];
      return [{ entity: "preset", id, removed: true }];
    }

    if ("applied" in message.attributes) {
      activePresetId = id;
      const changes: RadioStateChange[] = [];
      for (const [presetId, preset] of presets) {
        const active = presetId === id;
        if (preset.active === active) continue;
        const { snapshot, diff } = createPresetSnapshot(
          presetId,
          { active: active ? "1" : "0" },
          preset,
        );
        presets.set(presetId, snapshot);
        changes.push({ entity: "preset", id: presetId, diff, removed: false });
      }
      return changes;
    }

    // A bare "created" carries no fields; the Radio re-subscribes to get them.
    if ("created" in message.attributes) return [];

    const previous = presets.get(id);
    const attributes = previous
      ? message.attributes
      : { ...message.attributes, active: id === activePresetId ? "1" : "0" };
    const { snapshot, diff } = createPresetSnapshot(id, attributes, previous);
    presets.set(id, snapshot);
    return [{ entity: "preset", id, diff, removed: false }];
  }

  function handleNtpSource(message: FlexStatusMessage): RadioStateChange {
    const id = message.attributes.id;
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    if ("removed" in message.attributes) {
      ntpSources.delete(id);
      return { entity: "ntpSource", id, removed: true };
    }

    const previous = ntpSources.get(id);
    const { snapshot, diff } = createNtpSourceSnapshot(
      id,
      message.attributes,
      previous,
    );
    ntpSources.set(id, snapshot);
    return { entity: "ntpSource", id, diff, removed: false };
  }

  function patchNtpSource(
    id: string,
    attributes: Record<string, string>,
  ): NtpSourceStateChange | undefined {
    const previous = ntpSources.get(id);
    if (!previous || Object.keys(attributes).length === 0) return undefined;
    const { snapshot, diff } = createNtpSourceSnapshot(
      id,
      attributes,
      previous,
    );
    ntpSources.set(id, snapshot);
    if (Object.keys(diff as Record<string, unknown>).length === 0) {
      return undefined;
    }
    return { entity: "ntpSource", id, diff, removed: false };
  }

  function handleSpot(
    message: FlexStatusMessage,
  ): RadioStateChange | undefined {
    const id = resolveIdentifier(message, message.identifier);
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    // "spot 42 triggered pan=0x40000000" — transient event, not a state update.
    // The Radio class handles this directly and emits a spotTriggered event.
    if (
      message.positional.some((t) => t === "triggered") ||
      message.identifier === "triggered"
    ) {
      return undefined;
    }

    if (isMarkedDeleted(message)) {
      spots.delete(id);
      return {
        entity: "spot",
        id,
        removed: true,
      };
    }

    const previous = spots.get(id);
    const { snapshot, diff } = createSpotSnapshot(
      id,
      message.attributes,
      previous,
    );
    spots.set(id, snapshot);
    return {
      entity: "spot",
      id,
      diff,
      removed: false,
    };
  }

  function patchSpot(
    id: string,
    attributes: Record<string, string>,
  ): SpotStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = spots.get(id);
    const { snapshot, diff } = createSpotSnapshot(id, attributes, previous);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    spots.set(id, snapshot);
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "spot",
      id,
      diff,
      removed: false,
    };
  }

  function removeSpot(id: string): SpotStateChange | undefined {
    if (!spots.has(id)) return undefined;
    spots.delete(id);
    return {
      entity: "spot",
      id,
      removed: true,
    };
  }

  function handleDisplayMarker(message: FlexStatusMessage): RadioStateChange {
    const identity = resolveDisplayMarkerIdentity(
      message.attributes.group,
      message.attributes.id,
    );
    if (!identity) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }
    const { group, id } = identity;
    const markers = getDisplayMarkerGroup(group);

    if (isMarkedDeleted(message)) {
      markers?.delete(id);
      if (markers?.size === 0) {
        displayMarkers.delete(group);
      }
      return {
        entity: "displayMarker",
        group,
        id,
        removed: true,
      };
    }

    const previous = markers?.get(id);
    const { snapshot, diff } = createDisplayMarkerSnapshot(
      group,
      id,
      message.attributes,
      previous,
    );
    getDisplayMarkerGroup(group, true)?.set(id, snapshot);
    return {
      entity: "displayMarker",
      group,
      id,
      diff,
      removed: false,
    };
  }

  function patchDisplayMarker(
    group: string,
    id: string,
    attributes: Record<string, string>,
  ): DisplayMarkerStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = getDisplayMarkerGroup(group)?.get(id);
    const { snapshot, diff } = createDisplayMarkerSnapshot(
      group,
      id,
      attributes,
      previous,
    );
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    getDisplayMarkerGroup(group, true)?.set(id, snapshot);
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "displayMarker",
      group,
      id,
      diff,
      removed: false,
    };
  }

  function removeDisplayMarker(
    group: string,
    id: string,
  ): DisplayMarkerStateChange | undefined {
    const markers = getDisplayMarkerGroup(group);
    if (!markers?.has(id)) return undefined;
    markers.delete(id);
    if (markers.size === 0) {
      displayMarkers.delete(group);
    }
    return {
      entity: "displayMarker",
      group,
      id,
      removed: true,
    };
  }

  function handleTnf(message: FlexStatusMessage): RadioStateChange {
    const id = resolveIdentifier(message, message.identifier);
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    if (isMarkedDeleted(message)) {
      tnfs.delete(id);
      return {
        entity: "tnf",
        id,
        removed: true,
      };
    }

    const previous = tnfs.get(id);
    const { snapshot, diff } = createTnfSnapshot(
      id,
      message.attributes,
      previous,
    );
    tnfs.set(id, snapshot);
    return {
      entity: "tnf",
      id,
      diff,
      removed: false,
    };
  }

  function patchTnf(
    id: string,
    attributes: Record<string, string>,
  ): TnfStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = tnfs.get(id);
    const { snapshot, diff } = createTnfSnapshot(id, attributes, previous);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    tnfs.set(id, snapshot);
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "tnf",
      id,
      diff,
      removed: false,
    };
  }

  function removeTnf(id: string): TnfStateChange | undefined {
    if (!tnfs.has(id)) return undefined;
    tnfs.delete(id);
    return {
      entity: "tnf",
      id,
      removed: true,
    };
  }

  function handleMemory(message: FlexStatusMessage): RadioStateChange {
    const id = resolveIdentifier(message, message.identifier);
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }
    if (isMarkedDeleted(message)) {
      memories.delete(id);
      return { entity: "memory", id, removed: true };
    }
    const previous = memories.get(id);
    const { snapshot, diff } = createMemorySnapshot(
      id,
      message.attributes,
      previous,
    );
    memories.set(id, snapshot);
    return { entity: "memory", id, diff, removed: false };
  }

  function handleWaveform(message: FlexStatusMessage): RadioStateChange[] {
    if (message.identifier === "container") {
      return handleContainerWaveform(message);
    }

    // Transient event; the Radio reports it directly.
    if (message.identifier === "restarted") return [];

    if ("installed_list" in message.attributes) {
      return replaceLegacyWaveforms(message.raw);
    }

    const radioChange = patchRadio(message.attributes, {
      source: message.source,
      identifier: message.identifier,
      positional: message.positional,
    });
    return radioChange ? [radioChange] : [];
  }

  function handleContainerWaveform(
    message: FlexStatusMessage,
  ): RadioStateChange[] {
    const { name, version } = message.attributes;
    if (!name) {
      return [
        {
          entity: "unknown",
          source: message.source,
          id: message.identifier,
          attributes: message.attributes,
        },
      ];
    }

    const id = createWaveformId(name, version, true);
    const changes: RadioStateChange[] = [];
    const removed = isMarkedDeleted(message);

    if (removed) {
      if (waveforms.delete(id)) {
        changes.push({
          entity: "waveform",
          id,
          removed: true,
        });
      }
    } else {
      const previous = waveforms.get(id);
      const { snapshot, diff } = createWaveformSnapshot(
        id,
        true,
        {
          ...message.attributes,
          name,
          version,
        },
        previous,
      );
      waveforms.set(id, snapshot);
      changes.push({
        entity: "waveform",
        id,
        diff,
        removed: false,
      });
    }

    return changes;
  }

  function replaceLegacyWaveforms(rawMessage: string): RadioStateChange[] {
    const [, installedList] = rawMessage.split("installed_list=");
    const entries = parseLegacyWaveformList(installedList);
    const nextIds = new Set(entries.map((entry) => entry.id));
    const changes: RadioStateChange[] = [];

    for (const [id, snapshot] of waveforms) {
      if (snapshot.isContainer || nextIds.has(id)) continue;
      waveforms.delete(id);
      changes.push({
        entity: "waveform",
        id,
        removed: true,
      });
    }

    for (const entry of entries) {
      const previous = waveforms.get(entry.id);
      const { snapshot, diff } = createWaveformSnapshot(
        entry.id,
        false,
        {
          name: entry.name,
          version: entry.version,
        },
        previous,
      );
      waveforms.set(entry.id, snapshot);
      changes.push({
        entity: "waveform",
        id: entry.id,
        diff,
        removed: false,
      });
    }

    return changes;
  }

  function patchMemory(
    id: string,
    attributes: Record<string, string>,
  ): MemoryStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = memories.get(id);
    const { snapshot, diff } = createMemorySnapshot(id, attributes, previous);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    memories.set(id, snapshot);
    if (diffKeys.length === 0) return undefined;
    return { entity: "memory", id, diff, removed: false };
  }

  function removeMemory(id: string): MemoryStateChange | undefined {
    if (!memories.has(id)) return undefined;
    memories.delete(id);
    return { entity: "memory", id, removed: true };
  }

  function handleCwx(message: FlexStatusMessage): RadioStateChange | undefined {
    const { snapshot, diff } = createCwxSnapshot(message.attributes, cwx);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    cwx = snapshot;
    const progress = parseCwxProgressEvents(message.raw);
    if (diffKeys.length === 0 && progress.length === 0) return undefined;
    return {
      entity: "cwx",
      removed: false,
      diff,
      ...(progress.length > 0 ? { progress } : {}),
    };
  }

  function patchCwx(
    attributes: Record<string, string>,
  ): CwxStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const { snapshot, diff } = createCwxSnapshot(attributes, cwx);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    cwx = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "cwx",
      removed: false,
      diff,
    };
  }

  function handleDvk(message: FlexStatusMessage): RadioStateChange | undefined {
    // Recording lifecycle events use positional tokens ("added"/"deleted")
    // that the protocol parser places in identifier/positional, not attributes.
    const attributes: Record<string, string> = { ...message.attributes };
    const allTokens = [message.identifier, ...message.positional].map((t) =>
      t?.toLowerCase(),
    );
    if (allTokens.includes("added")) attributes.added = "";
    if (allTokens.includes("deleted")) attributes.deleted = "";
    const { snapshot, diff } = createDvkSnapshot(attributes, dvk);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    dvk = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "dvk",
      removed: false,
      diff,
    };
  }

  function patchDvk(
    attributes: Record<string, string>,
  ): DvkStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const { snapshot, diff } = createDvkSnapshot(attributes, dvk);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    dvk = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "dvk",
      removed: false,
      diff,
    };
  }

  function patchApd(
    attributes: Record<string, string>,
  ): ApdStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const { snapshot, diff } = createApdSnapshot(attributes, apd);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    apd = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "apd",
      removed: false,
      diff,
    };
  }

  function handleFilterPreset(
    message: FlexStatusMessage,
  ): FilterPresetStateChange | undefined {
    const modeGroup = parseFilterPresetModeGroup(message.identifier);
    const index = parseInteger(message.positional[0]);
    if (
      !modeGroup ||
      index === undefined ||
      index < 0 ||
      index >= FILTER_PRESET_COUNT
    ) {
      return undefined;
    }
    const { snapshot, diff } = createFilterPresetSnapshot(
      modeGroup,
      index,
      message.attributes,
      filterPresets,
    );
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    filterPresets = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "filterPreset",
      removed: false,
      diff,
    };
  }

  function patchFilterPreset(
    modeGroup: FilterPresetModeGroup,
    index: number,
    attributes: Record<string, string>,
  ): FilterPresetStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const { snapshot, diff } = createFilterPresetSnapshot(
      modeGroup,
      index,
      attributes,
      filterPresets,
    );
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    filterPresets = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "filterPreset",
      removed: false,
      diff,
    };
  }

  function updateLocalClientHandle(
    handle: string | number | undefined,
  ): RadioStateChange[] {
    const normalized =
      typeof handle === "number"
        ? Number.isFinite(handle)
          ? handle
          : undefined
        : typeof handle === "string"
          ? parseIntegerHex(handle)
          : undefined;
    if (normalized === localClientHandle) return [];
    localClientHandle = normalized;
    const changes: RadioStateChange[] = [];
    for (const [id, client] of guiClients) {
      const isThisClient =
        normalized !== undefined && client.clientHandleInt === normalized;
      if (client.isThisClient === isThisClient) continue;
      const updated = Object.freeze({
        ...client,
        isThisClient,
      });
      guiClients.set(id, updated);
      changes.push({
        entity: "guiClient",
        id,
        removed: false,
        diff: Object.freeze({ isThisClient }),
      });
    }
    return changes;
  }

  function applyPanadapterRfGainInfo(
    id: string,
    info: RfGainInfo,
  ): PanadapterStateChange | undefined {
    if (!panadapters.has(id)) return undefined;
    const attributes: Record<string, string> = {
      rf_gain_low: info.low.toString(10),
      rf_gain_high: info.high.toString(10),
      rf_gain_step: info.step.toString(10),
      rf_gain_markers: info.markers.join(","),
    };
    return patchPanadapter(id, attributes);
  }

  function applyWaterfallRfGainInfo(
    id: string,
    info: RfGainInfo,
  ): WaterfallStateChange | undefined {
    if (!waterfalls.has(id)) return undefined;
    const attributes: Record<string, string> = {
      rf_gain_low: info.low.toString(10),
      rf_gain_high: info.high.toString(10),
      rf_gain_step: info.step.toString(10),
      rf_gain_markers: info.markers.join(","),
    };
    return patchWaterfall(id, attributes);
  }
}

function resolveIdentifier(
  message: FlexStatusMessage,
  ...fallbacks: Array<string | undefined>
): string | undefined {
  for (const candidate of fallbacks) {
    if (candidate && candidate !== "") return candidate;
  }
  if (message.identifier && message.identifier !== "")
    return message.identifier;
  if (message.positional.length > 0 && message.positional[0] !== "")
    return message.positional[0];
  return undefined;
}

function resolveEqualizerId(
  identifier?: string,
  positional?: readonly string[],
): EqualizerId | undefined {
  const token = identifier ?? positional?.[0];
  if (!token) return undefined;
  const normalized = token.trim().toLowerCase();
  if (normalized === "rxsc") return "rx";
  if (normalized === "txsc") return "tx";
  return undefined;
}

function resolveDisplayMarkerIdentity(
  group: string | undefined,
  markerId: string | undefined,
): { group: string; id: string } | undefined {
  const normalizedGroup = group?.trim();
  const parsedId = parseInteger(markerId);
  if (!normalizedGroup || parsedId === undefined) return undefined;
  return {
    group: normalizedGroup,
    id: parsedId.toString(10),
  };
}

function isMarkedDeleted(message: FlexStatusMessage): boolean {
  return (
    message.positional.includes("removed") ||
    // sometimes "removed" is at the end of a status like this
    // "waveform container name=freedv-flex version=2.3.0 removed"
    // which causes it to be in attributes instead of positional
    "removed" in message.attributes ||
    // at least slice and xvrt statuses do this, maybe others
    message.attributes.in_use === "0"
  );
}
