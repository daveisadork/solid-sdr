import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { ApdSnapshot } from "./state/apd.js";
import type { ApdStateChange } from "./state/index.js";
import { formatBooleanFlag } from "./controller-helpers.js";
import type { RadioSession } from "./radio-core.js";

export interface ApdControllerEvents extends Record<string, unknown> {
  readonly change: ApdStateChange;
}

export interface ApdController {
  readonly enabled: boolean;
  readonly configurable: boolean;
  readonly equalizerActive: boolean;
  readonly equalizerCalibrating: boolean;
  readonly antenna: string | undefined;
  readonly frequencyMHz: number | undefined;
  readonly txErrorMilliHz: number | undefined;
  readonly rxErrorMilliHz: number | undefined;
  readonly sliceId: string | undefined;
  readonly mmx: number | undefined;
  readonly clientHandle: number | undefined;
  readonly sampleIndex: number | undefined;
  snapshot(): ApdSnapshot | undefined;
  setEnabled(enabled: boolean): Promise<void>;
  on<TKey extends keyof ApdControllerEvents>(
    event: TKey,
    listener: (payload: ApdControllerEvents[TKey]) => void,
  ): Subscription;
  onStateChange(change: ApdStateChange): void;
}

export class ApdControllerImpl implements ApdController {
  private readonly events = new TypedEventEmitter<ApdControllerEvents>();

  constructor(private readonly session: RadioSession) {}

  private current(): ApdSnapshot {
    const snapshot = this.session.getStore().getApd();
    if (!snapshot) {
      throw new FlexStateUnavailableError("APD status is not available");
    }
    return snapshot;
  }

  snapshot(): ApdSnapshot | undefined {
    return this.session.getStore().getApd();
  }

  get enabled(): boolean {
    return this.current().enabled;
  }

  get configurable(): boolean {
    return this.current().configurable;
  }

  get equalizerActive(): boolean {
    return this.current().equalizerActive;
  }

  get equalizerCalibrating(): boolean {
    return !this.current().equalizerActive;
  }

  get antenna(): string | undefined {
    return this.current().antenna;
  }

  get frequencyMHz(): number | undefined {
    return this.current().frequencyMHz;
  }

  get txErrorMilliHz(): number | undefined {
    return this.current().txErrorMilliHz;
  }

  get rxErrorMilliHz(): number | undefined {
    return this.current().rxErrorMilliHz;
  }

  get sliceId(): string | undefined {
    return this.current().sliceId;
  }

  get mmx(): number | undefined {
    return this.current().mmx;
  }

  get clientHandle(): number | undefined {
    return this.current().clientHandle;
  }

  get sampleIndex(): number | undefined {
    return this.current().sampleIndex;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const flag = formatBooleanFlag(enabled);
    const change = this.session.getStore().patchApd({ enable: flag });
    if (change) this.session.applyStateChange(change);
    try {
      await this.session.command(`apd enable=${flag}`);
    } catch (error) {
      await this.session.command("sub apd all");
      throw error;
    }
  }

  on<TKey extends keyof ApdControllerEvents>(
    event: TKey,
    listener: (payload: ApdControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: ApdStateChange): void {
    this.events.emit("change", change);
  }
}
