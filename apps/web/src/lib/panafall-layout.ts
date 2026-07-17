/**
 * Layout tree model for multi-panafall tiling.
 *
 * A layout is a tmux-style nested split tree whose leaves are panafall slots.
 * Slots are numbered by depth-first (reading) order of the preset tree, so
 * slot 0 is always the top-left panafall in every preset and per-slot state
 * carries over meaningfully when the user switches presets.
 *
 * Split sizes are NOT stored in the tree — presets are immutable data. User
 * dragged sizes persist separately, keyed by preset id + split path (the
 * preorder tree-position string: "" for the root split, "0", "1.0", ...).
 */

export type SlotId = 0 | 1 | 2 | 3;
export type SplitDir = "row" | "col";

export type LayoutNode =
  | { kind: "cell"; slot: SlotId }
  | { kind: "split"; dir: SplitDir; children: LayoutNode[] };

export type LayoutPresetId =
  | "1"
  | "2v"
  | "2h"
  | "3v"
  | "1+2"
  | "4v"
  | "2x2"
  | "1+3";

export type PanCount = 1 | 2 | 3 | 4;

export interface LayoutPreset {
  id: LayoutPresetId;
  label: string;
  /** Number of leaf cells in the tree. */
  capacity: PanCount;
  root: LayoutNode;
}

const cell = (slot: SlotId): LayoutNode => ({ kind: "cell", slot });
const split = (dir: SplitDir, ...children: LayoutNode[]): LayoutNode => ({
  kind: "split",
  dir,
  children,
});

/**
 * "col" stacks children vertically (a column of rows); "row" places them side
 * by side. The *v presets match the pre-cell-model vertical stacking.
 */
export const LAYOUT_PRESETS: Record<LayoutPresetId, LayoutPreset> = {
  "1": { id: "1", label: "Single", capacity: 1, root: cell(0) },
  "2v": {
    id: "2v",
    label: "2 stacked",
    capacity: 2,
    root: split("col", cell(0), cell(1)),
  },
  "2h": {
    id: "2h",
    label: "2 side by side",
    capacity: 2,
    root: split("row", cell(0), cell(1)),
  },
  "3v": {
    id: "3v",
    label: "3 stacked",
    capacity: 3,
    root: split("col", cell(0), cell(1), cell(2)),
  },
  "1+2": {
    id: "1+2",
    label: "1 + 2 stacked",
    capacity: 3,
    root: split("row", cell(0), split("col", cell(1), cell(2))),
  },
  "4v": {
    id: "4v",
    label: "4 stacked",
    capacity: 4,
    root: split("col", cell(0), cell(1), cell(2), cell(3)),
  },
  "2x2": {
    id: "2x2",
    label: "2 x 2 grid",
    capacity: 4,
    root: split(
      "col",
      split("row", cell(0), cell(1)),
      split("row", cell(2), cell(3)),
    ),
  },
  "1+3": {
    id: "1+3",
    label: "1 + 3 stacked",
    capacity: 4,
    root: split("row", cell(0), split("col", cell(1), cell(2), cell(3))),
  },
};

/** The preset used for each pan count when the user hasn't chosen one — matches the legacy vertical stack. */
export const DEFAULT_PRESET_BY_COUNT: Record<PanCount, LayoutPresetId> = {
  1: "1",
  2: "2v",
  3: "3v",
  4: "4v",
};

/** Leaf slots of a tree in depth-first (reading) order. */
export function leafSlots(node: LayoutNode): SlotId[] {
  if (node.kind === "cell") return [node.slot];
  return node.children.flatMap(leafSlots);
}

/** Preorder tree-position key for a split node's child: joinPath("", 1) === "1", joinPath("1", 0) === "1.0". */
export function joinPath(parent: string, index: number): string {
  return parent === "" ? String(index) : `${parent}.${index}`;
}

export interface CellEdges {
  top: boolean;
  left: boolean;
  right: boolean;
  bottom: boolean;
}

export const ALL_EDGES: CellEdges = {
  top: true,
  left: true,
  right: true,
  bottom: true,
};

/** Edges child `index` of an `edges`-touching split keeps. */
export function childEdges(
  edges: CellEdges,
  dir: SplitDir,
  index: number,
  count: number,
): CellEdges {
  if (dir === "row") {
    return {
      top: edges.top,
      bottom: edges.bottom,
      left: edges.left && index === 0,
      right: edges.right && index === count - 1,
    };
  }
  return {
    left: edges.left,
    right: edges.right,
    top: edges.top && index === 0,
    bottom: edges.bottom && index === count - 1,
  };
}

