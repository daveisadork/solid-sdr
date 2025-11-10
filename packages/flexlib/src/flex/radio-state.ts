import type { FlexStatusMessage } from "./protocol.js";
import type { RfGainInfo } from "./rf-gain.js";
import { freezeArray, freezeAttributes, isTruthy } from "./radio-state/common.js";
import type { SnapshotDiff } from "./radio-state/common.js";
import {
  createSliceSnapshot,
} from "./radio-state/slice.js";
import type { SliceSnapshot } from "./radio-state/slice.js";
import {
  createPanadapterSnapshot,
} from "./radio-state/panadapter.js";
import type { PanadapterSnapshot } from "./radio-state/panadapter.js";
import {
  createWaterfallSnapshot,
} from "./radio-state/waterfall.js";
import type { WaterfallSnapshot } from "./radio-state/waterfall.js";
import {
  AUDIO_STREAM_TYPES,
  createAudioStreamSnapshot,
} from "./radio-state/audio-stream.js";
import type {
  AudioStreamKind,
  AudioStreamSnapshot,
} from "./radio-state/audio-stream.js";
import { createMeterSnapshot } from "./radio-state/meter.js";
import type {
  MeterSnapshot,
} from "./radio-state/meter.js";
import {
  createDefaultRadioProperties,
  createRadioProperties,
} from "./radio-state/radio.js";
import type { RadioProperties } from "./radio-state/radio.js";

export type { SnapshotDiff } from "./radio-state/common.js";
export type { SliceSnapshot } from "./radio-state/slice.js";
export type { PanadapterSnapshot } from "./radio-state/panadapter.js";
export type { WaterfallSnapshot } from "./radio-state/waterfall.js";
export type {
  AudioStreamKind,
  AudioStreamSnapshot,
} from "./radio-state/audio-stream.js";
export type {
  KnownMeterUnits,
  MeterSnapshot,
  MeterUnits,
} from "./radio-state/meter.js";
export type { RadioProperties } from "./radio-state/radio.js";
export { KNOWN_METER_UNITS } from "./radio-state/meter.js";

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
  | ({
      entity: "audioStream";
      id: string;
    } & ChangeMetadata<AudioStreamSnapshot>)
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
export type AudioStreamStateChange = Extract<
  RadioStateChange,
  { entity: "audioStream" }
>;

export interface RadioStateSnapshot {
  readonly slices: readonly SliceSnapshot[];
  readonly panadapters: readonly PanadapterSnapshot[];
  readonly waterfalls: readonly WaterfallSnapshot[];
  readonly meters: readonly MeterSnapshot[];
  readonly audioStreams: readonly AudioStreamSnapshot[];
  readonly radio?: RadioProperties;
}

export interface RadioStateStore {
  apply(message: FlexStatusMessage): RadioStateChange[];
  snapshot(): RadioStateSnapshot;
  getSlice(id: string): SliceSnapshot | undefined;
  getPanadapter(id: string): PanadapterSnapshot | undefined;
  getWaterfall(id: string): WaterfallSnapshot | undefined;
  getMeter(id: string): MeterSnapshot | undefined;
  getAudioStream(id: string): AudioStreamSnapshot | undefined;
  getRadio(): RadioProperties | undefined;
  patchRadio(attributes: Record<string, string>): RadioStateChange | undefined;
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
  patchAudioStream(
    id: string,
    attributes: Record<string, string>,
  ): AudioStreamStateChange | undefined;
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
  const audioStreams = new Map<string, AudioStreamSnapshot>();
  let radio: RadioProperties | undefined;

  return {
    apply(message) {
      switch (message.source) {
        case "slice":
          return [handleSlice(message)];
        case "pan":
          return [handlePanadapter(message)];
        case "stream":
          return [handleStream(message)];
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
        audioStreams: Array.from(audioStreams.values()),
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
    getAudioStream(id) {
      return audioStreams.get(id);
    },
    getRadio() {
      return radio;
    },
    patchRadio(attributes) {
      return patchRadio(attributes);
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
    patchAudioStream(id, attributes) {
      return patchAudioStream(id, attributes);
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

  function patchRadio(
    attributes: Record<string, string>,
  ): RadioStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const previous = radio ?? createDefaultRadioProperties();
    const { snapshot, diff, rawDiff } = createRadioProperties(
      attributes,
      radio,
    );
    const diffKeys = Object.keys(diff as Record<string, unknown>);
    if (diffKeys.length === 0) {
      radio = snapshot;
      return undefined;
    }
    radio = snapshot;
    return {
      entity: "radio",
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

    if (isMarkedDeleted(message.attributes)) {
      const previous = audioStreams.get(id);
      audioStreams.delete(id);
      return {
        entity: "audioStream",
        id,
        previous,
        snapshot: undefined,
        rawDiff: freezeAttributes(message.attributes),
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
    const { snapshot, diff, rawDiff } = createAudioStreamSnapshot(
      id,
      attributePatch,
      previous,
    );
    audioStreams.set(id, snapshot);
    return {
      entity: "audioStream",
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
    const { snapshot, diff, rawDiff } = createAudioStreamSnapshot(
      id,
      attributePatch,
      previous,
    );
    audioStreams.set(id, snapshot);
    return {
      entity: "audioStream",
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
