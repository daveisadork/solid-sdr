import type { PolymorphicProps } from "@kobalte/core";
import { createSignal, splitProps, type ValidComponent } from "solid-js";
import { Button, type ButtonProps } from "./button";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

type ConfirmButtonProps<T extends ValidComponent = "button"> =
  ButtonProps<T> & {
    message?: string | undefined;
    onConfirm?: () => void;
  };

const ConfirmButton = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, ConfirmButtonProps<T>>,
) => {
  const [local, others] = splitProps(props as ConfirmButtonProps, [
    "message",
    "onConfirm",
  ]);
  const [open, setOpen] = createSignal(false);
  return (
    <Popover open={open()} onOpenChange={setOpen}>
      <PopoverTrigger as={Button<T>} {...others} />
      <PopoverContent class="flex flex-col gap-4 overflow-visible">
        <PopoverArrow />
        <div>{local.message ?? "Are you sure?"}</div>
        <div class="flex gap-4 justify-between items-center">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              local.onConfirm?.();
              setOpen(false);
            }}
          >
            Ok
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export type { ConfirmButtonProps };
export { ConfirmButton };
