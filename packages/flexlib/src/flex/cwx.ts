import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { clampInteger, formatBooleanFlag } from "./controller-helpers.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type { CwxSnapshot, CwxStateChange } from "./state/index.js";

/** Events emitted by a {@link CwxController}. */
export interface CwxControllerEvents {
  readonly change: CwxStateChange;
}

/**
 * Controller for the CWX (character-based CW keyer).
 *
 * Provides read access to keyer state and methods to send CW text,
 * manage macros, and configure speed/delay settings.
 */
export interface CwxController extends Readonly<Omit<CwxSnapshot, "raw">> {
  /** Returns the current snapshot of CWX state. */
  snapshot(): CwxSnapshot;

  /** Registers a listener for CWX state changes. */
  on<TKey extends keyof CwxControllerEvents>(
    event: TKey,
    listener: (payload: CwxControllerEvents[TKey]) => void,
  ): Subscription;

  /** Sets the break-in delay in milliseconds (clamped to 0–2000). */
  setDelay(ms: number): Promise<void>;

  /** Sets the sending speed in words per minute (clamped to 5–100). */
  setSpeed(wpm: number): Promise<void>;

  /** Enables or disables QSK (full break-in). */
  setQskEnabled(enabled: boolean): Promise<void>;

  /** Saves a macro to the given slot (0–11). */
  setMacro(index: number, text: string): Promise<void>;

  /** Sends a stored macro by slot index (0–11). */
  sendMacro(index: number): Promise<void>;

  /** Sends arbitrary CW text. */
  send(text: string): Promise<void>;

  /** Erases the specified number of characters from the CW buffer. */
  erase(count: number): Promise<void>;

  /** Clears the entire CW buffer. */
  clearBuffer(): Promise<void>;
}

export class CwxControllerImpl implements CwxController {
  private readonly events = new TypedEventEmitter<CwxControllerEvents>();

  constructor(private readonly radio: RadioSession) {}

  private current(): CwxSnapshot {
    const snapshot = this.radio.getStore().getCwx();
    if (!snapshot) {
      throw new FlexStateUnavailableError("CWX status is not available");
    }
    return snapshot;
  }

  snapshot(): CwxSnapshot {
    return this.current();
  }

  get delay(): number {
    return this.current().delay;
  }

  get speed(): number {
    return this.current().speed;
  }

  get qskEnabled(): boolean {
    return this.current().qskEnabled;
  }

  get daxSidetoneEnabled(): boolean {
    return this.current().daxSidetoneEnabled;
  }

  get mfSidetoneEnabled(): boolean {
    return this.current().mfSidetoneEnabled;
  }

  get macros(): readonly string[] {
    return this.current().macros;
  }

  async setDelay(ms: number): Promise<void> {
    const clamped = clampInteger(ms, 0, 2000, "CWX delay");
    await this.radio.command(`cwx delay ${clamped}`);
    const change = this.radio
      .getStore()
      .patchCwx({ break_in_delay: clamped.toString(10) });
    if (change) this.radio.applyStateChange(change);
  }

  async setSpeed(wpm: number): Promise<void> {
    const clamped = clampInteger(wpm, 5, 100, "CWX speed");
    await this.radio.command(`cwx wpm ${clamped}`);
    const change = this.radio
      .getStore()
      .patchCwx({ wpm: clamped.toString(10) });
    if (change) this.radio.applyStateChange(change);
  }

  async setQskEnabled(enabled: boolean): Promise<void> {
    const flag = formatBooleanFlag(enabled);
    await this.radio.command(`cwx qsk_enabled ${flag}`);
    const change = this.radio.getStore().patchCwx({ qsk_enabled: flag });
    if (change) this.radio.applyStateChange(change);
  }

  async setMacro(index: number, text: string): Promise<void> {
    const slot = clampInteger(index, 0, 11, "CWX macro index");
    const wireIndex = slot + 1; // wire protocol is 1-indexed
    await this.radio.command(`cwx macro save ${wireIndex} "${text}"`);
    const change = this.radio
      .getStore()
      .patchCwx({ [`macro${wireIndex}`]: text });
    if (change) this.radio.applyStateChange(change);
  }

  async sendMacro(index: number): Promise<void> {
    const slot = clampInteger(index, 0, 11, "CWX macro index");
    await this.radio.command(`cwx macro send ${slot + 1}`);
  }

  async send(text: string): Promise<void> {
    await this.radio.command(`cwx send "${text.replaceAll(" ", "\x7f")}"`);
  }

  async erase(count: number): Promise<void> {
    const n = clampInteger(count, 1, 255, "CWX erase count");
    await this.radio.command(`cwx erase ${n}`);
  }

  async clearBuffer(): Promise<void> {
    await this.radio.command("cwx clear");
  }

  on<TKey extends keyof CwxControllerEvents>(
    event: TKey,
    listener: (payload: CwxControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: CwxStateChange): void {
    this.events.emit("change", change);
  }
}
