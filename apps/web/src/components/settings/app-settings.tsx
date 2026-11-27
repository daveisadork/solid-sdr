import { useColorMode } from "@kobalte/core/color-mode";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  reconcile,
  Show,
} from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { useRtc } from "~/context/rtc";
import { APP_VERSION } from "~/lib/version";
import Download from "~icons/material-symbols/download";
import MaterialSymbolsLicense from "~icons/material-symbols/license";
import Upload from "~icons/material-symbols/upload";
import MdiGithub from "~icons/mdi/github";
import {
  type FillStyle,
  type PeakStyle,
  usePreferences,
} from "../../context/preferences";
import { LicenseGate } from "../license-gate";
import { Button } from "../ui/button";
import { Callout, CalloutContent, CalloutTitle } from "../ui/callout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  FileField,
  FileFieldDropzone,
  FileFieldHiddenInput,
  FileFieldItem,
  FileFieldItemList,
  FileFieldItemName,
  FileFieldItemSize,
} from "../ui/file-field";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "../ui/segmented-control";
import { SimpleSlider } from "../ui/simple-slider";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  TextField,
  TextFieldDescription,
  TextFieldInput,
  TextFieldLabel,
} from "../ui/text-field";
import { showToast } from "../ui/toast";
import { InfoItem } from "./common";

