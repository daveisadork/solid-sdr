import type {
  MeterSnapshot,
  MeterStateChange,
  MeterUnits,
} from "./state/index.js";
export type { MeterUnits, KnownMeterUnits } from "./state/index.js";
export { KNOWN_METER_UNITS } from "./state/index.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  FlexUdpPacketEvent,
  FlexUdpScope,
  FlexUdpSession,
} from "./udp.js";

export interface MeterControllerEvents extends Record<string, unknown> {
  readonly change: MeterStateChange;
  readonly data: FlexUdpPacketEvent<"meter">;
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
  readonly udp: FlexUdpSession;
}

export class MeterControllerImpl implements MeterController {
  private readonly events = new TypedEventEmitter<MeterControllerEvents>();
  private dataListeners = 0;
  private dataScope?: FlexUdpScope<"meter">;
  private dataSubscription?: Subscription;

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

  private ensureDataPipeline(): void {
    if (this.dataSubscription) return;
    const meterId = this.sourceIndex;
    if (!Number.isFinite(meterId)) return;
    const numericId = Math.trunc(meterId);
    this.dataScope = this.session.udp.scope(
      "meter",
      ({ packet }) => hasMeterId(packet.ids, numericId),
    );
    this.dataSubscription = this.dataScope.on((event) => {
      this.events.emit("data", event);
    });
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
    this.dataScope?.removeAll();
    this.dataScope = undefined;
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

function hasMeterId(ids: Uint16Array, expected: number): boolean {
  for (let index = 0; index < ids.length; index++) {
    if (ids[index] === expected) {
      return true;
    }
  }
  return false;
}
