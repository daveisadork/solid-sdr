import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type * as RadioGroupPrimitive from "@kobalte/core/radio-group";
import * as SegmentedControlPrimitive from "@kobalte/core/segmented-control";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import type { Component } from "solid-js";
import { omit } from "solid-js";

import { cn } from "~/lib/utils";

type SegmentedControlRootProps<TValue extends string = string> = Omit<
  SegmentedControlPrimitive.SegmentedControlRootProps,
  "value" | "defaultValue" | "onChange"
> & {
  class?: string | undefined;
  value?: TValue;
  defaultValue?: TValue;
  onChange?: (value: TValue) => void;
};

const SegmentedControl = <
  TValue extends string = string,
  T extends ValidComponent = "div",
>(
  props: PolymorphicProps<T, SegmentedControlRootProps<TValue>>,
) => {
  const local = props as SegmentedControlRootProps<TValue>;
  const others = omit(local, "class");
  return (
    <SegmentedControlPrimitive.Root
      class={cn(
        "group/segmented-control relative flex w-full select-none flex-col justify-between space-y-2 data-disabled:opacity-50 data-disabled:cursor-not-allowed",
        local.class,
      )}
      {...(others as SegmentedControlPrimitive.SegmentedControlRootProps)}
    />
  );
};

const SegmentedControlItemsList: Component<ComponentProps<"div">> = (props) => {
  const local = props;
  const others = omit(local, "class");
  return (
    <div
      role="presentation"
      class={cn(
        "flex group-aria-[orientation=vertical]/segmented-control:flex-col group-aria-[orientation=horizontal]/segmented-control:flex-row items-center justify-between rounded-md bg-input p-1 text-muted-foreground list-none",
        local.class,
      )}
      {...others}
    />
  );
};

const SegmentedControlGroup: Component<ComponentProps<"div">> = (props) => {
  const local = props;
  const others = omit(local, "class");
  return (
    <div
      role="presentation"
      class={cn("relative m-0 p-0 w-full", local.class)}
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
  const local = props as SegmentedControlIndicatorProps;
  const others = omit(local, "class");
  return (
    <SegmentedControlPrimitive.Indicator
      class={cn(
        "absolute rounded-sm duration-250ms transition-all bg-primary",
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
  const local = props as SegmentedControlLabelProps;
  const others = omit(local, "class");
  return (
    <SegmentedControlPrimitive.Label
      class={cn("text-sm font-medium leading-none", local.class)}
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
  const local = props as SegmentedControlLabelProps;
  const others = omit(local, "class");
  return (
    <SegmentedControlPrimitive.ItemLabel
      class={cn(
        "w-full text-center text-sm font-medium px-3 py-1.5 leading-none",
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
  const local = props as SegmentedControlItemProps;
  const others = omit(local, "class", "children");
  return (
    <SegmentedControlPrimitive.Item
      class={cn(
        "w-full relative inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none data-checked:text-primary-foreground data-checked:shadow-sm",
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
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
};
