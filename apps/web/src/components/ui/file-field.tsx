import * as FileFieldPrimitive from "@kobalte/core/file-field";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";

import { cva } from "class-variance-authority";
import type { JSX, ValidComponent } from "@solidjs/web";
import { children, omit } from "solid-js";

import { cn } from "~/lib/utils";

type FileFieldProps<T extends ValidComponent = "div"> =
  FileFieldPrimitive.FileFieldRootProps<T> & {
    class?: string | undefined;
    children?:
      | JSX.Element
      | ((context: FileFieldPrimitive.FileFieldContextValue) => JSX.Element);
  };

type FileFieldChildProps = Pick<FileFieldProps, "children">;

const FileFieldChild = (props: FileFieldChildProps) => {
  const context = FileFieldPrimitive.useFileFieldContext();
  const resolvedChildren = children(() => {
    const body = props.children;
    return typeof body === "function" ? body(context) : body;
  });

  return <>{resolvedChildren()}</>;
};
const FileField = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, FileFieldProps<T>>,
) => {
  const local = props as FileFieldProps;
  const others = omit(local, "children", "class");
  return (
    <FileFieldPrimitive.Root
      class={cn("flex flex-col gap-1", local.class)}
      {...others}
    >
      <FileFieldChild>{local.children}</FileFieldChild>
    </FileFieldPrimitive.Root>
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

type FileFieldLabelProps<T extends ValidComponent = "label"> =
  FileFieldPrimitive.FileFieldLabelProps<T> & { class?: string | undefined };

const FileFieldLabel = <T extends ValidComponent = "label">(
  props: PolymorphicProps<T, FileFieldLabelProps<T>>,
) => {
  const local = props as FileFieldLabelProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.Label
      class={cn(labelVariants(), local.class)}
      {...others}
    />
  );
};

type FileFieldDescriptionProps<T extends ValidComponent = "div"> =
  FileFieldPrimitive.FileFieldDescriptionProps & {
    class?: string | undefined;
  };

const FileFieldDescription = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, FileFieldDescriptionProps<T>>,
) => {
  const local = props as FileFieldDescriptionProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.Description
      class={cn(labelVariants({ variant: "description" }), local.class)}
      {...others}
    />
  );
};

type FileFieldErrorMessageProps<T extends ValidComponent = "div"> =
  FileFieldPrimitive.FileFieldErrorMessageProps<T> & {
    class?: string | undefined;
  };

const FileFieldErrorMessage = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, FileFieldErrorMessageProps<T>>,
) => {
  const local = props as FileFieldErrorMessageProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.ErrorMessage
      class={cn(labelVariants({ variant: "error" }), local.class)}
      {...others}
    />
  );
};

const FileFieldTrigger = FileFieldPrimitive.Trigger;
const FileFieldHiddenInput = FileFieldPrimitive.HiddenInput;
const FileFieldItemDeleteTrigger = FileFieldPrimitive.ItemDeleteTrigger;

type FileFieldDropzoneProps<T extends ValidComponent = "div"> =
  FileFieldPrimitive.FileFieldDropzoneProps<T> & { class?: string | undefined };

const FileFieldDropzone = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, FileFieldDropzoneProps<T>>,
) => {
  const local = props as FileFieldDropzoneProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.Dropzone
      class={cn(
        "rounded-lg border border-input shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-[dragging=true]:ring-2 data-[dragging=true]:ring-ring data-[dragging=true]:ring-offset-2 p-4",
        local.class,
      )}
      {...others}
    />
  );
};

type FileFieldItemListProps<T extends ValidComponent = "ul"> =
  FileFieldPrimitive.FileFieldItemListProps<T> & { class?: string | undefined };

const FileFieldItemList = <T extends ValidComponent = "ul">(
  props: PolymorphicProps<T, FileFieldItemListProps<T>>,
) => {
  const local = props as FileFieldItemListProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.ItemList
      class={cn("flex flex-col gap-2 overflow-hidden", local.class)}
      {...others}
    />
  );
};

type FileFieldItemProps<T extends ValidComponent = "li"> =
  FileFieldPrimitive.FileFieldItemRootProps<T> & { class?: string | undefined };

const FileFieldItem = <T extends ValidComponent = "li">(
  props: PolymorphicProps<T, FileFieldItemProps<T>>,
) => {
  const local = props as FileFieldItemProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.Item
      class={cn("flex items-center gap-3", local.class)}
      {...others}
    />
  );
};

type FileFieldItemNameProps<T extends ValidComponent = "span"> =
  FileFieldPrimitive.FileFieldItemNameProps<T> & { class?: string | undefined };

const FileFieldItemName = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, FileFieldItemNameProps<T>>,
) => {
  const local = props as FileFieldItemNameProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.ItemName
      class={cn("text-sm font-medium truncate", local.class)}
      {...others}
    />
  );
};

type FileFieldItemSizeProps<T extends ValidComponent = "span"> =
  FileFieldPrimitive.FileFieldItemSizeProps<T> & { class?: string | undefined };

const FileFieldItemSize = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, FileFieldItemSizeProps<T>>,
) => {
  const local = props as FileFieldItemSizeProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.ItemSize
      class={cn("text-xs text-muted-foreground shrink-0", local.class)}
      {...others}
    />
  );
};

type FileFieldItemPreviewProps<T extends ValidComponent = "div"> =
  FileFieldPrimitive.FileFieldItemPreviewProps<T> & {
    class?: string | undefined;
  };

const FileFieldItemPreview = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, FileFieldItemPreviewProps<T>>,
) => {
  const local = props as FileFieldItemPreviewProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.ItemPreview
      class={cn("shrink-0", local.class)}
      {...others}
    />
  );
};

type FileFieldItemPreviewImageProps<T extends ValidComponent = "img"> =
  FileFieldPrimitive.FileFieldItemPreviewImageProps<T> & {
    class?: string | undefined;
  };

const FileFieldItemPreviewImage = <T extends ValidComponent = "img">(
  props: PolymorphicProps<T, FileFieldItemPreviewImageProps<T>>,
) => {
  const local = props as FileFieldItemPreviewImageProps;
  const others = omit(local, "class");
  return (
    <FileFieldPrimitive.ItemPreviewImage
      class={cn("size-10 rounded-md object-cover", local.class)}
      {...others}
    />
  );
};

export {
  FileField,
  FileFieldDescription,
  FileFieldDropzone,
  FileFieldErrorMessage,
  FileFieldHiddenInput,
  FileFieldItem,
  FileFieldItemDeleteTrigger,
  FileFieldItemList,
  FileFieldItemName,
  FileFieldItemPreview,
  FileFieldItemPreviewImage,
  FileFieldItemSize,
  FileFieldLabel,
  FileFieldTrigger,
};
