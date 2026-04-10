import {
  ComponentProps,
  createSignal,
  JSX,
  Show,
  splitProps,
  ValidComponent,
} from "solid-js";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import Fullscreen from "~icons/mdi/fullscreen";
import FullscreenExit from "~icons/mdi/fullscreen-exit";
import { createFullscreen } from "@solid-primitives/fullscreen";
import { Button } from "@kobalte/core/button";

type FullscreenButtonProps<T extends ValidComponent = "button"> = Omit<
  ComponentProps<typeof TooltipTrigger<T>> & ComponentProps<typeof Button<T>>,
  "onClick" | "aria-label" | "children"
> & {
  class?: JSX.ElementClass;
};

export function FullscreenButton(props: FullscreenButtonProps) {
  const [local, others] = splitProps(props, ["class"]);
  const [fs, setFullscreen] = createSignal(false);
  const fullscreen = createFullscreen(() => document.documentElement, fs);
  return (
    <Tooltip>
      <TooltipTrigger
        as={Button}
        class={cn(
          "aspect-square size-10 not-pointer-coarse:size-5 ",
          local.class,
        )}
        onClick={() => setFullscreen(!fullscreen())}
        aria-label={fullscreen() ? "Exit fullscreen" : "Enter fullscreen"}
        {...others}
      >
        <Show when={fullscreen()} fallback={<Fullscreen class="size-full" />}>
          <FullscreenExit class="size-full" />
        </Show>
      </TooltipTrigger>
      <TooltipContent>
        {fullscreen() ? "Exit" : "Enter"} Fullscreen
      </TooltipContent>
    </Tooltip>
  );
}
