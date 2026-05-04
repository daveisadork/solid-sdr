import {
  FillStyle,
  PanadapterSettingsStyle,
  PeakStyle,
  usePreferences,
} from "../../context/preferences";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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
import { createEffect, For, onCleanup } from "solid-js";
import { useColorMode } from "@kobalte/core";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/text-field";
import useFlexRadio from "~/context/flexradio";

export function AppSettings() {
  const { preferences, setPreferences } = usePreferences();
  const { setColorMode } = useColorMode();
  const { radio, state } = useFlexRadio();

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

  const radioClientStationName = () => {
    const descriptor = Object.values(state.discoveredRadios).find(
      (disc) => disc.serial === state.status.radio.serial,
    );
    if (!descriptor) return;
    const index = descriptor.guiClientHandles.indexOf(
      `0x${state.clientHandle}`,
    );
    return descriptor.guiClientHosts[index];
  };

  createEffect(() => {
    radio()?.setClientStationName(preferences.stationName);
  });

  return (
    <div class="flex flex-col gap-4 text-sm">
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
          />
          <SimpleSwitch
            checked={preferences.enableBlurEffects}
            onChange={(isChecked) => {
              setPreferences("enableBlurEffects", isChecked);
            }}
            label="Blur Effects"
          />
          <SimpleSwitch
            checked={preferences.smoothScroll}
            onChange={(isChecked) => {
              setPreferences("smoothScroll", isChecked);
            }}
            label="Smooth Scroll"
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
    </div>
  );
}
