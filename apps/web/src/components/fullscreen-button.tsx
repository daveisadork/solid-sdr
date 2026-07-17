import type { PolymorphicProps } from "@kobalte/core";
import { ToggleButton } from "@kobalte/core/toggle-button";
import type { TooltipTriggerProps } from "@kobalte/core/tooltip";
import { createFullscreen } from "@solid-primitives/fullscreen";
import {
  createEffect,
  createSignal,
  Show,
  splitProps,
  type ValidComponent,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { cn } from "~/lib/utils";
import Fullscreen from "~icons/material-symbols/fullscreen";
import FullscreenExit from "~icons/material-symbols/fullscreen-exit";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type FullscreenButtonProps<T extends ValidComponent = "button"> =
  PolymorphicProps<T, TooltipTriggerProps<T>> & {
    class?: string | undefined;
  };

export function FullscreenButton(props: FullscreenButtonProps) {
  const [local, others] = splitProps(props, ["class"]);
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(document.documentElement, fs, {
    navigationUI: "hide",
  });

  // If fullscreen state changes outside of this component, keep the signal in sync.
  createEffect(() => setFullscreen(fullscreen()));

  const label = () => (fullscreen() ? "Exit Fullscreen" : "Enter Fullscreen");

  return (
    <Show when={document.fullscreenEnabled}>
      <Tooltip>
        <TooltipTrigger
          as={ToggleButton<"button">}
          class={cn("aspect-square size-control", local.class)}
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
