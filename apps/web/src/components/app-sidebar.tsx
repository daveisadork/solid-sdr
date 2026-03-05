import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import { TuningPanel } from "./tuningpanel";
import useFlexRadio from "~/context/flexradio";
import { Show } from "solid-js";
import { FPSCounter } from "./fps";
import { usePanafall } from "~/context/panafall";

export function AppSidebar() {
  const { state } = useFlexRadio();
  const { waterfall, panadapter, waterfallController, panadapterController } =
    usePanafall();
  return (
    <Sidebar
      gap={true}
      side="left"
      variant="floating"
      class="absolute h-full bg-transparent pointer-events-none z-50"
    >
      <SidebarContent class="h-full py-4 overflow-clip pointer-events-auto">
        <TuningPanel
          waterfall={waterfall()}
          panadapter={panadapter()}
          waterfallController={waterfallController()}
          panadapterController={panadapterController()}
        />
      </SidebarContent>
      <Show when={state.settings.showFps}>
        <FPSCounter />
      </Show>
    </Sidebar>
  );
}
