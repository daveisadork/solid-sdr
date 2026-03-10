import { lazy, Suspense } from "solid-js";
import { FlexRadioProvider } from "./context/flexradio";
import { StatusBar } from "./components/statusbar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";

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
const Panafall = lazy(() =>
  import("./components/panafall").then((mod) => ({ default: mod.Panafall })),
);
import BaselineDisplaySettings from "~icons/ic/baseline-display-settings";
import BaselineViewSidebar from "~icons/ic/baseline-view-sidebar";
import { PanafallProvider } from "./context/panafall";
import { TestThing } from "./components/test";

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
        <RtcProvider>
          <FlexRadioProvider>
            <div class="absolute inset-0 flex flex-col items-stretch">
              <PanafallProvider>
                <SidebarProvider class="relative grow h-auto overflow-visible min-h-0 bg-transparent">
                  <SidebarProvider
                    class="relative grow h-auto overflow-visible min-h-0 bg-transparent"
                    defaultOpen={false}
                  >
                    <AppSidebar />
                    <SidebarTrigger class="z-50 absolute left-2 top-4 select-none backdrop-blur-lg">
                      <BaselineDisplaySettings />
                    </SidebarTrigger>
                    <Suspense fallback={<div>Loading...</div>}>
                      <Panafall />
                    </Suspense>
                  </SidebarProvider>
                  <RightSidebar />
                  <SidebarTrigger class="z-50 absolute right-2 top-4 select-none backdrop-blur-lg">
                    <BaselineViewSidebar />
                  </SidebarTrigger>
                </SidebarProvider>
                {/* <TestThing /> */}
              </PanafallProvider>
              <StatusBar />
            </div>
            <RtcAudio /> {/* keeps audio elements mounted */}
            <Toaster />
          </FlexRadioProvider>
        </RtcProvider>
      </ColorModeProvider>
    </>
  );
}

export default App;
