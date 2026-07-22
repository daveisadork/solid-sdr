import { describe, expect, it } from "vitest";
import {
  ALL_EDGES,
  activePreset,
  cellEdges,
  childEdges,
  DEFAULT_PAN_WATERFALL_SPLIT,
  DEFAULT_PRESET_BY_COUNT,
  defaultLayoutSplitSizes,
  defaultPanafallLayoutPrefs,
  joinPath,
  LAYOUT_PRESETS,
  type LayoutNode,
  leafSlots,
  migrateLegacyLayout,
  type PanafallLayoutPrefs,
  reconcileSlotAssignments,
  type SlotId,
} from "./panafall-layout";

const presets = Object.values(LAYOUT_PRESETS);

describe("preset catalog invariants", () => {
  it("id key matches preset id", () => {
    for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
      expect(preset.id).toBe(key);
    }
  });

  it("leaf slots are exactly 0..capacity-1 in reading order", () => {
    for (const preset of presets) {
      expect(leafSlots(preset.root)).toEqual(
        Array.from({ length: preset.capacity }, (_, i) => i),
      );
    }
  });

  it("split nodes have at least 2 children", () => {
    const walk = (node: LayoutNode) => {
      if (node.kind !== "split") return;
      expect(node.children.length).toBeGreaterThanOrEqual(2);
      node.children.forEach(walk);
    };
    for (const preset of presets) walk(preset.root);
  });

  it("defaults exist for every pan count and match capacity", () => {
    for (const count of [1, 2, 3, 4] as const) {
      const preset = LAYOUT_PRESETS[DEFAULT_PRESET_BY_COUNT[count]];
      expect(preset.capacity).toBe(count);
    }
  });
});

describe("joinPath", () => {
  it("builds preorder position keys", () => {
    expect(joinPath("", 0)).toBe("0");
    expect(joinPath("", 1)).toBe("1");
    expect(joinPath("1", 0)).toBe("1.0");
    expect(joinPath("1.0", 2)).toBe("1.0.2");
  });
});

describe("cellEdges", () => {
  it("single cell touches all edges", () => {
    expect(cellEdges(LAYOUT_PRESETS["1"].root, 0)).toEqual(ALL_EDGES);
  });

  it("2v: top cell loses bottom, bottom cell loses top", () => {
    const root = LAYOUT_PRESETS["2v"].root;
    expect(cellEdges(root, 0)).toEqual({
      top: true,
      left: true,
      right: true,
      bottom: false,
    });
    expect(cellEdges(root, 1)).toEqual({
      top: false,
      left: true,
      right: true,
      bottom: true,
    });
  });

  it("2x2: each corner touches exactly its two outer edges", () => {
    const root = LAYOUT_PRESETS["2x2"].root;
    expect(cellEdges(root, 0)).toEqual({
      top: true,
      left: true,
      right: false,
      bottom: false,
    });
    expect(cellEdges(root, 1)).toEqual({
      top: true,
      left: false,
      right: true,
      bottom: false,
    });
    expect(cellEdges(root, 2)).toEqual({
      top: false,
      left: true,
      right: false,
      bottom: true,
    });
    expect(cellEdges(root, 3)).toEqual({
      top: false,
      left: false,
      right: true,
      bottom: true,
    });
  });

  it("1+2: big left cell keeps top+left+bottom; right stack splits top/bottom", () => {
    const root = LAYOUT_PRESETS["1+2"].root;
    expect(cellEdges(root, 0)).toEqual({
      top: true,
      left: true,
      right: false,
      bottom: true,
    });
    expect(cellEdges(root, 1)).toEqual({
      top: true,
      left: false,
      right: true,
      bottom: false,
    });
    expect(cellEdges(root, 2)).toEqual({
      top: false,
      left: false,
      right: true,
      bottom: true,
    });
  });

  it("middle cells of a 4-stack touch only left+right", () => {
    const root = LAYOUT_PRESETS["4v"].root;
    for (const slot of [1, 2] as SlotId[]) {
      expect(cellEdges(root, slot)).toEqual({
        top: false,
        left: true,
        right: true,
        bottom: false,
      });
    }
  });

  it("unknown slot touches nothing", () => {
    expect(cellEdges(LAYOUT_PRESETS["2v"].root, 3)).toEqual({
      top: false,
      left: false,
      right: false,
      bottom: false,
    });
  });

  it("childEdges only strips the interior edge", () => {
    expect(childEdges(ALL_EDGES, "row", 1, 3)).toEqual({
      top: true,
      bottom: true,
      left: false,
      right: false,
    });
  });
});

