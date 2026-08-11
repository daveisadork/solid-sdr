import { For, Show } from "solid-js";
import { PanafallProvider } from "~/context/panafall";
import { usePanafallLayout } from "~/context/panafall-layout";
import { type CellEdges, cellEdges, type SlotId } from "~/lib/panafall-layout";
import { TuningPanel } from "../tuning-panel";
import { Panafall } from "./panafall";
import { PanSettings } from "./settings";

function PanafallCell(props: { slot: SlotId; edges: CellEdges }) {
  const { streamForSlot } = usePanafallLayout();
  return (
    <Show when={streamForSlot(props.slot)} keyed>
      {(streamId) => (
        <PanafallProvider streamId={streamId} edges={props.edges}>
          <div
            class="relative flex w-full grow h-auto overflow-x-clip min-h-0 bg-transparent select-none"
            style={{
              // Chrome insets for the viewport edges this cell touches
              // (animation chain: see ChromeInsetsProvider). Defined on the
              // cell container so the settings flyout/sidebar and the
              // panafall itself all inherit them.
              "--cell-inset-left": props.edges.left
                ? "var(--inset-left)"
                : "0px",
              "--cell-inset-right": props.edges.right
                ? "var(--inset-right)"
                : "0px",
              "--cell-inset-bottom": props.edges.bottom
                ? "var(--inset-bottom)"
                : "0px",
              "--cell-visible-width":
                "calc(100% - var(--cell-inset-left) - var(--cell-inset-right))",
            }}
          >
            <PanSettings />
            <Panafall index={props.slot} />
          </div>
        </PanafallProvider>
      )}
    </Show>
  );
}

/**
 * Fixed, non-resizable grid. Slots fill column-major (grid-flow-col), so the
 * 3-pan case is 0/1 stacked left with 2 spanning the right column, and the
 * 4-pan case is a 2x2 with 0/1 in the left column and 2/3 in the right.
 */
function PanafallGrid() {
  const { panCount } = usePanafallLayout();
  const count = () => Math.min(Math.max(panCount(), 1), 4);
  return (
    <div
      class="size-full grid grid-flow-col gap-0.5 overflow-visible select-none"
      classList={{
        "grid-cols-1 grid-rows-1": count() === 1,
        "grid-cols-1 grid-rows-2": count() === 2,
        "grid-cols-2 grid-rows-2": count() >= 3,
      }}
    >
      <For each={Array.from({ length: count() }, (_, i) => i as SlotId)}>
        {(slot) => (
          <div
            class="relative flex flex-col min-h-0 min-w-0 overflow-visible select-none"
            classList={{ "row-span-2": count() === 3 && slot === 2 }}
          >
            <PanafallCell slot={slot} edges={cellEdges(count(), slot)} />
          </div>
        )}
      </For>
    </div>
  );
}

export function Panafalls() {
  return (
    <div class="flex flex-col relative size-full select-none">
      <div class="relative flex flex-col grow min-h-0 overflow-visible">
        <PanafallGrid />
      </div>
      <TuningPanel />
    </div>
  );
}
