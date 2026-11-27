import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as ToggleGroupPrimitive from "@kobalte/core/toggle-group";
import type { VariantProps } from "class-variance-authority";
import type { JSX, ValidComponent } from "@solidjs/web";
import { createContext, useContext, omit } from "solid-js";
import { toggleVariants } from "~/components/ui/toggle";
import { cn } from "~/lib/utils";

const ToggleGroupContext = createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

type ToggleGroupRootProps<T extends ValidComponent = "div"> =
  ToggleGroupPrimitive.ToggleGroupRootProps<T> &
    VariantProps<typeof toggleVariants> & {
      class?: string | undefined;
      children?: JSX.Element;
    };

const ToggleGroup = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ToggleGroupRootProps<T>>,
) => {
  const local = props as ToggleGroupRootProps;
  const others = omit(local, "class", "children", "size", "variant");

  return (
    <ToggleGroupPrimitive.Root
      class={cn("flex items-center justify-center gap-1", local.class)}
      {...others}
    >
      <ToggleGroupContext
        value={{
          get size() {
            return local.size;
          },
          get variant() {
            return local.variant;
          },
        }}
      >
        {local.children}
      </ToggleGroupContext>
    </ToggleGroupPrimitive.Root>
  );
};

type ToggleGroupItemProps<T extends ValidComponent = "button"> =
  ToggleGroupPrimitive.ToggleGroupItemProps<T> &
    VariantProps<typeof toggleVariants> & { class?: string | undefined };

const ToggleGroupItem = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, ToggleGroupItemProps<T>>,
) => {
  const local = props as ToggleGroupItemProps;
  const others = omit(local, "class", "size", "variant");
  const context = useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      class={cn(
        toggleVariants({
          size: context.size || local.size,
          variant: context.variant || local.variant,
        }),
        "hover:bg-accent data-pressed:bg-primary data-pressed:text-primary-foreground",
        "[&_svg]:pointer-events-none",
        "[&_svg]:size-4",
        "[&_svg]:shrink-0",
        local.class,
      )}
      {...others}
    />
  );
};

export { ToggleGroup, ToggleGroupItem };
