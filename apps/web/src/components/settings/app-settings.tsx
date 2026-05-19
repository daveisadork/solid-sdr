import {
  FillStyle,
  PanadapterSettingsStyle,
  PeakStyle,
  usePreferences,
} from "../../context/preferences";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "../ui/segmented-control";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { useColorMode } from "@kobalte/core";
import {
  TextField,
  TextFieldDescription,
  TextFieldInput,
  TextFieldLabel,
} from "../ui/text-field";
import useFlexRadio from "~/context/flexradio";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { SimpleSlider } from "../ui/simple-slider";
import Upload from "~icons/material-symbols/upload";
import Download from "~icons/material-symbols/download";
import { Button } from "../ui/button";
import { Callout, CalloutContent } from "../ui/callout";
import {
  FileField,
  FileFieldDropzone,
  FileFieldHiddenInput,
  FileFieldItem,
  FileFieldItemList,
  FileFieldItemName,
  FileFieldItemSize,
} from "../ui/file-field";
import { reconcile } from "solid-js/store";
import { showToast } from "../ui/toast";

export function AppSettings() {
  const { preferences, setPreferences } = usePreferences();
  const { setColorMode } = useColorMode();
  const { radio } = useFlexRadio();

  const [importFile, setImportFile] = createSignal<File>();

  const downloadUrl = createMemo(() => {
    const blob = new Blob([JSON.stringify(preferences, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });

  const doImport = () =>
    importFile()
      ?.text()
      .then((data) => {
        setPreferences(reconcile(JSON.parse(data)));
        showToast({
          variant: "success",
          description: "Settings imported successfully",
        });
      });

  createEffect(() => {
    setColorMode(preferences.theme);
  });

  createEffect(() => {
    if (preferences.theme !== "system") return;
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setColorMode(media.matches ? "dark" : "light");
    sync();
    media.addEventListener("change", sync);
    onCleanup(() => media.removeEventListener("change", sync));
  });

  createEffect(() => {
    radio()?.setClientStationName(preferences.stationName);
  });

  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
      <DialogHeader>
        <DialogTitle>App Settings</DialogTitle>
      </DialogHeader>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <Card class="bg-transparent">
          <CardHeader>
            <CardTitle>Station</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <TextField
              value={preferences.stationName}
              onChange={(value) => setPreferences("stationName", value)}
              class="flex flex-col gap-2"
            >
              <TextFieldLabel>Station Name</TextFieldLabel>
              <TextFieldInput placeholder="Laptop" />
            </TextField>
          </CardContent>
        </Card>
        <Card class="bg-transparent">
          <CardHeader>
            <CardTitle>Display</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <SimpleSwitch
              checked={preferences.enableTransparencyEffects}
              onChange={(isChecked) => {
                setPreferences("enableTransparencyEffects", isChecked);
              }}
              label="Transparency Effects"
              description="Enable the use of transparent/floating UI elements."
            />
            <SimpleSwitch
              checked={preferences.enableBlurEffects}
              onChange={(isChecked) => {
                setPreferences("enableBlurEffects", isChecked);
              }}
              label="Blur Effects"
              description="Enable the use of a blur effect on transparent UI elements"
            />
            <SimpleSwitch
              checked={preferences.smoothScroll}
              onChange={(isChecked) => {
                setPreferences("smoothScroll", isChecked);
              }}
              label="Smooth Scroll"
              description="Enable smooth horizontal scrolling of the panafall."
            />
            <SimpleSwitch
              checked={preferences.showTuningGuide}
              onChange={(isChecked) => {
                setPreferences("showTuningGuide", isChecked);
              }}
              label="Tuning Guide"
            />
            <SimpleSwitch
              checked={preferences.showDisplayMarkers}
              onChange={(isChecked) => {
                setPreferences("showDisplayMarkers", isChecked);
              }}
              label="Display Markers (Band Plan)"
            />
            <SimpleSwitch
              checked={preferences.showFps}
              onChange={(isChecked) => {
                setPreferences("showFps", isChecked);
              }}
              label="Show FPS"
              description="Show a floating FPS counter."
            />
            <SimpleSwitch
              checked={preferences.preventScreenSleep}
              onChange={(isChecked) => {
                setPreferences("preventScreenSleep", isChecked);
              }}
              label="Prevent Screensaver"
            />
            <SegmentedControl
              value={preferences.peakStyle}
              onChange={(value: PeakStyle) => {
                if (!value) return;
                setPreferences("peakStyle", value);
              }}
            >
              <SegmentedControlLabel>Peak Style</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["none", "points", "line"]}>
                    {(style) => (
                      <SegmentedControlItem value={style}>
                        <SegmentedControlItemLabel class="capitalize">
                          {style}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SegmentedControl
              value={preferences.fillStyle}
              onChange={(value: FillStyle) => {
                if (!value) return;
                setPreferences("fillStyle", value);
              }}
            >
              <SegmentedControlLabel>Fill Style</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["none", "solid", "gradient"]}>
                    {(style) => (
                      <SegmentedControlItem value={style}>
                        <SegmentedControlItemLabel class="capitalize">
                          {style}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SegmentedControl
              value={preferences.gradientStyle}
              onChange={(value) => {
                if (!value) return;
                setPreferences("gradientStyle", value as "color" | "classic");
              }}
            >
              <SegmentedControlLabel>Gradient Style</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["color", "classic"]}>
                    {(style) => (
                      <SegmentedControlItem value={style}>
                        <SegmentedControlItemLabel class="capitalize">
                          {style}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SegmentedControl
              value={preferences.panadapterSettingsStyle}
              onChange={(value: PanadapterSettingsStyle) => {
                if (!value) return;
                setPreferences("panadapterSettingsStyle", value);
              }}
            >
              <SegmentedControlLabel>
                Panadapter Settings Style
              </SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["sidebar", "floating"]}>
                    {(style) => (
                      <SegmentedControlItem value={style}>
                        <SegmentedControlItemLabel class="capitalize">
                          {style}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SegmentedControl
              value={preferences.theme}
              onChange={(value: "system" | "light" | "dark") => {
                if (!value) return;
                setPreferences("theme", value);
              }}
            >
              <SegmentedControlLabel>Theme</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["system", "light", "dark"]}>
                    {(style) => (
                      <SegmentedControlItem value={style}>
                        <SegmentedControlItemLabel class="capitalize">
                          {style}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
          </CardContent>
        </Card>
        <Card class="bg-transparent">
          <CardHeader>
            <CardTitle>Import / Export</CardTitle>
            <CardDescription>
              Manage SolidSDR GUI settings. These settings are stored in browser
              local storage, and include the settings in this dialog, MIDI
              controller mappings, audio/DAX settings, etc. It does NOT include
              radio settings or SolidSDR server settings.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <FileField
              accept=".json"
              multiple={false}
              onFileChange={({ acceptedFiles }) =>
                setImportFile(acceptedFiles[0])
              }
            >
              <FileFieldDropzone class="flex justify-around items-center">
                <Show
                  when={importFile()}
                  fallback="Drop your file here or click to choose..."
                >
                  <FileFieldItemList>
                    {() => (
                      <FileFieldItem>
                        <FileFieldItemName />
                        <FileFieldItemSize />
                      </FileFieldItem>
                    )}
                  </FileFieldItemList>
                </Show>
              </FileFieldDropzone>
              <FileFieldHiddenInput />
            </FileField>
          </CardContent>
          <CardFooter class="flex flex-col sm:flex-row sm:justify-end gap-2 items-stretch">
            <Button disabled={!importFile()} onClick={doImport}>
              <Upload /> Import
            </Button>
            <Button
              as="a"
              href={downloadUrl()}
              download={`solid-sdr-settings-${preferences.guiClientId}-${new Date().toISOString()}.json`}
            >
              <Download /> Export
            </Button>
          </CardFooter>
        </Card>

        <Card class="bg-transparent">
          <CardHeader>
            <CardTitle>Advanced</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <TextField
              value={preferences.guiClientId}
              onChange={(value) =>
                setPreferences("guiClientId", value.length ? value : null)
              }
              class="flex flex-col gap-2"
            >
              <TextFieldLabel>GUI Client ID</TextFieldLabel>
              <TextFieldInput />
              <TextFieldDescription>
                Unique identifier for this client, used by the radio for
                per-client settings persistence.
              </TextFieldDescription>
            </TextField>
            <SimpleSlider
              value={[preferences.panadapterOffset]}
              label="Panadapter Alignment Offset"
              minValue={-5}
              maxValue={5}
              step={1 / devicePixelRatio}
              onChange={([value]) => setPreferences("panadapterOffset", value)}
              description="Slightly shift frequency-positioned UI elements to improve alignment with panadapter data."
              getValueLabel={({ values: [value] }) => `${value}px`}
              fromCenter
            />
            <SimpleSlider
              value={[preferences.waterfallOffset]}
              label="Waterfall Alignment Offset"
              minValue={-5}
              maxValue={5}
              step={1}
              onChange={([value]) => setPreferences("waterfallOffset", value)}
              description="Slightly shift waterfall data to improve alignment with panadapter data."
              getValueLabel={({ values: [value] }) => `${value} bin`}
              fromCenter
            />
          </CardContent>
        </Card>
      </div>
    </DialogContent>
  );
}
