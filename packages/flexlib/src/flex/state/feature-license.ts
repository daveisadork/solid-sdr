import type { Mutable, SnapshotDiff, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseInteger,
} from "./common.js";

export type FeatureLicenseReason =
  | "license_file"
  | "plus"
  | "ea"
  | "built_in"
  | "unknown"
  | (string & {});

export interface FeatureLicenseFeature {
  readonly name: string;
  readonly enabled: boolean;
  readonly reason: FeatureLicenseReason;
}

export interface FeatureLicenseSubscription {
  readonly name: string;
  readonly expiration?: Date;
}

export interface FeatureLicenseSnapshot {
  readonly radioId?: string;
  readonly issueDate?: Date;
  readonly lastRefreshDate?: Date;
  readonly highestMajorVersion?: number;
  readonly region?: string;
  readonly features: Readonly<Record<string, FeatureLicenseFeature>>;
  readonly subscriptions: Readonly<Record<string, FeatureLicenseSubscription>>;
  readonly smartSdrPlusActive: boolean;
  readonly smartSdrPlusEarlyAccessActive: boolean;
  readonly smartSdrPlusExpiration?: Date;
  readonly smartSdrPlusEarlyAccessExpiration?: Date;
  readonly raw: Readonly<Record<string, string>>;
}

export interface FeatureLicenseUpdateContext {
  readonly identifier?: string;
}

const EMPTY_FEATURES: Readonly<Record<string, FeatureLicenseFeature>> =
  Object.freeze({});
const EMPTY_SUBSCRIPTIONS: Readonly<
  Record<string, FeatureLicenseSubscription>
> = Object.freeze({});

const DEFAULT_SNAPSHOT: FeatureLicenseSnapshot = Object.freeze({
  features: EMPTY_FEATURES,
  subscriptions: EMPTY_SUBSCRIPTIONS,
  smartSdrPlusActive: false,
  smartSdrPlusEarlyAccessActive: false,
  raw: Object.freeze({}),
});

export function createFeatureLicenseSnapshot(
  attributes: Record<string, string>,
  context: FeatureLicenseUpdateContext,
  previous: FeatureLicenseSnapshot | undefined,
): SnapshotUpdate<FeatureLicenseSnapshot> | undefined {
  if (Object.keys(attributes).length === 0 && !context.identifier) {
    return undefined;
  }

  const snapshot = previous ?? DEFAULT_SNAPSHOT;
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<FeatureLicenseSnapshot>> = {};

  switch (context.identifier) {
    case "feature":
      applyFeatureAttributes(attributes, partial, snapshot);
      break;
    case "subscription":
      applySubscriptionAttributes(attributes, partial, snapshot);
      break;
    default:
      applyLicenseMetadata(attributes, partial);
      break;
  }

  if (Object.keys(partial).length === 0) {
    return undefined;
  }

  const nextSnapshot = Object.freeze({
    ...snapshot,
    ...partial,
    raw: Object.freeze({
      ...snapshot.raw,
      ...attributes,
    }),
  }) as FeatureLicenseSnapshot;

  const diff = Object.freeze(partial) as SnapshotDiff<FeatureLicenseSnapshot>;

  return {
    snapshot: nextSnapshot,
    diff,
    rawDiff,
  };
}

function applyFeatureAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<FeatureLicenseSnapshot>>,
  previous: FeatureLicenseSnapshot,
): void {
  const name = attributes["name"];
  const enabledValue = attributes["enabled"];
  const reasonValue = attributes["reason"];
  if (!name || enabledValue === undefined || !reasonValue) {
    logParseError("license", "feature", JSON.stringify(attributes));
    return;
  }

  const enabledNumber = parseInteger(enabledValue);
  if (enabledNumber === undefined || enabledNumber < 0 || enabledNumber > 1) {
    logParseError("license", "feature.enabled", enabledValue);
    return;
  }

  const normalizedName = name.trim();
  if (!normalizedName) {
    logParseError("license", "feature.name", name);
    return;
  }

  const feature: FeatureLicenseFeature = Object.freeze({
    name: normalizedName,
    enabled: Boolean(enabledNumber),
    reason: normalizeReason(reasonValue),
  });

  partial.features = Object.freeze({
    ...previous.features,
    [feature.name]: feature,
  });
}

function applySubscriptionAttributes(
  attributes: Record<string, string>,
  partial: Mutable<Partial<FeatureLicenseSnapshot>>,
  previous: FeatureLicenseSnapshot,
): void {
  const name = attributes["name"]?.trim().toLowerCase();
  if (!name) {
    logParseError("license", "subscription.name", attributes["name"] ?? "");
    return;
  }

  const expiration = parseExpiration(attributes["expiration"]);
  const subscription: FeatureLicenseSubscription = Object.freeze({
    name,
    expiration,
  });

  partial.subscriptions = Object.freeze({
    ...previous.subscriptions,
    [name]: subscription,
  });

  if (name === "smartsdr+") {
    partial.smartSdrPlusActive = true;
    partial.smartSdrPlusExpiration = expiration;
  } else if (name === "smartsdr+_early_access") {
    partial.smartSdrPlusEarlyAccessActive = true;
    partial.smartSdrPlusEarlyAccessExpiration = expiration;
  }
}

function applyLicenseMetadata(
  attributes: Record<string, string>,
  partial: Mutable<Partial<FeatureLicenseSnapshot>>,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "radio_id":
        if (value) partial.radioId = value.toUpperCase();
        break;
      case "issued": {
        const parsed = parseExpiration(value);
        if (parsed) partial.issueDate = parsed;
        else logParseError("license", key, value);
        break;
      }
      case "last_refreshed_date": {
        const parsed = parseExpiration(value);
        if (parsed) partial.lastRefreshDate = parsed;
        else logParseError("license", key, value);
        break;
      }
      case "highest_major_version": {
        const digits = value ? value.replace(/[^0-9]/g, "") : "";
        const parsed = parseInteger(digits);
        if (parsed !== undefined) partial.highestMajorVersion = parsed;
        else logParseError("license", key, value);
        break;
      }
      case "region":
        if (value) partial.region = value;
        break;
      case "smart_sdr_plus":
        partial.smartSdrPlusActive = isTruthy(value);
        break;
      case "smart_sdr_plus_ea":
        partial.smartSdrPlusEarlyAccessActive = isTruthy(value);
        break;
      default:
        logUnknownAttribute("license", key, value);
        break;
    }
  }
}

function parseExpiration(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp);
}

function normalizeReason(value: string | undefined): FeatureLicenseReason {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "license_file" ||
    normalized === "plus" ||
    normalized === "ea" ||
    normalized === "built_in"
  ) {
    return normalized;
  }
  return normalized || "unknown";
}
