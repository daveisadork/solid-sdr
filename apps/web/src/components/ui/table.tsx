import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/utils";

const Table: Component<ComponentProps<"table">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "relative rounded-md clip-path-md border overflow-x-auto bg-background text-sm",
        local.class,
      )}
    >
      <table
        class={cn("relative w-full caption-bottom", local.class)}
        {...others}
      />
    </div>
  );
};

const TableHeader: Component<
  ComponentProps<"thead"> & { sticky?: boolean | undefined }
> = (props) => {
  const [local, others] = splitProps(props, ["class", "sticky"]);
  return (
    <thead
      class={cn(
        local.sticky
          ? "sticky top-0 fancy-bg-background shadow-[inset_0_-1px_0_var(--color-border)] [&_tr]:border-none"
          : "[&_tr]:border-b",
        local.class,
      )}
      {...others}
    />
  );
};

const TableBody: Component<ComponentProps<"tbody">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <tbody class={cn("[&_tr:last-child]:border-0", local.class)} {...others} />
  );
};

const TableFooter: Component<ComponentProps<"tfoot">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <tfoot
      class={cn("bg-primary font-medium text-primary-foreground", local.class)}
      {...others}
    />
  );
};

const TableRow: Component<ComponentProps<"tr">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <tr
      class={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        local.class,
      )}
      {...others}
    />
  );
};

const TableHead: Component<ComponentProps<"th">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <th
      class={cn(
        "h-10 px-2 text-left align-middle font-medium text-muted-foreground has-[[role=checkbox]]:pr-0",
        local.class,
      )}
      {...others}
    />
  );
};

const TableCell: Component<ComponentProps<"td">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <td
      class={cn("p-2 align-middle has-[[role=checkbox]]:pr-0", local.class)}
      {...others}
    />
  );
};

const TableCaption: Component<ComponentProps<"caption">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <caption
      class={cn("mt-4 text-sm text-muted-foreground", local.class)}
      {...others}
    />
  );
};

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
