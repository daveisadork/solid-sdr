import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  ApdSamplerPort,
  ApdSnapshot,
  ApdTxAntenna,
} from "./state/apd.js";
import type { ApdStateChange } from "./state/index.js";
import { formatBooleanFlag } from "./controller-helpers.js";
import type { RadioSession } from "./radio-core.js";

export interface ApdControllerEvents {
  readonly change: ApdStateChange;
}

export interface ApdController extends Readonly<Omit<ApdSnapshot, "raw">> {
  snapshot(): ApdSnapshot | undefined;
  setEnabled(enabled: boolean): Promise<void>;
  equalizerReset(): Promise<void>;
  setSamplerPort(
    txAntenna: ApdTxAntenna,
    samplePort: ApdSamplerPort,
  ): Promise<void>;
  on<TKey extends keyof ApdControllerEvents>(
    event: TKey,
    listener: (payload: ApdControllerEvents[TKey]) => void,
  ): Subscription;
  onStateChange(change: ApdStateChange): void;
}

export class ApdControllerImpl implements ApdController {
  private readonly events = new TypedEventEmitter<ApdControllerEvents>();

  constructor(private readonly radio: RadioSession) {}

  private current(): ApdSnapshot {
    const snapshot = this.radio.getStore().getApd();
    if (!snapshot) {
      throw new FlexStateUnavailableError("APD status is not available");
    }
    return snapshot;
  }

  snapshot(): ApdSnapshot {
    return this.current();
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

  get rfPower(): number | undefined {
    return this.current().rfPower;
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

  get availableSamplerPortsAnt1(): readonly string[] {
    return this.current().availableSamplerPortsAnt1;
  }

  get availableSamplerPortsAnt2(): readonly string[] {
    return this.current().availableSamplerPortsAnt2;
  }

  get availableSamplerPortsXvta(): readonly string[] {
    return this.current().availableSamplerPortsXvta;
  }

  get availableSamplerPortsXvtb(): readonly string[] {
    return this.current().availableSamplerPortsXvtb;
  }

  get selectedSamplerPortAnt1(): string {
    return this.current().selectedSamplerPortAnt1;
  }

  get selectedSamplerPortAnt2(): string {
    return this.current().selectedSamplerPortAnt2;
  }

  get selectedSamplerPortXvta(): string {
    return this.current().selectedSamplerPortXvta;
  }

  get selectedSamplerPortXvtb(): string {
    return this.current().selectedSamplerPortXvtb;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const flag = formatBooleanFlag(enabled);
    const change = this.radio.getStore().patchApd({ enable: flag });
    if (change) this.radio.applyStateChange(change);
    try {
      await this.radio.command(`apd enable=${flag}`);
    } catch (error) {
      await this.radio.command("sub apd all");
      throw error;
    }
  }

  async equalizerReset(): Promise<void> {
    const change = this.radio.getStore().patchApd({ equalizer_reset: "" });
    if (change) this.radio.applyStateChange(change);
    try {
      await this.radio.command("apd reset");
    } catch (error) {
      await this.radio.command("sub apd all");
      throw error;
    }
  }

  async setSamplerPort(
    txAntenna: ApdTxAntenna,
    samplePort: ApdSamplerPort,
  ): Promise<void> {
    const normalizedTxAntenna = txAntenna.trim().toUpperCase();
    const normalizedSamplePort = samplePort.trim().toUpperCase();
    const change = this.radio.getStore().patchApd({
      tx_ant: normalizedTxAntenna,
      selected_sampler: normalizedSamplePort,
    });
    if (change) this.radio.applyStateChange(change);
    try {
      await this.radio.command(
        `apd sampler tx_ant=${normalizedTxAntenna} sample_port=${normalizedSamplePort}`,
      );
    } catch (error) {
      await this.radio.command("sub apd all");
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
