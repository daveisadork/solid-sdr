import type { Component, ComponentProps } from "solid-js";
import { Show, splitProps } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const REASON_DESCRIPTIONS: Record<string, string> = {
  ea: "SmartSDR+ Early Access",
  plus: "SmartSDR+",
};

export const LicenseGate: Component<
  ComponentProps<"div"> & { feature: string }
> = (props) => {
  const { state } = useFlexRadio();
  const feature = () => state.status.featureLicense.features[props.feature];
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Show
      when={!feature()?.enabled}
      fallback={<div class={local.class} {...others} />}
    >
      <Tooltip disabled={!(feature()?.reason in REASON_DESCRIPTIONS)}>
        <TooltipTrigger as="div">
          <div inert class={cn("inert:opacity-50", local.class)} {...others} />
          <Show when={REASON_DESCRIPTIONS[feature()?.reason]}>
            {(reason) => (
              <TooltipContent>
                Get {reason()} to use this feature!
              </TooltipContent>
            )}
          </Show>
        </TooltipTrigger>
      </Tooltip>
    </Show>
  );
};
