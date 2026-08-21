import { createSignal, lazy } from "solid-js";
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
import { ProfileSettings } from "./profile-settings";

// Lazy tabs keep settings-only code (and deps like @tanstack/table-core and
// fflate) out of the entry chunk. ProfileSettings stays static because
// CreateProfileDialog already pins its module into the entry chunk.
const tabs = {
  app: lazy(() =>
    import("./app-settings").then((m) => ({ default: m.AppSettings })),
  ),
  radio: lazy(() =>
    import("./radio-settings").then((m) => ({ default: m.RadioSettings })),
  ),
  memory: lazy(() =>
    import("./memory-settings").then((m) => ({ default: m.MemorySettings })),
  ),
  spots: lazy(() =>
    import("./spots-settings").then((m) => ({ default: m.SpotsSettings })),
  ),
  midi: lazy(() =>
    import("./midi-settings").then((m) => ({ default: m.MidiSettings })),
  ),
  dax: lazy(() =>
    import("./dax-settings").then((m) => ({ default: m.DaxSettings })),
  ),
  daxIq: lazy(() =>
    import("./dax-iq-settings").then((m) => ({ default: m.DaxIqSettings })),
  ),
  audio: lazy(() =>
    import("./audio-settings").then((m) => ({ default: m.AudioSettings })),
  ),
  multiflex: lazy(() =>
    import("./multiflex-settings").then((m) => ({
      default: m.MultiflexSettings,
    })),
  ),
  network: lazy(() =>
    import("./network-stats").then((m) => ({ default: m.NetworkStats })),
  ),
  waveform: lazy(() =>
    import("./waveform-settings").then((m) => ({
      default: m.WaveformSettings,
    })),
  ),
  meters: lazy(() => import("./meters").then((m) => ({ default: m.Meters }))),
  profiles: ProfileSettings,
  "import/export": lazy(() =>
    import("./import-export").then((m) => ({ default: m.ImportExport })),
  ),
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
