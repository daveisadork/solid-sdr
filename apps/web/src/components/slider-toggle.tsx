import { Show, splitProps } from "solid-js";

import type { Component, ComponentProps, JSX } from "solid-js";

import {
  Slider,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from "./ui/slider";

import { Switch, SwitchControl, SwitchThumb } from "./ui/switch";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

type SliderToggleProps = ComponentProps<typeof Slider> & {
  label: JSX.Element | string;
  tooltip?: JSX.Element | string;
  switchChecked: boolean;
  onSwitchChange: (checked: boolean) => void;
  switchClass?: string;
  switchContainerClass?: string;
  switchDisabled?: boolean;
};

export const SliderToggle: Component<SliderToggleProps> = (props) => {
  const [local, sliderProps] = splitProps(props, [
    "class",
    "disabled",
    "label",
    "switchChecked",
    "onSwitchChange",
    "switchClass",
    "switchContainerClass",
    "switchDisabled",
    "tooltip",
  ]);

  return (
    <Slider
      class={cn("space-y-2", local.class)}
      disabled={!local.switchChecked}
      {...sliderProps}
    >
      <Tooltip placement="top">
        <TooltipTrigger as="div" class="flex w-full justify-between">
          <SliderLabel>{local.label}</SliderLabel>
          <SliderValueLabel />
        </TooltipTrigger>
        <Show when={local.tooltip}>
          <TooltipContent>{local.tooltip}</TooltipContent>
        </Show>
      </Tooltip>
      <div
        class={cn(
          "flex w-full items-center justify-between space-x-2",
          local.switchContainerClass,
        )}
      >
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
        <Switch
          class={cn(
            "h-auto flex items-center origin-right scale-75",
            local.switchClass,
          )}
          checked={local.switchChecked}
          disabled={local.switchDisabled}
          onChange={local.onSwitchChange}
        >
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      </div>
    </Slider>
  );
};
