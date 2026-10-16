import type { Mutable, SnapshotUpdate } from "./common.js";
import { freezeAttributes, parseInteger } from "./common.js";
import { decodeCwxText } from "./cwx.js";

/** Lifecycle state of the AutoDX controller. */
export type AutoDxState =
  | "Disabled"
  | "Monitor"
  | "TxDelay"
  | "Calling"
  | "AwaitReply"
  | "SendExchange"
  | "Log"
  | "Unknown";

/**
 * Which copied tokens may put the radio on the air once the DX call has been
 * copied. `unknown` is a trigger this library does not know; it is reported,
 * never sent.
 */
export type AutoDxTrigger = "either" | "call_up" | "up" | "unknown";

/**
 * Immutable snapshot of the AutoDX controller for one slice. The controller
 * runs on the radio; its configuration and state arrive on the `autodx` status.
 */
export interface AutoDxSnapshot {
  /** Id of the slice the controller is bound to. */
  readonly sliceId: string;
  /** Wire: `state`. */
  readonly state: AutoDxState;
  /** Whether the controller is armed. Wire: `enabled`. */
  readonly enabled: boolean;
  /** DX call to chase. Wire: `detect`. */
  readonly detect: string;
  /** Wire: `trigger`. */
  readonly trigger: AutoDxTrigger;
  /** Exchange to send. Wire: `exchange`. */
  readonly exchange: string;
  /** Wait for a reply after calling, in ms. 0 lets the controller choose. Wire: `await_reply_ms`. */
  readonly awaitReplyMs: number;
  /** Delay before transmitting, in ms. 0 lets the controller choose. Wire: `tx_delay_ms`. */
  readonly txDelayMs: number;
  /** QSO timeout in ms. 0 lets the controller choose. Wire: `timeout_ms`. */
  readonly timeoutMs: number;
  /** Whether the timeout restarts on activity. Wire: `timeout_restart`. */
  readonly timeoutRestart: boolean;
  /** Number of times to repeat the call. Wire: `call_retries`. */
  readonly callRetries: number;
  /** Call of the station being worked. Wire: `dx_call`. */
  readonly dxCall: string;
  /** Report received from the DX. Wire: `rx_rst`. */
  readonly rxRst: string;
  /** Exchange copied from the DX. Wire: `rx_exchange`. */
  readonly rxExchange: string;
  /** Number of QSOs logged. Wire: `qso_count`. */
  readonly qsoCount: number;
  /**
   * Last transmission sequence number the radio reported. The first one seen
   * is a baseline, not a transmission. Wire: `sent_seq`.
   */
  readonly sentSeq?: number;
  /** Text of the most recent transmission after the baseline. Wire: `sent_text`. */
  readonly lastSentText: string;
  /** Number of transmissions reported after the baseline. */
  readonly sentCount: number;
  readonly raw: Readonly<Record<string, string>>;
}

const STATE_BY_WIRE: Readonly<Record<string, AutoDxState>> = {
  disabled: "Disabled",
  monitor: "Monitor",
  calling: "Calling",
  tx_delay: "TxDelay",
  await_reply: "AwaitReply",
  send_exchange: "SendExchange",
  log: "Log",
};

const TRIGGERS: ReadonlySet<string> = new Set(["either", "call_up", "up"]);

export function createAutoDxSnapshot(
  sliceId: string,
  attributes: Record<string, string>,
  previous?: AutoDxSnapshot,
): SnapshotUpdate<AutoDxSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<AutoDxSnapshot>> = previous
    ? {}
    : {
        sliceId,
        state: "Disabled",
        enabled: false,
        detect: "",
        trigger: "either",
        exchange: "",
        awaitReplyMs: 0,
        txDelayMs: 0,
        timeoutMs: 0,
        timeoutRestart: false,
        callRetries: 0,
        dxCall: "",
        rxRst: "",
        rxExchange: "",
        qsoCount: 0,
        lastSentText: "",
        sentCount: 0,
      };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "state":
        partial.state = STATE_BY_WIRE[value.toLowerCase()] ?? "Unknown";
        break;
      case "enabled":
        partial.enabled = value === "1";
        break;
      case "detect":
        partial.detect = value;
        break;
      case "exchange":
        partial.exchange = value;
        break;
      case "trigger":
        partial.trigger = TRIGGERS.has(value)
          ? (value as AutoDxTrigger)
          : "unknown";
        break;
      case "await_reply_ms":
      case "tx_delay_ms":
      case "timeout_ms":
      case "call_retries":
      case "qso_count": {
        const parsed = parseInteger(value);
        if (parsed === undefined) break;
        if (key === "await_reply_ms") partial.awaitReplyMs = parsed;
        else if (key === "tx_delay_ms") partial.txDelayMs = parsed;
        else if (key === "timeout_ms") partial.timeoutMs = parsed;
        else if (key === "call_retries") partial.callRetries = parsed;
        else partial.qsoCount = parsed;
        break;
      }
      case "timeout_restart":
        partial.timeoutRestart = value === "1";
        break;
      case "dx_call":
        partial.dxCall = value;
        break;
      case "rx_rst":
        partial.rxRst = value;
        break;
      case "rx_exchange":
        partial.rxExchange = decodeCwxText(value);
        break;
      case "sent_text":
        partial.lastSentText = value;
        break;
    }
  }

  if ("sent_seq" in attributes) {
    const seq = parseInteger(attributes.sent_seq);
    if (seq !== undefined) {
      const seen = previous?.sentSeq;
      if (seen === undefined) {
        // The first sequence only sets the baseline. A transmission it
        // describes happened before this client arrived, so it is not counted.
        partial.sentSeq = seq;
      } else if (seq !== seen) {
        partial.sentSeq = seq;
        const text = partial.lastSentText ?? previous?.lastSentText ?? "";
        if (text.length > 0) partial.sentCount = (previous?.sentCount ?? 0) + 1;
      }
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({ ...previous?.raw, ...attributes }),
  }) as AutoDxSnapshot;
  return { snapshot, diff: Object.freeze(partial), rawDiff };
}
