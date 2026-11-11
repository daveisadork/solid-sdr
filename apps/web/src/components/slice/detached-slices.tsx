import { createMemo, For, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import useFlexRadio, {
  type PanadapterState,
  type SliceState,
} from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";
import MaterialSymbolsChevronLeft from "~icons/material-symbols/chevron-left";
import MaterialSymbolsChevronRight from "~icons/material-symbols/chevron-right";

export function DetachedSlice(props: {
  slice: SliceState;
  pan: PanadapterState;
  side: "left" | "right";
}) {
  const { radio } = useFlexRadio();
  const { panadapterController } = usePanafall();
  const sliceController = createMemo(() => radio()?.slice(props.slice.id));

  return (
    <Button
      variant="outline"
      class="flex p-2 font-extrabold font-mono items-center z-(--z-cell-overlays) pointer-events-auto text-shadow-md text-shadow-background gap-1 [&_svg]:size-8 hover:bg-muted border-none opacity-50"
      classList={{
        "flex-row-reverse": props.side === "right",
      }}
      onClick={() => {
        panadapterController()?.setCenterFrequency(props.slice.frequencyMHz);
        sliceController()?.setActive(true);
      }}
    >
      <div class="flex w-3.5 max-w-3.5 justify-center">
        <Show
          when={props.side === "left"}
          fallback={<MaterialSymbolsChevronRight />}
        >
          <MaterialSymbolsChevronLeft />
        </Show>
      </div>
      <div class="flex flex-col items-center gap-0">
        <div class="flex items-center">
          <span class="text-xl leading-tight">{props.slice.indexLetter}</span>
          <Show when={props.slice.isTransmitEnabled}>
            <span class="text-xs leading-tight">TX</span>
          </Show>
        </div>
        <span class="text-[0.5rem] italic font-normal leading-tight">
          {props.slice.frequencyMHz}
        </span>
      </div>
    </Button>
  );
}

export function DetachedSlices(props: {
  pan: PanadapterState;
  slices: SliceState[];
}) {
  const { sliceDetachedSide } = usePanafall();
  return (
    <div class="flex absolute inset-0 pt-detached-clearance px-2 pointer-events-none">
      <div class="flex flex-col gap-1">
        <For
          each={props.slices.filter(
            (slice) => sliceDetachedSide(slice) === "left",
          )}
        >
          {(slice) => (
            <DetachedSlice slice={slice} pan={props.pan} side="left" />
          )}
        </For>
      </div>
      <div class="grow" />
      <div class="flex flex-col gap-1">
        <For
          each={props.slices.filter(
            (slice) => sliceDetachedSide(slice) === "right",
          )}
        >
          {(slice) => (
            <DetachedSlice slice={slice} pan={props.pan} side="right" />
          )}
        </For>
      </div>
    </div>
  );
}
