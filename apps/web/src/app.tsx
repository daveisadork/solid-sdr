import { StatusBar } from "./components/statusbar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/toast";
import useFlexRadio, { FlexRadioProvider } from "./context/flexradio";
import "./app.css";
import {
  ColorModeProvider,
  ColorModeScript,
  createLocalStorageManager,
} from "@kobalte/core/color-mode";
import { Show } from "solid-js";
import BaselineViewSidebar from "~icons/ic/baseline-view-sidebar";
import MaterialSymbolsOpenInNew from "~icons/material-symbols/open-in-new";
import { DebugBanner } from "./components/debug-mode/banner";
import { FPSCounter } from "./components/fps";
import { Panafalls } from "./components/panafall/panafalls";
import { ReleaseNotification } from "./components/release-notification";
import { RightSidebar } from "./components/right-sidebar";
import { Button } from "./components/ui/button";
import { Callout, CalloutContent, CalloutTitle } from "./components/ui/callout";
import { AudioProvider } from "./context/audio";
import { ControlsProvider } from "./context/controls";
import { DebugModeProvider } from "./context/debug-mode";
import { PreferencesProvider, usePreferences } from "./context/preferences";
import { RtcProvider } from "./context/rtc";
import { RuntimeProvider } from "./context/runtime";

function AppInner() {
  const { preferences, setPreferences } = usePreferences();
  const { radio } = useFlexRadio();
  return (
    <div class="absolute inset-0 flex flex-col items-stretch">
      <DebugBanner />
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
            <DebugModeProvider>
              <RtcProvider>
                <FlexRadioProvider>
                  <RuntimeProvider>
                    <AudioProvider>
                      <ControlsProvider>
                        <AppInner />
                      </ControlsProvider>
                    </AudioProvider>
                  </RuntimeProvider>
                </FlexRadioProvider>
              </RtcProvider>
            </DebugModeProvider>
          </Show>
          <ReleaseNotification />
        </PreferencesProvider>
        <Toaster />
      </ColorModeProvider>
    </>
  );
}

export default App;
