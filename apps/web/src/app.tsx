import { lazy, Suspense, ErrorBoundary } from "solid-js";
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
const Panafall = lazy(() =>
  import("./components/panafall").then((mod) => ({ default: mod.Panafall })),
);

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
            <div class="flex flex-col relative items-stretch size-full">
              <SidebarProvider class="relative grow h-auto overflow-visible min-h-0 bg-transparent">
                <Suspense fallback={<div>Loading...</div>}>
                  <Panafall />
                </Suspense>
                <SidebarTrigger class="z-50 absolute right-2 top-4 select-none backdrop-blur-lg" />
                <AppSidebar />
              </SidebarProvider>
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
