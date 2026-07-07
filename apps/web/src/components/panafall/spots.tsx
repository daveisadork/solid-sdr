import { Key } from "@solid-primitives/keyed";
import { createElementSize } from "@solid-primitives/resize-observer";
import { throttle } from "@solid-primitives/scheduled";
import { cva } from "class-variance-authority";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
  untrack,
} from "solid-js";
import useFlexRadio, {
  type PanadapterState,
  type SpotState,
} from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";
import { usePreferences } from "~/context/preferences";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";

const FONT_SIZES = [
  "text-xs",
  "text-sm",
  "text-md",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-6xl",
  "text-7xl",
  "text-8xl",
  "text-9xl",
];

const GAP_PX = 4;

interface SpotLayout {
  type: "spot";
  spot: SpotState;
  key: string;
  x: number;
  level: number;
  priority: number;
}

interface ClusterLayout {
  type: "cluster";
  spots: SpotState[];
  key: string;
  x: number;
  level: number;
  priority: number;
}

type LayoutItem = SpotLayout | ClusterLayout;

const spotVariants = cva(
  [
    "px-1",
    "border",
    "rounded-sm",
    "text-(--resolved-color)",
    "border-(--resolved-color)",
    "bg-(--resolved-background-color)/80",
    "cursor-pointer",
    "pointer-events-auto",
    "shadow-sm",
    "font-mono",
    "shadow-black",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",
        layout:
          "absolute bottom-0 left-(--spot-x-offset) -translate-x-1/2 -translate-y-(--spot-lane)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Spot(props: {
  spot: SpotState;
  layout?: SpotLayout;
  pan?: PanadapterState;
  ref?: JSX.IntrinsicAttributes["ref"];
}) {
  const { radio } = useFlexRadio();
  return (
    <Show when={props.spot}>
      <Tooltip gutter={0}>
        <TooltipTrigger
          ref={props.ref}
          class={spotVariants({ variant: props.layout ? "layout" : "default" })}
          style={{
            "--spot-color": props.spot?.color,
            "--spot-background-color": props.spot?.backgroundColor,
            "--resolved-color":
              "var(--spot-override-color, var(--spot-color, var(--foreground)))",
            "--resolved-background-color":
              "var(--spots-override-bg-color, var(--spot-background-color, var(--background)))",
            "--spot-x-offset": props.layout ? `${props.layout.x}px` : undefined,
            "--spot-lane": props.layout
              ? `calc(var(--spot-spacing) + ${props.layout.level} * calc(100% + var(--spot-spacing)))`
              : undefined,
          }}
          onClick={() => {
            if (!props.spot || !props.pan) return;
            radio()?.spot(props.spot.id)?.trigger(props.pan.streamId);
          }}
        >
          {props.spot.callsign}
        </TooltipTrigger>
        <TooltipContent class="overflow-visible font-mono">
          <TooltipArrow />
          <Show when={props.spot.timestampSec}>
            {(ts) => <div>{new Date(ts() * 1000).toLocaleString()}</div>}
          </Show>
          <div>{props.spot.comment}</div>
        </TooltipContent>
      </Tooltip>
    </Show>
  );
}

function SpotCluster(props: { layout: ClusterLayout; pan: PanadapterState }) {
  return (
    <Show when={props.layout.spots?.length}>
      <Popover>
        <PopoverTrigger
          class={spotVariants({ variant: "layout" })}
          style={{
            "--resolved-color":
              "var(--spot-override-color, var(--spot-color, var(--foreground)))",
            "--resolved-background-color":
              "var(--spots-override-bg-color, var(--spot-background-color, var(--background)))",
            "--spot-x-offset": `${props.layout.x}px`,
            "--spot-lane": `calc(var(--spot-spacing) + ${props.layout.level} * calc(100% + var(--spot-spacing)))`,
          }}
        >
          +{props.layout.spots.length}
        </PopoverTrigger>
        <PopoverContent class="flex flex-wrap gap-2 font-mono overflow-visible">
          <PopoverArrow />
          <button
            type="button"
            /* this is here to steal focus so the child tooltips don't open by default */
            class="absolute size-0"
          />
          <Key each={props.layout.spots} by="callsign">
            {(spot) => <Spot spot={spot()} pan={props.pan} />}
          </Key>
        </PopoverContent>
      </Popover>
    </Show>
  );
}

