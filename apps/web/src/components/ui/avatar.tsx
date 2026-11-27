import * as ImagePrimitive from "@kobalte/core/image";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "~/lib/utils";

type AvatarRootProps<T extends ValidComponent = "span"> =
  ImagePrimitive.ImageRootProps<T> & {
    class?: string | undefined;
  };

const Avatar = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, AvatarRootProps<T>>,
) => {
  const local = props as AvatarRootProps;
  const others = omit(local, "class");
  return (
    <ImagePrimitive.Root
      class={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        local.class,
      )}
      {...others}
    />
  );
};

type AvatarImageProps<T extends ValidComponent = "img"> =
  ImagePrimitive.ImageImgProps<T> & {
    class?: string | undefined;
  };

const AvatarImage = <T extends ValidComponent = "img">(
  props: PolymorphicProps<T, AvatarImageProps<T>>,
) => {
  const local = props as AvatarImageProps;
  const others = omit(local, "class");
  return (
    <ImagePrimitive.Img
      class={cn("aspect-square size-full", local.class)}
      {...others}
    />
  );
};

type AvatarFallbackProps<T extends ValidComponent = "span"> =
  ImagePrimitive.ImageFallbackProps<T> & { class?: string | undefined };

const AvatarFallback = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, AvatarFallbackProps<T>>,
) => {
  const local = props as AvatarFallbackProps;
  const others = omit(local, "class");
  return (
    <ImagePrimitive.Fallback
      class={cn(
        "flex size-full items-center justify-center bg-muted",
        local.class,
      )}
      {...others}
    />
  );
};

export { Avatar, AvatarFallback, AvatarImage };
