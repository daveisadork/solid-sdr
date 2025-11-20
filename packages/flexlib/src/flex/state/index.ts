import type { FlexStatusMessage } from "../protocol.js";
import type { RfGainInfo } from "../rf-gain.js";
import type { Logger } from "../adapters.js";
import {
  isTruthy,
  parseIntegerMaybeHex,
  setRadioStateLogger,
} from "./common.js";
import type { SnapshotDiff } from "./common.js";
import {
  AUDIO_STREAM_TYPES,
  createAudioStreamSnapshot,
} from "./audio-stream.js";
import type {
  AudioStreamKind,
  AudioStreamSnapshot,
} from "./audio-stream.js";
import {
  createFeatureLicenseSnapshot,
  type FeatureLicenseSnapshot,
} from "./feature-license.js";
import { createMeterSnapshot } from "./meter.js";
import type { MeterSnapshot } from "./meter.js";
import { createPanadapterSnapshot } from "./panadapter.js";
import type { PanadapterSnapshot } from "./panadapter.js";
import { createRadioSnapshot } from "./radio.js";
import type { RadioSnapshot, RadioStatusContext } from "./radio.js";
import { createSliceSnapshot } from "./slice.js";
import type { SliceSnapshot } from "./slice.js";
import { createWaterfallSnapshot } from "./waterfall.js";
import type { WaterfallSnapshot } from "./waterfall.js";
import {
  createGuiClientSnapshot,
  type GuiClientSnapshot,
} from "./gui-client.js";

export type { SnapshotDiff } from "./common.js";
export type { SliceSnapshot } from "./slice.js";
export type { PanadapterSnapshot } from "./panadapter.js";
export type { WaterfallSnapshot } from "./waterfall.js";
export type {
  AudioStreamKind,
  AudioStreamSnapshot,
} from "./audio-stream.js";
export type { FeatureLicenseSnapshot } from "./feature-license.js";
export type {
  KnownMeterUnits,
  MeterSnapshot,
  MeterUnits,
} from "./meter.js";
export type {
  RadioFilterSharpnessMode,
  RadioOscillatorSetting,
  RadioScreensaverMode,
  RadioSnapshot as RadioSnapshot,
  RadioStatusContext,
} from "./radio.js";
export { KNOWN_METER_UNITS } from "./meter.js";
export type { GuiClientSnapshot } from "./gui-client.js";

type ChangeMetadata<TSnapshot> = {
  readonly diff?: SnapshotDiff<TSnapshot>;
  readonly removed: boolean;
  readonly kind?: "added" | "updated" | "removed";
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
  | ({ entity: "guiClient"; id: string } & ChangeMetadata<GuiClientSnapshot>)
  | ({ entity: "radio" } & ChangeMetadata<RadioSnapshot>)
  | ({ entity: "featureLicense" } & ChangeMetadata<FeatureLicenseSnapshot>)
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
export type GuiClientStateChange = Extract<
  RadioStateChange,
  { entity: "guiClient" }
>;

export interface RadioStateSnapshot {
  readonly slices: readonly SliceSnapshot[];
  readonly panadapters: readonly PanadapterSnapshot[];
  readonly waterfalls: readonly WaterfallSnapshot[];
  readonly meters: readonly MeterSnapshot[];
  readonly audioStreams: readonly AudioStreamSnapshot[];
  readonly guiClients: readonly GuiClientSnapshot[];
  readonly radio: RadioSnapshot;
  readonly featureLicense?: FeatureLicenseSnapshot;
}

export interface RadioStateStore {
  apply(message: FlexStatusMessage): RadioStateChange[];
  snapshot(): RadioStateSnapshot;
  getSlice(id: string): SliceSnapshot | undefined;
  getPanadapter(id: string): PanadapterSnapshot | undefined;
  getWaterfall(id: string): WaterfallSnapshot | undefined;
  getMeter(id: string): MeterSnapshot | undefined;
  getAudioStream(id: string): AudioStreamSnapshot | undefined;
  getGuiClient(id: string): GuiClientSnapshot | undefined;
  getGuiClients(): readonly GuiClientSnapshot[];
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
  let radio: RadioSnapshot;
  let featureLicense: FeatureLicenseSnapshot | undefined;
  let localClientHandle: number | undefined;

  return {
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
        case "client":
          return handleClient(message);
        case "license": {
          const change = handleLicense(message);
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
        radio,
        featureLicense,
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

    if (isMarkedDeleted(message.attributes)) {
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

  function patchRadio(
    attributes: Record<string, string>,
    context?: RadioStatusContext,
  ): RadioStateChange | undefined {
    if (Object.keys(attributes).length === 0) return undefined;
    const { snapshot, diff } = createRadioSnapshot(
      attributes,
      radio,
      context,
    );
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

    if (isMarkedDeleted(message.attributes)) {
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
      audioStreams.delete(id);
      return {
        entity: "audioStream",
        id,
        removed: true,
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
      if (isMarkedDeleted(message.attributes)) {
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

    if (isMarkedDeleted(message.attributes)) {
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

  function handleRadio(message: FlexStatusMessage): RadioStateChange {
    const { snapshot, diff } = createRadioSnapshot(
      message.attributes,
      radio,
      {
        source: message.source,
        identifier: message.identifier,
        positional: message.positional,
      },
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

  function updateLocalClientHandle(
    handle: string | number | undefined,
  ): RadioStateChange[] {
    const normalized =
      typeof handle === "number"
        ? Number.isFinite(handle)
          ? handle
          : undefined
        : typeof handle === "string"
          ? parseIntegerMaybeHex(handle)
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

function isMarkedDeleted(attributes: Record<string, string>): boolean {
  if ("removed" in attributes) return isTruthy(attributes["removed"]);
  if ("in_use" in attributes) return !isTruthy(attributes["in_use"]);
  if ("deleted" in attributes) return isTruthy(attributes["deleted"]);
  return false;
}
