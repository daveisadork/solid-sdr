import type {
  FeatureLicenseFeature,
  FeatureLicenseSnapshot,
} from "./state/feature-license.js";
import type { RadioSession } from "./radio-core.js";
import { FlexStateUnavailableError } from "./errors.js";

export type { FeatureLicenseFeature } from "./state/feature-license.js";

export interface FeatureLicenseController
  extends Readonly<Omit<FeatureLicenseSnapshot, "raw">> {
  snapshot(): FeatureLicenseSnapshot;
  getFeature(name: string): FeatureLicenseFeature | undefined;
  listFeatures(): readonly FeatureLicenseFeature[];
}

export class FeatureLicenseControllerImpl implements FeatureLicenseController {
  constructor(private readonly radio: RadioSession) {}

  private current(): FeatureLicenseSnapshot {
    const snapshot = this.radio.getStore().getFeatureLicense();
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        "Feature license status is not available",
      );
    }
    return snapshot;
  }

  snapshot(): FeatureLicenseSnapshot {
    return this.current();
  }

  get radioId() {
    return this.current().radioId;
  }

  get issueDate() {
    return this.current().issueDate;
  }

  get lastRefreshDate() {
    return this.current().lastRefreshDate;
  }

  get highestMajorVersion() {
    return this.current().highestMajorVersion;
  }

  get region() {
    return this.current().region;
  }

  get features() {
    return this.current().features;
  }

  get subscriptions() {
    return this.current().subscriptions;
  }

  get smartSdrPlusActive() {
    return this.current().smartSdrPlusActive;
  }

  get smartSdrPlusEarlyAccessActive() {
    return this.current().smartSdrPlusEarlyAccessActive;
  }

  get smartSdrPlusExpiration() {
    return this.current().smartSdrPlusExpiration;
  }

  get smartSdrPlusEarlyAccessExpiration() {
    return this.current().smartSdrPlusEarlyAccessExpiration;
  }

  getFeature(name: string): FeatureLicenseFeature | undefined {
    const normalized = name?.trim();
    if (!normalized) return undefined;
    return this.current().features[normalized];
  }

  listFeatures(): readonly FeatureLicenseFeature[] {
    return Object.values(this.current().features);
  }
}
