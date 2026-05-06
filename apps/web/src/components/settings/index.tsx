import { usePreferences } from "../../context/preferences";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogTrigger,
} from "../ui/dialog";
import MdiSettings from "~icons/mdi/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { AppSettings } from "./app-settings";
import { RadioSettings } from "./radio-settings";
import { Button } from "@kobalte/core/button";
import { SpotsSettings } from "./spots-settings";
import { MemorySettings } from "./memory-settings";
import { MidiSettings } from "./midi-settings";
import {
  DropdownMenu,
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";

export function OldSettings() {
  return (
    <Dialog modal={false}>
      <DialogTrigger
        as={Button<"button">}
        class="size-8 not-pointer-coarse:size-5 aspect-square"
      >
        <MdiSettings class="size-full" />
      </DialogTrigger>
      <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden sm:max-w-10/12 sm:w-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="app"
          class="w-full relative flex flex-col gap-2 shrink overflow-hidden"
        >
          <div class="flex justify-between">
            <div />
            <TabsList class="m-auto grid grid-cols-5">
              <TabsTrigger value="app">SolidSDR</TabsTrigger>
              <TabsTrigger value="radio">Radio</TabsTrigger>
              <TabsTrigger value="memory">Memory</TabsTrigger>
              <TabsTrigger value="spots">Spots</TabsTrigger>
              <TabsTrigger value="midi">MIDI</TabsTrigger>
            </TabsList>
            <div />
          </div>
          <div
            class="relative overflow-y-auto shrink pb-2"
            style={{
              "scrollbar-width": "thin",
            }}
          >
            <TabsContent value="app">
              <AppSettings />
            </TabsContent>
            <TabsContent value="radio">
              <RadioSettings />
            </TabsContent>
            <TabsContent value="memory">
              <MemorySettings />
            </TabsContent>
            <TabsContent value="spots">
              <SpotsSettings />
            </TabsContent>
            <TabsContent value="midi">
              <MidiSettings />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const tabs = {
  app: AppSettings,
  radio: RadioSettings,
  memory: MemorySettings,
  spots: SpotsSettings,
  midi: MidiSettings,
};

export function Settings() {
  const [activeTab, setActiveTab] = createSignal(null);
  return (
    <>
      <Dialog
        open={activeTab() !== null}
        onOpenChange={(open) => !open && setActiveTab(null)}
      >
        <Dynamic component={tabs[activeTab()]} />
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          as={Button<"button">}
          class="size-8 not-pointer-coarse:size-5 aspect-square"
        >
          <MdiSettings class="size-full" />
        </DropdownMenuTrigger>
        <DropdownMenuContent class="overflow-visible">
          <DropdownMenuArrow />
          <DropdownMenuItem onSelect={() => setActiveTab("app")}>
            App Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("radio")}>
            Radio Setup
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("memory")}>
            Memory
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("spots")}>
            Spots
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("midi")}>
            MIDI Controllers
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
