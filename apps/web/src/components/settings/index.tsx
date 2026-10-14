import { useMatch, useNavigate } from "@solidjs/router";
import { createEffect, ErrorBoundary, lazy, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import useFlexRadio from "~/context/flexradio";
import { APP_VERSION } from "~/lib/version";
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
import { Button } from "../ui/button";
import { Callout, CalloutContent, CalloutTitle } from "../ui/callout";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
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
  "dax-iq": lazy(() =>
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
  "import-export": lazy(() =>
    import("./import-export").then((m) => ({ default: m.ImportExport })),
  ),
};

const SETTINGS_ISSUE_URL =
  "https://github.com/daveisadork/solid-sdr/issues/new";
const MAX_SETTINGS_ISSUE_URL_LENGTH = 7500;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Stack frames include the page address. Publish a fixed host instead of the real one.
const PUBLIC_PAGE_ORIGIN = "https://solidsdr.local";

function redactPageUrl(text: string): string {
  const host = window.location.host;
  if (host.length === 0) return text;
  const hostPattern = escapeRegExp(host);
  return text
    .replace(
      new RegExp(`https?:\\/\\/${hostPattern}`, "gi"),
      PUBLIC_PAGE_ORIGIN,
    )
    .replace(new RegExp(`\\/\\/${hostPattern}`, "gi"), PUBLIC_PAGE_ORIGIN);
}

function settingsErrorDetails(error: unknown): string {
  const text =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  return redactPageUrl(text);
}

function settingsIssueBody(input: {
  tab: string;
  errorText: string;
  radioModel: string | undefined;
}): string {
  const message = input.errorText.split("\n")[0] ?? input.errorText;
  const fence = input.errorText.includes("```") ? "````" : "```";
  const lines = [
    "## Actual behavior",
    "",
    `${message} when trying to open ${input.tab}`,
    "",
    "## Environment",
    "",
    `- SolidSDR version: ${APP_VERSION}`,
    `- Browser: ${navigator.userAgent}`,
  ];
  if (input.radioModel) lines.push(`- Radio model: ${input.radioModel}`);
  lines.push("", "## Error", "", fence, input.errorText, fence);
  return lines.join("\n");
}

function settingsIssueHref(input: {
  tab: string;
  errorText: string;
  radioModel: string | undefined;
}): string {
  const note = "\n\nThe error text is cut because the link is too long.";
  let errorText = input.errorText;

  const build = (text: string) => {
    const params = new URLSearchParams({
      title: `Error in ${input.tab} settings`,
      labels: "bug",
      body: settingsIssueBody({
        tab: input.tab,
        errorText: text,
        radioModel: input.radioModel,
      }),
    });
    return `${SETTINGS_ISSUE_URL}?${params.toString()}`;
  };

  let href = build(errorText);
  while (href.length > MAX_SETTINGS_ISSUE_URL_LENGTH && errorText.length > 0) {
    errorText = `${errorText.slice(0, Math.max(0, errorText.length - 400))}${note}`;
    href = build(errorText);
  }
  return href;
}

function SettingsError(props: {
  error: unknown;
  reset: () => void;
  tab: keyof typeof tabs;
}) {
  const { state } = useFlexRadio();
  const details = () => settingsErrorDetails(props.error);
  const radioModel = () => {
    const model = state.status.radio?.model;
    return typeof model === "string" && model.length > 0 ? model : undefined;
  };
  const issueHref = () =>
    settingsIssueHref({
      tab: props.tab,
      errorText: details(),
      radioModel: radioModel(),
    });

  onMount(() => {
    console.error("Settings window failed", props.error);
  });

  return (
    <DialogContent class="flex max-h-10/12 flex-col gap-4 overflow-hidden text-sm">
      <DialogHeader>
        <DialogTitle>Error</DialogTitle>
      </DialogHeader>

      <Callout variant="error">
        <CalloutTitle>
          Settings could not load because of an error.
        </CalloutTitle>
        <CalloutContent class="flex flex-col gap-3">
          <p>
            Please report this error! Note, your SolidSDR URL has been replaced
            in the error detalis to protect your privacy.
          </p>
          <pre class="max-h-80 min-h-0 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border p-3 font-mono text-xs">
            {details()}
          </pre>
        </CalloutContent>
      </Callout>
      <DialogFooter>
        <Button
          as="a"
          href={issueHref()}
          target="_blank"
          rel="noopener noreferrer"
        >
          Report
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const match = useMatch(() => "/settings/:tab");
  const { state } = useFlexRadio();
  const disconnected = () => !state.clientHandle;
  const activeTab = () => {
    const tab = match()?.params.tab;
    return tab != null && tab in tabs ? (tab as keyof typeof tabs) : null;
  };
  const setActiveTab = (tab: keyof typeof tabs) => navigate(`/settings/${tab}`);
  createEffect(() => {
    if (match() && activeTab() === null) navigate("/", { replace: true });
  });
  return (
    <>
      <Dialog
        open={activeTab() !== null}
        onOpenChange={(open) => !open && navigate("/")}
      >
        {/* Each tab is the dialog body. The fallback must render
            DialogContent too, or a throw before that body leaves the
            open dialog blank. */}
        <Show when={activeTab()} keyed>
          {(tab) => (
            <ErrorBoundary
              fallback={(error, reset) => (
                <SettingsError error={error} reset={reset} tab={tab} />
              )}
            >
              <Dynamic component={tabs[tab]} />
            </ErrorBoundary>
          )}
        </Show>
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
            onSelect={() => setActiveTab("dax-iq")}
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
            onSelect={() => setActiveTab("import-export")}
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
