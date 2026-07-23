import { describe, expect, it } from "vitest";
import {
  ALL_EDGES,
  cellEdges,
  reconcileSlotAssignments,
  type SlotId,
} from "./panafall-layout";

describe("cellEdges", () => {
  it("single cell touches all edges", () => {
    expect(cellEdges(1, 0)).toEqual(ALL_EDGES);
  });

  it("2 stacked: top cell loses bottom, bottom cell loses top", () => {
    expect(cellEdges(2, 0)).toEqual({
      top: true,
      left: true,
      right: true,
      bottom: false,
    });
    expect(cellEdges(2, 1)).toEqual({
      top: false,
      left: true,
      right: true,
      bottom: true,
    });
  });

  it("3: left column stacked, slot 2 full-height right", () => {
    expect(cellEdges(3, 0)).toEqual({
      top: true,
      left: true,
      right: false,
      bottom: false,
    });
    expect(cellEdges(3, 1)).toEqual({
      top: false,
      left: true,
      right: false,
      bottom: true,
    });
    expect(cellEdges(3, 2)).toEqual({
      top: true,
      left: false,
      right: true,
      bottom: true,
    });
  });

  it("4: column-major 2x2, each corner touches exactly its two outer edges", () => {
    expect(cellEdges(4, 0)).toEqual({
      top: true,
      left: true,
      right: false,
      bottom: false,
    });
    expect(cellEdges(4, 1)).toEqual({
      top: false,
      left: true,
      right: false,
      bottom: true,
    });
    expect(cellEdges(4, 2)).toEqual({
      top: true,
      left: false,
      right: true,
      bottom: false,
    });
    expect(cellEdges(4, 3)).toEqual({
      top: false,
      left: false,
      right: true,
      bottom: true,
    });
  });

  it("clamps pan count into 1..4", () => {
    expect(cellEdges(0, 0)).toEqual(ALL_EDGES);
    expect(cellEdges(9, 3)).toEqual(cellEdges(4, 3));
  });

  it("slot beyond the count touches nothing", () => {
    expect(cellEdges(2, 3 as SlotId)).toEqual({
      top: false,
      left: false,
      right: false,
      bottom: false,
    });
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
