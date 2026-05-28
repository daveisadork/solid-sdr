import useFlexRadio, { FlexRadioProvider } from "./context/flexradio";
import { StatusBar } from "./components/statusbar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";

import { Toaster } from "./components/ui/toast";
import "./app.css";
import { RtcProvider } from "./context/rtc";
import RtcAudio from "./components/rtc-audio";
import {
  ColorModeProvider,
  ColorModeScript,
  createLocalStorageManager,
} from "@kobalte/core/color-mode";
import { RightSidebar } from "./components/right-sidebar";
import BaselineViewSidebar from "~icons/ic/baseline-view-sidebar";
import { PreferencesProvider, usePreferences } from "./context/preferences";
import { Panafalls } from "./components/panafall/panafalls";
import { FPSCounter } from "./components/fps";
import { RuntimeProvider } from "./context/runtime";
import { Show } from "solid-js";
import { ControlsProvider } from "./context/controls";
import { Callout, CalloutContent, CalloutTitle } from "./components/ui/callout";
import { Button } from "./components/ui/button";
import MaterialSymbolsOpenInNew from "~icons/material-symbols/open-in-new";
import { ReleaseNotification } from "./components/release-notification";

function AppInner() {
  const { preferences, setPreferences } = usePreferences();
  const { radio } = useFlexRadio();
  return (
    <div class="absolute inset-0 flex flex-col items-stretch">
      <SidebarProvider
        class="relative grow h-auto overflow-visible min-h-0 bg-transparent"
        open={!!preferences.radioPanelOpen}
        onOpenChange={(open) => setPreferences("radioPanelOpen", open)}
      >
        <Panafalls />
        <RightSidebar />
        <Show when={radio()}>
          <SidebarTrigger class="z-50 absolute right-4 top-4 select-none aspect-square fancy-bg-background size-10 not-pointer-coarse:size-5 pointer-coarse:border pointer-coarse:right-2 pointer-coarse:top-2">
            <BaselineViewSidebar />
          </SidebarTrigger>
        </Show>
      </SidebarProvider>
      <StatusBar />
      <Show when={preferences.showFps}>
        <FPSCounter />
      </Show>
    </div>
  );
}

function App() {
  const storageManager = createLocalStorageManager("vite-ui-theme");

  return (
    <>
      <ColorModeScript
        initialColorMode="dark"
        storageType={storageManager.type}
      />
      <ColorModeProvider
        initialColorMode="dark"
        storageManager={storageManager}
      >
        <PreferencesProvider>
          <Show
            when={window.isSecureContext}
            fallback={
              <Callout
                variant="error"
                class="absolute top-1/2 left-1/2 -translate-1/2"
              >
                <CalloutTitle>HTTPS Required</CalloutTitle>
                <CalloutContent class="flex flex-col gap-2">
                  SolidSDR requires a secure context (HTTPS) to work.
                  <div class="flex justify-end">
                    <Button
                      as="a"
                      href="https://github.com/daveisadork/solid-sdr/wiki/Secure-Contexts"
                      target="_blank"
                    >
                      <MaterialSymbolsOpenInNew />
                      View Docs
                    </Button>
                  </div>
                </CalloutContent>
              </Callout>
            }
          >
            <RtcProvider>
              <FlexRadioProvider>
                <RuntimeProvider>
                  <ControlsProvider>
                    <AppInner />
                    <RtcAudio /> {/* keeps audio elements mounted */}
                  </ControlsProvider>
                </RuntimeProvider>
              </FlexRadioProvider>
            </RtcProvider>
          </Show>
          <ReleaseNotification />
        </PreferencesProvider>
        <Toaster />
      </ColorModeProvider>
    </>
  );
}

export default App;
