import type {
  MeterSnapshot,
  MeterStateChange,
  MeterUnits,
} from "./radio-state.js";
export type { MeterUnits, KnownMeterUnits } from "./radio-state.js";
export { KNOWN_METER_UNITS } from "./radio-state.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import { FlexStateUnavailableError } from "./errors.js";

export interface MeterControllerEvents extends Record<string, unknown> {
  readonly change: MeterStateChange;
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
  snapshot(): MeterSnapshot;
  on<TKey extends keyof MeterControllerEvents>(
    event: TKey,
    listener: (payload: MeterControllerEvents[TKey]) => void,
  ): Subscription;
}

export interface MeterSessionApi {
  getMeter(id: string): MeterSnapshot | undefined;
}

export class MeterControllerImpl implements MeterController {
  private readonly events = new TypedEventEmitter<MeterControllerEvents>();

  constructor(
    private readonly session: MeterSessionApi,
    readonly id: string,
  ) {}

  private current(): MeterSnapshot {
    const snapshot = this.session.getMeter(this.id);
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

  snapshot(): MeterSnapshot {
    return this.current();
  }

  on<TKey extends keyof MeterControllerEvents>(
    event: TKey,
    listener: (payload: MeterControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: MeterStateChange): void {
    this.events.emit("change", change);
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
