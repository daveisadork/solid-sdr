import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type { SpotSnapshot, SpotStateChange } from "./state/index.js";

/** Payload for the spot "triggered" event. */
export interface SpotTriggeredEvent {
  readonly spotId: string;
  readonly panadapterStreamId?: string;
}

/** Events emitted by a {@link SpotController}. */
export interface SpotControllerEvents {
  readonly change: SpotStateChange;
  readonly triggered: SpotTriggeredEvent;
}

/**
 * Controller for a single DX spot.
 *
 * Provides read access to spot properties and methods to update,
 * trigger (click), or remove the spot.
 */
export interface SpotController extends Readonly<Omit<SpotSnapshot, "raw">> {
  /** Returns the current snapshot of this spot's state. */
  snapshot(): SpotSnapshot;

  /** Registers a listener for spot state changes. */
  on<TKey extends keyof SpotControllerEvents>(
    event: TKey,
    listener: (payload: SpotControllerEvents[TKey]) => void,
  ): Subscription;

  /** Triggers (clicks) the spot, optionally targeting a panadapter. */
  trigger(panadapterStreamId?: string): Promise<void>;

  /** Removes this spot from the radio. */
  remove(): Promise<void>;
}

export class SpotControllerImpl implements SpotController {
  private readonly events = new TypedEventEmitter<SpotControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  snapshot(): SpotSnapshot {
    return this.current();
  }

  get callsign(): SpotSnapshot["callsign"] {
    return this.current().callsign;
  }

  get rxFreqMHz(): SpotSnapshot["rxFreqMHz"] {
    return this.current().rxFreqMHz;
  }

  get txFreqMHz(): SpotSnapshot["txFreqMHz"] {
    return this.current().txFreqMHz;
  }

  get mode(): SpotSnapshot["mode"] {
    return this.current().mode;
  }

  get color(): SpotSnapshot["color"] {
    return this.current().color;
  }

  get backgroundColor(): SpotSnapshot["backgroundColor"] {
    return this.current().backgroundColor;
  }

  get source(): SpotSnapshot["source"] {
    return this.current().source;
  }

  get spotterCallsign(): SpotSnapshot["spotterCallsign"] {
    return this.current().spotterCallsign;
  }

  get timestampSec(): SpotSnapshot["timestampSec"] {
    return this.current().timestampSec;
  }

  get lifetimeSeconds(): SpotSnapshot["lifetimeSeconds"] {
    return this.current().lifetimeSeconds;
  }

  get comment(): SpotSnapshot["comment"] {
    return this.current().comment;
  }

  get priority(): SpotSnapshot["priority"] {
    return this.current().priority;
  }

  get triggerAction(): SpotSnapshot["triggerAction"] {
    return this.current().triggerAction;
  }

  async trigger(panadapterStreamId?: string): Promise<void> {
    const panArg = panadapterStreamId ? ` pan=${panadapterStreamId}` : "";
    await this.radio.command(`spot trigger ${this.id}${panArg}`);
  }

  async remove(): Promise<void> {
    await this.radio.command(`spot remove ${this.id}`);
    const change = this.radio.getStore().removeSpot(this.id);
    if (change) this.radio.applyStateChange(change);
  }

  on<TKey extends keyof SpotControllerEvents>(
    event: TKey,
    listener: (payload: SpotControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: SpotStateChange): void {
    this.events.emit("change", change);
  }

  /** @internal Called by Radio when a triggered status arrives for this spot. */
  onTriggered(panadapterStreamId?: string): void {
    this.events.emit("triggered", {
      spotId: this.id,
      panadapterStreamId,
    });
  }

  private current(): SpotSnapshot {
    const snapshot = this.radio.getStore().getSpot(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Spot ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }
}
