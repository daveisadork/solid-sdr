import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  logParseError,
  logUnknownAttribute,
  parseInteger,
} from "./common.js";

/** NTP source directive. */
export type NtpDirective = "server" | "pool" | "peer";

const NTP_DIRECTIVES: ReadonlySet<string> = new Set<NtpDirective>([
  "server",
  "pool",
  "peer",
]);

function isNtpDirective(value: string): value is NtpDirective {
  return NTP_DIRECTIVES.has(value);
}

/** Source state from the radio's time service (chrony). */
export type NtpSourceState =
  | "selected"
  | "candidate"
  | "outlier"
  | "falseticker"
  | "jittery"
  | "non-selectable"
  | "unknown";

const NTP_SOURCE_STATES: ReadonlySet<string> = new Set<NtpSourceState>([
  "selected",
  "candidate",
  "outlier",
  "falseticker",
  "jittery",
  "non-selectable",
  "unknown",
]);

function isNtpSourceState(value: string): value is NtpSourceState {
  return NTP_SOURCE_STATES.has(value);
}

/**
 * Immutable snapshot of one NTP time source the radio synchronizes to.
 */
export interface NtpSourceSnapshot {
  /** Source id chosen by the caller when the source was created. */
  readonly id: string;
  /** Host name or IP address. Wire: `address`. */
  readonly address: string;
  /** Wire: `directive`. An unexpected value is kept as sent. */
  readonly directive: NtpDirective;
  /** Free text description. Wire: `description`. */
  readonly description: string;
  /** Whether the time service prefers this source while it is reachable. Wire: `prefer`. */
  readonly prefer: boolean;
  /** Whether the radio is synchronized to this source. Wire: `selected`. */
  readonly selected: boolean;
  /** Whether the source is enabled. Wire: `enabled`. */
  readonly enabled: boolean;
  /** Source state from the radio's time service. Wire: `state`. */
  readonly state: NtpSourceState;
  /** Stratum, or -1 when unknown. Wire: `stratum`. */
  readonly stratum: number;
  /** 8-bit reachability register (0 to 255), or -1 when unknown. Wire: `reach`. */
  readonly reachability: number;
  readonly raw: Readonly<Record<string, string>>;
}

export function createNtpSourceSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: NtpSourceSnapshot,
): SnapshotUpdate<NtpSourceSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<NtpSourceSnapshot>> = previous
    ? {}
    : {
        id,
        description: "",
        state: "unknown",
      };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "id":
      case "address":
      case "description":
        partial[key] = value;
        break;
      case "directive":
        if (isNtpDirective(value)) partial.directive = value;
        else logParseError("ntp_sources", key, value);
        break;
      case "enabled":
      case "selected":
      case "prefer": {
        partial[key] = value === "1";
        break;
      }
      case "state":
        if (isNtpSourceState(value)) partial.state = value;
        else logParseError("ntp_sources", key, value);
        break;
      case "stratum": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.stratum = parsed;
        else logParseError("ntp_sources", key, value);
        break;
      }
      case "reach": {
        const parsed = parseInteger(value);
        if (parsed !== undefined) partial.reachability = parsed;
        else logParseError("ntp_sources", key, value);
        break;
      }
      default:
        logUnknownAttribute("ntp_sources", key, value);
        break;
    }
  }

  if (partial.state === "unknown") {
    partial.stratum = partial.stratum ?? -1;
    partial.reachability = partial.reachability ?? -1;
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({ ...previous?.raw, ...attributes }),
  }) as NtpSourceSnapshot;
  return { snapshot, diff: Object.freeze(partial), rawDiff };
}
