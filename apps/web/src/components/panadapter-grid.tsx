import { For, createEffect } from "solid-js";
import { cn } from "~/lib/utils";
import type { LinearScaleTick } from "./linear-scale";
import type { FrequencyGridTick } from "./scale";

type PanadapterGridProps = {
  horizontalTicks: LinearScaleTick[];
  verticalTicks: FrequencyGridTick[];
  class?: string;
};

export function PanadapterGrid(props: PanadapterGridProps) {
  createEffect(() => console.log(props.horizontalTicks));

  return (
    <div
      class={cn(
        "pointer-events-none absolute inset-0 overflow-visible mask-radial-at-bottom mask-radial-from-white/50 mask-radial-to-transparent mask-radial-to-90%",
        props.class,
      )}
    >
      <For each={props.horizontalTicks}>
        {(tick) => (
          <div
            class="absolute left-0 right-0 h-px top-[var(--tick-position)] bg-foreground"
            style={{
              "--tick-position": `${tick.position * 100}%`,
            }}
          />
        )}
      </For>
      <div class="size-full translate-x-[var(--drag-offset)]">
        <For each={props.verticalTicks}>
          {(tick) => (
            <div
              class="absolute top-0 bottom-0 left-[var(--tick-offset)] w-px bg-foreground"
              style={{
                "--tick-offset": `${tick.offset}px`,
              }}
            />
          )}
        </For>
      </div>
    </div>
  );
}
