import { Dialog } from "../ui/dialog";
import MdiSettings from "~icons/mdi/settings";
import { AppSettings } from "./app-settings";
import { RadioSettings } from "./radio-settings";
import { Button } from "@kobalte/core/button";
import { SpotsSettings } from "./spots-settings";
import { MemorySettings } from "./memory-settings";
import { MidiSettings } from "./midi-settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import { DaxSettings } from "./dax-settings";
import { DaxIqSettings } from "./dax-iq-settings";
import { AudioSettings } from "./audio-settings";
import { MultiflexSettings } from "./multiflex-settings";
import { NetworkStats } from "./network-stats";
import { WaveformSettings } from "./waveform-settings";
import { Meters } from "./meters";
import { ProfileSettings } from "./profile-settings";
import { ImportExport } from "./import-export";
import useFlexRadio from "~/context/flexradio";

const tabs = {
  app: AppSettings,
  radio: RadioSettings,
  memory: MemorySettings,
  spots: SpotsSettings,
  midi: MidiSettings,
  dax: DaxSettings,
  daxIq: DaxIqSettings,
  audio: AudioSettings,
  multiflex: MultiflexSettings,
  network: NetworkStats,
  waveform: WaveformSettings,
  meters: Meters,
  profiles: ProfileSettings,
  "import/export": ImportExport,
};

export function Settings() {
  const [activeTab, setActiveTab] = createSignal(null);
  const { state } = useFlexRadio();
  const disconnected = () => !state.clientHandle;
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
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("radio")}
          >
            Radio Setup
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("memory")}
          >
            Memory
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("spots")}
          >
            Spots
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("midi")}>
            MIDI Controllers
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("dax")}
          >
            DAX Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("daxIq")}
          >
            DAX IQ Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("audio")}>
            Audio Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("multiflex")}
          >
            multiFLEX
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("network")}
          >
            Network Stats
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("waveform")}
          >
            Waveforms
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("meters")}
          >
            Meters
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("profiles")}
          >
            Profiles
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("import/export")}
          >
            Import/Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
