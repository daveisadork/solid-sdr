import { For, Show, createEffect, createMemo } from "solid-js";
import { cn } from "~/lib/utils";
import type { LinearScaleTick } from "./linear-scale";
import type { FrequencyGridTick } from "./scale";

type PanadapterGridProps = {
  horizontalTicks: LinearScaleTick[];
  verticalTicks: FrequencyGridTick[];
  class?: string;
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function PanadapterGrid(props: PanadapterGridProps) {
  createEffect(() => {
    console.log(props.horizontalTicks);
  });
  return (
    <div
      class={cn(
        // "pointer-events-none absolute inset-0 overflow-visible -z-50 bg-radial-[ellipse_at_bottom] from-[#02517e] via-[#0a3d58] via-30% to-[ #012435] to-85%",
        // "pointer-events-none absolute inset-0 overflow-visible -z-50 bg-radial-[ellipse_at_bottom] from-sky-700 to-sky-700/10",
        "pointer-events-none absolute inset-0 overflow-visible -z-50",
        props.class,
      )}
      style={{
        "background-image": `radial-gradient(ellipse at bottom, #02517e, #0a3d58 31.7%, #012435 87.3%)`,
      }}
    >
      <div class="absolute inset-0 mask-radial-at-bottom mask-radial-from-white mask-radial-to-transparent">
        <For each={props.horizontalTicks}>
          {(tick) => (
            <div
              class="absolute left-0 right-0 h-px top-[var(--tick-position)] bg-foreground/50"
              style={{
                "--tick-position": `${tick.position * 100}%`,
              }}
            />
          )}
        </For>
        <div class="absolute inset-0 translate-x-[var(--drag-offset)]">
          <For each={props.verticalTicks}>
            {(tick) => (
              <div
                class="absolute top-0 bottom-0 left-[var(--tick-offset)] w-px bg-foreground/50"
                style={{
                  "--tick-offset": `${tick.offset}px`,
                  // "background-size":
                  //   "var(--panadapter-available-width) var(--panadapter-available-height)",
                  // "background-attachment": "fixed",
                }}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
