import { createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import useFlexRadio from "~/context/flexradio";
import AreaChartIcon from "~icons/material-symbols/area-chart";
import BookmarksIcon from "~icons/material-symbols/bookmarks";
import CableIcon from "~icons/material-symbols/cable";
import NetworkCheckIcon from "~icons/material-symbols/network-check";
import PianoIcon from "~icons/material-symbols/piano";
import RadioIcon from "~icons/material-symbols/radio";
import SettingsApplicationsIcon from "~icons/material-symbols/settings-applications";
import SpeedOutlineIcon from "~icons/material-symbols/speed-outline";
import VitalSignsIcon from "~icons/material-symbols/vital-signs";
import VolumeUpIcon from "~icons/material-symbols/volume-up";
import ApplicationExportIcon from "~icons/mdi/application-export";
import FloppyDiscMultipleIcon from "~icons/mdi/floppy-disc-multiple";
import LocationMultipleIcon from "~icons/mdi/location-multiple";
import MonitorMultipleIcon from "~icons/mdi/monitor-multiple";
import MdiSettings from "~icons/mdi/settings";
import { Dialog } from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { AppSettings } from "./app-settings";
import { AudioSettings } from "./audio-settings";
import { DaxIqSettings } from "./dax-iq-settings";
import { DaxSettings } from "./dax-settings";
import { ImportExport } from "./import-export";
import { MemorySettings } from "./memory-settings";
import { Meters } from "./meters";
import { MidiSettings } from "./midi-settings";
import { MultiflexSettings } from "./multiflex-settings";
import { NetworkStats } from "./network-stats";
import { ProfileSettings } from "./profile-settings";
import { RadioSettings } from "./radio-settings";
import { SpotsSettings } from "./spots-settings";
import { WaveformSettings } from "./waveform-settings";

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
  const [activeTab, setActiveTab] = createSignal<keyof typeof tabs | null>(
    null,
  );
  const { state } = useFlexRadio();
  const disconnected = () => !state.clientHandle;
  const activeTabComponent = () => {
    const tab = activeTab();
    return tab != null ? tabs[tab] : undefined;
  };
  return (
    <>
      <Dialog
        open={activeTab() !== null}
        onOpenChange={(open) => !open && setActiveTab(null)}
      >
        <Dynamic component={activeTabComponent()} />
      </Dialog>
      <DropdownMenu>
        <Tooltip>
          <DropdownMenuTrigger
            as={TooltipTrigger}
            class="size-control aspect-square"
            aria-label="Settings"
          >
            <MdiSettings class="size-full" />
          </DropdownMenuTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setActiveTab("app")}>
            <DropdownMenuIcon>
              <SettingsApplicationsIcon />
            </DropdownMenuIcon>
            App Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("radio")}
          >
            <DropdownMenuIcon>
              <RadioIcon />
            </DropdownMenuIcon>
            Radio Setup
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("memory")}
          >
            <DropdownMenuIcon>
              <BookmarksIcon />
            </DropdownMenuIcon>
            Memory
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("spots")}
          >
            <DropdownMenuIcon>
              <LocationMultipleIcon />
            </DropdownMenuIcon>
            Spots
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("midi")}>
            <DropdownMenuIcon>
              <PianoIcon />
            </DropdownMenuIcon>
            MIDI Controllers
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("dax")}
          >
            <DropdownMenuIcon>
              <CableIcon />
            </DropdownMenuIcon>
            DAX Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("daxIq")}
          >
            <DropdownMenuIcon>
              <AreaChartIcon />
            </DropdownMenuIcon>
            DAX IQ Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveTab("audio")}>
            <DropdownMenuIcon>
              <VolumeUpIcon />
            </DropdownMenuIcon>
            Audio Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("multiflex")}
          >
            <DropdownMenuIcon>
              <MonitorMultipleIcon />
            </DropdownMenuIcon>
            multiFLEX
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("network")}
          >
            <DropdownMenuIcon>
              <NetworkCheckIcon />
            </DropdownMenuIcon>
            Network Stats
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("waveform")}
          >
            <DropdownMenuIcon>
              <VitalSignsIcon />
            </DropdownMenuIcon>
            Waveforms
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("meters")}
          >
            <DropdownMenuIcon>
              <SpeedOutlineIcon />
            </DropdownMenuIcon>
            Meters
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("profiles")}
          >
            <DropdownMenuIcon>
              <FloppyDiscMultipleIcon />
            </DropdownMenuIcon>
            Profiles
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disconnected()}
            onSelect={() => setActiveTab("import/export")}
          >
            <DropdownMenuIcon>
              <ApplicationExportIcon />
            </DropdownMenuIcon>
            Import/Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
