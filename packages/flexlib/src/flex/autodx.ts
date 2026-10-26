import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import { createAutoDxSnapshot } from "./state/autodx.js";
import type {
  AutoDxSnapshot,
  AutoDxStateChange,
  AutoDxTrigger,
} from "./state/index.js";

/** Shortest wait for a reply after calling, in ms. */
export const AUTODX_AWAIT_REPLY_MIN_MS = 2000;
/** Longest wait for a reply after calling, in ms. */
export const AUTODX_AWAIT_REPLY_MAX_MS = 60000;
/** Shortest delay before transmitting, in ms. */
export const AUTODX_TX_DELAY_MIN_MS = 100;
/** Longest delay before transmitting, in ms. */
export const AUTODX_TX_DELAY_MAX_MS = 2000;
/** Shortest QSO timeout, in ms. */
export const AUTODX_TIMEOUT_MIN_MS = 60000;
/** Longest QSO timeout, in ms. */
export const AUTODX_TIMEOUT_MAX_MS = 600000;

/** Payload of the {@link AutoDxControllerEvents.sentText} event. */
export interface AutoDxSentTextEvent {
  /** Text the controller just transmitted. */
  readonly text: string;
}

/** Events emitted by an {@link AutoDxController}. */
export interface AutoDxControllerEvents {
  readonly change: AutoDxStateChange;
  /**
   * The controller transmitted text. The first transmission number the radio
   * reports only sets a baseline and does not fire this event.
   */
  readonly sentText: AutoDxSentTextEvent;
}

/**
 * Controller for AutoDX on one slice. AutoDX is an automated CW contact
 * controller that runs on the radio; this client sends its configuration and
 * shows the state it reports. The radio only arms AutoDX on a slice whose
 * chain is CW (see the slice's `chainMode`), and it refuses the arm command
 * otherwise.
 */
export interface AutoDxController
  extends Readonly<Omit<AutoDxSnapshot, "raw">> {
  /** Returns the current snapshot of this controller's state. */
  snapshot(): AutoDxSnapshot;

  /** Registers a listener for controller events. */
  on<TKey extends keyof AutoDxControllerEvents>(
    event: TKey,
    listener: (payload: AutoDxControllerEvents[TKey]) => void,
  ): Subscription;

  /**
   * Arms or disarms the controller. The new value shows at once. If the radio
   * refuses the command, the controller shows as disarmed and the error is
   * thrown. Disarming is always accepted.
   */
  setEnabled(enabled: boolean): Promise<void>;

  /**
   * Sets the DX call to chase. Only the first word is used, because an
   * operator may type the call and UP together. An empty value clears the call.
   */
  setDetect(detect: string): Promise<void>;

  /** Sets which copied tokens may start a call. `unknown` is never sent. */
  setTrigger(trigger: AutoDxTrigger): Promise<void>;

  /** Sets the exchange to send. It may contain spaces but not a line break. */
  setExchange(exchange: string): Promise<void>;

  /** Sets the wait for a reply after calling. 0 lets the controller choose; other values are clamped to 2000 to 60000 ms. */
  setAwaitReplyMs(ms: number): Promise<void>;

  /** Sets the delay before transmitting. 0 lets the controller choose; other values are clamped to 100 to 2000 ms. */
  setTxDelayMs(ms: number): Promise<void>;

  /** Sets the QSO timeout. 0 lets the controller choose; other values are clamped to 60000 to 600000 ms. */
  setTimeoutMs(ms: number): Promise<void>;

  /** Sets whether the timeout restarts on activity. */
  setTimeoutRestart(restart: boolean): Promise<void>;

  /** Sets how many times to repeat the call. Negative values become 0. */
  setCallRetries(retries: number): Promise<void>;

  /** Asks the radio to send the full controller status again. */
  requestStatus(): Promise<void>;
}

