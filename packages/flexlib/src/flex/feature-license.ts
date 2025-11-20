import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type {
  FeatureLicenseFeature,
  FeatureLicenseSnapshot,
} from "./state/feature-license.js";

export type { FeatureLicenseFeature } from "./state/feature-license.js";

export interface FeatureLicenseController {
  snapshot(): FeatureLicenseSnapshot | undefined;
  getFeature(name: string): FeatureLicenseFeature | undefined;
  listFeatures(): readonly FeatureLicenseFeature[];
  sendCommand(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
}

export class FeatureLicenseControllerImpl
  implements FeatureLicenseController
{
  constructor(
    private readonly session: {
      command(
        command: string,
        options?: FlexCommandOptions,
      ): Promise<FlexCommandResponse>;
    },
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
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse> {
    return this.session.command(command, options);
  }
}
