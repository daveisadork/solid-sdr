import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { clampInteger, formatBooleanFlag } from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  TxBandSettingSnapshot,
  TxBandSettingStateChange,
} from "./state/index.js";
import type { RadioSession } from "./radio-core.js";

export interface TxBandSettingControllerEvents
  {
  readonly change: TxBandSettingStateChange;
}

export interface TxBandSettingController extends Readonly<TxBandSettingSnapshot> {}

export interface TxBandSettingController {
  readonly id: string;
  snapshot(): TxBandSettingSnapshot;
  get bandName(): string | undefined;
  get tunePower(): number | undefined;
  get rfPower(): number | undefined;
  get pttInhibit(): boolean | undefined;
  get accTxReqEnabled(): boolean | undefined;
  get rcaTxReqEnabled(): boolean | undefined;
  get accTxEnabled(): boolean | undefined;
  get rcaTx1Enabled(): boolean | undefined;
  get rcaTx2Enabled(): boolean | undefined;
  get rcaTx3Enabled(): boolean | undefined;
  setHwAlcEnabled(enabled: boolean): Promise<void>;
  setTunePower(level: number): Promise<void>;
  setRfPower(level: number): Promise<void>;
  setPttInhibit(enabled: boolean): Promise<void>;
  setAccTxReqEnabled(enabled: boolean): Promise<void>;
  setRcaTxReqEnabled(enabled: boolean): Promise<void>;
  setAccTxEnabled(enabled: boolean): Promise<void>;
  setRcaTx1Enabled(enabled: boolean): Promise<void>;
  setRcaTx2Enabled(enabled: boolean): Promise<void>;
  setRcaTx3Enabled(enabled: boolean): Promise<void>;
  on<TKey extends keyof TxBandSettingControllerEvents>(
    event: TKey,
    listener: (payload: TxBandSettingControllerEvents[TKey]) => void,
  ): Subscription;
}

export interface TxBandSettingControllerImpl extends Readonly<TxBandSettingSnapshot> {}
export class TxBandSettingControllerImpl {
  private readonly events =
    new TypedEventEmitter<TxBandSettingControllerEvents>();

  constructor(
    private readonly session: RadioSession,
    readonly id: string,
  ) {
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

  snapshot(): TxBandSettingSnapshot {
    return this.current();
  }

  async setHwAlcEnabled(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("transmit", {
      hwalc_enabled: formatBooleanFlag(enabled),
    });
  }

  async setTunePower(level: number): Promise<void> {
    const clamped = clampInteger(level, 0, 100, "Tune power");
    await this.sendBandsetCommand("transmit", {
      tunepower: clamped.toString(10),
    });
  }

  async setRfPower(level: number): Promise<void> {
    const clamped = clampInteger(level, 0, 100, "RF power");
    await this.sendBandsetCommand("transmit", {
      rfpower: clamped.toString(10),
    });
  }

  async setPttInhibit(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("transmit", {
      inhibit: formatBooleanFlag(enabled),
    });
  }

  async setAccTxReqEnabled(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("interlock", {
      acc_txreq_enable: formatBooleanFlag(enabled),
    });
  }

  async setRcaTxReqEnabled(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("interlock", {
      rca_txreq_enable: formatBooleanFlag(enabled),
    });
  }

  async setAccTxEnabled(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("interlock", {
      acc_tx_enabled: formatBooleanFlag(enabled),
    });
  }

  async setRcaTx1Enabled(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("interlock", {
      tx1_enabled: formatBooleanFlag(enabled),
    });
  }

  async setRcaTx2Enabled(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("interlock", {
      tx2_enabled: formatBooleanFlag(enabled),
    });
  }

  async setRcaTx3Enabled(enabled: boolean): Promise<void> {
    await this.sendBandsetCommand("interlock", {
      tx3_enabled: formatBooleanFlag(enabled),
    });
  }

  on<TKey extends keyof TxBandSettingControllerEvents>(
    event: TKey,
    listener: (payload: TxBandSettingControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: TxBandSettingStateChange): void {
    this.events.emit("change", change);
  }

  current(): TxBandSettingSnapshot {
    const snapshot = this.session.getStore().getTxBandSetting(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `TX band ${this.id} is not available`,
      );
    }
    return snapshot;
  }

  private async sendBandsetCommand(
    namespace: "transmit" | "interlock",
    entries: Record<string, string>,
  ): Promise<void> {
    const parts = Object.entries(entries).map(
      ([key, value]) => `${key}=${value}`,
    );
    const command = `${namespace} bandset ${this.id} ${parts.join(" ")}`;
    await this.session.command(command);
    const change = this.session.getStore().patchTxBandSetting(this.id, entries);
    if (change) this.session.applyStateChange(change);
  }
}
