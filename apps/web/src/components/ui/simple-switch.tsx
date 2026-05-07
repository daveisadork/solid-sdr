import {
  Switch,
  SwitchControl,
  SwitchDescription,
  SwitchLabel,
  SwitchThumb,
} from "./switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { ComponentProps, JSX, Show, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

type TooltipProps = ComponentProps<typeof Tooltip>;

type SimpleSwitchProps = ComponentProps<typeof Switch> & {
  class?: string;
  label?: JSX.Element;
  description?: JSX.Element;
  tooltip?: JSX.Element;
  tooltipProps?: TooltipProps;
};

export const SimpleSwitch = (props: SimpleSwitchProps) => {
  const [local, switchProps] = splitProps(props, [
    "class",
    "description",
    "label",
    "tooltip",
    "tooltipProps",
  ]);

  return (
    <Tooltip {...local.tooltipProps}>
      <TooltipTrigger
        as={Switch}
        class={cn("flex flex-col", local.class)}
        {...switchProps}
      >
        <div class="flex items-center justify-between gap-2">
          <SwitchLabel class="grow">{local.label}</SwitchLabel>
          <SwitchControl class="origin-right scale-75">
            <SwitchThumb />
          </SwitchControl>
        </div>
        <Show when={local.description}>
          <SwitchDescription>{local.description}</SwitchDescription>
        </Show>
      </TooltipTrigger>
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
};