describe("defaultLayoutSplitSizes", () => {
  it("pre-populates every preset id and every split path with matching arity", () => {
    const defaults = defaultLayoutSplitSizes();
    for (const preset of Object.values(LAYOUT_PRESETS)) {
      const paths = defaults[preset.id];
      expect(paths).toBeDefined();
      const walk = (node: LayoutNode, path: string) => {
        if (node.kind !== "split") return;
        expect(paths[path]).toHaveLength(node.children.length);
        expect(paths[path].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        node.children.forEach((child, i) => {
          walk(child, joinPath(path, i));
        });
      };
      walk(preset.root, "");
      // no stray paths beyond the tree's split nodes
      const collected: string[] = [];
      const collect = (node: LayoutNode, path: string) => {
        if (node.kind !== "split") return;
        collected.push(path);
        node.children.forEach((child, i) => {
          collect(child, joinPath(path, i));
        });
      };
      collect(preset.root, "");
      expect(Object.keys(paths).sort()).toEqual(collected.sort());
    }
  });
});

describe("migrateLegacyLayout", () => {
  it("maps legacy positional arrays to slots losslessly", () => {
    const prefs: Record<string, unknown> = {
      panadapterSizes: [
        [0.456274, 0.543726],
        [0.3, 0.7],
      ],
      panadapterSettingsOpen: [true, false, true, false],
    };
    migrateLegacyLayout(prefs);
    const layout = prefs.panafallLayout as PanafallLayoutPrefs;
    expect(layout.version).toBe(1);
    expect(layout.presetByCount).toEqual(DEFAULT_PRESET_BY_COUNT);
    expect(layout.slots[0]).toEqual({
      panWaterfallSplit: [0.456274, 0.543726],
      settingsOpen: true,
    });
    expect(layout.slots[1]).toEqual({
      panWaterfallSplit: [0.3, 0.7],
      settingsOpen: false,
    });
    expect(layout.slots[2]).toEqual({
      panWaterfallSplit: DEFAULT_PAN_WATERFALL_SPLIT,
      settingsOpen: true,
    });
    expect(layout.slots[3]).toEqual({
      panWaterfallSplit: DEFAULT_PAN_WATERFALL_SPLIT,
      settingsOpen: false,
    });
  });

  it("is idempotent: existing panafallLayout is untouched", () => {
    const layout = defaultPanafallLayoutPrefs();
    layout.slots[0].panWaterfallSplit = [0.5, 0.5];
    const prefs: Record<string, unknown> = {
      panafallLayout: layout,
      panadapterSizes: [[0.1, 0.9]],
    };
    migrateLegacyLayout(prefs);
    expect(
      (prefs.panafallLayout as PanafallLayoutPrefs).slots[0].panWaterfallSplit,
    ).toEqual([0.5, 0.5]);
  });

  it("does nothing on a fresh profile", () => {
    const prefs: Record<string, unknown> = { smoothScroll: true };
    migrateLegacyLayout(prefs);
    expect(prefs.panafallLayout).toBeUndefined();
  });

  it("falls back to defaults on corrupt or partial legacy values", () => {
    const prefs: Record<string, unknown> = {
      panadapterSizes: [[Number.NaN, 0.5], [0.3], "junk", [2, -1]],
      panadapterSettingsOpen: "junk",
    };
    migrateLegacyLayout(prefs);
    const layout = prefs.panafallLayout as PanafallLayoutPrefs;
    for (const slot of layout.slots) {
      expect(slot.panWaterfallSplit).toEqual(DEFAULT_PAN_WATERFALL_SPLIT);
      expect(slot.settingsOpen).toBe(false);
    }
  });

  it("handles oversized legacy arrays by ignoring extras", () => {
    const prefs: Record<string, unknown> = {
      panadapterSizes: Array.from({ length: 8 }, () => [0.4, 0.6]),
      panadapterSettingsOpen: Array.from({ length: 8 }, () => true),
    };
    migrateLegacyLayout(prefs);
    const layout = prefs.panafallLayout as PanafallLayoutPrefs;
    expect(layout.slots).toHaveLength(4);
    expect(layout.slots.every((s) => s.settingsOpen)).toBe(true);
  });
});

describe("reconcileSlotAssignments", () => {
  const empty = [null, null, null, null];

  it("fills empty slots in stream order", () => {
    expect(reconcileSlotAssignments(empty, ["0x40", "0x41"])).toEqual([
      "0x40",
      "0x41",
      null,
      null,
    ]);
  });

  it("keeps surviving streams' relative order when the list reorders", () => {
    const current = ["0x40", "0x41", "0x42", null];
    expect(reconcileSlotAssignments(current, ["0x42", "0x40", "0x41"])).toEqual(
      ["0x40", "0x41", "0x42", null],
    );
  });

  it("packs down when a middle stream closes", () => {
    const current = ["0x40", "0x41", "0x42", null];
    expect(reconcileSlotAssignments(current, ["0x40", "0x42"])).toEqual([
      "0x40",
      "0x42",
      null,
      null,
    ]);
  });

  it("appends newcomers after survivors", () => {
    const current = ["0x40", "0x42", null, null];
    expect(reconcileSlotAssignments(current, ["0x40", "0x41", "0x42"])).toEqual(
      ["0x40", "0x42", "0x41", null],
    );
  });

  it("ignores streams beyond capacity", () => {
    expect(
      reconcileSlotAssignments(empty, ["a", "b", "c", "d", "e", "f"]),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("empties out when all streams close", () => {
    expect(reconcileSlotAssignments(["a", "b", null, null], [])).toEqual(empty);
  });
});

describe("activePreset", () => {
  it("returns the chosen preset when capacity matches", () => {
    expect(activePreset({ ...DEFAULT_PRESET_BY_COUNT, 4: "2x2" }, 4).id).toBe(
      "2x2",
    );
  });

  it("falls back to the default when capacity mismatches", () => {
    expect(
      // 2x2 has capacity 4 — the mismatch for count 2 exercises the fallback
      activePreset({ ...DEFAULT_PRESET_BY_COUNT, 2: "2x2" }, 2).id,
    ).toBe("2v");
  });

  it("clamps pan count into 1..4", () => {
    expect(activePreset(DEFAULT_PRESET_BY_COUNT, 0).id).toBe("1");
    expect(activePreset(DEFAULT_PRESET_BY_COUNT, 9).id).toBe("4v");
  });
});
