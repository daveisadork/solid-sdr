import { createMemo, For } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { PanafallProvider } from "~/context/panafall";
import { SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { AppSidebar } from "../app-sidebar";
import { Panafall } from "./panafall";
import BaselineDisplaySettings from "~icons/ic/baseline-display-settings";

export function Panafalls() {
  const { state } = useFlexRadio();
  const panafalls = createMemo(() =>
    Object.keys(state.status.panadapter).toSorted(),
  );
  return (
    <div class="flex flex-col relative size-full">
      <For each={panafalls()}>
        {(streamId, index) => (
          <PanafallProvider streamId={streamId}>
            <SidebarProvider
              class="relative grow h-auto overflow-visible min-h-0 bg-transparent"
              defaultOpen={false}
            >
              <AppSidebar />
              <SidebarTrigger class="z-50 absolute left-4 top-4 select-none aspect-square fancy-bg-background size-10 not-pointer-coarse:size-5 pointer-coarse:border">
                <BaselineDisplaySettings />
              </SidebarTrigger>
              <Panafall index={index()} />
            </SidebarProvider>
            {/* <TestThing /> */}
          </PanafallProvider>
        )}
      </For>
    </div>
  );
}
