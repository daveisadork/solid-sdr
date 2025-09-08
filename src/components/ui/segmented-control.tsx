import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js";
import { createEffect, splitProps } from "solid-js";

import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as SegmentedControlPrimitive from "@kobalte/core/segmented-control";
import * as RadioGroupPrimitive from "@kobalte/core/radio-group";

import { cn } from "~/lib/utils";

type SegmentedControlRootProps =
  SegmentedControlPrimitive.SegmentedControlRootProps & {
    class?: string | undefined;
  };

const SegmentedControl = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SegmentedControlRootProps>,
) => {
  const [local, others] = splitProps(props as SegmentedControlRootProps, [
    "class",
  ]);
  return (
    <SegmentedControlPrimitive.Root
      class={cn(
        "group/segmented-control relative flex w-full touch-none select-none flex-col justify-between space-y-2",
        local.class,
      )}
      {...others}
    />
  );
};

const SegmentedControlItemsList: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      role="presentation"
      class={cn(
        "flex group-aria-[orientation=vertical]/segmented-control:flex-col group-aria-[orientation=horizontal]/segmented-control:flex-row items-center justify-between rounded-md bg-muted p-1 text-muted-foreground list-none",
        local.class,
      )}
      {...others}
    />
  );
};

const SegmentedControlGroup: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      role="presentation"
      class={cn("relative rounded-md border m-0 p-0 w-full", local.class)}
      {...others}
    />
  );
};

type SegmentedControlIndicatorProps =
  SegmentedControlPrimitive.SegmentedControlIndicatorProps & {
    class?: string | undefined;
  };

const SegmentedControlIndicator = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SegmentedControlIndicatorProps>,
) => {
  const [local, others] = splitProps(props as SegmentedControlIndicatorProps, [
    "class",
  ]);
  return (
    <SegmentedControlPrimitive.Indicator
      class={cn(
        "absolute rounded-sm m-1 text-sm font-medium duration-250ms transition-all bg-primary",
        local.class,
      )}
      {...others}
    />
  );
};

type SegmentedControlLabelProps<T extends ValidComponent = "span"> =
  RadioGroupPrimitive.RadioGroupLabelProps<T> & {
    class?: string | undefined;
  };

const SegmentedControlLabel = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, SegmentedControlLabelProps<T>>,
) => {
  const [local, others] = splitProps(props as SegmentedControlLabelProps, [
    "class",
  ]);
  return (
    <SegmentedControlPrimitive.Label
      class={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        local.class,
      )}
      {...others}
    />
  );
};

type SegmentedControlItemLabelProps<T extends ValidComponent = "label"> =
  SegmentedControlPrimitive.SegmentedControlItemLabelProps<T> & {
    class?: string | undefined;
  };

const SegmentedControlItemLabel = <T extends ValidComponent = "label">(
  props: PolymorphicProps<T, SegmentedControlItemLabelProps<T>>,
) => {
  const [local, others] = splitProps(props as SegmentedControlLabelProps, [
    "class",
  ]);
  return (
    <SegmentedControlPrimitive.ItemLabel
      class={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        local.class,
      )}
      {...others}
    />
  );
};

type SegmentedControlItemProps<T extends ValidComponent = "div"> =
  SegmentedControlPrimitive.SegmentedControlItemProps<T> & {
    class?: string | undefined;
    children?: JSX.Element;
  };

const SegmentedControlItem = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SegmentedControlItemProps<T>>,
) => {
  const [local, others] = splitProps(props as SegmentedControlItemProps, [
    "class",
    "children",
  ]);
  return (
    <SegmentedControlPrimitive.Item
      class={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[checked]:text-primary-foreground data-[checked]:shadow-sm",
        local.class,
      )}
      {...others}
    >
      <SegmentedControlPrimitive.ItemInput class="[all:unset]" />
      {local.children}
    </SegmentedControlPrimitive.Item>
  );
};

export {
  SegmentedControl,
  SegmentedControlItemsList,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlLabel,
  SegmentedControlItem,
  SegmentedControlItemLabel,
};
