import { Key } from "@solid-primitives/keyed";
import { createElementSize } from "@solid-primitives/resize-observer";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import useFlexRadio, { type DisplayMarkerState } from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";
import { usePreferences } from "~/context/preferences";

const COLORS = {
  royal_blue: "rgb(64, 156, 255)",
  medium_purple: "rgb(175, 82, 222)",
  orange: "rgb(255, 165, 0)",
  lime_green: "rgb(76, 217, 100)",
  gray: "rgb(128, 128, 128)",
  red: "rgb(255, 59, 48)",
  yellow: "rgb(255, 204, 0)",
  dark_orange: "rgb(255, 149, 0)",
};

function DisplayMarker(props: {
  marker: DisplayMarkerState;
  freqToAnchorX: (freq: number) => number;
}) {
  const [textRef, setTextRef] = createSignal<HTMLElement>();
  const [hidden, setHidden] = createSignal(false);
  const textSize = createElementSize(textRef);

  createEffect(() => {
    const el = textRef();
    setHidden(textSize.width && el.scrollWidth > el.clientWidth);
  });

  const getMarkerOffset = (marker: DisplayMarkerState) =>
    props.freqToAnchorX(marker.startFrequencyMHz ?? marker.stopFrequencyMHz);

  const getMarkerWidth = (marker: DisplayMarkerState) =>
    Math.max(
      1,
      props.freqToAnchorX(marker.stopFrequencyMHz) - getMarkerOffset(marker),
    );

  return (
    <div
      class="absolute h-full top-0 left-0 translate-x-(--marker-offset) w-(--marker-width) bg-linear-to-b from-(--marker-color) to-transparent flex justify-center items-center overflow-hidden"
      style={{
        "--marker-offset": `${getMarkerOffset(props.marker)}px`,
        "--marker-width": `${getMarkerWidth(props.marker)}px`,
        "--marker-color": `oklch(from ${COLORS[props.marker.colorName]} l c h / ${props.marker.opacity ?? 100}%)`,
      }}
      ref={setTextRef}
    >
      <span
        classList={{
          invisible: hidden(),
        }}
      >
        {props.marker.label}
      </span>
    </div>
  );
}

function InnerDisplayMarkers() {
  const { state } = useFlexRadio();
  const { freqToAnchorX } = usePanafall();

  const markers = createMemo(() =>
    Object.values(
      state.status.displayMarker[`IARU${state.status.radio.iaruRegion}`] ?? [],
    ),
  );

  return (
    <div class="absolute inset-x-0 top-0 h-4 text-foreground/75 text-[0.5em]  text-shadow-background text-shadow-xs ">
      <div class="absolute inset-0 translate-x-(--drag-offset)">
        <Key each={markers()} by="id">
          {(marker) => (
            <DisplayMarker marker={marker()} freqToAnchorX={freqToAnchorX} />
          )}
        </Key>
      </div>
    </div>
  );
}

export function DisplayMarkers() {
  const { state } = useFlexRadio();
  const { preferences } = usePreferences();
  return (
    <Show
      when={
        state.status.featureLicense.features.PANADAPTER_VISUALS?.enabled &&
        preferences.showDisplayMarkers
      }
    >
      <InnerDisplayMarkers />
    </Show>
  );
}
