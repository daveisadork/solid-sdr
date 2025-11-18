import {
  Slider,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from "./slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { ComponentProps, JSX, Show, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

type TooltipProps = ComponentProps<typeof Tooltip>;

type SimpleSliderProps = ComponentProps<typeof Slider> & {
  class?: string;
  label?: JSX.Element | string;
  tooltip?: JSX.Element | string;
  tooltipProps?: TooltipProps;
};

export const SimpleSlider = (props: SimpleSliderProps) => {
  const [local, sliderProps] = splitProps(props, [
    "class",
    "children",
    "label",
    "tooltip",
    "tooltipProps",
  ]);

  return (
    <Tooltip {...local.tooltipProps}>
      <Slider class={cn("space-y-3", local.class)} {...sliderProps}>
        <TooltipTrigger class="flex w-full justify-between">
          <SliderLabel>{local.label}</SliderLabel>
          <SliderValueLabel />
        </TooltipTrigger>
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
};
