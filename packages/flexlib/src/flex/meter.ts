import type {
  MeterSnapshot,
  MeterStateChange,
  MeterUnits,
} from "./state/index.js";
export type { MeterUnits, KnownMeterUnits } from "./state/index.js";
export { KNOWN_METER_UNITS } from "./state/index.js";
import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession, MeterValueHandler } from "./radio-core.js";

/** Payload for meter "data" events — includes both raw and scaled values. */
export interface MeterDataEvent {
  readonly meterId: number;
  readonly raw: number;
  readonly value: number;
  readonly units: MeterUnits;
}

export interface MeterControllerEvents extends Record<string, unknown> {
  readonly change: MeterStateChange;
  readonly data: MeterDataEvent;
}

export interface MeterController {
  readonly id: string;
  readonly state: MeterSnapshot;
  readonly source: string;
  readonly sourceIndex: number;
  readonly name: string;
  readonly description: string;
  readonly units: MeterUnits;
  readonly low: number;
  readonly high: number;
  readonly fps: number;
  /** Last scaled meter value, updated on each VITA packet. */
  readonly value: number | undefined;
  snapshot(): MeterSnapshot;
  on<TKey extends keyof MeterControllerEvents>(
    event: TKey,
    listener: (payload: MeterControllerEvents[TKey]) => void,
  ): Subscription;
}

export class MeterControllerImpl implements MeterController {
  private readonly events = new TypedEventEmitter<MeterControllerEvents>();
  private dataListeners = 0;
  private dataSubscription?: Subscription;
  private _value: number | undefined;

  constructor(
    private readonly session: RadioSession,
    readonly id: string,
  ) {}

  private current(): MeterSnapshot {
    const snapshot = this.session.getStore().getMeter(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Meter ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }

  get state(): MeterSnapshot {
    return this.current();
  }

  get source(): string {
    return this.current().source;
  }

  get sourceIndex(): number {
    return this.current().sourceIndex;
  }

  get name(): string {
    return this.current().name;
  }

  get description(): string {
    return this.current().description;
  }

  get units(): MeterUnits {
    return this.current().units;
  }

  get low(): number {
    return this.current().low;
  }

  get high(): number {
    return this.current().high;
  }

  get fps(): number {
    return this.current().fps;
  }

  get value(): number | undefined {
    return this._value;
  }

  snapshot(): MeterSnapshot {
    return this.current();
  }

  on<TKey extends keyof MeterControllerEvents>(
    event: TKey,
    listener: (payload: MeterControllerEvents[TKey]) => void,
  ): Subscription {
    if (event === "data") {
      this.ensureDataPipeline();
      this.dataListeners += 1;
      const subscription = this.events.on(event, listener);
      return {
        unsubscribe: () => {
          subscription.unsubscribe();
          this.handleDataUnsubscribe();
        },
      };
    }
    return this.events.on(event, listener);
  }

  onStateChange(change: MeterStateChange): void {
    this.events.emit("change", change);
    if (change.removed) {
      this.teardownDataPipeline();
    }
  }

  private readonly handleMeterValue: MeterValueHandler = (
    meterId,
    rawValue,
  ) => {
    const snapshot = this.session.getStore().getMeter(this.id);
    const units = snapshot?.units ?? "none";
    const scaled = scaleMeterRawValue(units, rawValue);
    this._value = scaled;
    this.events.emit("data", {
      meterId,
      raw: rawValue,
      value: scaled,
      units,
    });
  };

  private ensureDataPipeline(): void {
    if (this.dataSubscription) return;
    const meterId = this.sourceIndex;
    if (!Number.isFinite(meterId)) return;
    const numericId = Math.trunc(meterId);
    this.dataSubscription = this.session.registerMeterHandler(
      numericId,
      this.handleMeterValue,
    );
  }

  private handleDataUnsubscribe(): void {
    if (this.dataListeners === 0) return;
    this.dataListeners = Math.max(0, this.dataListeners - 1);
    if (this.dataListeners === 0) {
      this.teardownDataPipeline();
    }
  }

  private teardownDataPipeline(): void {
    this.dataSubscription?.unsubscribe();
    this.dataSubscription = undefined;
  }
}

export interface MeterScalingOptions {
  readonly voltDenominator?: number;
}

export function scaleMeterRawValue(
  units: MeterUnits,
  rawValue: number,
  options?: MeterScalingOptions,
): number {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return NaN;

  if (
    units === "dB" ||
    units === "dBm" ||
    units === "dBFS" ||
    units === "SWR"
  ) {
    return value / 128;
  }

  if (units === "Volts" || units === "Amps") {
    const denominator = options?.voltDenominator ?? 256;
    return value / denominator;
  }

  if (units === "degF" || units === "degC") {
    return value / 64;
  }

  return value;
}
