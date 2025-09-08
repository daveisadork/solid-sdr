import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import { TuningPanel } from "./tuningpanel";
import useFlexRadio from "~/context/flexradio";
import { Show } from "solid-js";

export function AppSidebar() {
  const { state } = useFlexRadio();
  return (
    <Sidebar
      gap={false}
      side="right"
      variant="floating"
      class="bg-transparent pb-12"
    >
      <SidebarContent>
        <Show when={state.selectedPanadapter} keyed={true}>
          <TuningPanel streamId={state.selectedPanadapter!} />
        </Show>
      </SidebarContent>
    </Sidebar>
  );
}
