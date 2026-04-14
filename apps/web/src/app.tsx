import { FlexRadioProvider } from "./context/flexradio";
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
import { PreferencesProvider } from "./context/preferences";
import { Panafalls } from "./components/panafall/panafalls";

function App() {
  const storageManager = createLocalStorageManager("vite-ui-theme");

  return (
    <PreferencesProvider>
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
              <SidebarProvider class="relative grow h-auto overflow-visible min-h-0 bg-transparent">
                <Panafalls />
                <RightSidebar />
                <SidebarTrigger class="z-50 absolute right-4 top-4 select-none aspect-square fancy-bg-background size-10 not-pointer-coarse:size-5 pointer-coarse:border">
                  <BaselineViewSidebar />
                </SidebarTrigger>
              </SidebarProvider>
              <StatusBar />
            </div>
            <RtcAudio /> {/* keeps audio elements mounted */}
          </FlexRadioProvider>
        </RtcProvider>
        <Toaster />
      </ColorModeProvider>
    </PreferencesProvider>
  );
}

export default App;