function clampOrChoose(
  value: number,
  min: number,
  max: number,
  label: string,
): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`);
  }
  if (value <= 0) return 0;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export class AutoDxControllerImpl implements AutoDxController {
  private readonly events = new TypedEventEmitter<AutoDxControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly sliceId: string,
  ) {}

  snapshot(): AutoDxSnapshot {
    return this.current();
  }

  get state() {
    return this.current().state;
  }

  get enabled() {
    return this.current().enabled;
  }

  get detect() {
    return this.current().detect;
  }

  get trigger() {
    return this.current().trigger;
  }

  get exchange() {
    return this.current().exchange;
  }

  get awaitReplyMs() {
    return this.current().awaitReplyMs;
  }

  get txDelayMs() {
    return this.current().txDelayMs;
  }

  get timeoutMs() {
    return this.current().timeoutMs;
  }

  get timeoutRestart() {
    return this.current().timeoutRestart;
  }

  get callRetries() {
    return this.current().callRetries;
  }

  get dxCall() {
    return this.current().dxCall;
  }

  get rxRst() {
    return this.current().rxRst;
  }

  get rxExchange() {
    return this.current().rxExchange;
  }

  get qsoCount() {
    return this.current().qsoCount;
  }

  get sentSeq() {
    return this.current().sentSeq;
  }

  get lastSentText() {
    return this.current().lastSentText;
  }

  get sentCount() {
    return this.current().sentCount;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.current().enabled === enabled) return;
    this.patch({ enabled: enabled ? "1" : "0" });
    try {
      await this.radio.command(
        `autodx ${this.sliceId} enable ${enabled ? "1" : "0"}`,
      );
    } catch (error) {
      this.patch({ enabled: "0" });
      throw error;
    }
  }

  async setDetect(detect: string): Promise<void> {
    const call = detect.split(/\s+/).find((token) => token.length > 0) ?? "";
    if (this.current().detect === call) return;
    this.patch({ detect: call });
    // A quoted empty value would not clear the call. Three tokens do.
    await this.radio.command(
      call
        ? `autodx ${this.sliceId} detect ${call}`
        : `autodx ${this.sliceId} detect`,
    );
  }

  async setTrigger(trigger: AutoDxTrigger): Promise<void> {
    if (trigger === "unknown" || this.current().trigger === trigger) return;
    this.patch({ trigger });
    await this.radio.command(`autodx ${this.sliceId} trigger ${trigger}`);
  }

  async setExchange(exchange: string): Promise<void> {
    if (/[\r\n]/.test(exchange)) {
      throw new RangeError("AutoDX exchange cannot hold a line break");
    }
    if (this.current().exchange === exchange) return;
    this.patch({ exchange });
    await this.radio.command(`autodx ${this.sliceId} exchange "${exchange}"`);
  }

  async setAwaitReplyMs(ms: number): Promise<void> {
    const value = clampOrChoose(
      ms,
      AUTODX_AWAIT_REPLY_MIN_MS,
      AUTODX_AWAIT_REPLY_MAX_MS,
      "AutoDX await reply",
    );
    if (this.current().awaitReplyMs === value) return;
    this.patch({ await_reply_ms: String(value) });
    await this.radio.command(`autodx ${this.sliceId} await_reply_ms ${value}`);
  }

  async setTxDelayMs(ms: number): Promise<void> {
    const value = clampOrChoose(
      ms,
      AUTODX_TX_DELAY_MIN_MS,
      AUTODX_TX_DELAY_MAX_MS,
      "AutoDX transmit delay",
    );
    if (this.current().txDelayMs === value) return;
    this.patch({ tx_delay_ms: String(value) });
    await this.radio.command(`autodx ${this.sliceId} tx_delay_ms ${value}`);
  }

  async setTimeoutMs(ms: number): Promise<void> {
    const value = clampOrChoose(
      ms,
      AUTODX_TIMEOUT_MIN_MS,
      AUTODX_TIMEOUT_MAX_MS,
      "AutoDX timeout",
    );
    if (this.current().timeoutMs === value) return;
    this.patch({ timeout_ms: String(value) });
    await this.radio.command(`autodx ${this.sliceId} timeout_ms ${value}`);
  }

  async setTimeoutRestart(restart: boolean): Promise<void> {
    if (this.current().timeoutRestart === restart) return;
    this.patch({ timeout_restart: restart ? "1" : "0" });
    await this.radio.command(
      `autodx ${this.sliceId} timeout_restart ${restart ? "1" : "0"}`,
    );
  }

  async setCallRetries(retries: number): Promise<void> {
    if (!Number.isFinite(retries)) {
      throw new RangeError("AutoDX call retries must be a finite number");
    }
    const value = Math.max(0, Math.round(retries));
    if (this.current().callRetries === value) return;
    this.patch({ call_retries: String(value) });
    await this.radio.command(`autodx ${this.sliceId} call_retries ${value}`);
  }

  async requestStatus(): Promise<void> {
    this.current();
    await this.radio.command(`autodx ${this.sliceId} status`);
  }

  on<TKey extends keyof AutoDxControllerEvents>(
    event: TKey,
    listener: (payload: AutoDxControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: AutoDxStateChange): void {
    this.events.emit("change", change);
    if (!change.removed && (change.diff.sentCount ?? 0) > 0) {
      const text = this.radio.getStore().getAutoDx(this.sliceId)?.lastSentText;
      if (text) this.events.emit("sentText", { text });
    }
  }

  private patch(attributes: Record<string, string>): void {
    const change = this.radio.getStore().patchAutoDx(this.sliceId, attributes);
    if (change) this.radio.applyStateChange(change);
  }

  private current(): AutoDxSnapshot {
    const store = this.radio.getStore();
    if (!store.getSlice(this.sliceId)) {
      throw new FlexStateUnavailableError(
        `Slice ${this.sliceId} is no longer available`,
      );
    }
    return (
      store.getAutoDx(this.sliceId) ??
      createAutoDxSnapshot(this.sliceId, {}).snapshot
    );
  }
}
