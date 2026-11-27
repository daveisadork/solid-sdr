import * as DialogPrimitive from "@kobalte/core/dialog";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { createMediaQuery } from "@solid-primitives/media";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import type { Accessor, Component } from "solid-js";
import { createContext, Show, useContext, omit } from "solid-js";

import { cn } from "~/lib/utils";

const DialogContext = createContext<{
  isSheet: Accessor<boolean>;
}>({
  isSheet: () => false,
});

type DialogProps = DialogPrimitive.DialogRootProps & {
  /** `auto` (the default) renders a sheet below Tailwind's `sm` breakpoint and a centered dialog above it. */
  variant?: "dialog" | "sheet" | "auto";
};

const Dialog: Component<DialogProps> = (props) => {
  const local = props;
  const rest = omit(local, "variant");
  const isSm = createMediaQuery("(min-width: 40rem)");
  const isSheet = () => {
    const variant = local.variant ?? "auto";
    return variant === "sheet" || (variant === "auto" && !isSm());
  };

  return (
    <DialogContext
      value={{
        isSheet,
      }}
    >
      <DialogPrimitive.Root {...rest} />
    </DialogContext>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const portalVariants = cva("fixed inset-0 z-50 flex", {
  variants: {
    position: {
      center: "items-start justify-center sm:items-center",
      top: "items-start",
      bottom: "items-end",
      left: "justify-start",
      right: "justify-end",
    },
  },
  defaultVariants: { position: "center" },
});

type DialogPortalProps = DialogPrimitive.DialogPortalProps &
  VariantProps<typeof portalVariants>;

const DialogPortal: Component<DialogPortalProps> = (props) => {
  const local = props;
  const rest = omit(local, "position", "children");
  return (
    <DialogPrimitive.Portal {...rest}>
      <div class={portalVariants({ position: local.position })}>
        {local.children}
      </div>
    </DialogPrimitive.Portal>
  );
};

type DialogOverlayProps<T extends ValidComponent = "div"> =
  DialogPrimitive.DialogOverlayProps<T> & { class?: string | undefined };

const DialogOverlay = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DialogOverlayProps<T>>,
) => {
  const rest = omit(props as DialogOverlayProps, "class");
  return (
    <DialogPrimitive.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-background/80 data-expanded:animate-in data-closed:animate-out data-closed:fade-out-0 data-expanded:fade-in-0",
        props.class,
      )}
      {...rest}
    />
  );
};

