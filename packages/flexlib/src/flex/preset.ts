import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type { PresetSnapshot, PresetStateChange } from "./state/index.js";

/** Events emitted by a {@link PresetController}. */
export interface PresetControllerEvents {
  readonly change: PresetStateChange;
}

/**
 * Controller for a radio preset, a named bundle of settings the radio applies
 * together. Presets are read only: a client can apply one but not create,
 * edit, or delete it.
 */
export interface PresetController
  extends Readonly<Omit<PresetSnapshot, "raw">> {
  /** Returns the current snapshot of this preset. */
  snapshot(): PresetSnapshot;

  /** Registers a listener for preset state changes. */
  on<TKey extends keyof PresetControllerEvents>(
    event: TKey,
    listener: (payload: PresetControllerEvents[TKey]) => void,
  ): Subscription;

  /**
   * Applies this preset on the radio. Does nothing when this preset is
   * already the active one. The preset becomes active when the radio confirms.
   */
  select(): Promise<void>;
}

export class PresetControllerImpl implements PresetController {
  private readonly events = new TypedEventEmitter<PresetControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  snapshot(): PresetSnapshot {
    return this.current();
  }

  get name(): PresetSnapshot["name"] {
    return this.current().name;
  }

  get sliceConfig(): PresetSnapshot["sliceConfig"] {
    return this.current().sliceConfig;
  }

  get aleConfig(): PresetSnapshot["aleConfig"] {
    return this.current().aleConfig;
  }

  get active(): PresetSnapshot["active"] {
    return this.current().active;
  }

  async select(): Promise<void> {
    this.current();
    if (this.radio.getStore().getActivePresetId() === this.id) return;
    await this.radio.command(`preset apply id=${this.id}`);
  }

  on<TKey extends keyof PresetControllerEvents>(
    event: TKey,
    listener: (payload: PresetControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: PresetStateChange): void {
    this.events.emit("change", change);
  }

  private current(): PresetSnapshot {
    const snapshot = this.radio.getStore().getPreset(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Preset ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }
}
