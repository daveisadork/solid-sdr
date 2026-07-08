import { createElementSize } from "@solid-primitives/resize-observer";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  mergeProps,
} from "solid-js";
import { cn } from "~/lib/utils";

export type LinearScaleProps = {
  min: number;
  max: number;
  invert?: boolean;
  tickSpacing?: number;
  format?: (value: number) => string;
  hideMin?: boolean;
  hideMax?: boolean;
  class?: string;
  tickClass?: string;
  labelClass?: string;
  renderTick?: (value: number) => JSX.Element;
  onTicksChange?: (ticks: LinearScaleTick[]) => void;
};

export type LinearScaleTick = {
  value: number;
  label: JSX.Element;
  position: number;
  isEdge: "min" | "max" | null;
};

const DEFAULT_TICK_COUNT = 5;
const DEFAULT_TICK_SPACING = 56;
const EPSILON = 1e-6;

const scalingSteps = [1, 2, 5, 10, 20, 25, 30, 50, 60, 100];

function defaultFormatter(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return value.toPrecision(3).replace(/\.0+$/, "");
  }
  return Math.abs(value - Math.round(value)) < EPSILON
    ? String(Math.round(value))
    : value.toFixed(2).replace(/\.?0+$/, "");
}

export function LinearScale(props: LinearScaleProps) {
  const merged = mergeProps(
    {
      format: defaultFormatter,
      tickSpacing: DEFAULT_TICK_SPACING,
    },
    props,
  );
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const size = createElementSize(container);

  const targetTickCount = createMemo(() => {
    const dimension = size.height;
    const spacing = merged.tickSpacing ?? DEFAULT_TICK_SPACING;
    if (!dimension || !Number.isFinite(dimension) || dimension <= 0) {
      return DEFAULT_TICK_COUNT;
    }
    const desired = Math.max(3, Math.round(dimension / Math.max(spacing, 1)));
    return Number.isFinite(desired) ? desired : DEFAULT_TICK_COUNT;
  });

  const allTicks = createMemo<LinearScaleTick[]>(() => {
    const min = Math.floor(merged.min);
    const max = Math.ceil(merged.max);
    const range = merged.max - merged.min;
    const render = merged.renderTick || merged.format;

    return Array.from({ length: max - min + 1 }, (_, i) => {
      const value = min + i;
      return {
        value,
        label: render(value),
        position: (merged.max - value) / range,
        isEdge: min === value ? "min" : max === value ? "max" : null,
      };
    });
  });

  const ticks = createMemo<LinearScaleTick[]>(() => {
    const target = targetTickCount();
    const ticks = allTicks().filter(
      (tick) =>
        (!merged.hideMin || tick.isEdge !== "min") &&
        (!merged.hideMax || tick.isEdge !== "max"),
    );
    for (const step of scalingSteps) {
      const filtered = ticks.filter((tick) => tick.value % step === 0);
      if (filtered.length <= target) {
        return filtered;
      }
    }
    const modulo = Math.round(ticks.length / target);
    return ticks.filter((tick) => tick.value % modulo === 0);
  });

  createEffect(() => {
    const next = ticks();
    merged.onTicksChange?.(next);
  });

  return (
    <div
      ref={setContainer}
      class={cn(
        "relative size-full flex select-none font-mono text-xs text-primary/80 flex-col",
        merged.class,
      )}
    >
      <For each={ticks()}>
        {(tick) => (
          <div
            class={cn(
              "absolute inset-x-0 top-(--tick-position)",
              merged.tickClass,
            )}
            style={{ "--tick-position": `${tick.position * 100}%` }}
          >
            <div class="relative h-0">
              <div
                class={cn(
                  "absolute right-0 top-0 whitespace-nowrap text-xs font-medium text-primary scale-label-shadow -translate-y-1/2",
                  merged.labelClass,
                )}
              >
                {tick.label}
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
