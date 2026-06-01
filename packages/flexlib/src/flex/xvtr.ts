import { TypedEventEmitter, type Subscription } from "../util/events.js";
import {
  clampNumber,
  ensureFinite,
  formatBooleanFlag,
  formatMegahertz,
} from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { XvtrSnapshot, XvtrStateChange } from "./state/index.js";
import type { RadioSession } from "./radio-core.js";

/** Events emitted by an {@link XvtrController}. */
export interface XvtrControllerEvents {
  readonly change: XvtrStateChange;
}

/**
 * Controller for a single transverter (XVTR) definition.
 *
 * Provides read access to all transverter properties and methods to
 * update settings. Each setter sends the appropriate `xvtr set` command
 * to the radio and optimistically patches the local store.
 */
export interface XvtrController extends Readonly<Omit<XvtrSnapshot, "raw">> {
  /** Returns the current snapshot of this transverter's state. */
  snapshot(): XvtrSnapshot;

  /** Registers a listener for transverter state changes. */
  on<TKey extends keyof XvtrControllerEvents>(
    event: TKey,
    listener: (payload: XvtrControllerEvents[TKey]) => void,
  ): Subscription;

  /** Sets the display name (max 4 characters, truncated if longer). */
  setName(name: string): Promise<void>;

  /** Sets the RF frequency in MHz. */
  setRfFreqMHz(freq: number): Promise<void>;

  /** Sets the IF frequency in MHz. */
  setIfFreqMHz(freq: number): Promise<void>;

  /** Sets the LO error offset in MHz. */
  setLoErrorMHz(error: number): Promise<void>;

  /** Sets the receive gain in dB. */
  setRxGainDb(gain: number): Promise<void>;

  /** Sets whether this transverter is receive-only. */
  setRxOnly(rxOnly: boolean): Promise<void>;

  /** Sets the maximum transmit power in dBm. */
  setMaxPowerDbm(power: number): Promise<void>;

  /** Sets the display order. */
  setOrder(order: number): Promise<void>;

  /** Removes this transverter from the radio. */
  remove(): Promise<void>;
}

export class XvtrControllerImpl implements XvtrController {
  private readonly events = new TypedEventEmitter<XvtrControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  snapshot(): XvtrSnapshot {
    return this.current();
  }

  get name(): string {
    return this.current().name;
  }

  get rfFreqMHz(): number {
    return this.current().rfFreqMHz;
  }

  get ifFreqMHz(): number {
    return this.current().ifFreqMHz;
  }

  get loErrorMHz(): number {
    return this.current().loErrorMHz;
  }

  get rxGainDb(): number {
    return this.current().rxGainDb;
  }

  get rxOnly(): boolean {
    return this.current().rxOnly;
  }

  get maxPowerDbm(): number {
    return this.current().maxPowerDbm;
  }

  get order(): number {
    return this.current().order;
  }

  get preferred(): boolean {
    return this.current().preferred;
  }

  get twoMeterInt(): number {
    return this.current().twoMeterInt;
  }

  get valid(): boolean {
    return this.current().valid;
  }

  async setName(name: string): Promise<void> {
    const truncated = name.slice(0, 4);
    await this.sendSet({ name: truncated });
  }

  async setRfFreqMHz(freq: number): Promise<void> {
    const value = formatMegahertz(ensureFinite(freq, "RF frequency"));
    await this.sendSet({ rf_freq: value });
  }

  async setIfFreqMHz(freq: number): Promise<void> {
    const value = formatMegahertz(ensureFinite(freq, "IF frequency"));
    await this.sendSet({ if_freq: value });
  }

  async setLoErrorMHz(error: number): Promise<void> {
    const value = formatMegahertz(ensureFinite(error, "LO error"));
    await this.sendSet({ lo_error: value });
  }

  async setRxGainDb(gain: number): Promise<void> {
    const value = ensureFinite(gain, "RX gain").toFixed(2);
    await this.sendSet({ rx_gain: value });
  }

  async setRxOnly(rxOnly: boolean): Promise<void> {
    await this.sendSet({ rx_only: formatBooleanFlag(rxOnly) });
  }

  async setMaxPowerDbm(power: number): Promise<void> {
    const finite = ensureFinite(power, "Max power");
    const ifFreq = this.current().ifFreqMHz;
    const model = this.radio.getStore().getRadio()?.model;
    let max: number;
    if (ifFreq < 80.0) {
      if (
        model === "FLEX-6400" ||
        model === "FLEX-6400M" ||
        model === "FLEX-6600" ||
        model === "FLEX-6600M"
      ) {
        max = 10.0;
      } else {
        max = 15.0;
      }
    } else {
      max = 8.0;
    }
    const clamped = clampNumber(finite, -10, max);
    const value = clamped.toFixed(2);
    await this.sendSet({ max_power: value });
  }

  async setOrder(order: number): Promise<void> {
    const value = ensureFinite(order, "Order").toString(10);
    await this.sendSet({ order: value });
  }

  async remove(): Promise<void> {
    await this.radio.command(`xvtr remove ${this.id}`);
    const change = this.radio.getStore().removeXvtr(this.id);
    if (change) this.radio.applyStateChange(change);
  }

  on<TKey extends keyof XvtrControllerEvents>(
    event: TKey,
    listener: (payload: XvtrControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: XvtrStateChange): void {
    this.events.emit("change", change);
  }

  private current(): XvtrSnapshot {
    const snapshot = this.radio.getStore().getXvtr(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Transverter ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  private async sendSet(entries: Record<string, string>): Promise<void> {
    const parts = Object.entries(entries).map(
      ([key, value]) => `${key}=${value}`,
    );
    await this.radio.command(`xvtr set ${this.id} ${parts.join(" ")}`);
    const change = this.radio.getStore().patchXvtr(this.id, entries);
    if (change) this.radio.applyStateChange(change);
  }
}
