import { createMemo, For, Match, Switch } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { PanafallProvider } from "~/context/panafall";
import { SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { PanafallSettingsSidebar, PanSettings } from "./settings";
import { Panafall } from "./panafall";
import BaselineDisplaySettings from "~icons/ic/baseline-display-settings";
import { usePreferences } from "~/context/preferences";

export function Panafalls() {
  const { state } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();
  const panafalls = createMemo(() =>
    Object.values(state.status.panadapter)
      .filter((p) => p.clientHandle === state.clientHandleInt)
      .map((p) => p.id)
      .toSorted(),
  );
  return (
    <div class="flex flex-col relative size-full select-none">
      <For each={panafalls()}>
        {(streamId, index) => (
          <PanafallProvider streamId={streamId}>
            <SidebarProvider
              open={
                preferences.panadapterSettingsStyle === "sidebar" &&
                Boolean(preferences.panadapterSettingsOpen[index()])
              }
              onOpenChange={(open) =>
                setPreferences("panadapterSettingsOpen", index(), open)
              }
              class="relative grow h-auto overflow-visible min-h-0 bg-transparent select-none"
            >
              <Switch>
                <Match when={preferences.panadapterSettingsStyle === "sidebar"}>
                  <PanafallSettingsSidebar />
                  <SidebarTrigger class="z-50 absolute left-4 top-4 select-none aspect-square fancy-bg-background size-10 not-pointer-coarse:size-5 pointer-coarse:border">
                    <BaselineDisplaySettings />
                  </SidebarTrigger>
                </Match>
                <Match
                  when={preferences.panadapterSettingsStyle === "floating"}
                >
                  <PanSettings />
                </Match>
              </Switch>
              <Panafall index={index()} />
            </SidebarProvider>
            {/* <TestThing /> */}
          </PanafallProvider>
        )}
      </For>
    </div>
  );
}
