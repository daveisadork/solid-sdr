import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  arraysShallowEqual,
  EMPTY_ATTRIBUTES,
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseFloatSafe,
  parseInteger,
  parseIntegerHex,
} from "./common.js";

const DEFAULT_SAMPLER_PORT = "INTERNAL" as const;
const DEFAULT_SAMPLER_PORTS = Object.freeze([
  DEFAULT_SAMPLER_PORT,
]) as readonly string[];

export type ApdTxAntenna = "ANT1" | "ANT2" | "XVTA" | "XVTB" | (string & {});
export type ApdSamplerPort =
  | "INTERNAL"
  | "RX_A"
  | "XVTA"
  | "RX_B"
  | "XVTB"
  | (string & {});

export interface ApdSnapshot {
  readonly enabled: boolean;
  readonly configurable: boolean;
  readonly equalizerActive: boolean;
  readonly antenna?: string;
  readonly frequencyMHz?: number;
  readonly rfPower?: number;
  readonly txErrorMilliHz?: number;
  readonly rxErrorMilliHz?: number;
  readonly sliceId?: string;
  readonly mmx?: number;
  readonly clientHandle?: number;
  readonly sampleIndex?: number;
  readonly availableSamplerPortsAnt1: readonly string[];
  readonly availableSamplerPortsAnt2: readonly string[];
  readonly availableSamplerPortsXvta: readonly string[];
  readonly availableSamplerPortsXvtb: readonly string[];
  readonly selectedSamplerPortAnt1: string;
  readonly selectedSamplerPortAnt2: string;
  readonly selectedSamplerPortXvta: string;
  readonly selectedSamplerPortXvtb: string;
  readonly raw: Readonly<Record<string, string>>;
}

export function createApdSnapshot(
  attributes: Record<string, string>,
  previous?: ApdSnapshot,
): SnapshotUpdate<ApdSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<ApdSnapshot>> = previous
    ? {}
    : {
        enabled: false,
        configurable: false,
        equalizerActive: false,
        availableSamplerPortsAnt1: DEFAULT_SAMPLER_PORTS,
        availableSamplerPortsAnt2: DEFAULT_SAMPLER_PORTS,
        availableSamplerPortsXvta: DEFAULT_SAMPLER_PORTS,
        availableSamplerPortsXvtb: DEFAULT_SAMPLER_PORTS,
        selectedSamplerPortAnt1: DEFAULT_SAMPLER_PORT,
        selectedSamplerPortAnt2: DEFAULT_SAMPLER_PORT,
        selectedSamplerPortXvta: DEFAULT_SAMPLER_PORT,
        selectedSamplerPortXvtb: DEFAULT_SAMPLER_PORT,
      };

  if ("tx_ant" in attributes || "selected_sampler" in attributes) {
    applySamplerAttributes(attributes, partial, previous);
  }

  for (const [key, value] of Object.entries(attributes)) {
    const normalized = key.toLowerCase();
    switch (normalized) {
      case "enable":
        partial.enabled = isTruthy(value);
        break;
      case "configurable":
        partial.configurable = isTruthy(value);
        break;
      case "equalizer_active":
        partial.equalizerActive = isTruthy(value);
        break;
      case "equalizer_reset":
        partial.equalizerActive = false;
        break;
      case "ant":
        partial.antenna = value || undefined;
        break;
      case "freq": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.frequencyMHz = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "rfpower": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.rfPower = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "tx_error_mhz": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.txErrorMilliHz = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "rx_error_mhz": {
        const parsed = parseFloatSafe(value);
        if (parsed !== undefined) partial.rxErrorMilliHz = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "slice":
        partial.sliceId = value || undefined;
        break;
      case "mmx": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.mmx = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "client_handle": {
        const parsed = parseIntegerHex(value);
        if (parsed !== undefined) partial.clientHandle = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "sample_index": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.sampleIndex = parsed;
        else if (value) logParseError("apd", key, value);
        break;
      }
      case "tx_ant":
      case "selected_sampler":
      case "valid_samplers":
        break;
      default:
        logUnknownAttribute("apd", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...(previous?.raw ?? EMPTY_ATTRIBUTES),
      ...attributes,
    }),
  }) as ApdSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

function applySamplerAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<ApdSnapshot>>,
  previous?: ApdSnapshot,
): void {
  const txAntenna = attributes["tx_ant"]?.trim().toUpperCase();
  if (!txAntenna) return;

  const samplerState = resolveSamplerState(txAntenna, previous);
  if (!samplerState) return;

  const nextAvailable = normalizeAvailableSamplerPorts(
    attributes["valid_samplers"],
    samplerState.available,
  );
  if (!arraysShallowEqual(samplerState.available, nextAvailable)) {
    partial[samplerState.availableKey] = Object.freeze(
      nextAvailable,
    ) as ApdSnapshot[typeof samplerState.availableKey];
  }

  if ("selected_sampler" in attributes) {
    const selected = normalizeSelectedSamplerPort(
      attributes["selected_sampler"],
      nextAvailable,
      "valid_samplers" in attributes,
    );
    if (selected !== samplerState.selected) {
      partial[samplerState.selectedKey] = selected as ApdSnapshot[typeof samplerState.selectedKey];
    }
  }
}

function resolveSamplerState(txAntenna: string, previous?: ApdSnapshot) {
  switch (txAntenna) {
    case "ANT1":
      return {
        available: previous?.availableSamplerPortsAnt1 ?? DEFAULT_SAMPLER_PORTS,
        selected: previous?.selectedSamplerPortAnt1 ?? DEFAULT_SAMPLER_PORT,
        availableKey: "availableSamplerPortsAnt1" as const,
        selectedKey: "selectedSamplerPortAnt1" as const,
      };
    case "ANT2":
      return {
        available: previous?.availableSamplerPortsAnt2 ?? DEFAULT_SAMPLER_PORTS,
        selected: previous?.selectedSamplerPortAnt2 ?? DEFAULT_SAMPLER_PORT,
        availableKey: "availableSamplerPortsAnt2" as const,
        selectedKey: "selectedSamplerPortAnt2" as const,
      };
    case "XVTA":
      return {
        available: previous?.availableSamplerPortsXvta ?? DEFAULT_SAMPLER_PORTS,
        selected: previous?.selectedSamplerPortXvta ?? DEFAULT_SAMPLER_PORT,
        availableKey: "availableSamplerPortsXvta" as const,
        selectedKey: "selectedSamplerPortXvta" as const,
      };
    case "XVTB":
      return {
        available: previous?.availableSamplerPortsXvtb ?? DEFAULT_SAMPLER_PORTS,
        selected: previous?.selectedSamplerPortXvtb ?? DEFAULT_SAMPLER_PORT,
        availableKey: "availableSamplerPortsXvtb" as const,
        selectedKey: "selectedSamplerPortXvtb" as const,
      };
    default:
      return undefined;
  }
}

function normalizeAvailableSamplerPorts(
  rawValue: string | undefined,
  previous: readonly string[],
): readonly string[] {
  if (rawValue === undefined) return previous;

  const ports = rawValue
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0 && token !== DEFAULT_SAMPLER_PORT);

  return [DEFAULT_SAMPLER_PORT, ...ports];
}

function normalizeSelectedSamplerPort(
  rawValue: string | undefined,
  available: readonly string[],
  enforceAvailableList: boolean,
): string {
  const normalized = rawValue?.trim().toUpperCase();
  if (!normalized || normalized === "INVALID") return DEFAULT_SAMPLER_PORT;
  if (!enforceAvailableList) return normalized;
  return available.includes(normalized) ? normalized : DEFAULT_SAMPLER_PORT;
}
