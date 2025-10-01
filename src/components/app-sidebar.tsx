import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import { TuningPanel } from "./tuningpanel";
import useFlexRadio from "~/context/flexradio";
import { Show } from "solid-js";
import { FPSCounter } from "./fps";

export function AppSidebar() {
  const { state } = useFlexRadio();
  return (
    <Sidebar
      gap={true}
      side="right"
      variant="floating"
      class="absolute h-full bg-transparent pointer-events-none"
    >
      <SidebarContent class="h-full py-4 overflow-clip pointer-events-auto">
        <Show when={state.selectedPanadapter} keyed={true}>
          <TuningPanel streamId={state.selectedPanadapter!} />
        </Show>
      </SidebarContent>
      <FPSCounter />
    </Sidebar>
  );
}