/** Even split fractions for a split node's children. */
export function evenSizes(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

export interface PanafallSlotPrefs {
  /** Fractions of the pan/waterfall vertical split (was panadapterSizes[i]). */
  panWaterfallSplit: [number, number];
  /** Whether the per-panafall settings sidebar is open (was panadapterSettingsOpen[i]). */
  settingsOpen: boolean;
}

export interface PanafallLayoutPrefs {
  version: 1;
  /** Active preset per pan count — pan count is radio-driven, so the choice is per count. */
  presetByCount: Record<PanCount, LayoutPresetId>;
  /**
   * User-dragged split fractions, keyed preset id -> split path. Every preset
   * id and split path is pre-populated in the defaults: the preferences
   * deepMerge drops persisted keys missing from defaults, and the key space is
   * static per preset catalog.
   */
  splitSizes: Record<LayoutPresetId, Record<string, number[]>>;
  /** Per spatial slot (reading order), shared across presets. */
  slots: PanafallSlotPrefs[];
}

export const DEFAULT_PAN_WATERFALL_SPLIT: [number, number] = [0.25, 0.75];

function collectSplitDefaults(
  node: LayoutNode,
  path: string,
  out: Record<string, number[]>,
): void {
  if (node.kind !== "split") return;
  out[path] = evenSizes(node.children.length);
  node.children.forEach((child, i) => {
    collectSplitDefaults(child, joinPath(path, i), out);
  });
}

export function defaultLayoutSplitSizes(): Record<
  LayoutPresetId,
  Record<string, number[]>
> {
  const result = {} as Record<LayoutPresetId, Record<string, number[]>>;
  for (const preset of Object.values(LAYOUT_PRESETS)) {
    const paths: Record<string, number[]> = {};
    collectSplitDefaults(preset.root, "", paths);
    result[preset.id] = paths;
  }
  return result;
}

export function defaultPanafallLayoutPrefs(): PanafallLayoutPrefs {
  return {
    version: 1,
    presetByCount: { ...DEFAULT_PRESET_BY_COUNT },
    splitSizes: defaultLayoutSplitSizes(),
    slots: Array.from({ length: 4 }, () => ({
      panWaterfallSplit: [...DEFAULT_PAN_WATERFALL_SPLIT] as [number, number],
      settingsOpen: false,
    })),
  };
}

/**
 * In-place migration of a persisted preferences payload from the positional
 * panadapterSizes/panadapterSettingsOpen arrays to panafallLayout. Legacy
 * index i was the vertical-stack row i, which is reading-order slot i, so the
 * mapping is lossless. Idempotent; the legacy keys are dropped afterwards by
 * the deepMerge against defaults that no longer contain them.
 */
export function migrateLegacyLayout(prefs: Record<string, unknown>): void {
  if (prefs.panafallLayout) return;
  if (!prefs.panadapterSizes && !prefs.panadapterSettingsOpen) return;
  const sizes = Array.isArray(prefs.panadapterSizes)
    ? prefs.panadapterSizes
    : [];
  const open = Array.isArray(prefs.panadapterSettingsOpen)
    ? prefs.panadapterSettingsOpen
    : [];
  const layout = defaultPanafallLayoutPrefs();
  layout.slots = layout.slots.map((slot, i) => {
    const legacy = sizes[i];
    const valid =
      Array.isArray(legacy) &&
      legacy.length === 2 &&
      legacy.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
    return {
      panWaterfallSplit: valid
        ? ([legacy[0], legacy[1]] as [number, number])
        : slot.panWaterfallSplit,
      settingsOpen: Boolean(open[i]),
    };
  });
  prefs.panafallLayout = layout;
}

export const SLOT_COUNT = 4;

/**
 * Reconcile stream->slot assignments against the current stream list.
 * Surviving streams keep their relative slot order (radio-side list reorders
 * do not shuffle slots), assignments are packed into the leading slots so the
 * active preset (whose capacity equals the stream count) renders all of them,
 * and new streams fill in after the survivors. Streams beyond SLOT_COUNT are
 * left unassigned.
 */
export function reconcileSlotAssignments(
  current: readonly (string | null)[],
  streams: readonly string[],
): (string | null)[] {
  const survivors = current.filter(
    (s): s is string => s !== null && streams.includes(s),
  );
  const newcomers = streams.filter((s) => !survivors.includes(s));
  const packed = [...survivors, ...newcomers].slice(0, SLOT_COUNT);
  return Array.from({ length: SLOT_COUNT }, (_, i) => packed[i] ?? null);
}

/**
 * The preset to render for a pan count, guarding against a persisted preset id
 * whose capacity no longer matches.
 */
export function activePreset(
  presetByCount: Record<PanCount, LayoutPresetId>,
  panCount: number,
): LayoutPreset {
  const count = Math.min(Math.max(panCount, 1), 4) as PanCount;
  const chosen = LAYOUT_PRESETS[presetByCount[count]];
  if (chosen?.capacity === count) return chosen;
  return LAYOUT_PRESETS[DEFAULT_PRESET_BY_COUNT[count]];
}

/** Which viewport edges the given slot's cell touches within `root`. */
export function cellEdges(root: LayoutNode, slot: SlotId): CellEdges {
  const walk = (node: LayoutNode, edges: CellEdges): CellEdges | undefined => {
    if (node.kind === "cell") {
      return node.slot === slot ? edges : undefined;
    }
    for (const [i, child] of node.children.entries()) {
      const found = walk(
        child,
        childEdges(edges, node.dir, i, node.children.length),
      );
      if (found) return found;
    }
    return undefined;
  };
  return (
    walk(root, ALL_EDGES) ?? {
      top: false,
      left: false,
      right: false,
      bottom: false,
    }
  );
}
