import { usePanafallLayout } from "~/context/panafall-layout";
import { ALL_EDGES } from "~/lib/panafall-layout";
import { TuningPanel } from "../tuning-panel";
import { LayoutNodeView } from "./layout-view";

function PanafallLayoutView() {
  const { layout } = usePanafallLayout();
  return (
    <div class="relative flex flex-col grow min-h-0 overflow-visible">
      <LayoutNodeView
        node={layout().root}
        presetId={layout().id}
        path=""
        edges={ALL_EDGES}
      />
    </div>
  );
}

export function Panafalls() {
  return (
    <div class="flex flex-col relative size-full select-none">
      <PanafallLayoutView />
      <TuningPanel />
    </div>
  );
}
