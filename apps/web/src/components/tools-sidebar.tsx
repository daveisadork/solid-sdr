import { Show } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import { Sidebar, SidebarContent } from "./ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

/**
 * App-level left sidebar hosting operator tools (CWX, DVK). Mirrors
 * RadioSidebar: gap-squeeze in opaque mode, floating over the panafalls in
 * transparency mode (chrome-insets push the panafall chrome right), Sheet on
 * mobile.
 */
export function ToolsSidebar() {
  const { state } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();

  return (
    <Show when={state.clientHandle}>
      <Sidebar
        gap={!preferences.enableTransparencyEffects}
        side="left"
        variant={preferences.enableTransparencyEffects ? "floating" : "sidebar"}
        class="absolute h-[calc(100%-var(--inset-bottom))] pr-0 bg-transparent pointer-events-none z-(--z-chrome)"
      >
        <SidebarContent
          class="absolute inset-y-4 inset-x-0 gap-0 overflow-y-auto overflow-x-hidden pointer-events-auto"
          style={{
            "scrollbar-gutter": "stable",
            "scrollbar-width": "thin",
          }}
        >
          <Tabs
            value={preferences.toolsPanel}
            onChange={(value) => setPreferences("toolsPanel", value)}
            class="select-none flex flex-col p-2"
          >
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="cwx">CWX</TabsTrigger>
              <TabsTrigger value="dvk">DVK</TabsTrigger>
            </TabsList>
            {/* forceMount keeps inactive tool state (e.g. CWX send progress)
                alive across tab flips; Kobalte doesn't hide unselected
                forceMounted panes, hence not-data-selected:hidden. */}
            <TabsContent
              forceMount
              value="cwx"
              class="flex flex-col gap-3 py-2 not-data-selected:hidden"
            >
              <div class="text-sm text-muted-foreground">Coming soon</div>
            </TabsContent>
            <TabsContent
              forceMount
              value="dvk"
              class="flex flex-col gap-3 py-2 not-data-selected:hidden"
            >
              <div class="text-sm text-muted-foreground">Coming soon</div>
            </TabsContent>
          </Tabs>
        </SidebarContent>
      </Sidebar>
    </Show>
  );
}
