import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type {
  DvkRecording,
  DvkSnapshot,
  DvkStateChange,
} from "./state/index.js";

/** Events emitted by a {@link DvkController}. */
export interface DvkControllerEvents {
  readonly change: DvkStateChange;
}

/**
 * Controller for the DVK (Digital Voice Keyer).
 *
 * Provides access to DVK system status and stored recordings, and
 * methods to create, record, play, and manage voice keyer entries.
 */
export interface DvkController extends Readonly<Omit<DvkSnapshot, "raw">> {
  /** Returns the current snapshot of DVK state. */
  snapshot(): DvkSnapshot;

  /** Registers a listener for DVK state changes. */
  on<TKey extends keyof DvkControllerEvents>(
    event: TKey,
    listener: (payload: DvkControllerEvents[TKey]) => void,
  ): Subscription;

  /** Creates a new recording with the given name. */
  create(name: string): Promise<void>;

  /** Starts recording into the specified recording slot. */
  startRecording(id: string): Promise<void>;

  /** Stops the current recording. */
  stopRecording(): Promise<void>;

  /** Starts preview playback of the specified recording. */
  startPreview(id: string): Promise<void>;

  /** Stops preview playback. */
  stopPreview(): Promise<void>;

  /** Starts playback (on-air) of the specified recording. */
  startPlayback(id: string): Promise<void>;

  /** Stops playback. */
  stopPlayback(): Promise<void>;

  /** Deletes a recording by ID. */
  remove(id: string): Promise<void>;

  /** Renames a recording. */
  setName(id: string, name: string): Promise<void>;

  /** Clears all recordings. */
  clearAll(): Promise<void>;
}

export class DvkControllerImpl implements DvkController {
  private readonly events = new TypedEventEmitter<DvkControllerEvents>();

  constructor(private readonly radio: RadioSession) {}

  private current(): DvkSnapshot {
    const snapshot = this.radio.getStore().getDvk();
    if (!snapshot) {
      throw new FlexStateUnavailableError("DVK status is not available");
    }
    return snapshot;
  }

  snapshot(): DvkSnapshot {
    return this.current();
  }

  get status() {
    return this.current().status;
  }

  get enabled(): boolean {
    return this.current().enabled;
  }

  get statusRecordingId(): string | undefined {
    return this.current().statusRecordingId;
  }

  get recordings(): readonly DvkRecording[] {
    return this.current().recordings;
  }

  async create(name: string): Promise<void> {
    await this.radio.command(`dvk create name="${name}"`);
  }

  async startRecording(id: string): Promise<void> {
    await this.radio.command(`dvk rec_start id=${id}`);
  }

  async stopRecording(): Promise<void> {
    await this.radio.command("dvk rec_stop");
  }

  async startPreview(id: string): Promise<void> {
    await this.radio.command(`dvk preview_start id=${id}`);
  }

  async stopPreview(): Promise<void> {
    await this.radio.command("dvk preview_stop");
  }

  async startPlayback(id: string): Promise<void> {
    await this.radio.command(`dvk playback_start id=${id}`);
  }

  async stopPlayback(): Promise<void> {
    await this.radio.command("dvk playback_stop");
  }

  async remove(id: string): Promise<void> {
    await this.radio.command(`dvk remove id=${id}`);
  }

  async setName(id: string, name: string): Promise<void> {
    await this.radio.command(`dvk set_name id=${id} name="${name}"`);
  }

  async clearAll(): Promise<void> {
    await this.radio.command("dvk clear");
  }

  on<TKey extends keyof DvkControllerEvents>(
    event: TKey,
    listener: (payload: DvkControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: DvkStateChange): void {
    this.events.emit("change", change);
  }
}
