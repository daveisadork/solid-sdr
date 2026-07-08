import { type Subscription, TypedEventEmitter } from "../util/events.js";
import {
  clampInteger,
  ensureFinite,
  formatBooleanFlag,
  formatMegahertz,
} from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type { TnfSnapshot, TnfStateChange } from "./state/index.js";

/** Events emitted by a {@link TnfController}. */
export interface TnfControllerEvents {
  readonly change: TnfStateChange;
}

/**
 * Controller for a single Tracking Notch Filter (TNF).
 *
 * Provides read access to all TNF properties and methods to
 * update settings. Each setter sends the appropriate `tnf set` command
 * to the radio and optimistically patches the local store.
 */
export interface TnfController extends Readonly<Omit<TnfSnapshot, "raw">> {
  /** Returns the current snapshot of this TNF's state. */
  snapshot(): TnfSnapshot;

  /** Registers a listener for TNF state changes. */
  on<TKey extends keyof TnfControllerEvents>(
    event: TKey,
    listener: (payload: TnfControllerEvents[TKey]) => void,
  ): Subscription;

  /** Sets the center frequency in MHz. */
  setFrequency(freq: number): Promise<void>;

  /** Sets the filter depth (1 = normal, 2 = deep, 3 = very deep). */
  setDepth(depth: number): Promise<void>;

  /** Sets the filter bandwidth in MHz. */
  setBandwidth(bandwidth: number): Promise<void>;

  /** Sets whether this TNF persists across radio reboots. */
  setPermanent(permanent: boolean): Promise<void>;

  /** Removes this TNF from the radio. */
  remove(): Promise<void>;
}

export class TnfControllerImpl implements TnfController {
  private readonly events = new TypedEventEmitter<TnfControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  snapshot(): TnfSnapshot {
    return this.current();
  }

  get frequencyMHz(): number {
    return this.current().frequencyMHz;
  }

  get depth(): number {
    return this.current().depth;
  }

  get bandwidthMHz(): number {
    return this.current().bandwidthMHz;
  }

  get permanent(): boolean {
    return this.current().permanent;
  }

  async setFrequency(freq: number): Promise<void> {
    const value = formatMegahertz(ensureFinite(freq, "Frequency"));
    await this.sendSet({ freq: value });
  }

  async setDepth(depth: number): Promise<void> {
    const clamped = clampInteger(depth, 1, 3, "TNF depth");
    await this.sendSet({ depth: clamped.toString(10) });
  }

  async setBandwidth(bandwidth: number): Promise<void> {
    const value = formatMegahertz(ensureFinite(bandwidth, "Bandwidth"));
    await this.sendSet({ width: value });
  }

  async setPermanent(permanent: boolean): Promise<void> {
    await this.sendSet({ permanent: formatBooleanFlag(permanent) });
  }

  async remove(): Promise<void> {
    await this.radio.command(`tnf remove ${this.id}`);
    const change = this.radio.getStore().removeTnf(this.id);
    if (change) this.radio.applyStateChange(change);
  }

  on<TKey extends keyof TnfControllerEvents>(
    event: TKey,
    listener: (payload: TnfControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: TnfStateChange): void {
    this.events.emit("change", change);
  }

  private current(): TnfSnapshot {
    const snapshot = this.radio.getStore().getTnf(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `TNF ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  private async sendSet(entries: Record<string, string>): Promise<void> {
    const parts = Object.entries(entries).map(
      ([key, value]) => `${key}=${value}`,
    );
    const change = this.radio.getStore().patchTnf(this.id, entries);
    if (change) this.radio.applyStateChange(change);
    try {
      await this.radio.command(`tnf set ${this.id} ${parts.join(" ")}`);
    } catch (error) {
      await this.radio.command(`sub tnf ${this.id}`);
      throw error;
    }
  }
}
