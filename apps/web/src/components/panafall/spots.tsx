import { For, Show } from "solid-js";
import useFlexRadio, {
  SpotState,
  type PanadapterState,
} from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";
import { usePreferences } from "~/context/preferences";
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

export function Spots(props: { pan: PanadapterState }) {
  const { state, radio } = useFlexRadio();
  const { freqToX, spotIds } = usePanafall();
  const { preferences } = usePreferences();

  const color = (spot: SpotState) =>
    [preferences.spots.overrideColor, spot.color, "var(--foreground)"].find(
      Boolean,
    );

  const bgColor = (spot: SpotState) =>
    [
      preferences.spots.overrideBackgroundColor,
      spot.backgroundColor,
      "var(--background)",
    ].find(Boolean);

  return (
    <div
      class="absolute font-mono inset-1 translate-x-(--drag-offset) -translate-y-(--spots-position) z-20 pointer-events-none"
      classList={{
        "bottom-4": preferences.enableTransparencyEffects,
        [FONT_SIZES[preferences.spots.fontSize]]: true,
      }}
      style={{
        "--spots-position": `${preferences.spots.position}%`,
        "--spot-spacing": `${preferences.spots.verticalSpacing}%`,
        "--spot-levels": preferences.spots.levels,
      }}
    >
      <For each={spotIds()}>
        {(spotId, index) => (
          <Show when={state.status.spot[spotId]}>
            {(getSpot) => {
              const spot = getSpot();
              return (
                <Tooltip gutter={0}>
                  <TooltipTrigger
                    class="absolute px-1 bottom-0 left-(--spot-x-offset) -translate-x-1/2 -translate-y-(--spot-lane) border rounded-sm text-(--spot-color) border-(--spot-color) bg-(--spot-background-color)/80 z-(--spot-z-index) cursor-pointer pointer-events-auto shadow-sm shadow-black"
                    style={{
                      "--spot-z-index": -spot.priority,
                      "--spot-x-offset": `${freqToX(spot.rxFreqMHz)}px`,
                      "--spot-color": color(spot),
                      "--spot-background-color": bgColor(spot),
                      "--spot-index": index(),
                      "--spot-lane": `calc(var(--spot-spacing) + mod(var(--spot-index), var(--spot-levels)) * calc(100% + var(--spot-spacing)))`,
                    }}
                    onClick={() => {
                      radio()?.spot(spotId)?.trigger(props.pan.streamId);
                    }}
                  >
                    {spot.callsign}
                  </TooltipTrigger>
                  <TooltipContent class="overflow-visible">
                    <TooltipArrow />
                    <div>
                      {new Date(spot.timestampSec * 1000).toLocaleString()}
                    </div>
                    <div>{spot.comment}</div>
                  </TooltipContent>
                </Tooltip>
              );
            }}
          </Show>
        )}
      </For>
    </div>
  );
}
