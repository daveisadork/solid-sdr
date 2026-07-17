import { For, Match, Show, Switch } from "solid-js";
import { PanafallProvider } from "~/context/panafall";
import { usePanafallLayout } from "~/context/panafall-layout";
import { usePreferences } from "~/context/preferences";
import {
  type CellEdges,
  childEdges,
  joinPath,
  type LayoutNode,
  type LayoutPresetId,
  type SlotId,
} from "~/lib/panafall-layout";
import BaselineDisplaySettings from "~icons/ic/baseline-display-settings";
import { Resizable, ResizableHandle, ResizablePanel } from "../ui/resizable";
import { SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { Panafall } from "./panafall";
import { PanafallSettingsSidebar, PanSettings } from "./settings";

type SplitNode = Extract<LayoutNode, { kind: "split" }>;
type CellNode = Extract<LayoutNode, { kind: "cell" }>;

function LayoutSplitHandle() {
  return (
    <ResizableHandle class="z-(--z-split-handle) fancy-bg-border w-0.5 data-[orientation=vertical]:h-0.5 pointer-coarse:w-1.5 pointer-coarse:data-[orientation=vertical]:h-1.5 after:w-2 data-[orientation=vertical]:after:h-2 pointer-coarse:data-[orientation=horizontal]:after:w-8 pointer-coarse:data-[orientation=vertical]:after:h-8 hover:bg-primary/60 data-active:bg-primary/60 transition-colors" />
  );
}

export function PanafallCell(props: { slot: SlotId; edges: CellEdges }) {
  const { preferences, setPreferences } = usePreferences();
  const { streamForSlot } = usePanafallLayout();
  return (
    <Show when={streamForSlot(props.slot)} keyed>
      {(streamId) => (
        <PanafallProvider streamId={streamId} edges={props.edges}>
          <SidebarProvider
            open={
              preferences.panadapterSettingsStyle === "sidebar" &&
              Boolean(
                preferences.panafallLayout.slots[props.slot]?.settingsOpen,
              )
            }
            onOpenChange={(open) =>
              setPreferences(
                "panafallLayout",
                "slots",
                props.slot,
                "settingsOpen",
                open,
              )
            }
            class="relative grow h-auto overflow-visible min-h-0 bg-transparent select-none"
            style={{
              // Chrome insets for the viewport edges this cell touches, as
              // var() references so the @property transition on --inset-*
              // keeps cell content and sliding chrome in lockstep. Defined on
              // the cell container so the settings flyout/sidebar and the
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
            <Switch>
              <Match when={preferences.panadapterSettingsStyle === "sidebar"}>
                <PanafallSettingsSidebar />
                <SidebarTrigger class="z-(--z-chrome) absolute left-control-inset top-control-inset select-none aspect-square fancy-bg-background size-control pointer-coarse:border">
                  <BaselineDisplaySettings />
                </SidebarTrigger>
              </Match>
              <Match when={preferences.panadapterSettingsStyle === "floating"}>
                <PanSettings />
              </Match>
            </Switch>
            <Panafall index={props.slot} />
          </SidebarProvider>
        </PanafallProvider>
      )}
    </Show>
  );
}

function SplitNodeView(props: {
  node: SplitNode;
  presetId: LayoutPresetId;
  path: string;
  edges: CellEdges;
}) {
  const { preferences, setPreferences } = usePreferences();
  return (
    <Resizable
      class="size-full overflow-visible select-none"
      orientation={props.node.dir === "row" ? "horizontal" : "vertical"}
      sizes={
        preferences.panafallLayout.splitSizes[props.presetId]?.[props.path]
      }
      onSizesChange={(sizes) => {
        const node = props.node;
        // corvu fires this during panel teardown, when the reactive node prop
        // may already point at a different tree shape
        if (node.kind !== "split") return;
        if (sizes?.length !== node.children.length) return;
        if (sizes.some((s) => Number.isNaN(s))) return;
        const stored =
          preferences.panafallLayout.splitSizes[props.presetId]?.[props.path];
        if (stored && sizes.every((s, i) => s === stored[i])) return;
        setPreferences(
          "panafallLayout",
          "splitSizes",
          props.presetId,
          props.path,
          [...sizes],
        );
      }}
    >
      <For each={props.node.children}>
        {(child, i) => (
          <>
            <Show when={i() > 0}>
              <LayoutSplitHandle />
            </Show>
            <ResizablePanel
              class="relative flex flex-col overflow-visible select-none"
              minSize={0.1}
            >
              <LayoutNodeView
                node={child}
                presetId={props.presetId}
                path={joinPath(props.path, i())}
                edges={childEdges(
                  props.edges,
                  props.node.dir,
                  i(),
                  props.node.children.length,
                )}
              />
            </ResizablePanel>
          </>
        )}
      </For>
    </Resizable>
  );
}

export function LayoutNodeView(props: {
  node: LayoutNode;
  presetId: LayoutPresetId;
  path: string;
  edges: CellEdges;
}) {
  return (
    <Switch>
      <Match when={props.node.kind === "cell"}>
        <PanafallCell
          slot={(props.node as CellNode).slot}
          edges={props.edges}
        />
      </Match>
      <Match when={props.node.kind === "split"}>
        <SplitNodeView
          node={props.node as SplitNode}
          presetId={props.presetId}
          path={props.path}
          edges={props.edges}
        />
      </Match>
    </Switch>
  );
}
