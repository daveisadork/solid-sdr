import type { FlexStatusMessage } from "./protocol.js";

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
  readonly raw: Readonly<Record<string, string>>;
}

export type RadioStateChange =
  | {
      entity: "slice";
      id: string;
      snapshot?: SliceSnapshot;
      previous?: SliceSnapshot;
    }
  | {
      entity: "panadapter";
      id: string;
      snapshot?: PanadapterSnapshot;
      previous?: PanadapterSnapshot;
    }
  | {
      entity: "waterfall";
      id: string;
      snapshot?: WaterfallSnapshot;
      previous?: WaterfallSnapshot;
    }
  | {
      entity: "meter";
      id: string;
      snapshot?: MeterSnapshot;
      previous?: MeterSnapshot;
    }
  | { entity: "radio"; snapshot: RadioProperties; previous?: RadioProperties }
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

type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer U>
    ? U[]
    : T[P] extends Readonly<Record<string, infer V>>
      ? Record<string, V>
      : T[P];
};

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
}

export function createRadioStateStore(): RadioStateStore {
  const slices = new Map<string, SliceSnapshot>();
  const panadapters = new Map<string, PanadapterSnapshot>();
  const waterfalls = new Map<string, WaterfallSnapshot>();
  const meters = new Map<string, MeterSnapshot>();
  let radio: RadioProperties | undefined;

  return {
    apply(message) {
      const source = message.source;
      if (source === "slice") return [handleSlice(message)];
      if (source === "pan") return [handlePanadapter(message)];
      if (source === "display") {
        if (message.identifier === "pan") {
          const streamHint = message.positional[0];
          return [handlePanadapter(message, streamHint)];
        }
        if (message.identifier === "waterfall") {
          const streamHint = message.positional[0];
          return [handleDisplay(message, streamHint)];
        }
        return [
          {
            entity: "unknown",
            source,
            id: message.identifier,
            attributes: message.attributes,
          },
        ];
      }
      if (source === "meter") return [handleMeter(message)];
      if (source === "radio") return [handleRadio(message)];
      return [
        {
          entity: "unknown",
          source,
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
      };
    }

    const previous = slices.get(id);
    const snapshot = createSliceSnapshot(id, message.attributes, previous);
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
      };
    }

    const previous = panadapters.get(id);
    const snapshot = createPanadapterSnapshot(id, message.attributes, previous);
    panadapters.set(id, snapshot);
    return {
      entity: "panadapter",
      id,
      previous,
      snapshot,
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
        };
      }
      const previous = waterfalls.get(id);
      const attributes = streamHint
        ? { stream_id: streamHint, ...message.attributes }
        : message.attributes;
      const waterfall = createWaterfallSnapshot(id, attributes, previous);
      waterfalls.set(id, waterfall);
      return {
        entity: "waterfall",
        id,
        previous,
        snapshot: waterfall,
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
      };
    }

    const previous = meters.get(id);
    const snapshot = createMeterSnapshot(id, message.attributes, previous);
    meters.set(id, snapshot);
    return {
      entity: "meter",
      id,
      previous,
      snapshot,
    };
  }

  function handleRadio(message: FlexStatusMessage): RadioStateChange {
    const snapshot = createRadioProperties(message.attributes, radio);
    const previous = radio;
    radio = snapshot;
    return {
      entity: "radio",
      snapshot,
      previous,
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
    const snapshot = createSliceSnapshot(
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
    };
  }

  function patchPanadapter(
    id: string,
    attributes: Record<string, string>,
  ): PanadapterStateChange | undefined {
    const previous = panadapters.get(id);
    const stream = attributes["stream_id"] ?? previous?.streamId ?? id;
    const snapshot = createPanadapterSnapshot(
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
    };
  }

  function patchWaterfall(
    id: string,
    attributes: Record<string, string>,
  ): WaterfallStateChange | undefined {
    const previous = waterfalls.get(id);
    const stream = attributes["stream_id"] ?? previous?.streamId ?? id;
    const snapshot = createWaterfallSnapshot(
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
    };
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
): SliceSnapshot {
  const raw: Record<string, string> = previous ? { ...previous.raw } : {};
  const next: Mutable<SliceSnapshot> = previous
    ? {
        ...previous,
        tuneStepListHz: Array.from(previous.tuneStepListHz),
        meterIds: Array.from(previous.meterIds),
        availableRxAntennas: Array.from(previous.availableRxAntennas),
        availableTxAntennas: Array.from(previous.availableTxAntennas),
        modeList: Array.from(previous.modeList),
        raw,
      }
    : {
        id,
        frequencyMHz: 0,
        mode: "",
        sampleRateHz: 0,
        indexLetter: "",
        isInUse: true,
        isActive: false,
        isTransmitEnabled: false,
        isWide: false,
        isQskEnabled: false,
        rxAntenna: "",
        txAntenna: "",
        panadapterStreamId: undefined,
        daxChannel: -1,
        daxIqChannel: -1,
        daxClientCount: 0,
        isLocked: false,
        rfGain: 0,
        filterLowHz: 0,
        filterHighHz: 0,
        rttyMarkHz: 0,
        rttyShiftHz: 0,
        diglOffsetHz: 0,
        diguOffsetHz: 0,
        audioPan: 0,
        audioGain: 0,
        isMuted: false,
        anfEnabled: false,
        anfLevel: 0,
        apfEnabled: false,
        apfLevel: 0,
        wnbEnabled: false,
        wnbLevel: 0,
        nbEnabled: false,
        nbLevel: 0,
        nrEnabled: false,
        nrLevel: 0,
        nrlEnabled: false,
        nrlLevel: 0,
        anflEnabled: false,
        anflLevel: 0,
        nrsEnabled: false,
        nrsLevel: 0,
        rnnEnabled: false,
        anftEnabled: false,
        nrfEnabled: false,
        nrfLevel: 0,
        escEnabled: false,
        escGain: 1,
        escPhaseShift: 0,
        agcMode: "",
        agcThreshold: 0,
        agcOffLevel: 0,
        loopAEnabled: false,
        loopBEnabled: false,
        ritEnabled: false,
        ritOffsetHz: 0,
        xitEnabled: false,
        xitOffsetHz: 0,
        tuneStepHz: 0,
        tuneStepListHz: [],
        postDemodLowHz: 0,
        postDemodHighHz: 0,
        postDemodBypass: false,
        recordingEnabled: false,
        playbackAvailable: false,
        playbackEnabled: false,
        recordTimeSeconds: 0,
        fmToneMode: "",
        fmToneValue: "",
        fmDeviation: 0,
        fmToneBurstEnabled: false,
        fmPreDeEmphasisEnabled: false,
        squelchEnabled: false,
        squelchLevel: 0,
        squelchTriggeredWeight: 0,
        squelchAverageFactor: 0,
        squelchHangDelayMs: 0,
        txOffsetFrequencyMHz: 0,
        fmRepeaterOffsetMHz: 0,
        repeaterOffsetDirection: "",
        diversityEnabled: false,
        diversityChild: false,
        diversityParent: false,
        diversityIndex: 0,
        isDetached: false,
        availableRxAntennas: [],
        availableTxAntennas: [],
        modeList: [],
        rxErrorMilliHz: 0,
        meterIds: [],
        owner: "",
        clientHandle: 0,
        raw,
      };

  for (const [key, value] of Object.entries(attributes)) {
    raw[key] = value;
    switch (key) {
      case "freq":
      case "rf_frequency":
      case "RF_frequency": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.frequencyMHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "mode":
        next.mode = value;
        break;
      case "sample_rate": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.sampleRateHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "index_letter":
        next.indexLetter = value;
        break;
      case "active":
        next.isActive = isTruthy(value);
        break;
      case "in_use":
        next.isInUse = isTruthy(value);
        break;
      case "tx":
        next.isTransmitEnabled = isTruthy(value);
        break;
      case "wide":
        next.isWide = isTruthy(value);
        break;
      case "qsk":
        next.isQskEnabled = isTruthy(value);
        break;
      case "rxant":
        next.rxAntenna = value;
        break;
      case "txant":
        next.txAntenna = value;
        break;
      case "pan":
      case "panadapter":
        next.panadapterStreamId = value || undefined;
        break;
      case "dax": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.daxChannel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "dax_iq_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.daxIqChannel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "dax_clients": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.daxClientCount = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rfgain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGain = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "filter_lo": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.filterLowHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "filter_hi": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.filterHighHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rtty_mark": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rttyMarkHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rtty_shift": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rttyShiftHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "digl_offset": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.diglOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "digu_offset": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.diguOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "audio_pan": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.audioPan = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "audio_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.audioGain = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "audio_mute":
        next.isMuted = isTruthy(value);
        break;
      case "lock":
        next.isLocked = isTruthy(value);
        break;
      case "anf":
        next.anfEnabled = isTruthy(value);
        break;
      case "anf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.anfLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "apf":
        next.apfEnabled = isTruthy(value);
        break;
      case "apf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.apfLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "wnb":
        next.wnbEnabled = isTruthy(value);
        break;
      case "wnb_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.wnbLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nb":
        next.nbEnabled = isTruthy(value);
        break;
      case "nb_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.nbLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nr":
        next.nrEnabled = isTruthy(value);
        break;
      case "nr_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.nrLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "lms_nr":
      case "nrl":
        next.nrlEnabled = isTruthy(value);
        break;
      case "lms_nr_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.nrlLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nrl_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.nrlLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "lms_anf":
      case "anfl":
        next.anflEnabled = isTruthy(value);
        break;
      case "lms_anf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.anflLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "anfl_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.anflLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "speex_nr":
      case "nrs":
        next.nrsEnabled = isTruthy(value);
        break;
      case "speex_nr_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.nrsLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "nrs_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.nrsLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rnnoise":
      case "rnn":
        next.rnnEnabled = isTruthy(value);
        break;
      case "anft":
        next.anftEnabled = isTruthy(value);
        break;
      case "nrf":
        next.nrfEnabled = isTruthy(value);
        break;
      case "nrf_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.nrfLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "esc":
        next.escEnabled = isTruthy(value);
        break;
      case "esc_gain": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.escGain = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "esc_phase_shift": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.escPhaseShift = parsed;
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
        next.agcMode = value;
        break;
      case "agc_threshold": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.agcThreshold = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "agc_off_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.agcOffLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "loopa":
        next.loopAEnabled = isTruthy(value);
        break;
      case "loopb":
        next.loopBEnabled = isTruthy(value);
        break;
      case "rit_on":
        next.ritEnabled = isTruthy(value);
        break;
      case "rit_freq": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.ritOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "xit_on":
        next.xitEnabled = isTruthy(value);
        break;
      case "xit_freq": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.xitOffsetHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "step": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.tuneStepHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "step_list": {
        const parsed = parseIntegerList(value);
        if (parsed) next.tuneStepListHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "post_demod_low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.postDemodLowHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "post_demod_high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.postDemodHighHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "post_demod_bypass":
        next.postDemodBypass = isTruthy(value);
        break;
      case "record":
        next.recordingEnabled = isTruthy(value);
        break;
      case "play": {
        const normalized = value?.trim().toLowerCase();
        if (!value || normalized === "disabled") {
          next.playbackAvailable = false;
          next.playbackEnabled = false;
          break;
        }
        const parsed = parseInteger(value);
        if (parsed !== undefined) {
          next.playbackAvailable = true;
          next.playbackEnabled = parsed === 1;
        } else {
          next.playbackAvailable = true;
          next.playbackEnabled = isTruthy(value);
        }
        break;
      }
      case "record_time": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.recordTimeSeconds = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "fm_tone_mode":
        next.fmToneMode = value;
        break;
      case "fm_tone_value":
        next.fmToneValue = value;
        break;
      case "fm_deviation": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.fmDeviation = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "fm_tone_burst":
        next.fmToneBurstEnabled = isTruthy(value);
        break;
      case "dfm_pre_de_emphasis":
        next.fmPreDeEmphasisEnabled = isTruthy(value);
        break;
      case "squelch":
        next.squelchEnabled = isTruthy(value);
        break;
      case "squelch_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.squelchLevel = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "squelch_triggered_weight": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.squelchTriggeredWeight = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "squelch_avg_factor": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.squelchAverageFactor = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "squelch_hang_delay_ms": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.squelchHangDelayMs = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "tx_offset_freq": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.txOffsetFrequencyMHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "fm_repeater_offset_freq": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.fmRepeaterOffsetMHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "repeater_offset_dir":
        next.repeaterOffsetDirection = value;
        break;
      case "diversity":
        next.diversityEnabled = isTruthy(value);
        break;
      case "diversity_child":
        next.diversityChild = isTruthy(value);
        break;
      case "diversity_parent":
        next.diversityParent = isTruthy(value);
        break;
      case "diversity_index": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.diversityIndex = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "detached":
        next.isDetached = isTruthy(value);
        break;
      case "ant_list": {
        const parsed = parseCsv(value);
        if (parsed) next.availableRxAntennas = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "tx_ant_list": {
        const parsed = parseCsv(value);
        if (parsed) next.availableTxAntennas = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "mode_list": {
        const parsed = parseCsv(value);
        if (parsed) next.modeList = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "rx_error_mHz": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.rxErrorMilliHz = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "meter_list": {
        const parsed = parseCsv(value);
        if (parsed) next.meterIds = parsed;
        else logParseError("slice", key, value);
        break;
      }
      case "owner":
        next.owner = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) next.clientHandle = parsed;
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

  const snapshot: SliceSnapshot = Object.freeze({
    ...next,
    tuneStepListHz: freezeArray(next.tuneStepListHz, previous?.tuneStepListHz),
    availableRxAntennas: freezeArray(
      next.availableRxAntennas,
      previous?.availableRxAntennas,
    ),
    availableTxAntennas: freezeArray(
      next.availableTxAntennas,
      previous?.availableTxAntennas,
    ),
    modeList: freezeArray(next.modeList, previous?.modeList),
    meterIds: freezeArray(next.meterIds, previous?.meterIds),
    raw: Object.freeze(raw),
  });
  return snapshot;
}

function createPanadapterSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: PanadapterSnapshot,
): PanadapterSnapshot {
  const raw: Record<string, string> = previous ? { ...previous.raw } : {};
  const next: Mutable<PanadapterSnapshot> = previous
    ? {
        ...previous,
        rxAntennas: Array.from(previous.rxAntennas ?? []),
        rfGainMarkers: Array.from(previous.rfGainMarkers ?? []),
        attachedSlices: Array.from(previous.attachedSlices ?? []),
        clientHandle: previous.clientHandle,
        xvtr: previous.xvtr,
        preampSetting: previous.preampSetting,
        raw,
      }
    : {
        id,
        streamId: id,
        centerFrequencyMHz: 0,
        bandwidthMHz: 0,
        autoCenterEnabled: false,
        minBandwidthMHz: 0,
        maxBandwidthMHz: 0,
        lowDbm: 0,
        highDbm: 0,
        rxAntenna: "",
        daxIqChannel: -1,
        daxIqRate: 0,
        rfGain: 0,
        rfGainLow: 0,
        rfGainHigh: 0,
        rfGainStep: 0,
        rfGainMarkers: [],
        isBandZoomOn: false,
        isSegmentZoomOn: false,
        wnbEnabled: false,
        wnbLevel: 0,
        wnbUpdating: false,
        noiseFloorPosition: 0,
        noiseFloorPositionEnabled: false,
        width: 0,
        height: 0,
        fps: 0,
        average: 0,
        weightedAverage: false,
        wideEnabled: false,
        loopAEnabled: false,
        loopBEnabled: false,
        band: "",
        rxAntennas: [],
        loggerDisplayEnabled: false,
        loggerDisplayAddress: "",
        loggerDisplayPort: 0,
        loggerDisplayRadioNum: 0,
        waterfallStreamId: "",
        attachedSlices: [],
        clientHandle: 0,
        xvtr: "",
        preampSetting: "",
        raw,
      };

  for (const [key, value] of Object.entries(attributes)) {
    raw[key] = value;
    switch (key) {
      case "stream_id":
      case "stream":
        next.streamId = value || next.streamId;
        break;
      case "center": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.centerFrequencyMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "bandwidth": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.bandwidthMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "auto_center":
      case "autocenter":
        next.autoCenterEnabled = isTruthy(value);
        break;
      case "min_bw": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.minBandwidthMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "max_bw": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.maxBandwidthMHz = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "min_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.lowDbm = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "max_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.highDbm = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "band":
        next.band = value;
        break;
      case "rxant":
        next.rxAntenna = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) next.clientHandle = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "xvtr":
        next.xvtr = value;
        break;
      case "pre":
        next.preampSetting = value;
        break;
      case "daxiq_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.daxIqChannel = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "daxiq_rate": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.daxIqRate = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rfgain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGain = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rf_gain_low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGainLow = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rf_gain_high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGainHigh = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rf_gain_step": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGainStep = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "rf_gain_markers":
        if (value === "") {
          next.rfGainMarkers = [];
          break;
        } else {
          const parsed = parseIntegerList(value);
          if (parsed !== undefined) next.rfGainMarkers = parsed;
          else logParseError("panadapter", key, value);
        }
        break;
      case "band_zoom":
        next.isBandZoomOn = isTruthy(value);
        break;
      case "segment_zoom":
        next.isSegmentZoomOn = isTruthy(value);
        break;
      case "wnb":
        next.wnbEnabled = isTruthy(value);
        break;
      case "wnb_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.wnbLevel = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "wnb_updating":
        next.wnbUpdating = isTruthy(value);
        break;
      case "pan_position":
      case "noise_floor_position": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.noiseFloorPosition = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "pan_position_enable":
      case "noise_floor_position_enable":
        next.noiseFloorPositionEnabled = isTruthy(value);
        break;
      case "xpixels":
      case "x_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.width = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "ypixels":
      case "y_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.height = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "fps": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.fps = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "average": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.average = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "weighted_average":
        next.weightedAverage = isTruthy(value);
        break;
      case "wide":
        next.wideEnabled = isTruthy(value);
        break;
      case "loopa":
        next.loopAEnabled = isTruthy(value);
        break;
      case "loopb":
        next.loopBEnabled = isTruthy(value);
        break;
      case "n1mm_spectrum_enable":
        next.loggerDisplayEnabled = isTruthy(value);
        break;
      case "n1mm_address":
        next.loggerDisplayAddress = value;
        break;
      case "n1mm_port": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.loggerDisplayPort = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "n1mm_radio": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.loggerDisplayRadioNum = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      case "waterfall":
        next.waterfallStreamId = value;
        break;
      case "ant_list": {
        const parsed = parseCsv(value);
        if (parsed) next.rxAntennas = parsed;
        else logParseError("panadapter", key, value);
        break;
      }
      default:
        logUnknownAttribute("panadapter", key, value);
        break;
    }
  }

  const snapshot: PanadapterSnapshot = Object.freeze({
    ...next,
    rxAntennas: freezeArray(next.rxAntennas, previous?.rxAntennas),
    rfGainMarkers: freezeArray(next.rfGainMarkers, previous?.rfGainMarkers),
    attachedSlices: freezeArray(next.attachedSlices, previous?.attachedSlices),
    raw: Object.freeze(raw),
  });
  return snapshot;
}

function createWaterfallSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: WaterfallSnapshot,
): WaterfallSnapshot {
  const raw: Record<string, string> = previous ? { ...previous.raw } : {};
  const next: Mutable<WaterfallSnapshot> = previous
    ? {
        ...previous,
        rfGainMarkers: Array.from(previous.rfGainMarkers ?? []),
        raw,
      }
    : {
        id,
        streamId: attributes["stream_id"] ?? attributes["stream"] ?? id,
        panadapterStreamId:
          attributes["pan"] ?? attributes["panadapter"] ?? "",
        centerFrequencyMHz: 0,
        bandwidthMHz: 0,
        lowDbm: 0,
        highDbm: 0,
        fps: 0,
        average: 0,
        weightedAverage: false,
        rxAntenna: "",
        rfGain: 0,
        rfGainLow: 0,
        rfGainHigh: 0,
        rfGainStep: 0,
        rfGainMarkers: [],
        daxIqChannel: -1,
        isBandZoomOn: false,
        isSegmentZoomOn: false,
        loopAEnabled: false,
        loopBEnabled: false,
        wideEnabled: false,
        band: "",
        width: 0,
        height: 0,
        lineDurationMs: undefined,
        blackLevel: 0,
        colorGain: 0,
        autoBlackLevelEnabled: false,
        gradientIndex: 0,
        clientHandle: 0,
        xvtr: "",
        raw,
      };

  for (const [key, value] of Object.entries(attributes)) {
    raw[key] = value;
    switch (key) {
      case "stream_id":
      case "stream":
        next.streamId = value || next.streamId;
        break;
      case "pan":
      case "panadapter":
        next.panadapterStreamId = value ?? "";
        break;
      case "center": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.centerFrequencyMHz = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "bandwidth": {
        const parsed = parseMegahertz(value);
        if (parsed !== undefined) next.bandwidthMHz = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "min_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.lowDbm = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "max_dbm": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.highDbm = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "fps": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.fps = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "average": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.average = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "weighted_average":
        next.weightedAverage = isTruthy(value);
        break;
      case "band_zoom":
        next.isBandZoomOn = isTruthy(value);
        break;
      case "segment_zoom":
        next.isSegmentZoomOn = isTruthy(value);
        break;
      case "rxant":
        next.rxAntenna = value;
        break;
      case "rfgain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGain = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_low": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGainLow = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_high": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGainHigh = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_step": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.rfGainStep = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "rf_gain_markers":
        if (value === "") {
          next.rfGainMarkers = [];
        } else {
          const parsed = parseIntegerList(value);
          if (parsed !== undefined) next.rfGainMarkers = parsed;
          else logParseError("waterfall", key, value);
        }
        break;
      case "daxiq_channel": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.daxIqChannel = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "loopa":
        next.loopAEnabled = isTruthy(value);
        break;
      case "loopb":
        next.loopBEnabled = isTruthy(value);
        break;
      case "wide":
        next.wideEnabled = isTruthy(value);
        break;
      case "band":
        next.band = value;
        break;
      case "client_handle": {
        const parsed = parseIntegerMaybeHex(value);
        if (parsed !== undefined) next.clientHandle = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "xvtr":
        next.xvtr = value;
        break;
      case "xpixels":
      case "x_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.width = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "ypixels":
      case "y_pixels": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.height = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "line_duration": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.lineDurationMs = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "black_level": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.blackLevel = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "color_gain": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.colorGain = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      case "auto_black":
        next.autoBlackLevelEnabled = isTruthy(value);
        break;
      case "gradient_index": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.gradientIndex = parsed;
        else logParseError("waterfall", key, value);
        break;
      }
      default:
        logUnknownAttribute("waterfall", key, value);
        break;
    }
  }

  const snapshot: WaterfallSnapshot = Object.freeze({
    ...next,
    rfGainMarkers: freezeArray(next.rfGainMarkers, previous?.rfGainMarkers),
    raw: Object.freeze(raw),
  });
  return snapshot;
}

function createMeterSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: MeterSnapshot,
): MeterSnapshot {
  const raw: Record<string, string> = previous ? { ...previous.raw } : {};
  const next: Mutable<MeterSnapshot> = previous
    ? { ...previous, raw }
    : {
        id,
        source: "unknown",
        sourceIndex: 0,
        name: "",
        description: "",
        units: "none",
        low: 0,
        high: 0,
        fps: 0,
        raw,
      };

  for (const [key, value] of Object.entries(attributes)) {
    raw[key] = value;
    switch (key) {
      case "src":
        next.source = value;
        break;
      case "num": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.sourceIndex = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "nam":
        next.name = value || next.name || id;
        break;
      case "desc":
        next.description = value;
        break;
      case "unit":
        next.units = parseMeterUnits(value, next.units);
        break;
      case "low": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.low = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "hi": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.high = parsed;
        else logParseError("meter", key, value);
        break;
      }
      case "fps": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) next.fps = parsed;
        else logParseError("meter", key, value);
        break;
      }
      default:
        logUnknownAttribute("meter", key, value);
        break;
    }
  }

  const snapshot: MeterSnapshot = Object.freeze({
    ...next,
    raw: Object.freeze(raw),
  });
  return snapshot;
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
): RadioProperties {
  const raw: Record<string, string> = previous ? { ...previous.raw } : {};
  const next: Mutable<RadioProperties> = previous
    ? { ...previous, raw }
    : {
        nickname: "",
        callsign: "",
        firmware: "",
        availableSlices: 0,
        availablePanadapters: 0,
        availableDaxIq: 0,
        availableDaxAudio: 0,
        gpsLock: false,
        raw,
      };

  for (const [key, value] of Object.entries(attributes)) {
    raw[key] = value;
    switch (key) {
      case "nickname":
        next.nickname = value;
        break;
      case "callsign":
        next.callsign = value;
        break;
      case "version":
      case "firmware":
        next.firmware = value;
        break;
      case "available_slices":
      case "slices": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.availableSlices = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "available_panadapters":
      case "panadapters": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.availablePanadapters = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "available_daxiq":
      case "daxiq_available": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.availableDaxIq = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "available_dax":
      case "dax_available": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) next.availableDaxAudio = parsed;
        else logParseError("radio", key, value);
        break;
      }
      case "gps_lock":
        next.gpsLock = isTruthy(value);
        break;
      default:
        logUnknownAttribute("radio", key, value);
        break;
    }
  }

  const snapshot: RadioProperties = Object.freeze({
    ...next,
    raw: Object.freeze(raw),
  });
  return snapshot;
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
