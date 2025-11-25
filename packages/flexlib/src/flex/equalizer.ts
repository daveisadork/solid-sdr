import type {
  FlexCommandOptions,
  FlexCommandResponse,
} from "./adapters.js";
import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import {
  EQUALIZER_BANDS,
  type EqualizerBand,
  type EqualizerBandLevels,
} from "./state/equalizer.js";
import type {
  EqualizerId,
  EqualizerSnapshot,
  EqualizerStateChange,
} from "./state/index.js";
import { clampInteger, formatBooleanFlag } from "./controller-helpers.js";

const LEVEL_MIN = -10;
const LEVEL_MAX = 10;

export interface EqualizerControllerEvents extends Record<string, unknown> {
  readonly change: EqualizerStateChange;
}

export type EqualizerLevelUpdate = Partial<Record<EqualizerBand, number>>;

export interface EqualizerController {
  readonly id: EqualizerId;
  readonly state: EqualizerSnapshot;
  readonly enabled: boolean;
  readonly levels: EqualizerBandLevels;
  getLevel(band: EqualizerBand): number;
  snapshot(): EqualizerSnapshot;
  setEnabled(enabled: boolean): Promise<void>;
  setLevel(band: EqualizerBand, level: number): Promise<void>;
  setLevels(levels: EqualizerLevelUpdate): Promise<void>;
  refresh(): Promise<void>;
  on<TKey extends keyof EqualizerControllerEvents>(
    event: TKey,
    listener: (payload: EqualizerControllerEvents[TKey]) => void,
  ): Subscription;
}

export interface EqualizerSessionApi {
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  patchEqualizer(id: EqualizerId, attributes: Record<string, string>): void;
  getEqualizer(id: EqualizerId): EqualizerSnapshot | undefined;
}

export class EqualizerControllerImpl implements EqualizerController {
  private readonly events = new TypedEventEmitter<EqualizerControllerEvents>();

  constructor(
    private readonly session: EqualizerSessionApi,
    readonly id: EqualizerId,
  ) {}

  private current(): EqualizerSnapshot {
    const snapshot = this.session.getEqualizer(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Equalizer ${this.id.toUpperCase()} is not available`,
      );
    }
    return snapshot;
  }

  get state(): EqualizerSnapshot {
    return this.current();
  }

  get enabled(): boolean {
    return this.current().enabled;
  }

  get levels(): EqualizerBandLevels {
    return this.current().bands;
  }

  getLevel(band: EqualizerBand): number {
    return this.current().bands[band];
  }

  snapshot(): EqualizerSnapshot {
    return this.current();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const mode = formatBooleanFlag(enabled);
    await this.sendEntries({ mode });
  }

  async setLevel(band: EqualizerBand, level: number): Promise<void> {
    await this.setLevels({ [band]: level });
  }

  async setLevels(levels: EqualizerLevelUpdate): Promise<void> {
    const entries: Record<string, string> = {};
    for (const band of EQUALIZER_BANDS) {
      const requested = levels[band];
      if (requested === undefined) continue;
      const normalized = this.normalizeLevel(requested);
      entries[band] = normalized.toString(10);
    }
    await this.sendEntries(entries);
  }

  async refresh(): Promise<void> {
    await this.session.command(`eq ${this.commandTarget} info`);
  }

  on<TKey extends keyof EqualizerControllerEvents>(
    event: TKey,
    listener: (payload: EqualizerControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: EqualizerStateChange): void {
    this.events.emit("change", change);
  }

  private async sendEntries(entries: Record<string, string>): Promise<void> {
    const keys = Object.keys(entries);
    if (keys.length === 0) return;
    const commandParts = keys.map((key) => `${key}=${entries[key]}`);
    const command = `eq ${this.commandTarget} ${commandParts.join(" ")}`;
    this.session.patchEqualizer(this.id, entries);
    await this.session.command(command);
  }

  private get commandTarget(): string {
    return `${this.id}sc`;
  }

  private normalizeLevel(value: number): number {
    return clampInteger(value, LEVEL_MIN, LEVEL_MAX, "Equalizer level");
  }
}
