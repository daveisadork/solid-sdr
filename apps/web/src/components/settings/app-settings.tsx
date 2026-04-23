import {
  FillStyle,
  PanadapterSettingsStyle,
  PeakStyle,
  usePreferences,
} from "../../context/preferences";
import { Button } from "../ui/button";
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

export function AppSettings() {
  const { preferences, setPreferences } = usePreferences();
  const { setColorMode } = useColorMode();

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
  return (
    <Card class="bg-transparent">
      <CardContent class="flex flex-col gap-4 text-sm select-none p-6">
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
  );
}
