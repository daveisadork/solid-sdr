import {
  createMemo,
  JSX,
  For,
  Show,
  mergeProps,
  createSignal,
  createEffect,
} from "solid-js";
import { createElementSize } from "@solid-primitives/resize-observer";
import { cn } from "~/lib/utils";

type Orientation = "vertical" | "horizontal";

export type LinearScaleProps = {
  min: number;
  max: number;
  orientation?: Orientation;
  invert?: boolean;
  ticks?: number[];
  tickStep?: number;
  targetTicks?: number;
  tickSpacing?: number;
  format?: (value: number) => string;
  tickLength?: number | string;
  showTicks?: boolean;
  showMin?: boolean;
  showMax?: boolean;
  class?: string;
  tickClass?: string;
  labelClass?: string;
  lineClass?: string;
  renderTick?: (value: number) => JSX.Element;
  onTicksChange?: (ticks: LinearScaleTick[]) => void;
};

export type LinearScaleTick = {
  value: number;
  label: string | JSX.Element;
  position: number;
  isEdge: "min" | "max" | null;
};

const DEFAULT_TICK_COUNT = 5;
const DEFAULT_TICK_SPACING = 56;
const EPSILON = 1e-6;

function niceTickStep(min: number, max: number, count: number) {
  const span = max - min;
  if (!isFinite(span) || span === 0 || !isFinite(count) || count <= 0) {
    return 0;
  }
  const step0 = Math.abs(span) / count;
  let step = Math.pow(10, Math.floor(Math.log10(step0)));
  const error = step0 / step;
  if (error >= 10) {
    step *= 10;
  } else if (error >= 5) {
    step *= 5;
  } else if (error >= 2) {
    step *= 2;
  }
  return step;
}

function approximateEqual(a: number, b: number, tolerance = EPSILON) {
  return Math.abs(a - b) <= tolerance;
}

function defaultFormatter(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return value.toPrecision(3).replace(/\.0+$/, "");
  }
  return Math.abs(value - Math.round(value)) < EPSILON
    ? String(Math.round(value))
    : value.toFixed(2).replace(/\.?0+$/, "");
}

function resolveLength(length?: number | string) {
  if (length == null) return undefined;
  return typeof length === "number" ? `${length}px` : length;
}

