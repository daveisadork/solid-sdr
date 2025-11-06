import type { FlexStatusMessage } from "./protocol.js";
import type { RfGainInfo } from "./rf-gain.js";

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
  readonly lineDurationMs?: number;
  readonly blackLevel: number;
  readonly colorGain: number;
  readonly autoBlackLevelEnabled: boolean;
  readonly gradientIndex: number;
  readonly clientHandle: number;
  readonly xvtr: string;
  readonly raw: Readonly<Record<string, string>>;
}

export type KnownMeterUnits =
  | "none"
  | "Volts"
  | "Amps"
  | "dB"
  | "dBm"
  | "dBFS"
  | "RPM"
  | "degF"
  | "degC"
  | "SWR"
  | "Watts"
  | "Percent";

export type MeterUnits = KnownMeterUnits | (string & {});

export const KNOWN_METER_UNITS: readonly KnownMeterUnits[] = Object.freeze([
  "none",
  "Volts",
  "Amps",
  "dB",
  "dBm",
  "dBFS",
  "RPM",
  "degF",
  "degC",
  "SWR",
  "Watts",
  "Percent",
]);

export interface MeterSnapshot {
  readonly id: string;
  readonly source: string;
  readonly sourceIndex: number;
  readonly name: string;
  readonly description: string;
  readonly units: MeterUnits;
  readonly low: number;
  readonly high: number;
  readonly fps: number;
  readonly raw: Readonly<Record<string, string>>;
}

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
  readonly gpsLatitude?: string;
  readonly gpsLongitude?: string;
  readonly gpsGrid?: string;
  readonly gpsAltitude?: string;
  readonly gpsSatellitesTracked?: string;
  readonly gpsSatellitesVisible?: string;
  readonly gpsSpeed?: string;
  readonly gpsFreqError?: string;
  readonly gpsStatus?: string;
  readonly gpsUtcTime?: string;
  readonly gpsTrack?: string;
  readonly gpsGnssPoweredAntenna?: boolean;
  readonly raw: Readonly<Record<string, string>>;
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer U>
    ? U[]
    : T[P] extends Readonly<Record<string, infer V>>
      ? Record<string, V>
      : T[P];
};

type MutableProps<T> = {
  -readonly [P in keyof T]: T[P];
};

export type SnapshotDiff<TSnapshot> = Readonly<
  MutableProps<Partial<Omit<TSnapshot, "raw">>>
>;

interface SnapshotUpdate<TSnapshot> {
  readonly snapshot: TSnapshot;
  readonly diff: SnapshotDiff<TSnapshot>;
  readonly rawDiff: Readonly<Record<string, string>>;
}

type ChangeMetadata<TSnapshot> = {
  readonly snapshot?: TSnapshot;
  readonly previous?: TSnapshot;
  readonly diff?: SnapshotDiff<TSnapshot>;
  readonly rawDiff?: Readonly<Record<string, string>>;
};

type RequiredSnapshotChange<TSnapshot> = {
  readonly snapshot: TSnapshot;
  readonly previous?: TSnapshot;
  readonly diff: SnapshotDiff<TSnapshot>;
  readonly rawDiff: Readonly<Record<string, string>>;
};

export type RadioStateChange =
  | ({ entity: "slice"; id: string } & ChangeMetadata<SliceSnapshot>)
  | ({ entity: "panadapter"; id: string } & ChangeMetadata<PanadapterSnapshot>)
  | ({ entity: "waterfall"; id: string } & ChangeMetadata<WaterfallSnapshot>)
  | ({ entity: "meter"; id: string } & ChangeMetadata<MeterSnapshot>)
  | ({ entity: "radio" } & RequiredSnapshotChange<RadioProperties>)
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

export interface RadioStateSnapshot {
  readonly slices: readonly SliceSnapshot[];
  readonly panadapters: readonly PanadapterSnapshot[];
  readonly waterfalls: readonly WaterfallSnapshot[];
  readonly meters: readonly MeterSnapshot[];
  readonly radio?: RadioProperties;
}

