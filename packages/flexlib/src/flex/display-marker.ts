import { TypedEventEmitter, type Subscription } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type {
  DisplayMarkerSnapshot,
  DisplayMarkerStateChange,
} from "./state/index.js";
import type { RadioSession } from "./radio-core.js";

/** Events emitted by a {@link DisplayMarkerController}. */
export interface DisplayMarkerControllerEvents {
  readonly change: DisplayMarkerStateChange;
}

/**
 * Controller for a single display marker.
 *
 * Display markers are radio-driven overlays, so this controller exposes
 * read-only state plus change notifications.
 */
export interface DisplayMarkerController
  extends Readonly<Omit<DisplayMarkerSnapshot, "raw">> {
  /** Returns the current snapshot of this marker's state. */
  snapshot(): DisplayMarkerSnapshot;

  /** Registers a listener for marker state changes. */
  on<TKey extends keyof DisplayMarkerControllerEvents>(
    event: TKey,
    listener: (payload: DisplayMarkerControllerEvents[TKey]) => void,
  ): Subscription;
}

/**
 * Default implementation of {@link DisplayMarkerController}.
 */
export class DisplayMarkerControllerImpl implements DisplayMarkerController {
  private readonly events =
    new TypedEventEmitter<DisplayMarkerControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly group: string,
    readonly id: string,
  ) {}

  snapshot(): DisplayMarkerSnapshot {
    return this.current();
  }

  get label(): string | undefined {
    return this.current().label;
  }

  get startFrequencyMHz(): number | undefined {
    return this.current().startFrequencyMHz;
  }

  get stopFrequencyMHz(): number | undefined {
    return this.current().stopFrequencyMHz;
  }

  get colorName(): string | undefined {
    return this.current().colorName;
  }

  get opacity(): number | undefined {
    return this.current().opacity;
  }

  on<TKey extends keyof DisplayMarkerControllerEvents>(
    event: TKey,
    listener: (payload: DisplayMarkerControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: DisplayMarkerStateChange): void {
    this.events.emit("change", change);
  }

  private current(): DisplayMarkerSnapshot {
    const snapshot = this.radio.getStore().getDisplayMarker(this.group, this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `Display marker ${this.group}/${this.id} is no longer available`,
      );
    }
    return snapshot;
  }
}
