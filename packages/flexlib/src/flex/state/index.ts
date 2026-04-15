import type { FlexStatusMessage } from "../protocol.js";
import type { RfGainInfo } from "../rf-gain.js";
import type { Logger } from "../adapters.js";
import { isTruthy, parseIntegerHex, setRadioStateLogger } from "./common.js";
import type { SnapshotDiff } from "./common.js";
import {
  AUDIO_STREAM_TYPES,
  createAudioStreamSnapshot,
} from "./audio-stream.js";
import type { AudioStreamKind, AudioStreamSnapshot } from "./audio-stream.js";
import {
  createFeatureLicenseSnapshot,
  type FeatureLicenseSnapshot,
} from "./feature-license.js";
import { createApdSnapshot, type ApdSnapshot } from "./apd.js";
import {
  createEqualizerSnapshot,
  type EqualizerId,
  type EqualizerSnapshot,
} from "./equalizer.js";
import { createMeterSnapshot, type MeterSnapshot } from "./meter.js";
import {
  createPanadapterSnapshot,
  type PanadapterSnapshot,
} from "./panadapter.js";
import {
  createRadioSnapshot,
  type RadioSnapshot,
  type RadioStatusContext,
} from "./radio.js";
import { createSliceSnapshot, type SliceSnapshot } from "./slice.js";
import {
  createWaterfallSnapshot,
  type WaterfallSnapshot,
} from "./waterfall.js";
import {
  createGuiClientSnapshot,
  type GuiClientSnapshot,
} from "./gui-client.js";
import {
  createTxBandSettingSnapshot,
  type TxBandSettingSnapshot,
} from "./tx-band-settings.js";
import { createXvtrSnapshot, type XvtrSnapshot } from "./xvtr.js";
import { createSpotSnapshot, type SpotSnapshot } from "./spot.js";
import { createCwxSnapshot, type CwxSnapshot } from "./cwx.js";
import { createDvkSnapshot, type DvkSnapshot } from "./dvk.js";

export type { SnapshotDiff } from "./common.js";
export type { SliceSnapshot } from "./slice.js";
export type { PanadapterSnapshot } from "./panadapter.js";
export type { WaterfallSnapshot } from "./waterfall.js";
export type { AudioStreamKind, AudioStreamSnapshot } from "./audio-stream.js";
export type { FeatureLicenseSnapshot } from "./feature-license.js";
export type { ApdSnapshot } from "./apd.js";
export type { EqualizerSnapshot, EqualizerId } from "./equalizer.js";
export type { KnownMeterUnits, MeterSnapshot, MeterUnits } from "./meter.js";
export type { TxBandSettingSnapshot } from "./tx-band-settings.js";
export type { XvtrSnapshot } from "./xvtr.js";
export type { SpotSnapshot } from "./spot.js";
export type { CwxSnapshot } from "./cwx.js";
export type { DvkSnapshot, DvkRecording, DvkStatus } from "./dvk.js";
export type {
  RadioAtuTuneStatus,
  RadioFilterSharpnessMode,
  RadioOscillatorSetting,
  RadioScreensaverMode,
  RadioLogModule,
  RadioInterlockState,
  RadioInterlockReason,
  RadioPttSource,
  RadioCwIambicMode,
  RadioSnapshot as RadioSnapshot,
  RadioStatusContext,
} from "./radio.js";
export { KNOWN_METER_UNITS } from "./meter.js";
export type { GuiClientSnapshot } from "./gui-client.js";

type ChangeMetadata<TSnapshot> = {
  readonly diff?: SnapshotDiff<TSnapshot>;
  readonly removed: boolean;
};

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
  | ({ entity: "spot"; id: string } & ChangeMetadata<SpotSnapshot>)
  | ({ entity: "radio" } & ChangeMetadata<RadioSnapshot>)
  | ({ entity: "featureLicense" } & ChangeMetadata<FeatureLicenseSnapshot>)
  | ({ entity: "apd" } & ChangeMetadata<ApdSnapshot>)
  | ({ entity: "cwx" } & ChangeMetadata<CwxSnapshot>)
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
export type SpotStateChange = Extract<RadioStateChange, { entity: "spot" }>;
export type CwxStateChange = Extract<RadioStateChange, { entity: "cwx" }>;
export type DvkStateChange = Extract<RadioStateChange, { entity: "dvk" }>;

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
  readonly spots: readonly SpotSnapshot[];
  readonly radio: RadioSnapshot;
  readonly featureLicense?: FeatureLicenseSnapshot;
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
  getXvtr(id: string): XvtrSnapshot | undefined;
  getXvtrs(): readonly XvtrSnapshot[];
  getSpot(id: string): SpotSnapshot | undefined;
  getSpots(): readonly SpotSnapshot[];
  getApd(): ApdSnapshot | undefined;
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
  patchCwx(attributes: Record<string, string>): CwxStateChange | undefined;
  patchDvk(attributes: Record<string, string>): DvkStateChange | undefined;
  patchApd(attributes: Record<string, string>): ApdStateChange | undefined;
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
}

