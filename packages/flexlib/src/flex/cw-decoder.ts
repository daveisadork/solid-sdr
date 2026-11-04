import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type { CwDecoderSnapshot, CwDecoderStateChange } from "./state/index.js";

/** Events emitted by a {@link CwDecoderController}. */
export interface CwDecoderControllerEvents {
  /**
   * The radio sent decoder status. Fires once per message; `diff.text` is set
   * for each decoded character, including repeats and spaces.
   */
  readonly change: CwDecoderStateChange;
}

/**
 * Controller for the CW decoder on one slice. The radio has no decoder
 * commands, so the controller is read-only.
 */
export interface CwDecoderController
  extends Readonly<Omit<CwDecoderSnapshot, "raw">> {
  /** Returns the current snapshot of this decoder's state. */
  snapshot(): CwDecoderSnapshot;

  /** Registers a listener for decoder events. */
  on<TKey extends keyof CwDecoderControllerEvents>(
    event: TKey,
    listener: (payload: CwDecoderControllerEvents[TKey]) => void,
  ): Subscription;
}

export class CwDecoderControllerImpl implements CwDecoderController {
  private readonly events = new TypedEventEmitter<CwDecoderControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  snapshot(): CwDecoderSnapshot {
    return this.current();
  }

  get active(): CwDecoderSnapshot["active"] {
    return this.current().active;
  }

  get text(): CwDecoderSnapshot["text"] {
    return this.current().text;
  }

  get wpm(): CwDecoderSnapshot["wpm"] {
    return this.current().wpm;
  }

  get snrDb(): CwDecoderSnapshot["snrDb"] {
    return this.current().snrDb;
  }

  get locked(): CwDecoderSnapshot["locked"] {
    return this.current().locked;
  }

  get pitchHz(): CwDecoderSnapshot["pitchHz"] {
    return this.current().pitchHz;
  }

  get lowerSideband(): CwDecoderSnapshot["lowerSideband"] {
    return this.current().lowerSideband;
  }

  on<TKey extends keyof CwDecoderControllerEvents>(
    event: TKey,
    listener: (payload: CwDecoderControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: CwDecoderStateChange): void {
    this.events.emit("change", change);
  }

  private current(): CwDecoderSnapshot {
    const snapshot = this.radio.getStore().getCwDecoder(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `CW decoder for slice ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }
}
