import type { Mutable, SnapshotUpdate } from "./common.js";
import { freezeAttributes, logParseError, parseInteger } from "./common.js";

/** NTP source directive. */
export type NtpDirective = "server" | "pool" | "peer";

/**
 * Immutable snapshot of one NTP time source the radio synchronizes to.
 */
export interface NtpSourceSnapshot {
  /** Source id chosen by the caller when the source was created. */
  readonly id: string;
  /** Host name or IP address. Wire: `address`. */
  readonly address: string;
  /** Wire: `directive`. An unexpected value is kept as sent. */
  readonly directive: NtpDirective | (string & {});
  /** Free text description. Wire: `description`. */
  readonly description: string;
  /** Whether the time service prefers this source while it is reachable. Wire: `prefer`. */
  readonly prefer: boolean;
  /** Whether the radio is synchronized to this source. Wire: `selected`. */
  readonly selected: boolean;
  /** Whether the source is enabled. Wire: `enabled`. */
  readonly enabled: boolean;
  /**
   * Source state from the radio's time service, such as `selected`,
   * `candidate`, `outlier`, `falseticker`, `jittery`, or `non-selectable`.
   * Empty when the radio has no data for the source. Wire: `state`.
   */
  readonly state: string;
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
        address: "",
        directive: "",
        description: "",
        prefer: false,
        selected: false,
        enabled: false,
        state: "",
        stratum: -1,
        reachability: -1,
      };

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "address":
        partial.address = value;
        break;
      case "directive":
        partial.directive = value;
        break;
      case "description":
        partial.description = value;
        break;
      case "enabled":
      case "selected":
      case "prefer": {
        if (value !== "0" && value !== "1") {
          logParseError("ntp_sources", key, value);
          break;
        }
        partial[key] = value === "1";
        break;
      }
      case "state":
        partial.state = value;
        if (value === "unknown") {
          partial.stratum = -1;
          partial.reachability = -1;
        }
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
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({ ...previous?.raw, ...attributes }),
  }) as NtpSourceSnapshot;
  return { snapshot, diff: Object.freeze(partial), rawDiff };
}
