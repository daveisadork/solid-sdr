import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as PopoverPrimitive from "@kobalte/core/popover";
import type { Component, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/utils";

const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverArrow = PopoverPrimitive.Arrow;

type PopoverCloseButtonProps<T extends ValidComponent = "button"> =
  PopoverPrimitive.PopoverCloseButtonProps<T> & {
    children?: JSX.Element;
    class?: string | undefined;
  };

const PopoverCloseButton = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, PopoverCloseButtonProps<T>>,
) => {
  const [local, others] = splitProps(props as PopoverCloseButtonProps, [
    "children",
    "class",
  ]);
  return (
    <PopoverPrimitive.CloseButton
      class={cn(
        "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
        local.class,
      )}
      {...others}
    >
      {local.children ?? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
          </svg>
          <span class="sr-only">Close</span>
        </>
      )}
    </PopoverPrimitive.CloseButton>
  );
};

const Popover: Component<PopoverPrimitive.PopoverRootProps> = (props) => {
  return <PopoverPrimitive.Root gutter={4} {...props} />;
};

type PopoverContentProps<T extends ValidComponent = "div"> =
  PopoverPrimitive.PopoverContentProps<T> & { class?: string | undefined };

const PopoverContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, PopoverContentProps<T>>,
) => {
  const [local, others] = splitProps(props as PopoverContentProps, ["class"]);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        class={cn(
          "text-sm z-50 w-72 origin-(--kb-popover-content-transform-origin) max-h-(--kb-popper-content-available-height) overflow-x-auto rounded-md border fancy-bg-popover p-4 text-popover-foreground shadow-md outline-none data-expanded:animate-in data-closed:animate-out data-closed:fade-out-0 data-expanded:fade-in-0 data-closed:zoom-out-95 data-expanded:zoom-in-95",
          local.class,
        )}
        {...others}
      />
    </PopoverPrimitive.Portal>
  );
};

export {
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
};
