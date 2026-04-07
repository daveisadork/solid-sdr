import type {
  FeatureLicenseFeature,
  FeatureLicenseSnapshot,
} from "./state/feature-license.js";
import type { RadioSession, RadioCommandOptions, RadioCommandResponse } from "./radio-core.js";

export type { FeatureLicenseFeature } from "./state/feature-license.js";

export interface FeatureLicenseController {
  snapshot(): FeatureLicenseSnapshot | undefined;
  getFeature(name: string): FeatureLicenseFeature | undefined;
  listFeatures(): readonly FeatureLicenseFeature[];
  sendCommand(
    command: string,
    options?: RadioCommandOptions,
  ): Promise<RadioCommandResponse>;
}

export class FeatureLicenseControllerImpl
  implements FeatureLicenseController
{
  constructor(
    private readonly session: RadioSession,
    private readonly getSnapshot: () => FeatureLicenseSnapshot | undefined,
  ) {}

  snapshot(): FeatureLicenseSnapshot | undefined {
    return this.getSnapshot();
  }

  getFeature(name: string): FeatureLicenseFeature | undefined {
    const normalized = name?.trim();
    if (!normalized) return undefined;
    return this.getSnapshot()?.features[normalized];
  }

  listFeatures(): readonly FeatureLicenseFeature[] {
    const snapshot = this.getSnapshot();
    if (!snapshot) return [];
    return Object.values(snapshot.features);
  }

  async sendCommand(
    command: string,
    options?: RadioCommandOptions,
  ): Promise<RadioCommandResponse> {
    return this.session.command(command, options);
  }
}
