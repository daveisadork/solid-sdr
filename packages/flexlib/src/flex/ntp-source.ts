import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import type {
  NtpDirective,
  NtpSourceSnapshot,
  NtpSourceStateChange,
} from "./state/index.js";

/** Most NTP sources the radio keeps at one time. */
export const NTP_MAX_SOURCES = 10;

/** Longest description that always survives the radio's command parsing. */
export const NTP_MAX_DESCRIPTION_LENGTH = 62;

const VALID_ID = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;
const VALID_ADDRESS = /^[A-Za-z0-9._:%-]+$/;
const VALID_DESCRIPTION = /^[A-Za-z0-9._\- ]*$/;
const DIRECTIVES: ReadonlySet<string> = new Set(["server", "pool", "peer"]);

/** True for 1 to 64 letters, digits, and hyphens that do not start or end with a hyphen. */
export function isValidNtpSourceId(id: string): boolean {
  return id.length <= 64 && VALID_ID.test(id);
}

/** True for 1 to 253 characters from letters, digits, and `. : - _ %`. */
export function isValidNtpAddress(address: string): boolean {
  return address.length <= 253 && VALID_ADDRESS.test(address);
}

/** True for up to 62 characters from letters, digits, spaces, and `. _ -`. */
export function isValidNtpDescription(description: string): boolean {
  return (
    description.length <= NTP_MAX_DESCRIPTION_LENGTH &&
    VALID_DESCRIPTION.test(description)
  );
}

/** True for `server`, `pool`, or `peer`. */
export function isValidNtpDirective(directive: string): boolean {
  return DIRECTIVES.has(directive);
}

/** Fields for creating an NTP source. */
export interface NtpSourceCreateOptions {
  /** Unique id for the new source. See {@link isValidNtpSourceId}. */
  readonly id: string;
  /** Host name or IP address. See {@link isValidNtpAddress}. */
  readonly address: string;
  readonly directive: NtpDirective;
  /** Optional description. See {@link isValidNtpDescription}. */
  readonly description?: string;
  /** Whether the time service should prefer this source. Defaults to false. */
  readonly prefer?: boolean;
}

/**
 * Builds the create command, or throws {@link RangeError} when a field is not
 * one the radio accepts. Nothing is sent for an invalid field.
 */
export function buildNtpSourceCreateCommand(
  options: NtpSourceCreateOptions,
): string {
  const { id, address, directive, description = "", prefer } = options;
  if (!isValidNtpSourceId(id)) {
    throw new RangeError(`Invalid NTP source id: ${id}`);
  }
  if (!isValidNtpAddress(address)) {
    throw new RangeError(`Invalid NTP source address: ${address}`);
  }
  if (!isValidNtpDirective(directive)) {
    throw new RangeError(`Invalid NTP source directive: ${directive}`);
  }
  if (!isValidNtpDescription(description)) {
    throw new RangeError("Invalid NTP source description");
  }
  let command = `ntp_sources create id=${id} address=${address} directive=${directive}`;
  if (description) command += ` description="${description}"`;
  if (prefer) command += " prefer=1";
  return command;
}

/** Events emitted by an {@link NtpSourceController}. */
export interface NtpSourceControllerEvents {
  readonly change: NtpSourceStateChange;
}

/**
 * Controller for one NTP time source. The radio has no command to edit a
 * source. To change one, remove it and create it again.
 */
export interface NtpSourceController
  extends Readonly<Omit<NtpSourceSnapshot, "raw">> {
  /** Returns the current snapshot of this source. */
  snapshot(): NtpSourceSnapshot;

  /** Registers a listener for source state changes. */
  on<TKey extends keyof NtpSourceControllerEvents>(
    event: TKey,
    listener: (payload: NtpSourceControllerEvents[TKey]) => void,
  ): Subscription;

  /**
   * Enables or disables the source. The new value shows at once and is undone
   * if the radio refuses the command.
   */
  setEnabled(enabled: boolean): Promise<void>;

  replace(source: Omit<NtpSourceCreateOptions, "id">): Promise<void>;

  /** Removes the source from the radio. */
  remove(): Promise<void>;
}

export class NtpSourceControllerImpl implements NtpSourceController {
  private readonly events = new TypedEventEmitter<NtpSourceControllerEvents>();

  constructor(
    private readonly radio: RadioSession,
    readonly id: string,
  ) {}

  snapshot(): NtpSourceSnapshot {
    return this.current();
  }

  get address(): NtpSourceSnapshot["address"] {
    return this.current().address;
  }

  get directive(): NtpSourceSnapshot["directive"] {
    return this.current().directive;
  }

  get description(): NtpSourceSnapshot["description"] {
    return this.current().description;
  }

  get prefer(): NtpSourceSnapshot["prefer"] {
    return this.current().prefer;
  }

  get selected(): NtpSourceSnapshot["selected"] {
    return this.current().selected;
  }

  get enabled(): NtpSourceSnapshot["enabled"] {
    return this.current().enabled;
  }

  get state(): NtpSourceSnapshot["state"] {
    return this.current().state;
  }

  get stratum(): NtpSourceSnapshot["stratum"] {
    return this.current().stratum;
  }

  get reachability(): NtpSourceSnapshot["reachability"] {
    return this.current().reachability;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.patch({ enabled: enabled ? "1" : "0" });
    try {
      await this.radio.command(
        `ntp_sources ${enabled ? "enable" : "disable"} id=${this.id}`,
      );
    } catch (error) {
      await this.radio.command(`sub ntp_sources ${this.id}`);
      throw error;
    }
  }

  async remove(): Promise<void> {
    await this.radio.command(`ntp_sources remove id=${this.id}`);
  }

  async replace(source: Omit<NtpSourceCreateOptions, "id">): Promise<void> {
    const { id, address, directive, description, prefer, enabled } =
      this.current();
    this.patch({
      address: source.address,
      directive: source.directive,
      description: source.description ?? "",
      prefer: source.prefer ? "1" : "0",
    });
    try {
      this.radio.getStore().setNtpSourceReplacing(this.id);
      await this.remove();
      await this.radio.createNtpSource({ ...source, id });
    } catch (error) {
      await this.radio
        .createNtpSource({
          id,
          address,
          directive,
          description,
          prefer,
        })
        .catch(() => {});
      throw error;
    } finally {
      if (!enabled) await this.setEnabled(enabled);
      this.radio.getStore().clearNtpSourceReplacing(this.id);
    }
  }

  on<TKey extends keyof NtpSourceControllerEvents>(
    event: TKey,
    listener: (payload: NtpSourceControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: NtpSourceStateChange): void {
    this.events.emit("change", change);
  }

  private patch(attributes: Record<string, string>): void {
    const change = this.radio.getStore().patchNtpSource(this.id, attributes);
    if (change) this.radio.applyStateChange(change);
  }

  private current(): NtpSourceSnapshot {
    const snapshot = this.radio.getStore().getNtpSource(this.id);
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        `NTP source ${this.id} is no longer available`,
      );
    }
    return snapshot;
  }
}
