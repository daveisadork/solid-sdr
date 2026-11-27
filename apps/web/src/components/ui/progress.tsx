import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as ProgressPrimitive from "@kobalte/core/progress";
import type { JSX, ValidComponent } from "@solidjs/web";
import type { Component } from "solid-js";
import { omit } from "solid-js";

import { Label } from "~/components/ui/label";

type ProgressRootProps<T extends ValidComponent = "div"> =
  ProgressPrimitive.ProgressRootProps<T> & { children?: JSX.Element };

const Progress = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ProgressRootProps<T>>,
) => {
  const local = props as ProgressRootProps;
  const others = omit(local, "children");
  return (
    <ProgressPrimitive.Root {...others}>
      {local.children}
      <ProgressPrimitive.Track class="relative h-2 w-full overflow-hidden rounded-full bg-input">
        <ProgressPrimitive.Fill class="h-full w-(--kb-progress-fill-width) flex-1 bg-primary" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
};

const ProgressLabel: Component<ProgressPrimitive.ProgressLabelProps> = (
  props,
) => {
  return <ProgressPrimitive.Label as={Label} {...props} />;
};

const ProgressValueLabel: Component<
  ProgressPrimitive.ProgressValueLabelProps
> = (props) => {
  return <ProgressPrimitive.ValueLabel as={Label} {...props} />;
};

export { Progress, ProgressLabel, ProgressValueLabel };
