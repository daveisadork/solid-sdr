import type { ParentProps } from "solid-js";
import { PopoverArrow, PopoverContent } from "~/components/ui/popover";

export function SlicePopoverContent(props: ParentProps) {
  return (
    <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
      <PopoverArrow />
      <div class="relative p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
        {props.children}
      </div>
    </PopoverContent>
  );
}
