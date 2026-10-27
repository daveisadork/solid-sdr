import type { Component, ComponentProps } from "solid-js";
import { Show, splitProps } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export const LicenseGate: Component<
  ComponentProps<"div"> & { feature: string }
> = (props) => {
  const { state } = useFlexRadio();
  const enabled = () =>
    state.status.featureLicense.features[props.feature]?.enabled;
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Show when={!enabled()} fallback={<div class={local.class} {...others} />}>
      <Tooltip>
        <TooltipTrigger>
          <div inert class={cn("inert:opacity-50", local.class)} {...others} />
          <TooltipContent>Get SmartSDR+ to use this feature!</TooltipContent>
        </TooltipTrigger>
      </Tooltip>
    </Show>
  );
};
