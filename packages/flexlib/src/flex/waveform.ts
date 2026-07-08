import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { FlexError, FlexStateUnavailableError } from "./errors.js";
import type { RadioCommandOptions, RadioSession } from "./radio-core.js";
import type { WaveformSnapshot, WaveformStateChange } from "./state/index.js";

export interface WaveformControllerEvents {
  readonly change: WaveformStateChange;
}

export interface WaveformController
  extends Readonly<Omit<WaveformSnapshot, "raw">> {
  snapshot(): WaveformSnapshot;
  uninstall(options?: Pick<RadioCommandOptions, "timeoutMs">): Promise<void>;
  restart(options?: Pick<RadioCommandOptions, "timeoutMs">): Promise<void>;
  on<TKey extends keyof WaveformControllerEvents>(
    event: TKey,
    listener: (payload: WaveformControllerEvents[TKey]) => void,
  ): Subscription;
  onStateChange(change: WaveformStateChange): void;
}

export class WaveformControllerImpl implements WaveformController {
  private readonly events = new TypedEventEmitter<WaveformControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  private current(): WaveformSnapshot {
    const snapshot = this.radio.getStore().getWaveform(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError("Waveform status is not available");
    }
    return snapshot;
  }

  snapshot(): WaveformSnapshot {
    return this.current();
  }

  get name(): string {
    return this.current().name;
  }

  get version(): string {
    return this.current().version;
  }

  get isContainer(): boolean {
    return this.current().isContainer;
  }

  get displayName(): string {
    return this.current().displayName;
  }

  async uninstall({
    timeoutMs = 30_000,
  }: Pick<RadioCommandOptions, "timeoutMs"> = {}): Promise<void> {
    const snapshot = this.current();
    if (snapshot.isContainer) {
      await this.radio.command(`waveform remove_container ${snapshot.name}`, {
        timeoutMs,
      });
      return;
    }
    await this.radio.command(`waveform uninstall ${snapshot.name}`, {
      timeoutMs,
    });
  }

  async restart({
    timeoutMs = 30_000,
  }: Pick<RadioCommandOptions, "timeoutMs"> = {}): Promise<void> {
    const snapshot = this.current();
    if (!snapshot.isContainer) {
      throw new FlexError("Only container waveforms can be restarted");
    }
    await this.radio.command(`waveform restart ${snapshot.name}`, {
      timeoutMs,
    });
  }

  on<TKey extends keyof WaveformControllerEvents>(
    event: TKey,
    listener: (payload: WaveformControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: WaveformStateChange): void {
    this.events.emit("change", change);
  }
}
