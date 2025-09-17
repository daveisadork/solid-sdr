import { FlexRadioProvider } from "./context/flexradio";
import { StatusBar } from "./components/statusbar";
import { Panafall } from "./components/panafall";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import {
  ColorModeProvider,
  ColorModeScript,
  createLocalStorageManager,
} from "@kobalte/core";
import { Toaster } from "./components/ui/toast";
import "./app.css";

function App() {
  const storageManager = createLocalStorageManager("vite-ui-theme");

  return (
    <FlexRadioProvider>
      <ColorModeScript storageType={storageManager.type} />
      <ColorModeProvider storageManager={storageManager}>
        <div class="flex flex-col relative items-stretch size-full">
          <SidebarProvider class="relative grow h-auto overflow-visible min-h-0 bg-transparent">
            <Panafall />
            <SidebarTrigger class="z-50 absolute right-2 top-2 select-none" />
            <AppSidebar />
          </SidebarProvider>
          <StatusBar />
        </div>
        <Toaster />
      </ColorModeProvider>
    </FlexRadioProvider>
  );
}

export default App;
