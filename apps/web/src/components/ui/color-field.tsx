import type { ValidComponent } from "solid-js";
import { mergeProps, splitProps } from "solid-js";

import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as ColorFieldPrimitive from "@kobalte/core/color-field";
import { cva } from "class-variance-authority";

import { cn } from "~/lib/utils";

type ColorFieldRootProps<T extends ValidComponent = "div"> =
  ColorFieldPrimitive.ColorFieldRootProps<T> & {
    class?: string | undefined;
  };

const ColorField = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ColorFieldRootProps<T>>,
) => {
  const [local, others] = splitProps(props as ColorFieldRootProps, ["class"]);
  return (
    <ColorFieldPrimitive.Root
      class={cn("flex flex-col gap-1", local.class)}
      {...others}
    />
  );
};

type ColorFieldInputProps<T extends ValidComponent = "input"> =
  ColorFieldPrimitive.ColorFieldInputProps<T> & {
    class?: string | undefined;
    type?:
      | "button"
      | "checkbox"
      | "color"
      | "date"
      | "datetime-local"
      | "email"
      | "file"
      | "hidden"
      | "image"
      | "month"
      | "number"
      | "password"
      | "radio"
      | "range"
      | "reset"
      | "search"
      | "submit"
      | "tel"
      | "text"
      | "time"
      | "url"
      | "week";
  };

const ColorFieldInput = <T extends ValidComponent = "input">(
  rawProps: PolymorphicProps<T, ColorFieldInputProps<T>>,
) => {
  const props = mergeProps<ColorFieldInputProps<T>[]>(
    { type: "text" },
    rawProps,
  );
  const [local, others] = splitProps(props as ColorFieldInputProps, [
    "type",
    "class",
  ]);
  return (
    <ColorFieldPrimitive.Input
      type={local.type}
      class={cn(
        "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-invalid:border-error-foreground data-invalid:text-error-foreground",
        local.class,
      )}
      {...others}
    />
  );
};

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  {
    variants: {
      variant: {
        label: "data-[invalid]:text-destructive",
        description: "font-normal text-muted-foreground",
        error: "text-xs text-destructive",
      },
    },
    defaultVariants: {
      variant: "label",
    },
  },
);

type ColorFieldLabelProps<T extends ValidComponent = "label"> =
  ColorFieldPrimitive.ColorFieldLabelProps<T> & { class?: string | undefined };

const ColorFieldLabel = <T extends ValidComponent = "label">(
  props: PolymorphicProps<T, ColorFieldLabelProps<T>>,
) => {
  const [local, others] = splitProps(props as ColorFieldLabelProps, ["class"]);
  return (
    <ColorFieldPrimitive.Label
      class={cn(labelVariants(), local.class)}
      {...others}
    />
  );
};

type ColorFieldDescriptionProps<T extends ValidComponent = "div"> =
  ColorFieldPrimitive.ColorFieldDescriptionProps<T> & {
    class?: string | undefined;
  };

const ColorFieldDescription = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ColorFieldDescriptionProps<T>>,
) => {
  const [local, others] = splitProps(props as ColorFieldDescriptionProps, [
    "class",
  ]);
  return (
    <ColorFieldPrimitive.Description
      class={cn(labelVariants({ variant: "description" }), local.class)}
      {...others}
    />
  );
};

type ColorFieldErrorMessageProps<T extends ValidComponent = "div"> =
  ColorFieldPrimitive.ColorFieldErrorMessageProps<T> & {
    class?: string | undefined;
  };

const ColorFieldErrorMessage = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ColorFieldErrorMessageProps<T>>,
) => {
  const [local, others] = splitProps(props as ColorFieldErrorMessageProps, [
    "class",
  ]);
  return (
    <ColorFieldPrimitive.ErrorMessage
      class={cn(labelVariants({ variant: "error" }), local.class)}
      {...others}
    />
  );
};

export {
  ColorField,
  ColorFieldInput,
  ColorFieldLabel,
  ColorFieldDescription,
  ColorFieldErrorMessage,
};