export interface RadioStateStore {
  apply(message: FlexStatusMessage): RadioStateChange[];
  snapshot(): RadioStateSnapshot;
  getSlice(id: string): SliceSnapshot | undefined;
  getPanadapter(id: string): PanadapterSnapshot | undefined;
  getWaterfall(id: string): WaterfallSnapshot | undefined;
  getMeter(id: string): MeterSnapshot | undefined;
  getRadio(): RadioProperties | undefined;
  patchSlice(
    id: string,
    attributes: Record<string, string>,
  ): SliceStateChange | undefined;
  patchPanadapter(
    id: string,
    attributes: Record<string, string>,
  ): PanadapterStateChange | undefined;
  patchWaterfall(
    id: string,
    attributes: Record<string, string>,
  ): WaterfallStateChange | undefined;
  applyPanadapterRfGainInfo(
    id: string,
    info: RfGainInfo,
  ): PanadapterStateChange | undefined;
  applyWaterfallRfGainInfo(
    id: string,
    info: RfGainInfo,
  ): WaterfallStateChange | undefined;
}

export function createRadioStateStore(): RadioStateStore {
  const slices = new Map<string, SliceSnapshot>();
  const panadapters = new Map<string, PanadapterSnapshot>();
  const waterfalls = new Map<string, WaterfallSnapshot>();
  const meters = new Map<string, MeterSnapshot>();
  let radio: RadioProperties | undefined;

  return {
    apply(message) {
      switch (message.source) {
        case "slice":
          return [handleSlice(message)];
        case "pan":
          return [handlePanadapter(message)];
        case "meter":
          return [handleMeter(message)];
        case "radio":
        case "gps":
          return [handleRadio(message)];
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
        radio,
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
    getRadio() {
      return radio;
    },
    patchSlice(id, attributes) {
      return patchSlice(id, attributes);
    },
    patchPanadapter(id, attributes) {
      return patchPanadapter(id, attributes);
    },
    patchWaterfall(id, attributes) {
      return patchWaterfall(id, attributes);
    },
    applyPanadapterRfGainInfo(id, info) {
      return applyPanadapterRfGainInfo(id, info);
    },
    applyWaterfallRfGainInfo(id, info) {
      return applyWaterfallRfGainInfo(id, info);
    },
  };

  function handleSlice(message: FlexStatusMessage): RadioStateChange {
    const id = resolveIdentifier(message, message.attributes["index"]);
    if (!id) {
      return {
        entity: "unknown",
        source: message.source,
        attributes: message.attributes,
      };
    }

    if (isMarkedDeleted(message.attributes)) {
      const previous = slices.get(id);
      slices.delete(id);
      updatePanadapterSliceMembership(
        id,
        undefined,
        previous?.panadapterStreamId,
      );
      return {
        entity: "slice",
        id,
        previous,
        snapshot: undefined,
        rawDiff: freezeAttributes(message.attributes),
      };
    }

    const previous = slices.get(id);
    const { snapshot, diff, rawDiff } = createSliceSnapshot(
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
    return {
      entity: "slice",
      id,
      previous,
      snapshot,
      diff,
      rawDiff,
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

    if (isMarkedDeleted(message.attributes)) {
      const previous = panadapters.get(id);
      panadapters.delete(id);
      detachSlicesFromPanadapter(id);
      return {
        entity: "panadapter",
        id,
        previous,
        snapshot: undefined,
        rawDiff: freezeAttributes(message.attributes),
      };
    }

    const previous = panadapters.get(id);
    const { snapshot, diff, rawDiff } = createPanadapterSnapshot(
      id,
      message.attributes,
      previous,
    );
    panadapters.set(id, snapshot);
    return {
      entity: "panadapter",
      id,
      previous,
      snapshot,
      diff,
      rawDiff,
    };
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
      if (isMarkedDeleted(message.attributes)) {
        const previous = waterfalls.get(id);
        waterfalls.delete(id);
        return {
          entity: "waterfall",
          id,
          previous,
          snapshot: undefined,
          rawDiff: freezeAttributes(message.attributes),
        };
      }
      const previous = waterfalls.get(id);
      const attributes = streamHint
        ? { stream_id: streamHint, ...message.attributes }
        : message.attributes;
      const { snapshot, diff, rawDiff } = createWaterfallSnapshot(
        id,
        attributes,
        previous,
      );
      waterfalls.set(id, snapshot);
      return {
        entity: "waterfall",
        id,
        previous,
        snapshot,
        diff,
        rawDiff,
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

    if (isMarkedDeleted(message.attributes)) {
      const previous = meters.get(id);
      meters.delete(id);
      return {
        entity: "meter",
        id,
        previous,
        snapshot: undefined,
        rawDiff: freezeAttributes(message.attributes),
      };
    }

    const previous = meters.get(id);
    const { snapshot, diff, rawDiff } = createMeterSnapshot(
      id,
      message.attributes,
      previous,
    );
    meters.set(id, snapshot);
    return {
      entity: "meter",
      id,
      previous,
      snapshot,
      diff,
      rawDiff,
    };
  }

  function handleRadio(message: FlexStatusMessage): RadioStateChange {
    const previous = radio;
    const { snapshot, diff, rawDiff } = createRadioProperties(
      message.attributes,
      radio,
      message.source,
    );
    radio = snapshot;
    return {
      entity: "radio",
      snapshot,
      previous,
      diff,
      rawDiff,
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
        const filtered = pan.attachedSlices.filter((id) => id !== sliceId);
        const updated = Object.freeze({
          ...pan,
          attachedSlices: freezeArray(filtered),
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
        attachedSlices: freezeArray([...pan.attachedSlices, sliceId]),
      };
      panadapters.set(nextPan, Object.freeze(next));
    }
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
    const { snapshot, diff, rawDiff } = createSliceSnapshot(
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
      previous,
      snapshot,
      diff,
      rawDiff,
    };
  }

  function patchPanadapter(
    id: string,
    attributes: Record<string, string>,
  ): PanadapterStateChange | undefined {
    const previous = panadapters.get(id);
    const stream = attributes["stream_id"] ?? previous?.streamId ?? id;
    const { snapshot, diff, rawDiff } = createPanadapterSnapshot(
      id,
      { stream_id: stream, ...attributes },
      previous,
    );
    panadapters.set(id, snapshot);
    return {
      entity: "panadapter",
      id,
      previous,
      snapshot,
      diff,
      rawDiff,
    };
  }

  function patchWaterfall(
    id: string,
    attributes: Record<string, string>,
  ): WaterfallStateChange | undefined {
    const previous = waterfalls.get(id);
    const stream = attributes["stream_id"] ?? previous?.streamId ?? id;
    const { snapshot, diff, rawDiff } = createWaterfallSnapshot(
      id,
      { stream_id: stream, ...attributes },
      previous,
    );
    waterfalls.set(id, snapshot);
    return {
      entity: "waterfall",
      id,
      previous,
      snapshot,
      diff,
      rawDiff,
    };
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

function isMarkedDeleted(attributes: Record<string, string>): boolean {
  if ("removed" in attributes) return isTruthy(attributes["removed"]);
  if ("in_use" in attributes) return !isTruthy(attributes["in_use"]);
  if ("deleted" in attributes) return isTruthy(attributes["deleted"]);
  return false;
}

function createSliceSnapshot(
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

function createPanadapterSnapshot(
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
          partial.rfGainMarkers = Object.freeze(parsed);
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
          partial.rxAntennas = Object.freeze(parsed);
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

function createWaterfallSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: WaterfallSnapshot,
): SnapshotUpdate<WaterfallSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: MutableProps<Partial<WaterfallSnapshot>> = {};

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "stream_id":
      case "stream":
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
          partial.rfGainMarkers = Object.freeze(parsed);
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
        if (parsed !== undefined) partial.lineDurationMs = parsed;
        else logParseError("waterfall", key, value);
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

function createMeterSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: MeterSnapshot,
): SnapshotUpdate<MeterSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<MeterSnapshot>> = {};

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "src":
        partial.source = value;
        break;
      case "num": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.sourceIndex = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "nam":
        partial.name = value || partial.name || id;
        break;
      case "desc":
        partial.description = value;
        break;
      case "unit":
        partial.units = parseMeterUnits(value, partial.units);
        break;
      case "low": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.low = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "hi": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.high = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "fps": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.fps = parsed;
        else logParseError("meter", key, value);
        break;
      }
      default:
        logUnknownAttribute("meter", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as MeterSnapshot;
  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

function parseMeterUnits(
  value: string | undefined,
  fallback?: MeterUnits,
): MeterUnits {
  if (!value) return fallback ?? "none";
  const trimmed = value.trim();
  if (trimmed === "") return fallback ?? "none";
  const normalized = trimmed.toLowerCase() === "none" ? "none" : trimmed;
  const known = KNOWN_METER_UNITS.find((unit) => unit === normalized);
  if (known) return known;
  return normalized as MeterUnits;
}

function createRadioProperties(
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
      case "lat":
        partial.gpsLatitude = value;
        break;
      case "lon":
        partial.gpsLongitude = value;
        break;
      case "grid":
        partial.gpsGrid = value;
        break;
      case "altitude":
        partial.gpsAltitude = value;
        break;
      case "tracked":
      case "satellites_tracked":
        partial.gpsSatellitesTracked = value;
        break;
      case "visible":
      case "satellites_visible":
        partial.gpsSatellitesVisible = value;
        break;
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
      case "track":
        partial.gpsTrack = value;
        break;
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

function parseMegahertz(value: string | undefined): number | undefined {
  const mhz = parseFloatSafe(value);
  if (mhz === undefined) return undefined;
  return mhz;
}

function parseFloatSafe(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseIntegerMaybeHex(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().toLowerCase();
  const parsed = trimmed.startsWith("0x")
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseIntegerList(value: string | undefined): number[] | undefined {
  if (!value) return undefined;
  const result: number[] = [];
  for (const token of value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    const parsed = Number.parseInt(token, 10);
    if (!Number.isFinite(parsed)) return undefined;
    result.push(parsed);
  }
  return result;
}

function freezeArray<T>(
  input: readonly T[],
  previous?: readonly T[],
): readonly T[] {
  if (previous && arraysShallowEqual(previous, input)) {
    return previous;
  }
  if (!Object.isFrozen(input)) {
    Object.freeze(input as T[]);
  }
  return input;
}

const EMPTY_ATTRIBUTES: Readonly<Record<string, string>> = Object.freeze({});

function createDefaultRadioProperties(): RadioProperties {
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

function freezeAttributes(
  attributes: Record<string, string>,
): Readonly<Record<string, string>> {
  if (Object.keys(attributes).length === 0) {
    return EMPTY_ATTRIBUTES;
  }
  return Object.freeze({ ...attributes });
}

function arraysShallowEqual<T>(
  previous: readonly T[] | undefined,
  next: readonly T[],
): boolean {
  if (!previous) return false;
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index] !== next[index]) return false;
  }
  return true;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "on" ||
    normalized === "yes"
  );
}

function logUnknownAttribute(entity: string, key: string, value: string): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(
      `[radio-state] Unhandled ${entity} attribute`,
      `${key}=${value}`,
    );
  }
}

function logParseError(entity: string, key: string, value: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `[radio-state] Failed to parse ${entity} attribute`,
      `${key}=${value}`,
    );
  }
}