export function LinearScale(props: LinearScaleProps) {
  const merged = mergeProps(
    {
      orientation: "vertical" as Orientation,
      invert: false,
      format: defaultFormatter,
      tickSpacing: DEFAULT_TICK_SPACING,
      showTicks: true,
      showMin: true,
      showMax: true,
    },
    props,
  );

  const [container, setContainer] = createSignal<HTMLDivElement>();
  const size = createElementSize(container);

  const targetTickCount = createMemo(() => {
    const explicit = merged.targetTicks;
    if (explicit && explicit > 0 && Number.isFinite(explicit)) {
      return explicit;
    }
    const dimension =
      merged.orientation === "vertical" ? size.height : size.width;
    const spacing = merged.tickSpacing ?? DEFAULT_TICK_SPACING;
    if (!dimension || !Number.isFinite(dimension) || dimension <= 0) {
      return DEFAULT_TICK_COUNT;
    }
    const desired = Math.max(3, Math.round(dimension / Math.max(spacing, 1)));
    return Number.isFinite(desired) ? desired : DEFAULT_TICK_COUNT;
  });

  const ticks = createMemo<LinearScaleTick[]>(() => {
    const { min, max } = merged;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    const target = targetTickCount();
    if (approximateEqual(min, max)) {
      return [
        {
          value: min,
          label: merged.renderTick
            ? merged.renderTick(min)
            : merged.format(min),
          position: 0.5,
          isEdge: "max",
        },
      ];
    }
    const span = max - min;
    const sourceTicks =
      merged.ticks && merged.ticks.length
        ? merged.ticks.slice().sort((a, b) => a - b)
        : undefined;

    let step = merged.tickStep;
    if (!step && !sourceTicks) {
      step = niceTickStep(min, max, target ?? DEFAULT_TICK_COUNT);
    }

    const values: number[] = [];
    if (sourceTicks) {
      sourceTicks.forEach((value) => {
        if (value < min - EPSILON || value > max + EPSILON) return;
        values.push(value);
      });
    } else if (step) {
      const safeStep = Math.abs(step);
      const start = Math.ceil(min / safeStep) * safeStep;
      const limit = max + safeStep / 2;
      for (let value = start; value <= limit; value += safeStep) {
        if (value < min - EPSILON) continue;
        values.push(Number(value.toPrecision(12)));
      }
    }

    if (!values.length) {
      values.push(min, max);
    }

    const includesMin = values.some((value) => approximateEqual(value, min));
    const includesMax = values.some((value) => approximateEqual(value, max));
    if (!includesMin) values.push(min);
    if (!includesMax) values.push(max);

    values.sort((a, b) => a - b);

    const unique: number[] = [];
    for (const value of values) {
      if (
        !unique.length ||
        !approximateEqual(
          value,
          unique[unique.length - 1],
          Math.max(span * 1e-6, EPSILON),
        )
      ) {
        unique.push(value);
      }
    }

    const datums = unique.map((value) => {
      const ratio = span === 0 ? 0.5 : (value - min) / span;
      const position =
        merged.orientation === "vertical"
          ? merged.invert
            ? ratio
            : 1 - ratio
          : merged.invert
            ? 1 - ratio
            : ratio;
      const isEdge = approximateEqual(value, min)
        ? ("min" as const)
        : approximateEqual(value, max)
          ? ("max" as const)
          : null;
      const label = merged.renderTick
        ? merged.renderTick(value)
        : merged.format(value);

      return {
        value,
        label,
        position: Math.min(Math.max(position, 0), 1),
        isEdge,
      };
    });

    let filtered = datums;
    if (!merged.showMin) {
      filtered = filtered.filter((tick) => tick.isEdge !== "min");
    }
    if (!merged.showMax) {
      filtered = filtered.filter((tick) => tick.isEdge !== "max");
    }

    return filtered.length ? filtered : datums;
  });

  createEffect(() => {
    const next = ticks();
    merged.onTicksChange?.(next);
  });

  return (
    <div
      ref={setContainer}
      class={cn(
        "relative flex select-none font-mono text-xs text-primary/80",
        merged.orientation === "vertical"
          ? "h-full w-full flex-col"
          : "h-full w-full",
        merged.class,
      )}
    >
      {merged.orientation === "vertical" ? (
        <div class="relative h-full w-full">
          <For each={ticks()}>
            {(tick) => {
              const translateY =
                tick.isEdge === "max"
                  ? "0%"
                  : tick.isEdge === "min"
                    ? "-100%"
                    : "-50%";
              const length = resolveLength(merged.tickLength) ?? "100%";
              const showTickLine = !!merged.showTicks;
              return (
                <div
                  class={cn("absolute left-0 right-0", merged.tickClass)}
                  style={{ top: `${tick.position * 100}%` }}
                >
                  <div class="relative h-0">
                    <Show when={showTickLine}>
                      <div
                        class={cn(
                          "block h-px rounded-full bg-primary/25",
                          merged.lineClass,
                          tick.isEdge ? "bg-primary/35" : "",
                        )}
                        style={{
                          width: length,
                          transform: "translateY(-0.5px)",
                        }}
                      />
                    </Show>
                    <div
                      class={cn(
                        "absolute right-0 top-0 whitespace-nowrap text-xs font-medium text-primary scale-label-shadow",
                        merged.labelClass,
                      )}
                      style={{ transform: `translateY(${translateY})` }}
                    >
                      {tick.label}
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      ) : (
        <div class="relative h-full w-full">
          <For each={ticks()}>
            {(tick) => {
              const translateX =
                tick.isEdge === "max"
                  ? "-100%"
                  : tick.isEdge === "min"
                    ? "0%"
                    : "-50%";
              const length = resolveLength(merged.tickLength) ?? "100%";
              const showTickLine = !!merged.showTicks;
              return (
                <div
                  class={cn("absolute top-0 bottom-0", merged.tickClass)}
                  style={{ left: `${tick.position * 100}%` }}
                >
                  <div class="relative w-0">
                    <Show when={showTickLine}>
                      <div
                        class={cn(
                          "block w-px rounded-full bg-primary/25",
                          merged.lineClass,
                          tick.isEdge ? "bg-primary/35" : "",
                        )}
                        style={{
                          height: length,
                          transform: "translateX(-0.5px)",
                        }}
                      />
                    </Show>
                    <div
                      class={cn(
                        "absolute left-0 top-0 whitespace-nowrap text-xs font-medium text-primary scale-label-shadow",
                        merged.labelClass,
                      )}
                      style={{ transform: `translateX(${translateX})` }}
                    >
                      {tick.label}
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      )}
    </div>
  );
}
