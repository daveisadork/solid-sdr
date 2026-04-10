import {
  ComponentProps,
  createEffect,
  createSignal,
  JSX,
  Match,
  onCleanup,
  splitProps,
  Switch,
  ValidComponent,
} from "solid-js";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";

import {
  ConfigColorMode,
  createLocalStorageManager,
  useColorMode,
} from "@kobalte/core";

import ThemeLightDark from "~icons/mdi/theme-light-dark";
import LightMode from "~icons/material-symbols/light-mode-outline";
import DarkMode from "~icons/material-symbols/dark-mode-outline";

type ThemeButtonProps<T extends ValidComponent = "button"> = Omit<
  ComponentProps<typeof TooltipTrigger<T>> & ComponentProps<typeof Button<T>>,
  "onClick" | "aria-label" | "children"
> & {
  class?: JSX.ElementClass;
};

export function ThemeButton(props: ThemeButtonProps) {
  const [local, others] = splitProps(props, ["class"]);

  const { colorMode, setColorMode } = useColorMode();
  const storageManager = createLocalStorageManager("vite-ui-theme");
  const themeSequence = ["system", "light", "dark"] as const;
  const [modePreference, setModePreference] = createSignal<ConfigColorMode>(
    storageManager.get("system") ?? "dark",
  );

  createEffect(() => {
    const preference = modePreference();
    storageManager.set(preference);
    setColorMode(preference);
  });

  createEffect(() => {
    if (modePreference() !== "system") return;
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setColorMode(media.matches ? "dark" : "light");
    sync();
    media.addEventListener("change", sync);
    onCleanup(() => media.removeEventListener("change", sync));
  });

  const cycleTheme = () => {
    const currentPref = modePreference();
    const index = themeSequence.indexOf(currentPref);
    const next = themeSequence[(index + 1) % themeSequence.length];
    setModePreference(next);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        as={Button}
        size="icon"
        variant="outline"
        class={cn("aspect-square not-pointer-coarse:size-5 ", local.class)}
        onClick={cycleTheme}
        aria-label="Toggle theme"
        {...others}
      >
        <Switch fallback={<ThemeLightDark />}>
          <Match when={modePreference() === "light"}>
            <LightMode />
          </Match>
          <Match when={modePreference() === "dark"}>
            <DarkMode />
          </Match>
        </Switch>
      </TooltipTrigger>
      <TooltipContent>
        Theme: {modePreference()} ({colorMode()} active)
      </TooltipContent>
    </Tooltip>
  );
}
