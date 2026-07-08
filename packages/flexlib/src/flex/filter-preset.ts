import { type Subscription, TypedEventEmitter } from "../util/events.js";
import { clampInteger, ensureFinite, toInteger } from "./controller-helpers.js";
import { FlexError, FlexStateUnavailableError } from "./errors.js";
import type { RadioSession } from "./radio-core.js";
import { FILTER_PRESET_COUNT } from "./state/filter-preset.js";
import type {
  FilterPresetEntry,
  FilterPresetModeGroup,
  FilterPresetSnapshot,
  FilterPresetStateChange,
} from "./state/index.js";

/** Events emitted by a {@link FilterPresetController}. */
export interface FilterPresetControllerEvents {
  readonly change: FilterPresetStateChange;
}

/** Input data used when saving a filter preset back to the radio. */
export interface FilterPresetSaveRequest {
  /** Short preset label sent as `name=...`. */
  readonly name: string;
  /** Low filter edge in Hz. */
  readonly filterLowHz: number;
  /** High filter edge in Hz. */
  readonly filterHighHz: number;
}

/**
 * Controller for the radio's filter preset inventory.
 *
 * Filter presets are radio-scoped, fixed-size banks of receive filter
 * settings grouped by mode family.
 */
export interface FilterPresetController
  extends Readonly<Omit<FilterPresetSnapshot, "raw">> {
  /** Returns the current snapshot of all filter preset groups. */
  snapshot(): FilterPresetSnapshot;

  /** Returns all presets for a given mode group. */
  group(modeGroup: FilterPresetModeGroup): readonly FilterPresetEntry[];

  /** Returns a single preset entry by mode group and slot index. */
  preset(
    modeGroup: FilterPresetModeGroup,
    index: number,
  ): FilterPresetEntry | undefined;

  /** Saves one preset slot to the radio and updates local state optimistically. */
  save(
    modeGroup: FilterPresetModeGroup,
    index: number,
    preset: FilterPresetSaveRequest,
  ): Promise<void>;

  /** Resets all presets in a mode group to the radio defaults. */
  reset(modeGroup: FilterPresetModeGroup): Promise<void>;

  /** Registers a listener for filter preset state changes. */
  on<TKey extends keyof FilterPresetControllerEvents>(
    event: TKey,
    listener: (payload: FilterPresetControllerEvents[TKey]) => void,
  ): Subscription;

  onStateChange(change: FilterPresetStateChange): void;
}

/** Default implementation of {@link FilterPresetController}. */
export class FilterPresetControllerImpl implements FilterPresetController {
  private readonly events =
    new TypedEventEmitter<FilterPresetControllerEvents>();

  constructor(private readonly radio: RadioSession) {}

  snapshot(): FilterPresetSnapshot {
    return this.current();
  }

  get ssb(): readonly FilterPresetEntry[] {
    return this.current().ssb;
  }

  get cw(): readonly FilterPresetEntry[] {
    return this.current().cw;
  }

  get am(): readonly FilterPresetEntry[] {
    return this.current().am;
  }

  get digital(): readonly FilterPresetEntry[] {
    return this.current().digital;
  }

  get rtty(): readonly FilterPresetEntry[] {
    return this.current().rtty;
  }

  group(modeGroup: FilterPresetModeGroup): readonly FilterPresetEntry[] {
    switch (modeGroup) {
      case "ssb":
        return this.current().ssb;
      case "cw":
        return this.current().cw;
      case "am":
        return this.current().am;
      case "digital":
        return this.current().digital;
      case "rtty":
        return this.current().rtty;
    }
  }

  preset(
    modeGroup: FilterPresetModeGroup,
    index: number,
  ): FilterPresetEntry | undefined {
    const slot = clampInteger(
      index,
      0,
      FILTER_PRESET_COUNT - 1,
      "Filter preset index",
    );
    return this.group(modeGroup)[slot];
  }

  async save(
    modeGroup: FilterPresetModeGroup,
    index: number,
    preset: FilterPresetSaveRequest,
  ): Promise<void> {
    const slot = clampInteger(
      index,
      0,
      FILTER_PRESET_COUNT - 1,
      "Filter preset index",
    );
    const name = normalizeFilterPresetName(preset.name);
    const filterLowHz = toInteger(
      ensureFinite(preset.filterLowHz, "Filter preset low edge"),
      "Filter preset low edge",
    );
    const filterHighHz = toInteger(
      ensureFinite(preset.filterHighHz, "Filter preset high edge"),
      "Filter preset high edge",
    );
    const attributes = {
      name,
      low: filterLowHz.toString(10),
      high: filterHighHz.toString(10),
    };
    const change = this.radio
      .getStore()
      .patchFilterPreset(modeGroup, slot, attributes);
    if (change) this.radio.applyStateChange(change);

    const nameSegment = name ? ` name=${name}` : "";
    try {
      await this.radio.command(
        `filt_preset save group=${modeGroup} num=${slot} low=${filterLowHz} high=${filterHighHz}${nameSegment}`,
      );
    } catch (error) {
      await this.radio.command("sub filt_preset all");
      throw error;
    }
  }

  async reset(modeGroup: FilterPresetModeGroup): Promise<void> {
    await this.radio.command(`filt_preset reset group=${modeGroup}`);
  }

  on<TKey extends keyof FilterPresetControllerEvents>(
    event: TKey,
    listener: (payload: FilterPresetControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  onStateChange(change: FilterPresetStateChange): void {
    this.events.emit("change", change);
  }

  private current(): FilterPresetSnapshot {
    const snapshot = this.radio.getStore().getFilterPresets();
    if (!snapshot) {
      throw new FlexStateUnavailableError(
        "Filter preset status is not available",
      );
    }
    return snapshot;
  }
}

function normalizeFilterPresetName(value: string): string {
  const normalized = value.trim();
  if (normalized.length > 4) {
    throw new FlexError("Filter preset name must be 4 characters or fewer");
  }
  if (/\s/.test(normalized)) {
    throw new FlexError("Filter preset name cannot contain whitespace");
  }
  return normalized;
}
