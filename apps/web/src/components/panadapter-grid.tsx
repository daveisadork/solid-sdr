import { For, createMemo } from "solid-js";
import { cn } from "~/lib/utils";
import type { LinearScaleTick } from "./linear-scale";
import type { FrequencyGridTick } from "./scale";

type PanadapterGridProps = {
  horizontalTicks: LinearScaleTick[];
  verticalTicks: FrequencyGridTick[];
  viewportWidth?: number;
  class?: string;
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const GRID_REPEAT_RADIUS = 2; // renders [-radius, radius] copies

export function PanadapterGrid(props: PanadapterGridProps) {
  const horizontal = createMemo(() =>
    props.horizontalTicks.filter(
      (tick) =>
        Number.isFinite(tick.position) &&
        tick.position >= 0 &&
        tick.position <= 1,
    ),
  );
  const vertical = createMemo(() => {
    const width = props.viewportWidth ?? 0;
    const base = props.verticalTicks;
    if (!width || width <= 0) return base;
    const ticks: FrequencyGridTick[] = [];
    for (let i = -GRID_REPEAT_RADIUS; i <= GRID_REPEAT_RADIUS; i++) {
      const offset = i * width;
      for (const tick of base) {
        ticks.push({
          ...tick,
          offset: tick.offset + offset,
        });
      }
    }
    // Deduplicate overlapping lines (to avoid brighter vertical lines)
    const sorted = ticks
      .slice()
      .sort((a, b) => a.offset - b.offset)
      .filter((tick) => Number.isFinite(tick.offset));
    const deduped: FrequencyGridTick[] = [];
    for (const tick of sorted) {
      const last = deduped[deduped.length - 1];
      if (!last || Math.abs(tick.offset - last.offset) > 0.5) {
        deduped.push(tick);
      }
    }
    return deduped;
  });

  const extendedWidth = createMemo(() => {
    const width = props.viewportWidth ?? 0;
    if (!width || width <= 0) return undefined;
    return width * (GRID_REPEAT_RADIUS * 2 + 1);
  });

  const extendedLeft = createMemo(() => {
    const width = props.viewportWidth ?? 0;
    if (!width || width <= 0) return undefined;
    return -GRID_REPEAT_RADIUS * width;
  });

  return (
    <div
      class={cn(
        "pointer-events-none absolute inset-0 overflow-visible",
        props.class,
      )}
      style={{
        width: extendedWidth() ? `${extendedWidth()}px` : undefined,
        left: extendedLeft() ? `${extendedLeft()}px` : undefined,
      }}
    >
      <div class="absolute inset-0 bg-[radial-gradient(150%_120%_at_50%_45%,_rgba(30,64,175,0.35)_0%,_rgba(14,165,233,0.22)_32%,_rgba(8,47,73,0.12)_65%,_rgba(7,15,35,0)_100%)]" />
      <For each={horizontal()}>
        {(tick) => (
          <div
            class="absolute left-0 right-0"
            style={{
              top: `${clamp01(tick.position) * 100}%`,
              height: "1px",
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.3) 55%, rgba(255,255,255,0) 100%)",
            }}
          />
        )}
      </For>
      <For each={vertical()}>
        {(tick) => (
          <div
            class="absolute top-0 bottom-0"
            style={{
              left: `${tick.offset}px`,
              width: "1px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.3) 55%, rgba(255,255,255,0) 100%)",
            }}
          />
        )}
      </For>
    </div>
  );
}
