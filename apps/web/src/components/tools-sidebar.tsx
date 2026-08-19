import { Show } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import { CwxPanel } from "./cwx-panel";
import { DvkPanel } from "./dvk-panel";
import { Sidebar, SidebarContent } from "./ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

/**
 * App-level left sidebar hosting operator tools (CWX, DVK). Mirrors
 * RadioSidebar: gap-squeeze in opaque mode, floating over the panafalls in
 * transparency mode (chrome-insets push the panafall chrome right), Sheet on
 * mobile.
 */
export function ToolsSidebar() {
  const { state, isLicensed } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();

  const dvk = () => isLicensed("DIGITAL_VOICE_KEYER");

  return (
    <Show when={state.clientHandle}>
      <Sidebar
        gap={!preferences.enableTransparencyEffects}
        side="left"
        variant={preferences.enableTransparencyEffects ? "floating" : "sidebar"}
        class="absolute h-[calc(100%-var(--inset-bottom))] pr-0 bg-transparent pointer-events-none z-(--z-chrome)"
      >
        <SidebarContent class="absolute inset-0 gap-0 overflow-hidden pointer-events-auto py-3">
          <Tabs
            // A stored "dvk" outlives the radio it was set on; falling back
            // keeps the preference intact for the next licensed radio.
            value={dvk() ? preferences.toolsPanel : "cwx"}
            onChange={(value) => setPreferences("toolsPanel", value)}
            class="select-none flex min-h-0 flex-1 flex-col"
          >
            <div class="px-3">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="cwx">CWX</TabsTrigger>
                <TabsTrigger disabled={!dvk()} value="dvk">
                  DVK
                </TabsTrigger>
              </TabsList>
            </div>
            {/* forceMount keeps inactive tool state (e.g. CWX send progress)
                alive across tab flips; Kobalte doesn't hide unselected
                forceMounted panes, hence not-data-selected:hidden. */}
            <TabsContent
              forceMount
              value="cwx"
              class="flex min-h-0 flex-1 flex-col gap-3 not-data-selected:hidden px-3"
            >
              <CwxPanel />
            </TabsContent>
            <Show when={dvk()}>
              <TabsContent
                forceMount={dvk()}
                value="dvk"
                class="flex min-h-0 flex-1 flex-col gap-3 not-data-selected:hidden overflow-y-auto px-3"
                style={{
                  "scrollbar-gutter": "stable",
                  "scrollbar-width": "thin",
                }}
              >
                <DvkPanel />
              </TabsContent>
            </Show>
          </Tabs>
        </SidebarContent>
      </Sidebar>
    </Show>
  );
}
