import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { ApdSnapshot } from "./state/apd.js";
import type { ApdStateChange } from "./state/index.js";
import { formatBooleanFlag } from "./controller-helpers.js";
import type { RadioSession } from "./radio-core.js";

export interface ApdControllerEvents {
  readonly change: ApdStateChange;
}

export interface ApdController extends Readonly<ApdSnapshot> {}

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

export interface ApdControllerImpl extends Readonly<ApdSnapshot> {}
export class ApdControllerImpl {
  private readonly events = new TypedEventEmitter<ApdControllerEvents>();

  constructor(private readonly session: RadioSession) {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }
        const snapshot = target.current();
        if (snapshot && typeof prop === "string" && prop in snapshot) {
          return (snapshot as unknown as Record<string, unknown>)[prop];
        }
        return undefined;
      },
    });
  }

  current(): ApdSnapshot {
    const snapshot = this.session.getStore().getApd();
    if (!snapshot) {
      throw new FlexStateUnavailableError("APD status is not available");
    }
    return snapshot;
  }

  snapshot(): ApdSnapshot | undefined {
    return this.session.getStore().getApd();
  }

  get equalizerCalibrating(): boolean {
    return !this.current().equalizerActive;
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