export interface RadioStateStoreOptions {
  readonly logger?: Pick<Logger, "debug" | "warn">;
}

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
  const spots = new Map<string, SpotSnapshot>();
  let radio: RadioSnapshot;
  let featureLicense: FeatureLicenseSnapshot | undefined;
  let apd: ApdSnapshot | undefined;
  let cwx: CwxSnapshot | undefined;
  let dvk: DvkSnapshot | undefined;
  let localClientHandle: number | undefined;

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
    spots.clear();
    radio = undefined as unknown as RadioSnapshot;
    featureLicense = undefined;
    apd = undefined;
    cwx = undefined;
    dvk = undefined;
    localClientHandle = undefined;
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
          return [handleMeter(message)];
        case "radio":
        case "gps":
          return [handleRadio(message)];
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
        case "spot": {
          const spotChange = handleSpot(message);
          if (spotChange) return [spotChange];
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
          return [handleRadio(message)];
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
        spots: Array.from(spots.values()),
        radio,
        featureLicense,
        apd,
        cwx,
        dvk,
      };
    },
    getSlice(id) {
      return slices.get(id);
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
    getApd() {
      return apd;
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
    patchCwx(attributes) {
      return patchCwx(attributes);
    },
    patchDvk(attributes) {
      return patchDvk(attributes);
    },
    patchApd(attributes) {
      return patchApd(attributes);
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
    const id = resolveIdentifier(message, message.attributes["index"]);
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
    changes.push(...recomputeGuiClientTransmitSlices([previous.clientHandle]));
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
      attributes["equalizer_reset"] = "";
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
    const parsed = parseIntegerHex(attributes["client_handle"]);
    return parsed ? localClientHandle === parsed : true;
  }

  function patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): RadioStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
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
      message.attributes["stream_id"],
      message.attributes["stream"],
      message.attributes["client_handle"],
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
      message.attributes["stream_id"],
      message.attributes["stream"],
    );
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    const removed =
      message.positional.some(
        (token) => token === "removed" || token === "deleted",
      ) || isMarkedDeleted(message);
    if (removed) {
      audioStreams.delete(id);
      return {
        entity: "audioStream",
        id,
        removed: true,
      };
    }

    const existing = audioStreams.get(id);
    const typeToken = message.attributes["type"] ?? existing?.type;
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
    if (typeToken && attributePatch["type"] === undefined) {
      attributePatch["type"] = typeToken;
    }
    if (attributePatch["stream_id"] === undefined && id) {
      attributePatch["stream_id"] = id;
    }
    const { snapshot, diff } = createAudioStreamSnapshot(
      id,
      attributePatch,
      previous,
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
      message.attributes["band_id"] ??
      message.attributes["id"];
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
      guiClientsByHandle.delete(existing.clientHandle);
      return [
        {
          entity: "guiClient",
          id,
          removed: true,
        },
      ];
    }

    if (action === "connected") {
      const clientIdAttr = message.attributes["client_id"]?.trim();
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
      if (!previous || previous.clientHandle !== snapshot.clientHandle) {
        if (previous) guiClientsByHandle.delete(previous.clientHandle);
        guiClientsByHandle.set(snapshot.clientHandle, id);
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
        snapshot.clientHandle,
      );
      if (transmitChange) changes.push(transmitChange);
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
      message.attributes["stream_id"],
      message.attributes["stream"],
    );
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        id: message.identifier,
        attributes: message.attributes,
      };
    }

    if (message.identifier === "waterfall" || message.attributes["pan"]) {
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

  function handleMeter(message: FlexStatusMessage): RadioStateChange {
    const id = resolveIdentifier(
      message,
      message.identifier,
      message.attributes["num"],
    );
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    if (isMarkedDeleted(message)) {
      meters.delete(id);
      return {
        entity: "meter",
        id,
        removed: true,
      };
    }

    const previous = meters.get(id);
    const { snapshot, diff } = createMeterSnapshot(
      id,
      message.attributes,
      previous,
    );
    meters.set(id, snapshot);
    return {
      entity: "meter",
      id,
      diff,
      removed: false,
    };
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
      if (pan && pan.attachedSlices.includes(sliceId)) {
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
    const stream = attributes["stream_id"] ?? previous?.streamId ?? id;
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
    const stream = attributes["stream_id"] ?? previous?.streamId ?? id;
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
    const typeToken = attributes["type"] ?? previous?.type;
    const attributePatch: Record<string, string> =
      typeToken && attributes["type"] === undefined
        ? { ...attributes, type: typeToken }
        : { ...attributes };
    if (attributePatch["stream_id"] === undefined) {
      attributePatch["stream_id"] = previous?.streamId ?? id;
    }
    const { snapshot, diff } = createAudioStreamSnapshot(
      id,
      attributePatch,
      previous,
    );
    audioStreams.set(id, snapshot);
    return {
      entity: "audioStream",
      id,
      diff,
      removed: false,
    };
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

  function handleCwx(message: FlexStatusMessage): RadioStateChange | undefined {
    const { snapshot, diff } = createCwxSnapshot(message.attributes, cwx);
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    cwx = snapshot;
    if (diffKeys.length === 0) return undefined;
    return {
      entity: "cwx",
      removed: false,
      diff,
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
    if (allTokens.includes("added")) attributes["added"] = "";
    if (allTokens.includes("deleted")) attributes["deleted"] = "";
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
        normalized !== undefined && client.clientHandle === normalized;
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

function isMarkedDeleted(message: FlexStatusMessage): boolean {
  return (
    message.positional.includes("removed") ||
    message.positional.includes("deleted") ||
    isTruthy(message.attributes.removed) ||
    isTruthy(message.attributes.deleted) ||
    ("in_use" in message.attributes && !isTruthy(message.attributes.in_use))
  );
}
