import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "./switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { ComponentProps, JSX, Show, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

type TooltipProps = ComponentProps<typeof Tooltip>;

type SimpleSwitchProps = ComponentProps<typeof Switch> & {
  class?: string;
  label?: JSX.Element | string;
  tooltip?: JSX.Element | string;
  tooltipProps?: TooltipProps;
};

export const SimpleSwitch = (props: SimpleSwitchProps) => {
  const [local, switchProps] = splitProps(props, [
    "class",
    "label",
    "tooltip",
    "tooltipProps",
  ]);

  return (
    <Tooltip {...local.tooltipProps}>
      <TooltipTrigger
        as={Switch}
        class={cn("flex items-center space-x-2 justify-between", local.class)}
        {...switchProps}
      >
        <SwitchLabel>{local.label}</SwitchLabel>
        <SwitchControl class="origin-right scale-75">
          <SwitchThumb />
        </SwitchControl>
      </TooltipTrigger>
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
};