const LicenseInfo = () => {
  const [open, setOpen] = createSignal(false);

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <DialogTrigger as={Button}>
        <MaterialSymbolsLicense /> License
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>License</DialogTitle>
          <DialogDescription>
            SolidSDR is licensed under the MIT license
          </DialogDescription>
        </DialogHeader>
        <p>Copyright {new Date().getFullYear()} Dave Hayes, KF0SMY</p>

        <p>
          Permission is hereby granted, free of charge, to any person obtaining
          a copy of this software and associated documentation files (the
          “Software”), to deal in the Software without restriction, including
          without limitation the rights to use, copy, modify, merge, publish,
          distribute, sublicense, and/or sell copies of the Software, and to
          permit persons to whom the Software is furnished to do so, subject to
          the following conditions:
        </p>

        <p>
          The above copyright notice and this permission notice shall be
          included in all copies or substantial portions of the Software.
        </p>

        <p>
          THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
          IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
          CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
          TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
          SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export function AppSettings() {
  const { preferences, setPreferences } = usePreferences();
  const { setColorMode } = useColorMode();
  const { radio } = useFlexRadio();
  const { serverVersion } = useRtc();
  const [newRelease, setNewRelease] = createSignal(false);
  const [importFile, setImportFile] = createSignal<File>();

  const currentRelease = createMemo(async () => {
    const response = await fetch(
      "https://api.github.com/repos/daveisadork/solid-sdr/releases/latest",
    );
    return await response.json();
  });

  createEffect(() => currentRelease()?.tag_name, {
    effect: (currentVersion) => {
      if (!currentVersion) return;
      setNewRelease(!APP_VERSION.startsWith(currentVersion));
    },
    // An offline or rate-limited update check must not break the dialog.
    error: (err) => console.warn("Release check failed", err),
  });

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

  createEffect(
    () => preferences.theme,
    (theme) => {
      setColorMode(theme);
      if (theme !== "system" || typeof window === "undefined") return;
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const sync = () => setColorMode(media.matches ? "dark" : "light");
      sync();
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    },
  );

  createEffect(
    () => ({ activeRadio: radio(), name: preferences.stationName }),
    ({ activeRadio, name }) => {
      activeRadio?.setClientStationName(name);
    },
  );

  return (
    <DialogContent class="text-sm">
      <DialogHeader>
        <DialogTitle>App Settings</DialogTitle>
      </DialogHeader>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>About SolidSDR</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-2 text-sm">
          <Show when={newRelease()}>
            <a href={currentRelease().html_url} target="_blank" rel="noopener">
              <Callout>
                <CalloutTitle>
                  SolidSDR {currentRelease().name} is available!
                </CalloutTitle>
                <CalloutContent>
                  Click here for more information.
                </CalloutContent>
              </Callout>
            </a>
          </Show>
          <InfoItem label="Client Version" value={APP_VERSION} />
          <InfoItem label="Server Version" value={serverVersion() ?? "—"} />
        </CardContent>
        <CardFooter class="flex flex-col sm:flex-row sm:justify-end gap-2 items-stretch">
          <LicenseInfo />
          <Button
            as="a"
            href="https://github.com/daveisadork/solid-sdr"
            target="_blank"
          >
            <MdiGithub /> Project Page
          </Button>
        </CardFooter>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Station</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <TextField
            value={preferences.stationName}
            onChange={(value) =>
              setPreferences((draft) => {
                draft.stationName = value;
              })
            }
            class="flex flex-col gap-2"
          >
            <TextFieldLabel>Station Name</TextFieldLabel>
            <TextFieldInput placeholder="Laptop" />
          </TextField>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <SimpleSwitch
            checked={preferences.smoothScroll}
            onChange={(isChecked) => {
              setPreferences((draft) => {
                draft.smoothScroll = isChecked;
              });
            }}
            label="Smooth Scroll"
            description="Enable smooth horizontal scrolling of the panafall."
          />
          <SimpleSwitch
            checked={preferences.mousewheelTuning}
            onChange={(isChecked) => {
              setPreferences((draft) => {
                draft.mousewheelTuning = isChecked;
              });
            }}
            label="Mousewheel Tuning"
            description="Enable tuning the active slice with the mousewheel."
          />
          <SimpleSwitch
            checked={preferences.invertMousewheelTuning}
            onChange={(isChecked) => {
              setPreferences((draft) => {
                draft.invertMousewheelTuning = isChecked;
              });
            }}
            label="Invert Mousewheel Tuning"
            description="Change the direction mousewheel tuning moves the frequency."
          />
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
              setPreferences((draft) => {
                draft.enableTransparencyEffects = isChecked;
              });
            }}
            label="Transparency Effects"
            description="Enable the use of transparent/floating UI elements."
          />
          <SimpleSwitch
            checked={preferences.enableBlurEffects}
            onChange={(isChecked) => {
              setPreferences((draft) => {
                draft.enableBlurEffects = isChecked;
              });
            }}
            label="Blur Effects"
            description="Enable the use of a blur effect on transparent UI elements"
          />
          <SimpleSwitch
            checked={preferences.showTuningGuide}
            onChange={(isChecked) => {
              setPreferences((draft) => {
                draft.showTuningGuide = isChecked;
              });
            }}
            label="Tuning Guide"
          />
          <LicenseGate feature="PANADAPTER_VISUALS">
            <SimpleSwitch
              checked={preferences.showDisplayMarkers}
              onChange={(isChecked) => {
                setPreferences((draft) => {
                  draft.showDisplayMarkers = isChecked;
                });
              }}
              label="Display Markers (Band Plan)"
            />
          </LicenseGate>
          <SimpleSwitch
            checked={preferences.showFps}
            onChange={(isChecked) => {
              setPreferences((draft) => {
                draft.showFps = isChecked;
              });
            }}
            label="Show FPS"
            description="Show a floating FPS counter."
          />
          <SimpleSwitch
            checked={preferences.preventScreenSleep}
            onChange={(isChecked) => {
              setPreferences((draft) => {
                draft.preventScreenSleep = isChecked;
              });
            }}
            label="Prevent Screensaver"
          />
          <SegmentedControl
            value={preferences.peakStyle}
            onChange={(value: PeakStyle) => {
              if (!value) return;
              setPreferences((draft) => {
                draft.peakStyle = value;
              });
            }}
          >
            <SegmentedControlLabel>Peak Style</SegmentedControlLabel>
            <SegmentedControlIndicator />
            <SegmentedControlGroup>
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
              setPreferences((draft) => {
                draft.fillStyle = value;
              });
            }}
          >
            <SegmentedControlLabel>Fill Style</SegmentedControlLabel>
            <SegmentedControlIndicator />
            <SegmentedControlGroup>
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
              setPreferences((draft) => {
                draft.gradientStyle = value as "color" | "classic";
              });
            }}
          >
            <SegmentedControlLabel>Gradient Style</SegmentedControlLabel>
            <SegmentedControlIndicator />
            <SegmentedControlGroup>
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
            value={preferences.theme}
            onChange={(value: "system" | "light" | "dark") => {
              if (!value) return;
              setPreferences((draft) => {
                draft.theme = value;
              });
            }}
          >
            <SegmentedControlLabel>Theme</SegmentedControlLabel>
            <SegmentedControlIndicator />
            <SegmentedControlGroup>
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
            value={preferences.guiClientId ?? ""}
            onChange={(value) =>
              setPreferences((draft) => {
                draft.guiClientId = value.length ? value : null;
              })
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
            onChange={([value]) =>
              setPreferences((draft) => {
                draft.panadapterOffset = value;
              })
            }
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
            onChange={([value]) =>
              setPreferences((draft) => {
                draft.waterfallOffset = value;
              })
            }
            description="Slightly shift waterfall data to improve alignment with panadapter data."
            getValueLabel={({ values: [value] }) => `${value} bin`}
            fromCenter
          />
        </CardContent>
      </Card>
    </DialogContent>
  );
}
