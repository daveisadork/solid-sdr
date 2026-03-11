import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import { TuningPanel } from "./tuningpanel";
import { Show } from "solid-js";
import { FPSCounter } from "./fps";
import { usePanafall } from "~/context/panafall";
import { usePreferences } from "~/context/preferences";

export function AppSidebar() {
  const { preferences } = usePreferences();
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
      <Show when={preferences.showFps}>
        <FPSCounter />
      </Show>
    </Sidebar>
  );
}