export function Spots(props: { pan: PanadapterState }) {
  const { spots, radio } = useFlexRadio();
  const { freqToX } = usePanafall();
  const { preferences } = usePreferences();

  const [zeroLenRef, setZeroLenRef] = createSignal<HTMLElement>();
  const [oneLenRef, setOneLenRef] = createSignal<HTMLElement>();
  const emptySize = createElementSize(zeroLenRef);
  const singleSize = createElementSize(oneLenRef);
  const [layout, setLayout] = createSignal<LayoutItem[]>([]);

  const estimateWidthFunc = createMemo(() => {
    const charW = singleSize.width - emptySize.width;
    const padding = emptySize.width;

    return (text: string) => text.length * charW + padding;
  });

  // Persists across layout recomputations — used to keep callsigns at their
  // previous level when possible so the display doesn't shuffle every FT8 cycle.
  let prevLevels = new Map<string, number>();

  const calculateLayout = async () => {
    const maxLevels = preferences.spots.levels;
    const { bandwidthMHz, centerFrequencyMHz } = props.pan;
    const estimateWidth = estimateWidthFunc();
    const halfBandwidth = bandwidthMHz / 2;
    const minFreq = centerFrequencyMHz - halfBandwidth;
    const maxFreq = centerFrequencyMHz + halfBandwidth;

    // Sort by priority ascending (lower number = higher priority gets placed
    // first), then by frequency as tiebreaker for stable left-to-right order.
    const sorted = untrack(() =>
      spots
        .values()
        .filter((spot) => spot.rxFreqMHz > minFreq && spot.rxFreqMHz < maxFreq)
        .toArray()
        .toSorted(
          (a, b) => a.priority - b.priority || a.rxFreqMHz - b.rxFreqMHz,
        ),
    );

    // Per-level occupied ranges tracking index into result array
    const occupied: { left: number; right: number; idx: number }[][] =
      Array.from({ length: maxLevels }, () => []);
    const result: LayoutItem[] = [];
    const nextLevels = new Map<string, number>();

    for (const spot of sorted) {
      const x = freqToX(spot.rxFreqMHz);
      const hw = estimateWidth(spot.callsign) / 2 + GAP_PX;
      const left = x - hw;
      const right = x + hw;

      // Prefer the level this callsign occupied last time for visual stability
      const prev = prevLevels.get(spot.callsign);
      let placedLevel = -1;
      if (prev !== undefined && prev < maxLevels) {
        if (!occupied[prev].some((r) => left < r.right && right > r.left)) {
          placedLevel = prev;
        }
      }

      // Fall back to first available level
      if (placedLevel < 0) {
        for (let lvl = 0; lvl < maxLevels; lvl++) {
          if (!occupied[lvl].some((r) => left < r.right && right > r.left)) {
            placedLevel = lvl;
            break;
          }
        }
      }

      if (placedLevel >= 0) {
        const idx = result.length;
        result.push({
          type: "spot",
          spot,
          key: spot.callsign,
          x,
          level: placedLevel,
          priority: spot.priority,
        });
        occupied[placedLevel].push({ left, right, idx });
        nextLevels.set(spot.callsign, placedLevel);
      } else {
        // All levels full — merge into nearby cluster at top level.
        // Cluster bounds are NOT expanded so they stay local — spots further
        // away will form their own clusters instead of snowballing into one.
        const topLevel = maxLevels - 1;
        const overlap = occupied[topLevel].find(
          (r) => left < r.right && right > r.left,
        );

        if (overlap) {
          const existing = result[overlap.idx];
          if (existing.type === "cluster") {
            existing.spots.push(spot);
            if (spot.priority < existing.priority) {
              existing.priority = spot.priority;
            }
          } else {
            result[overlap.idx] = {
              type: "cluster",
              spots: [existing.spot, spot],
              key:
                spot.priority < existing.priority
                  ? spot.callsign
                  : existing.key,
              x: existing.x,
              level: topLevel,
              priority: Math.min(existing.priority, spot.priority),
            };
          }
        } else {
          const idx = result.length;
          result.push({
            type: "spot",
            key: spot.callsign,
            spot,
            x,
            level: topLevel,
            priority: spot.priority,
          });
          occupied[topLevel].push({ left, right, idx });
          nextLevels.set(spot.callsign, topLevel);
        }
      }
    }

    prevLevels = nextLevels;
    setLayout(result);
  };

  createEffect(calculateLayout);
  const throttledCalculateLayout = throttle(calculateLayout, 250);

  createEffect(() => {
    const sub = radio()?.on("change", (change) => {
      if (change.entity === "spot") {
        throttledCalculateLayout();
      }
    });
    onCleanup(() => sub?.unsubscribe());
  });

  return (
    <div
      class="absolute font-mono inset-0 -translate-y-(--spots-position) z-20 pointer-events-none"
      classList={{
        "bottom-4": preferences.enableTransparencyEffects,
        [FONT_SIZES[preferences.spots.fontSize]]: true,
      }}
      style={{
        "--spots-position": `${preferences.spots.position}%`,
        "--spot-spacing": `${preferences.spots.verticalSpacing}%`,
        "--spot-override-color": preferences.spots.overrideColor,
        "--spot-override-bg-color": preferences.spots.overrideBackgroundColor,
      }}
    >
      <Key each={layout().filter((l) => l.type === "spot")} by="key">
        {(item) => <Spot spot={item().spot} layout={item()} pan={props.pan} />}
      </Key>
      <For each={layout()?.filter((l) => l.type === "cluster")}>
        {(cluster) => <SpotCluster layout={cluster} pan={props.pan} />}
      </For>
      <div class="size-0 overflow-hidden">
        <Spot
          ref={setZeroLenRef}
          spot={{
            id: "",
            callsign: "",
            rxFreqMHz: 0,
            mode: "",
            txFreqMHz: 0,
            priority: 1,
            triggerAction: "none",
          }}
        />
        <Spot
          ref={setOneLenRef}
          spot={{
            id: "",
            callsign: "Q",
            rxFreqMHz: 0,
            mode: "",
            txFreqMHz: 0,
            priority: 1,
            triggerAction: "none",
          }}
        />
      </div>
    </div>
  );
}
