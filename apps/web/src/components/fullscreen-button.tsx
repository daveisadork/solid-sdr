import {
  createEffect,
  createSignal,
  Show,
  splitProps,
  ValidComponent,
} from "solid-js";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import Fullscreen from "~icons/material-symbols/fullscreen";
import FullscreenExit from "~icons/material-symbols/fullscreen-exit";
import { createFullscreen } from "@solid-primitives/fullscreen";
import { Dynamic } from "solid-js/web";
import { TooltipTriggerProps } from "@kobalte/core/tooltip";
import { ToggleButton } from "@kobalte/core/toggle-button";
import { PolymorphicProps } from "@kobalte/core";

type FullscreenButtonProps<T extends ValidComponent = "button"> =
  PolymorphicProps<T, TooltipTriggerProps<T>> & {
    class?: string | undefined;
  };

export function FullscreenButton(props: FullscreenButtonProps) {
  const [local, others] = splitProps(props, ["class"]);
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(document.documentElement, fs);

  // If fullscreen state changes outside of this component, keep the signal in sync.
  createEffect(() => setFullscreen(fullscreen()));

  const label = () => (fullscreen() ? "Exit Fullscreen" : "Enter Fullscreen");

  return (
    <Show when={document.fullscreenEnabled !== false}>
      <Tooltip>
        <TooltipTrigger
          as={ToggleButton<"button">}
          class={cn(
            "aspect-square size-10 not-pointer-coarse:size-5 ",
            local.class,
          )}
          aria-label={label()}
          pressed={fullscreen()}
          onChange={setFullscreen}
          {...others}
        >
          <Dynamic
            component={fullscreen() ? FullscreenExit : Fullscreen}
            class="size-full"
          />
        </TooltipTrigger>
        <TooltipContent>{label()}</TooltipContent>
      </Tooltip>
    </Show>
  );
}
