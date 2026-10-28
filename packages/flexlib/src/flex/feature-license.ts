import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type {
  FeatureLicenseFeature,
  FeatureLicenseSnapshot,
} from "./state/feature-license.js";

export type { FeatureLicenseFeature } from "./state/feature-license.js";

export interface FeatureLicenseController
  extends Readonly<Omit<FeatureLicenseSnapshot, "raw">> {
  snapshot(): FeatureLicenseSnapshot;
  getFeature(name: string): FeatureLicenseFeature | undefined;
  listFeatures(): readonly FeatureLicenseFeature[];
  /** Send `license refresh` to re-fetch the radio's license state from the server. */
  refreshLicenseState(): Promise<void>;
  /**
   * Upload a license key to the radio. `licenseKey` is the content of a
   * FlexRadio `.lic` file with the `BEGIN/END LICENSE KEY` header lines and
   * all newlines removed. The file's body is already base64-encoded by
   * FlexRadio; no additional encoding is required before calling this method.
   */
  uploadLicense(licenseKey: string): Promise<void>;
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

  get radioId(): FeatureLicenseSnapshot["radioId"] {
    return this.current().radioId;
  }

  get issueDate(): FeatureLicenseSnapshot["issueDate"] {
    return this.current().issueDate;
  }

  get lastRefreshDate(): FeatureLicenseSnapshot["lastRefreshDate"] {
    return this.current().lastRefreshDate;
  }

  get highestMajorVersion(): FeatureLicenseSnapshot["highestMajorVersion"] {
    return this.current().highestMajorVersion;
  }

  get region(): FeatureLicenseSnapshot["region"] {
    return this.current().region;
  }

  get features(): FeatureLicenseSnapshot["features"] {
    return this.current().features;
  }

  get subscriptions(): FeatureLicenseSnapshot["subscriptions"] {
    return this.current().subscriptions;
  }

  get smartSdrPlusActive(): FeatureLicenseSnapshot["smartSdrPlusActive"] {
    return this.current().smartSdrPlusActive;
  }

  get smartSdrPlusEarlyAccessActive(): FeatureLicenseSnapshot["smartSdrPlusEarlyAccessActive"] {
    return this.current().smartSdrPlusEarlyAccessActive;
  }

  get smartSdrPlusExpiration(): FeatureLicenseSnapshot["smartSdrPlusExpiration"] {
    return this.current().smartSdrPlusExpiration;
  }

  get smartSdrPlusEarlyAccessExpiration(): FeatureLicenseSnapshot["smartSdrPlusEarlyAccessExpiration"] {
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

  async refreshLicenseState(): Promise<void> {
    await this.radio.command("license refresh");
  }

  async uploadLicense(licenseKey: string): Promise<void> {
    await this.radio.command(`license set=${licenseKey}`);
  }
}