const contentVariants = cva(
  "relative flex flex-col z-50 bg-background max-h-screen min-h-0 overflow-clip shadow-lg data-expanded:animate-in data-closed:animate-out text-sm",
  {
    variants: {
      variant: {
        dialog: cn(
          "sm:max-h-[95vh] border rounded-lg transition-none data-closed:duration-300 data-expanded:duration-300 data-closed:fade-out-0 data-expanded:fade-in-0",
          "data-closed:zoom-out-95 data-expanded:zoom-in-95",
          "data-anchored:data-closed:zoom-out-0 data-anchored:data-expanded:zoom-in-0",
        ),
        sheet:
          "transition ease-in-out data-closed:duration-300 data-expanded:duration-500 w-full",
      },
      position: {
        center: "w-full max-w-sm sm:max-w-lg",
        top: "inset-x-0 top-0 border-b data-closed:slide-out-to-top data-expanded:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-closed:slide-out-to-bottom data-expanded:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-closed:slide-out-to-left data-expanded:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-closed:slide-out-to-right data-expanded:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: { variant: "dialog", position: "center" },
  },
);

type DialogContentProps<T extends ValidComponent = "div"> =
  DialogPrimitive.DialogContentProps<T> &
    VariantProps<typeof contentVariants> & {
      hideOverlay?: boolean | undefined;
      class?: string | undefined;
      children?: JSX.Element;
      style?: JSX.CSSProperties;
    };

const DialogContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DialogContentProps<T>>,
) => {
  const local = props as DialogContentProps;
  const rest = omit(local, "position", "class", "children", "hideOverlay");
  const { isSheet } = useContext(DialogContext);
  const ctx = DialogPrimitive.useDialogContext();

  const anchorToTrigger = (e: AnimationEvent) => {
    if (!["enter", "exit"].includes(e.animationName)) return;
    const el = e.currentTarget as HTMLElement;
    if (e.target !== el) return; // ignore animations bubbling from children
    const trigger = ctx.triggerRef();
    if (isSheet() || !trigger?.isConnected) {
      el.style.removeProperty("transform-origin");
      return;
    }
    const t = trigger.getBoundingClientRect();
    const tx = t.left + t.width / 2;
    const ty = t.top + t.height / 2;
    el.style.transformOrigin = `${tx - el.offsetLeft}px ${ty - el.offsetTop}px`;
  };

  const position = () => {
    if (!isSheet()) return "center";
    return local.position && local.position !== "center"
      ? local.position
      : "bottom";
  };
  return (
    <DialogPortal position={position()}>
      <Show when={!local.hideOverlay}>
        <DialogOverlay />
      </Show>
      <DialogPrimitive.Content
        data-sheet={isSheet() ? true : undefined}
        data-dialog={isSheet() ? undefined : true}
        data-anchored={ctx.triggerRef() ? true : undefined}
        onAnimationStart={anchorToTrigger}
        class={cn(
          contentVariants({
            variant: isSheet() ? "sheet" : "dialog",
            position: position(),
          }),
          local.class,
        )}
        {...rest}
      >
        <div
          class="flex flex-col flex-1 p-4 gap-4 min-h-0 overflow-y-auto"
          style={{ "scrollbar-width": "thin" }}
        >
          {local.children}
        </div>
        <DialogPrimitive.CloseButton class="absolute z-20 right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-expanded:bg-accent data-expanded:text-muted-foreground">
          <svg
            aria-hidden="true"
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
        </DialogPrimitive.CloseButton>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

const DialogHeader: Component<
  ComponentProps<"div"> & { sticky?: boolean | undefined }
> = (props) => {
  const local = props;
  const rest = omit(local, "class", "sticky");
  const sticky = () => local.sticky ?? true;
  return (
    <div
      class={cn(
        "sticky flex flex-col space-y-1.5 text-center sm:text-left left-0",
        sticky() && "-m-4 p-4 z-10 -top-4 -left-4 fancy-bg-background",
        local.class,
      )}
      {...rest}
    />
  );
};

const DialogFooter: Component<
  ComponentProps<"div"> & { sticky?: boolean | undefined }
> = (props) => {
  const local = props;
  const rest = omit(local, "class", "sticky");
  return (
    <div
      class={cn(
        "sticky flex flex-col-reverse sm:flex-row sm:justify-end gap-2 left-0",
        local.sticky && "-m-4 p-4 -bottom-4 -left-4 fancy-bg-background",
        local.class,
      )}
      {...rest}
    />
  );
};

type DialogTitleProps<T extends ValidComponent = "h2"> =
  DialogPrimitive.DialogTitleProps<T> & {
    class?: string | undefined;
  };

const DialogTitle = <T extends ValidComponent = "h2">(
  props: PolymorphicProps<T, DialogTitleProps<T>>,
) => {
  const rest = omit(props as DialogTitleProps, "class");
  return (
    <DialogPrimitive.Title
      class={cn(
        "text-lg font-semibold leading-none tracking-tight",
        props.class,
      )}
      {...rest}
    />
  );
};

type DialogDescriptionProps<T extends ValidComponent = "p"> =
  DialogPrimitive.DialogDescriptionProps<T> & {
    class?: string | undefined;
  };

const DialogDescription = <T extends ValidComponent = "p">(
  props: PolymorphicProps<T, DialogDescriptionProps<T>>,
) => {
  const rest = omit(props as DialogDescriptionProps, "class");
  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", props.class)}
      {...rest}
    />
  );
};

export type { DialogContentProps };
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
