import {
  type ComponentProps,
  createMemo,
  type JSX,
  Show,
  splitProps,
} from "solid-js";
import { cn } from "../../lib/utils";
import {
  Slider,
  SliderDescription,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from "./slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type TooltipProps = ComponentProps<typeof Tooltip>;

type SimpleSliderProps = ComponentProps<typeof Slider> & {
  class?: string;
  label?: JSX.Element;
  tooltip?: JSX.Element;
  tooltipProps?: TooltipProps;
  description?: JSX.Element;
  fromCenter?: boolean;
};

export const SimpleSlider = (props: SimpleSliderProps) => {
  const [local, sliderProps] = splitProps(props, [
    "class",
    "children",
    "label",
    "description",
    "tooltip",
    "tooltipProps",
    "fromCenter",
  ]);

  const fillStyle = createMemo((): JSX.CSSProperties => {
    const min = props.minValue ?? 0;
    const max = props.maxValue ?? 100;
    const [value] = props.value;
    const valuePercent = ((value - min) / (max - min)) * 100;
    return {
      right: valuePercent > 50 ? `${100 - valuePercent}%` : "50%",
      left: valuePercent <= 50 ? `${valuePercent}%` : "50%",
    };
  });

  return (
    <Tooltip {...local.tooltipProps}>
      <Slider class={cn("space-y-2 pb-2", local.class)} {...sliderProps}>
        <TooltipTrigger class="flex w-full justify-between">
          <SliderLabel>{local.label}</SliderLabel>
          <SliderValueLabel />
        </TooltipTrigger>
        <SliderTrack>
          <Show when={local.fromCenter} fallback={<SliderFill />}>
            <SliderFill style={fillStyle()} />
          </Show>
          <SliderThumb />
        </SliderTrack>
        <Show when={local.description}>
          <SliderDescription class="self-start">
            {local.description}
          </SliderDescription>
        </Show>
      </Slider>
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
};
