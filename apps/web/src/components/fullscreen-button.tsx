import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { ToggleButton } from "@kobalte/core/toggle-button";
import type { TooltipTriggerProps } from "@kobalte/core/tooltip";
import { createFullscreen } from "@solid-primitives/fullscreen";
import type { ValidComponent } from "@solidjs/web";
import { omit, Show } from "solid-js";
import { Dynamic } from "@solidjs/web";
import { cn } from "~/lib/utils";
import Fullscreen from "~icons/material-symbols/fullscreen";
import FullscreenExit from "~icons/material-symbols/fullscreen-exit";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type FullscreenButtonProps<T extends ValidComponent = "button"> =
  PolymorphicProps<T, TooltipTriggerProps<T>> & {
    class?: string | undefined;
  };

export function FullscreenButton(props: FullscreenButtonProps) {
  const local = props;
  const others = omit(local, "class");
  // isActive follows the real fullscreen state, including exits via Escape.
  const {
    enter,
    exit,
    isActive: fullscreen,
  } = createFullscreen(document.documentElement, { navigationUI: "hide" });

  const label = () => (fullscreen() ? "Exit Fullscreen" : "Enter Fullscreen");

  return (
    <Show when={document.fullscreenEnabled}>
      <Tooltip>
        <TooltipTrigger
          as={ToggleButton<"button">}
          {...others}
          class={cn("aspect-square size-control", local.class)}
          aria-label={label()}
          pressed={fullscreen()}
          onChange={(pressed: boolean) => void (pressed ? enter() : exit())}
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
