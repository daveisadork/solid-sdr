import { TypedEventEmitter, type Subscription } from "../util/events.js";
import {
  formatBooleanFlag,
  formatInteger,
  formatMegahertz,
} from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { MemorySnapshot, MemoryStateChange } from "./state/index.js";
import type { RadioSession } from "./radio-core.js";

/** Events emitted by a {@link MemoryController}. */
export interface MemoryControllerEvents {
  readonly change: MemoryStateChange;
}

/**
 * Controller for a single memory channel.
 *
 * Provides read access to all memory properties and methods to
 * update settings. Each setter sends the appropriate `memory set` command
 * to the radio and optimistically patches the local store.
 */
export interface MemoryController extends Readonly<Omit<MemorySnapshot, "raw">> {
  /** Returns the current snapshot of this memory's state. */
  snapshot(): MemorySnapshot;

  /** Registers a listener for memory state changes. */
  on<TKey extends keyof MemoryControllerEvents>(
    event: TKey,
    listener: (payload: MemoryControllerEvents[TKey]) => void,
  ): Subscription;

  setOwner(owner: string): Promise<void>;
  setGroup(group: string): Promise<void>;
  setName(name: string): Promise<void>;
  setFrequency(frequencyMHz: number): Promise<void>;
  setMode(mode: string): Promise<void>;
  setStep(stepHz: number): Promise<void>;
  setRepeaterOffsetDirection(direction: string): Promise<void>;
  setRepeaterOffset(offsetMHz: number): Promise<void>;
  setFmToneMode(mode: string): Promise<void>;
  setFmToneValue(value: string): Promise<void>;
  setSquelchEnabled(enabled: boolean): Promise<void>;
  setSquelchLevel(level: number): Promise<void>;
  setFilterLow(lowHz: number): Promise<void>;
  setFilterHigh(highHz: number): Promise<void>;
  setRttyMark(markHz: number): Promise<void>;
  setRttyShift(shiftHz: number): Promise<void>;
  setDiglOffset(offsetHz: number): Promise<void>;
  setDiguOffset(offsetHz: number): Promise<void>;

  /** Applies this memory to the active slice. */
  apply(): Promise<void>;

  /** Removes this memory from the radio. */
  remove(): Promise<void>;
}

export class MemoryControllerImpl implements MemoryController {
  private readonly events = new TypedEventEmitter<MemoryControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  snapshot(): MemorySnapshot {
    return this.current();
  }

  get owner(): string { return this.current().owner; }
  get group(): string { return this.current().group; }
  get name(): string { return this.current().name; }
  get frequencyMHz(): number { return this.current().frequencyMHz; }
  get mode(): string { return this.current().mode; }
  get stepHz(): number { return this.current().stepHz; }
  get repeaterOffsetDirection(): string { return this.current().repeaterOffsetDirection; }
  get repeaterOffsetMHz(): number { return this.current().repeaterOffsetMHz; }
  get fmToneMode(): string { return this.current().fmToneMode; }
  get fmToneValue(): string { return this.current().fmToneValue; }
  get squelchEnabled(): boolean { return this.current().squelchEnabled; }
  get squelchLevel(): number { return this.current().squelchLevel; }
  get filterLowHz(): number { return this.current().filterLowHz; }
  get filterHighHz(): number { return this.current().filterHighHz; }
  get rttyMarkHz(): number { return this.current().rttyMarkHz; }
  get rttyShiftHz(): number { return this.current().rttyShiftHz; }
  get diglOffsetHz(): number { return this.current().diglOffsetHz; }
  get diguOffsetHz(): number { return this.current().diguOffsetHz; }
  get raw(): Record<string, string> { return this.current().raw; }

  on<TKey extends keyof MemoryControllerEvents>(
    event: TKey,
    listener: (payload: MemoryControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: MemoryStateChange): void {
    this.events.emit("change", change);
  }

  async setOwner(owner: string): Promise<void> {
    await this.sendSet({ owner: owner.replace(/ /g, "\u007f") });
  }

  async setGroup(group: string): Promise<void> {
    await this.sendSet({ group: group.replace(/ /g, "\u007f") });
  }

  async setName(name: string): Promise<void> {
    await this.sendSet({ name: name.replace(/ /g, "\u007f") });
  }

  async setFrequency(frequencyMHz: number): Promise<void> {
    await this.sendSet({ freq: formatMegahertz(frequencyMHz) });
  }

  async setMode(mode: string): Promise<void> {
    await this.sendSet({ mode });
  }

  async setStep(stepHz: number): Promise<void> {
    await this.sendSet({ step: formatInteger(stepHz) });
  }

  async setRepeaterOffsetDirection(direction: string): Promise<void> {
    await this.sendSet({ repeater: direction });
  }

  async setRepeaterOffset(offsetMHz: number): Promise<void> {
    await this.sendSet({ repeater_offset: formatMegahertz(offsetMHz) });
  }

  async setFmToneMode(mode: string): Promise<void> {
    await this.sendSet({ tone_mode: mode });
  }

  async setFmToneValue(value: string): Promise<void> {
    await this.sendSet({ tone_value: value });
  }

  async setSquelchEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ squelch: formatBooleanFlag(enabled) });
  }

  async setSquelchLevel(level: number): Promise<void> {
    await this.sendSet({ squelch_level: formatInteger(level) });
  }

  async setFilterLow(lowHz: number): Promise<void> {
    await this.sendSet({ rx_filter_low: formatInteger(lowHz) });
  }

  async setFilterHigh(highHz: number): Promise<void> {
    await this.sendSet({ rx_filter_high: formatInteger(highHz) });
  }

  async setRttyMark(markHz: number): Promise<void> {
    await this.sendSet({ rtty_mark: formatInteger(markHz) });
  }

  async setRttyShift(shiftHz: number): Promise<void> {
    await this.sendSet({ rtty_shift: formatInteger(shiftHz) });
  }

  async setDiglOffset(offsetHz: number): Promise<void> {
    await this.sendSet({ digl_offset: formatInteger(offsetHz) });
  }

  async setDiguOffset(offsetHz: number): Promise<void> {
    await this.sendSet({ digu_offset: formatInteger(offsetHz) });
  }

  async apply(): Promise<void> {
    await this.radio.command(`memory apply ${this.id}`);
  }

  async remove(): Promise<void> {
    await this.radio.command(`memory remove ${this.id}`);
    const change = this.radio.getStore().removeMemory(this.id);
    if (change) this.radio.applyStateChange(change);
  }

  private current(): MemorySnapshot {
    const snapshot = this.radio.getStore().getMemory(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Memory ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  private async sendSet(entries: Record<string, string>): Promise<void> {
    const parts = Object.entries(entries).map(
      ([key, value]) => `${key}=${value}`,
    );
    const change = this.radio.getStore().patchMemory(this.id, entries);
    if (change) this.radio.applyStateChange(change);
    try {
      await this.radio.command(`memory set ${this.id} ${parts.join(" ")}`);
    } catch (error) {
      await this.radio.command(`sub memories ${this.id}`);
      throw error;
    }
  }
}
