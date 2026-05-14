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
import { DaxSettings } from "./dax-settings";
import { AudioSettings } from "./audio-settings";
import { MultiflexSettings } from "./multiflex-settings";
import { NetworkStats } from "./network-stats";
import { WaveformSettings } from "./waveform-settings";
import { Meters } from "./meters";
import { ProfileSettings } from "./profile-settings";

const tabs = {
  app: AppSettings,
  radio: RadioSettings,
  memory: MemorySettings,
  spots: SpotsSettings,
  midi: MidiSettings,
  dax: DaxSettings,
  audio: AudioSettings,
  multiflex: MultiflexSettings,
  network: NetworkStats,
  waveform: WaveformSettings,
  meters: Meters,
  profiles: ProfileSettings,
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
          class="size-10 not-pointer-coarse:size-5 aspect-square"
        >
          <MdiSettings class="size-full" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
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
          <DropdownMenuItem onSelect={() => setActiveTab("dax")}>
            DAX Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("audio")}>
            Audio Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("multiflex")}>
            multiFLEX
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("network")}>
            Network Stats
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("waveform")}>
            Waveforms
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("meters")}>
            Meters
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("profiles")}>
            Profiles
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
