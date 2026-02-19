import { createStore } from "solid-js/store";
import useFlexRadio from "~/context/flexradio";
import {
  createElementSize,
  createWindowSize,
} from "@solid-primitives/resize-observer";
import {
  batch,
  createEffect,
  createSignal,
  For,
  Show,
  splitProps,
} from "solid-js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverArrow,
} from "~/components/ui/popover";

import type { Component, ComponentProps, JSX } from "solid-js";
import { createPointerListeners } from "@solid-primitives/pointer";
import { createElementBounds } from "@solid-primitives/bounds";
import BaselineChevronLeft from "~icons/ic/baseline-chevron-left";
import BaselineChevronRight from "~icons/ic/baseline-chevron-right";
import BaselineVolumeUp from "~icons/ic/baseline-volume-up";
import BaselineVolumeOff from "~icons/ic/baseline-volume-off";
import { Button } from "./ui/button";
import { Portal } from "solid-js/web";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "./ui/select";

import {
  Slider,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from "./ui/slider";

import { Trigger as SelectTrigger } from "@kobalte/core/select";
import { ToggleButton } from "@kobalte/core/toggle-button";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "./ui/segmented-control";
import { cn, degToRad, radToDeg } from "~/lib/utils";
import { FrequencyInput } from "./frequency-input";
import { SliderToggle } from "./ui/slider-toggle";
import { SimpleSwitch } from "./ui/simple-switch";
import { SimpleSlider } from "./ui/simple-slider";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldDescription,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
} from "./ui/number-field";
import { LevelMeter } from "./level-meter";

const filterMaxHz = 12_000;
const filterMinHz = -filterMaxHz;

export interface FilterPreset {
  name: string;
  lowCut: number;
  highCut: number;
}

export const filterPresets: Record<string, FilterPreset[]> = {
  AM: [
    { name: "5.6K", lowCut: -2800, highCut: 2800 },
    { name: "6.0K", lowCut: -3000, highCut: 3000 },
    { name: "8.0K", lowCut: -4000, highCut: 4000 },
    { name: "10K", lowCut: -5000, highCut: 5000 },
    { name: "12K", lowCut: -6000, highCut: 6000 },
    { name: "14K", lowCut: -7000, highCut: 7000 },
    { name: "16K", lowCut: -8000, highCut: 8000 },
    { name: "20K", lowCut: -10000, highCut: 10000 },
  ],
  USB: [
    { name: "1.8K", lowCut: 100, highCut: 1900 },
    { name: "2.1K", lowCut: 100, highCut: 2200 },
    { name: "2.4K", lowCut: 100, highCut: 2500 },
    { name: "2.7K", lowCut: 100, highCut: 2800 },
    { name: "2.9K", lowCut: 100, highCut: 3000 },
    { name: "3.3K", lowCut: 100, highCut: 3400 },
    { name: "4.0K", lowCut: 100, highCut: 4100 },
    { name: "6.0K", lowCut: 100, highCut: 6100 },
  ],
  LSB: [
    { name: "1.8K", lowCut: -1900, highCut: -100 },
    { name: "2.1K", lowCut: -2200, highCut: -100 },
    { name: "2.4K", lowCut: -2500, highCut: -100 },
    { name: "2.7K", lowCut: -2800, highCut: -100 },
    { name: "2.9K", lowCut: -3000, highCut: -100 },
    { name: "3.3K", lowCut: -3400, highCut: -100 },
    { name: "4.0K", lowCut: -4100, highCut: -100 },
    { name: "6.0K", lowCut: -6100, highCut: -100 },
  ],
  DIGU: [
    { name: "100", lowCut: -50, highCut: 50 },
    { name: "300", lowCut: -150, highCut: 150 },
    { name: "600", lowCut: -300, highCut: 300 },
    { name: "1.0K", lowCut: -500, highCut: 500 },
    { name: "1.5K", lowCut: -750, highCut: 750 },
    { name: "2.0K", lowCut: -1000, highCut: 1000 },
    { name: "3.0K", lowCut: -1500, highCut: 1500 },
    { name: "6.0K", lowCut: -3000, highCut: 3000 },
  ],
  DIGL: [
    { name: "100", lowCut: -50, highCut: 50 },
    { name: "300", lowCut: -150, highCut: 150 },
    { name: "600", lowCut: -300, highCut: 300 },
    { name: "1.0K", lowCut: -500, highCut: 500 },
    { name: "1.5K", lowCut: -750, highCut: 750 },
    { name: "2.0K", lowCut: -1000, highCut: 1000 },
    { name: "3.0K", lowCut: -1500, highCut: 1500 },
    { name: "6.0K", lowCut: -3000, highCut: 3000 },
  ],
  RTTY: [
    { name: "250", lowCut: -125, highCut: 125 },
    { name: "300", lowCut: -150, highCut: 150 },
    { name: "350", lowCut: -175, highCut: 175 },
    { name: "400", lowCut: -200, highCut: 200 },
    { name: "500", lowCut: -250, highCut: 250 },
    { name: "1.0K", lowCut: -500, highCut: 500 },
    { name: "1.5K", lowCut: -750, highCut: 750 },
    { name: "3.0K", lowCut: -1500, highCut: 1500 },
  ],
  CW: [
    { name: "50", lowCut: -25, highCut: 25 },
    { name: "100", lowCut: -50, highCut: 50 },
    { name: "250", lowCut: -125, highCut: 125 },
    { name: "400", lowCut: -200, highCut: 200 },
    { name: "500", lowCut: -250, highCut: 250 },
    { name: "800", lowCut: -400, highCut: 400 },
    { name: "1.0K", lowCut: -500, highCut: 500 },
    { name: "3.0K", lowCut: -1500, highCut: 1500 },
  ],
  DFM: [
    { name: "6.0K", lowCut: -3000, highCut: 3000 },
    { name: "8.0K", lowCut: -4000, highCut: 4000 },
    { name: "10K", lowCut: -5000, highCut: 5000 },
    { name: "12K", lowCut: -6000, highCut: 6000 },
    { name: "14K", lowCut: -7000, highCut: 7000 },
    { name: "16K", lowCut: -8000, highCut: 8000 },
    { name: "18K", lowCut: -9000, highCut: 9000 },
    { name: "20K", lowCut: -10000, highCut: 10000 },
  ],
};

export interface FilterConstraint {
  low: number;
  high: number;
}

const filterConstraints: Record<string, FilterConstraint> = {
  AM: { low: -10_000, high: 10_000 },
  USB: { low: 0, high: 10_000 },
  LSB: { low: -10_000, high: 0 },
  DIGU: { low: -3_000, high: 3_000 },
  DIGL: { low: -3_000, high: 3_000 },
  RTTY: { low: -1_500, high: 1_500 },
  CW: { low: -1_500, high: 1_500 },
  DFM: { low: -10_000, high: 10_000 },
};

const StatusToggle: Component<ComponentProps<"span"> & { active?: boolean }> = (
  props,
) => {
  const [local, others] = splitProps(props, ["class", "classList", "active"]);
  return (
    <span
      class={local.class}
      classList={{
        "text-blue-500": local.active,
        "text-neutral-500": !local.active,
        ...local.classList,
      }}
      {...others}
    />
  );
};

const Triangle: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class", "style"]);
  return (
    <div
      class={cn("h-1.5 aspect-[2]", local.class)}
      style={{
        "clip-path": "polygon(50% 100%,100% 0,0 0)",
        ...(local.style as JSX.CSSProperties),
      }}
      {...others}
    />
  );
};

export function DetachedSlice(props: { sliceIndex: string }) {
  const sliceIndex = () => props.sliceIndex;
  const { radio, state } = useFlexRadio();
  const slice = () => state.status.slice[props.sliceIndex];
  const pan = () => state.status.panadapter[slice()?.panadapterStreamId];

  return (
    <Button
      variant="ghost"
      size="sm"
      class="font-extrabold text-md font-mono z-10 pointer-events-auto text-shadow-md text-shadow-background"
      onClick={() => {
        radio()
          ?.panadapter(slice().panadapterStreamId)
          ?.setCenterFrequency(slice().frequencyMHz);
        radio()?.slice(sliceIndex())?.setActive(true);
      }}
    >
      <Show when={slice().frequencyMHz < pan().centerFrequencyMHz}>
        <BaselineChevronLeft />
      </Show>
      <span>{slice().indexLetter}</span>
      <Show when={slice().frequencyMHz > pan().centerFrequencyMHz}>
        <BaselineChevronRight />
      </Show>
    </Button>
  );
}

export function DetachedSlices(props: { streamId: string }) {
  const { state } = useFlexRadio();
  const pan = () => state.status.panadapter[props.streamId];

  return (
    <div class="flex absolute top-10 left-0 bottom-0 w-(--panafall-available-width) pr-10 pointer-events-none">
      <div class="flex flex-col">
        <For
          each={Object.keys(state.status.slice).filter((sliceIndex) => {
            const slice = state.status.slice[sliceIndex];
            return (
              slice.panadapterStreamId === props.streamId &&
              slice.isInUse &&
              slice.isDetached &&
              slice.frequencyMHz < pan().centerFrequencyMHz
            );
          })}
        >
          {(sliceIndex) => <DetachedSlice sliceIndex={sliceIndex} />}
        </For>
      </div>
      <div class="grow" />
      <div class="flex flex-col">
        <For
          each={Object.keys(state.status.slice).filter((sliceIndex) => {
            const slice = state.status.slice[sliceIndex];
            return (
              slice.panadapterStreamId === props.streamId &&
              slice.isInUse &&
              slice.isDetached &&
              slice.frequencyMHz > pan().centerFrequencyMHz
            );
          })}
        >
          {(sliceIndex) => <DetachedSlice sliceIndex={sliceIndex} />}
        </For>
      </div>
    </div>
  );
}

const SliceFilter = (props: { sliceIndex: string }) => {
  const sliceIndex = () => props.sliceIndex;
  const { radio: session, state } = useFlexRadio();
  const slice = () => state.status.slice[sliceIndex()];
  const sliceController = () => session()?.slice(sliceIndex());
  const [rawFilterLow, setRawFilterLow] = createSignal(slice().filterLowHz);
  const [rawFilterHigh, setRawFilterHigh] = createSignal(slice().filterHighHz);

  createEffect(() => setRawFilterLow(slice()?.filterLowHz ?? 0));
  createEffect(() => setRawFilterHigh(slice()?.filterHighHz ?? 0));

  const applyFilterLow = () =>
    rawFilterLow() !== slice().filterLowHz
      ? sliceController().setFilterLow(rawFilterLow())
      : null;

  const applyFilterHigh = () =>
    rawFilterHigh() !== slice().filterHighHz
      ? sliceController().setFilterHigh(rawFilterHigh())
      : null;

  const filterText = () => {
    let filterWidth =
      (slice()?.filterHighHz ?? 0) - (slice()?.filterLowHz ?? 0);
    const unit = filterWidth >= 1000 ? "K" : "";
    if (filterWidth >= 1000) filterWidth /= 1000;
    return `${filterWidth}${unit}`;
  };

  const selectedPreset = () =>
    filterPresets[slice().mode].find(
      (preset) =>
        preset.lowCut === slice()?.filterLowHz &&
        preset.highCut === slice()?.filterHighHz,
    );

  return (
    <Popover>
      <PopoverTrigger class="text-blue-500 text-xs text-center font-mono grow textbox-trim-both textbox-edge-cap-alphabetic">
        {filterText()}
      </PopoverTrigger>
      <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 bg-background/50 backdrop-blur-xl">
        <PopoverArrow />
        <div class="p-4 flex flex-col space-y-6 max-h-(--kb-popper-content-available-height) overflow-x-auto">
          <Show when={filterPresets[slice().mode]}>
            {(presets) => (
              <ToggleGroup
                value={selectedPreset()?.name}
                onChange={(preset: string) => {
                  const presetObj = presets().find((p) => p.name === preset);
                  if (!presetObj) return;
                  sliceController().setFilter(
                    presetObj.lowCut,
                    presetObj.highCut,
                  );
                }}
                class="grid grid-cols-4"
              >
                <For each={presets()}>
                  {(preset) => (
                    <ToggleGroupItem
                      variant="outline"
                      size="sm"
                      class="border-muted-foreground data-pressed:bg-primary data-pressed:text-primary-foreground"
                      value={preset.name}
                    >
                      {preset.name}
                    </ToggleGroupItem>
                  )}
                </For>
              </ToggleGroup>
            )}
          </Show>
          <div class="flex justify-between">
            <div>
              <NumberField
                class="flex w-24 flex-col gap-2 select-none font-mono"
                rawValue={rawFilterLow()}
                format={false}
                minValue={filterMinHz}
                maxValue={slice().filterHighHz}
                onRawValueChange={setRawFilterLow}
                onFocusOut={applyFilterLow}
              >
                <NumberFieldDescription class="select-none">
                  Low Hz
                </NumberFieldDescription>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
            </div>
            <div>
              <NumberField
                class="flex w-24 flex-col gap-2 select-none font-mono"
                rawValue={rawFilterHigh()}
                minValue={slice().filterLowHz}
                format={false}
                maxValue={filterConstraints[slice().mode]?.high ?? filterMaxHz}
                onRawValueChange={setRawFilterHigh}
                onFocusOut={applyFilterHigh}
              >
                <NumberFieldDescription class="select-none text-right">
                  High Hz
                </NumberFieldDescription>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput size={6} />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
            </div>
          </div>
          <Slider
            minValue={filterConstraints[slice().mode]?.low ?? filterMinHz}
            maxValue={filterConstraints[slice().mode]?.high ?? filterMaxHz}
            step={25}
            value={[slice().filterLowHz, slice().filterHighHz]}
            onChange={([low, high]) => sliceController().setFilter(low, high)}
            class="space-y-3"
          >
            <SliderTrack>
              <SliderFill />
              <div
                class="absolute w-0.75 bg-red-500 h-[200%] rounded-sm -translate-y-1/4"
                classList={{
                  "left-0 -translate-x-1/2":
                    filterConstraints[slice().mode]?.low === 0,
                  "right-0 translate-x-1/2":
                    filterConstraints[slice().mode]?.high === 0,
                  "left-1/2 -translate-x-1/2":
                    filterConstraints[slice().mode]?.low < 0 &&
                    filterConstraints[slice().mode]?.high > 0,
                }}
              />
              <SliderThumb />
              <SliderThumb />
            </SliderTrack>
          </Slider>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export function Slice(props: { sliceIndex: string }) {
  const sliceIndex = () => props.sliceIndex;
  const { radio: session, state } = useFlexRadio();
  const [slice, setSlice] = createStore(state.status.slice[sliceIndex()]);
  const sliceController = () => session()?.slice(sliceIndex());
  const streamId = () => slice.panadapterStreamId;
  const [pan] = createStore(state.status.panadapter[streamId()]);
  const [offset, setOffset] = createSignal(0);
  const [ref, setRef] = createSignal<HTMLDivElement>();
  const [sentinel, setSentinel] = createSignal<HTMLDivElement>();
  const [wrapper, setWrapper] = createSignal<HTMLElement>();
  const [flag, setFlag] = createSignal<HTMLElement>();
  const [filterWidth, setFilterWidth] = createSignal(0);
  const [filterOffset, setFilterOffset] = createSignal(0);
  const [flagSide, setFlagSide] = createSignal<"left" | "right">("left");
  const [dragState, setDragState] = createStore({
    dragging: false,
    originX: 0,
    originFreq: 0,
    offset: 0,
  });
  const windowSize = createWindowSize();
  const wrapperSize = createElementSize(wrapper);
  const sentinelBounds = createElementBounds(sentinel);
  const flagBounds = createElementBounds(flag);

  createEffect(() => console.log(flagSide()));

  createEffect(() => {
    if (slice.diversityParent) {
      return setFlagSide("left");
    }
    if (slice.diversityChild) {
      return setFlagSide("right");
    }
    if (flagBounds.left! < 0) {
      setFlagSide("right");
    } else if (flagBounds.right! > wrapperSize.width!) {
      setFlagSide("left");
    }
  });

  createPointerListeners({
    async onMove(event) {
      if (!dragState.dragging) return;
      const newX = Math.max(0, Math.min(event.x, pan.width - 1));
      const newOffset = dragState.originX - newX;

      const mhzPerPx = pan.bandwidthMHz / pan.width;
      // Round frequency to the nearest step
      const step = slice.tuneStepHz / 1e6; // Convert Hz to MHz
      const freqUnrounded = dragState.originFreq - newOffset * mhzPerPx;
      const freqSteps = Math.round(freqUnrounded / step);
      const freq = freqSteps * step;

      if (freq === slice.frequencyMHz) {
        return;
      }

      await sliceController()?.setFrequency(freq);
    },
    onUp() {
      setDragState("dragging", false);
    },
    onLeave() {
      setDragState("dragging", false);
    },
  });

  createEffect((center) => {
    if (pan.centerFrequencyMHz !== center) {
      setDragState("dragging", false);
    }
    return pan.centerFrequencyMHz;
  });

  createEffect(() => {
    const parent = ref()?.parentElement;
    if (!parent) return;
    setWrapper(parent);
  });

  createEffect(() => {
    const { width } = windowSize;
    if (!width) return;
    const leftFreq = pan.centerFrequencyMHz - pan.bandwidthMHz / 2;
    const offsetMhz = slice.frequencyMHz - leftFreq;
    const offsetPixels = (offsetMhz / pan.bandwidthMHz) * width;
    const filterWidthMhz = (slice.filterHighHz - slice.filterLowHz) / 1e6; // Convert Hz to MHz
    batch(() => {
      const fWidth = (filterWidthMhz / pan.bandwidthMHz) * width;
      setFilterWidth(
        window.devicePixelRatio <= 1 ? Math.round(fWidth) : fWidth,
      );
      setFilterOffset((slice.filterLowHz / 1e6 / pan.bandwidthMHz) * width);
      // panadapter display is off by 2 pixels, so adjust
      setOffset(
        (window.devicePixelRatio <= 1
          ? Math.round(offsetPixels)
          : offsetPixels) - 2,
      );
    });
  });

  const tuneSlice = async (hz: number) => {
    if (!Number.isFinite(hz)) {
      return;
    }
    const freqMhz = hz / 1e6;
    if (Math.abs(freqMhz - slice.frequencyMHz) < 1e-9) {
      return;
    }
    try {
      await sliceController()?.setFrequency(freqMhz);
    } catch {
      // Ignore errors; the UI will reflect the previous baseline frequency.
    }
  };

  const makeActive = async () => {
    if (slice.isActive) return;
    sliceController()?.setActive(true);
  };

  createEffect(() => {
    const detached =
      sentinelBounds.left! < 0 || sentinelBounds.right! > wrapperSize.width!;
    if (detached === slice.isDetached) return;
    setSlice("isDetached", detached);
  });

  return (
    <>
      <Show when={!slice.isDetached}>
        <div
          class="absolute inset-y-0 translate-x-(--slice-offset) cursor-ew-resize"
          classList={{
            "z-0": !slice.isActive,
            "z-10": slice.isActive,
          }}
          style={{
            "--slice-offset": `calc(var(--drag-offset) + ${offset()}px)`,
          }}
          onClick={makeActive}
          ref={setRef}
        >
          <div
            class="absolute h-full translate-x-(--filter-offset) w-(--filter-width)"
            classList={{
              "backdrop-brightness-125 backdrop-contrast-75":
                !slice.diversityChild,
              "cursor-grab": !dragState.dragging,
              "cursor-grabbing": dragState.dragging,
            }}
            style={{
              "--filter-width": `${filterWidth()}px`,
              "--filter-offset": `${filterOffset()}px`,
            }}
            onPointerDown={(event) => {
              setDragState({
                dragging: true,
                originX: event.clientX,
                originFreq: slice.frequencyMHz,
                offset: 0,
              });
              makeActive();
            }}
          />
          <div
            class="absolute inset-y-0 max-w-px w-px flex flex-col items-center m-auto top-0"
            classList={{
              "bg-yellow-300": slice.isActive,
              "bg-red-500": !slice.isActive,
            }}
          >
            <Show when={slice.isActive}>
              <Triangle
                class="relative top-0"
                classList={{
                  "bg-red-500": slice.diversityChild,
                  "bg-yellow-300": !slice.diversityChild,
                }}
              />
              <Show when={slice.diversityEnabled}>
                <Triangle
                  class="relative -translate-y-1/2"
                  classList={{
                    "bg-red-500 -translate-z-1": slice.diversityParent,
                    "bg-yellow-300 translate-z-1": slice.diversityChild,
                  }}
                />
              </Show>
            </Show>
          </div>
          <Portal>
            <div
              class="absolute top-0 left-0 translate-x-(--flag-offset) pt-1 px-1 z-20"
              style={{
                "--side-offset":
                  flagSide() === "left"
                    ? `calc(100% - ${devicePixelRatio > 1 ? 1 : 0.5}px)`
                    : "0px",
                "--flag-offset": `calc(${sentinelBounds.left}px - var(--side-offset))`,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              ref={setFlag}
            >
              <div
                class="border border-foreground/50 rounded-md overflow-hidden flex flex-col p-1.5 gap-1 pointer-events-auto text-sm font-mono bg-background/50 drop-shadow-black subpixel-antialiased transform-gpu backdrop-blur-xs"
                classList={{
                  "drop-shadow-lg": slice.isActive,
                  "drop-shadow-md": !slice.isActive,
                }}
              >
                <div
                  class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-md"
                  classList={{
                    "backdrop-brightness-75 backdrop-grayscale-25":
                      !slice.isActive,
                  }}
                />
                <div class="flex justify-between items-center gap-1">
                  <Select
                    value={slice.rxAntenna}
                    options={Array.from(slice.availableRxAntennas)}
                    onChange={(v: string) => {
                      if (!v || v === slice.rxAntenna) return;
                      sliceController().setRxAntenna(v);
                    }}
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {props.item.rawValue.replace("_", " ")}
                      </SelectItem>
                    )}
                  >
                    <SelectTrigger
                      aria-label="RX Antenna"
                      class="flex items-center text-blue-500 font-medium"
                    >
                      <SelectValue<string> class="textbox-trim-both textbox-edge-cap-alphabetic">
                        {(state) => state.selectedOption().replace("_", " ")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  <Select
                    value={slice.txAntenna}
                    options={Array.from(slice.availableTxAntennas)}
                    onChange={(v: string) => {
                      if (!v || v === slice.txAntenna) return;
                      sliceController().setTxAntenna(v);
                    }}
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {props.item.rawValue.replace("_", " ")}
                      </SelectItem>
                    )}
                  >
                    <SelectTrigger
                      aria-label="TX Antenna"
                      class="flex items-center text-red-500 font-medium"
                    >
                      <SelectValue<string> class="textbox-trim-both textbox-edge-cap-alphabetic">
                        {(state) => state.selectedOption().replace("_", " ")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  <SliceFilter sliceIndex={props.sliceIndex} />
                  <ToggleButton
                    class="flex justify-center items-center h-4.5 font-extrabold px-1 rounded-sm"
                    classList={{
                      "bg-red-500": slice.isTransmitEnabled,
                      "opacity-50": !slice.isTransmitEnabled,
                    }}
                    pressed={slice.isTransmitEnabled}
                    onChange={(pressed) => {
                      sliceController().enableTransmit(pressed);
                    }}
                  >
                    <span class="leading-tight textbox-trim-both textbox-edge-cap-alphabetic">
                      TX
                    </span>
                  </ToggleButton>
                  <Popover>
                    <PopoverTrigger class="flex items-center bg-blue-500 h-4.5 px-1 rounded-sm">
                      <span class="font-extrabold textbox-edge-cap-alphabetic textbox-trim-both">
                        {slice.indexLetter}
                      </span>
                    </PopoverTrigger>
                    <PopoverContent class="flex flex-col overflow-hidden w-96 max-h-(--kb-popper-content-available-height)">
                      <div>
                        <Select
                          class="flex flex-col gap-2 select-none"
                          value={slice.tuneStepHz}
                          options={Array.from(slice.tuneStepListHz)}
                          onChange={(v: number) => {
                            if (!v || v === slice.tuneStepHz) return;
                            sliceController().setTuneStep(v);
                          }}
                          itemComponent={(props) => (
                            <SelectItem item={props.item}>
                              {props.item.rawValue} Hz
                            </SelectItem>
                          )}
                        >
                          <SelectLabel>Tune Step</SelectLabel>
                          <SelectTrigger>
                            <SelectValue<number>>
                              {(state) => `${state.selectedOption()} Hz`}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent />
                        </Select>
                      </div>
                      <pre class="size-full overflow-auto text-sm">
                        {JSON.stringify(slice, null, 2)}
                      </pre>
                    </PopoverContent>
                  </Popover>
                </div>
                <Show when={!slice.diversityChild}>
                  <div class="flex justify-between items-center">
                    <Popover>
                      <PopoverTrigger
                        class="textbox-trim-both textbox-edge-cap-alphabetic"
                        disabled={slice.diversityChild}
                      >
                        {slice.mode.padEnd(4, "\xA0")}
                      </PopoverTrigger>
                      <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 bg-background/50 backdrop-blur-xl">
                        <PopoverArrow />
                        <div class="p-4 flex flex-col space-y-6 max-h-(--kb-popper-content-available-height) overflow-x-auto">
                          <ToggleGroup
                            value={slice.mode}
                            onChange={(mode: string) => {
                              if (!mode || mode === slice.mode) return;
                              sliceController().setMode(mode);
                            }}
                            class="grid grid-cols-4"
                          >
                            <For each={slice.modeList}>
                              {(mode) => (
                                <ToggleGroupItem
                                  variant="outline"
                                  size="sm"
                                  class="border-muted-foreground data-pressed:bg-primary data-pressed:text-primary-foreground"
                                  value={mode}
                                >
                                  {mode}
                                </ToggleGroupItem>
                              )}
                            </For>
                          </ToggleGroup>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FrequencyInput
                      class="text-right bg-transparent text-lg/tight font-mono"
                      size={14}
                      valueHz={Math.round(slice.frequencyMHz * 1e6)}
                      onCommit={tuneSlice}
                    />
                  </div>
                </Show>
                <LevelMeter
                  sliceIndex={props.sliceIndex}
                  compressionFactor={0.6}
                  compressionThreshold={-73}
                />
                <div class="flex items-center text-xs h-3.5 font-medium justify-evenly *:flex *:justify-center *:items-center *:h-full *:basis-0 *:grow *:shrink *:min-w-0">
                  <Popover>
                    <PopoverTrigger
                      onContextMenu={(e) => {
                        e.preventDefault();
                        sliceController().setMute(!slice.isMuted);
                      }}
                    >
                      <Show
                        when={slice.isMuted}
                        fallback={<BaselineVolumeUp />}
                      >
                        <BaselineVolumeOff />
                      </Show>
                    </PopoverTrigger>
                    <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 bg-background/50 backdrop-blur-xl">
                      <PopoverArrow />
                      <div class="p-4 flex flex-col space-y-6 max-h-(--kb-popper-content-available-height) overflow-x-auto">
                        <SimpleSwitch
                          checked={slice.isMuted}
                          onChange={(isChecked) => {
                            sliceController().setMute(isChecked);
                          }}
                          label="Audio Mute"
                        />
                        <SimpleSlider
                          minValue={0}
                          maxValue={100}
                          value={[slice.audioGain]}
                          onChange={([value]) => {
                            sliceController().setAudioGain(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Audio Level"
                        />
                        <Slider
                          minValue={0}
                          maxValue={100}
                          value={[slice.audioPan]}
                          onChange={([value]) => {
                            sliceController().setAudioPan(value);
                          }}
                          getValueLabel={(params) => {
                            const value = params.values[0] - 50;
                            if (value === 0) return "Center";
                            return value < 0 ? `L${-value}` : `R${value}`;
                          }}
                          class="space-y-3"
                        >
                          <div class="flex w-full justify-between">
                            <SliderLabel>Audio Pan</SliderLabel>
                            <SliderValueLabel />
                          </div>
                          <SliderTrack>
                            <SliderFill
                              style={{
                                right:
                                  slice.audioPan > 50
                                    ? `${100 - slice.audioPan}%`
                                    : "50%",
                                left:
                                  slice.audioPan <= 50
                                    ? `${slice.audioPan}%`
                                    : "50%",
                              }}
                            />
                            <SliderThumb />
                          </SliderTrack>
                        </Slider>
                        <SegmentedControl
                          value={slice.agcMode}
                          onChange={(value) => {
                            sliceController().setAgcMode(value);
                          }}
                        >
                          <SegmentedControlLabel>
                            AGC Mode
                          </SegmentedControlLabel>
                          <SegmentedControlGroup>
                            <SegmentedControlIndicator />
                            <SegmentedControlItemsList class="bg-muted/50">
                              <For
                                each={[
                                  { label: "Off", value: "off" },
                                  { label: "Slow", value: "slow" },
                                  { label: "Med", value: "med" },
                                  { label: "Fast", value: "fast" },
                                ]}
                              >
                                {({ label, value }) => (
                                  <SegmentedControlItem value={value}>
                                    <SegmentedControlItemLabel>
                                      {label}
                                    </SegmentedControlItemLabel>
                                  </SegmentedControlItem>
                                )}
                              </For>
                            </SegmentedControlItemsList>
                          </SegmentedControlGroup>
                        </SegmentedControl>
                        <SimpleSlider
                          disabled={slice.agcMode === "off"}
                          minValue={0}
                          maxValue={100}
                          value={[slice.agcThreshold]}
                          onChange={([threshold]) => {
                            sliceController().setAgcSettings({ threshold });
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="AGC Threshold"
                        />
                        <SimpleSwitch
                          checked={slice.diversityEnabled}
                          disabled={slice.diversityChild}
                          onChange={(isChecked) => {
                            sliceController().setDiversityEnabled(isChecked);
                          }}
                          label="Diversity Reception"
                        />
                        <Show when={slice.diversityParent}>
                          <Show
                            when={
                              state.status.featureLicense?.features?.DIV_ESC
                                ?.enabled
                            }
                          >
                            <SimpleSwitch
                              checked={slice.escEnabled}
                              disabled={slice.diversityChild}
                              onChange={(isChecked) => {
                                sliceController().setEscEnabled(isChecked);
                              }}
                              label="Enhanced Signal Clarity (ESC)"
                            />
                            <SimpleSlider
                              disabled={!slice.escEnabled}
                              value={[slice.escGain]}
                              minValue={0.01}
                              maxValue={2.0}
                              step={0.01}
                              onChange={([value]) => {
                                if (value === slice.escGain) return;
                                sliceController()
                                  .setEscGain(value)
                                  .catch(console.log);
                              }}
                              getValueLabel={(params) => `${params.values[0]}`}
                              label="ESC Gain"
                            />
                            <SimpleSlider
                              disabled={!slice.escEnabled}
                              minValue={0}
                              maxValue={360}
                              value={[
                                Math.round(radToDeg(slice.escPhaseShift)),
                              ]}
                              onChange={([value]) => {
                                const rad = degToRad(value);
                                if (rad === slice.escPhaseShift) return;
                                sliceController()
                                  .setEscPhaseShift(rad)
                                  .catch(console.log);
                              }}
                              getValueLabel={(params) => `${params.values[0]}°`}
                              label="ESC Phase Shift"
                            />
                          </Show>
                        </Show>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger>
                      <span class="textbox-trim-both textbox-edge-cap-alphabetic">
                        DSP
                      </span>
                    </PopoverTrigger>
                    <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 bg-background/50 backdrop-blur-xl">
                      <PopoverArrow />
                      <div class="relative p-4 flex flex-col space-y-6 max-h-(--kb-popper-content-available-height) overflow-x-auto">
                        <SliderToggle
                          disabled={!slice.wnbEnabled}
                          minValue={0}
                          maxValue={100}
                          value={[slice.wnbLevel]}
                          onChange={([value]) => {
                            sliceController().setWnbLevel(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Wideband Noise Blanker (WNB)"
                          switchChecked={slice.wnbEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setWnbEnabled(isChecked);
                          }}
                        />
                        <SliderToggle
                          disabled={!slice.nbEnabled}
                          minValue={0}
                          maxValue={100}
                          value={[slice.nbLevel]}
                          onChange={([value]) => {
                            sliceController().setNbLevel(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Noise Blanker (NB)"
                          switchChecked={slice.nbEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setNbEnabled(isChecked);
                          }}
                        />
                        <SliderToggle
                          disabled={!slice.nrEnabled}
                          minValue={0}
                          maxValue={100}
                          value={[slice.nrLevel]}
                          onChange={([value]) => {
                            sliceController().setNrLevel(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Noise Reduction (NR)"
                          switchChecked={slice.nrEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setNrEnabled(isChecked);
                          }}
                        />
                        <SimpleSwitch
                          checked={slice.nrsEnabled}
                          onChange={(isChecked) => {
                            sliceController().setNrsEnabled(isChecked);
                          }}
                          label="Spectral Subtraction (NRS)"
                        />
                        <SimpleSwitch
                          checked={slice.nrfEnabled}
                          onChange={(isChecked) => {
                            sliceController().setNrfEnabled(isChecked);
                          }}
                          label="Noise Reduction Filter (NRF)"
                        />
                        <SimpleSwitch
                          checked={slice.rnnEnabled}
                          onChange={(isChecked) => {
                            sliceController().setRnnEnabled(isChecked);
                          }}
                          label="AI Noise Reduction (RNN)"
                        />
                        <SliderToggle
                          disabled={!slice.anfEnabled}
                          minValue={0}
                          maxValue={100}
                          value={[slice.anfLevel]}
                          onChange={([value]) => {
                            sliceController().setAnfLevel(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Automatic Notch Filter (ANF)"
                          switchChecked={slice.anfEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setAnfEnabled(isChecked);
                          }}
                        />
                        <SimpleSwitch
                          checked={slice.anftEnabled}
                          onChange={(isChecked) => {
                            sliceController().setAnftEnabled(isChecked);
                          }}
                          label=" FFT Auto Notch Filter (ANFT)"
                        />
                        <SliderToggle
                          disabled={!slice.apfEnabled}
                          minValue={0}
                          maxValue={100}
                          value={[slice.apfLevel]}
                          onChange={([value]) => {
                            sliceController().setApfLevel(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Automatic Peaking Filter (APF)"
                          switchChecked={slice.apfEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setApfEnabled(isChecked);
                          }}
                        />
                        <SliderToggle
                          disabled={!slice.nrlEnabled}
                          minValue={0}
                          maxValue={100}
                          value={[slice.nrlLevel]}
                          onChange={([value]) => {
                            sliceController().setNrlLevel(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Legacy Noise Reduction (NRL)"
                          switchChecked={slice.nrlEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setNrlEnabled(isChecked);
                          }}
                        />
                        <SliderToggle
                          disabled={!slice.anflEnabled}
                          minValue={0}
                          maxValue={100}
                          value={[slice.anflLevel]}
                          onChange={([value]) => {
                            sliceController().setAnflLevel(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]}%`}
                          label="Legacy Auto Notch Filter (ANFL)"
                          switchChecked={slice.anflEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setAnflEnabled(isChecked);
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger>
                      <span class="textbox-trim-both textbox-edge-cap-alphabetic">
                        RIT
                      </span>
                    </PopoverTrigger>
                    <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 bg-background/50 backdrop-blur-xl">
                      <PopoverArrow />
                      <div class="relative p-4 flex flex-col space-y-6 max-h-(--kb-popper-content-available-height) overflow-x-auto">
                        <SliderToggle
                          disabled={!slice.ritEnabled}
                          minValue={-100}
                          maxValue={100}
                          value={[slice.ritOffsetHz]}
                          onChange={([value]) => {
                            if (value === slice.ritOffsetHz) return;
                            sliceController().setRitOffset(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]} Hz`}
                          label="RX Offset (RIT)"
                          switchChecked={slice.ritEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setRitEnabled(isChecked);
                          }}
                        />
                        <SliderToggle
                          disabled={!slice.xitEnabled}
                          minValue={-100}
                          maxValue={100}
                          value={[slice.xitOffsetHz]}
                          onChange={([value]) => {
                            if (value === slice.xitOffsetHz) return;
                            sliceController().setXitOffset(value);
                          }}
                          getValueLabel={(params) => `${params.values[0]} Hz`}
                          label="TX Offset (XIT)"
                          switchChecked={slice.xitEnabled}
                          onSwitchChange={(isChecked) => {
                            sliceController().setXitEnabled(isChecked);
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Select
                    value={slice.daxChannel}
                    options={Array.from(
                      { length: state.status.radio.sliceCount + 1 },
                      (_, i) => i,
                    )}
                    onChange={(v: number) => {
                      if (v === slice.daxChannel) return;
                      sliceController().setDaxChannel(v);
                    }}
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {props.item.rawValue || "None"}
                      </SelectItem>
                    )}
                  >
                    <SelectTrigger
                      aria-label="DAX Channel"
                      class="h-auto p-0 textbox-trim-both textbox-edge-cap-alphabetic"
                    >
                      DAX
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>
              </div>
            </div>
          </Portal>
        </div>
      </Show>
      <div
        ref={setSentinel}
        class="absolute translate-x-(--slice-offset) pointer-events-none"
        style={{
          "--slice-offset": `calc(var(--drag-offset) + ${offset()}px)`,
        }}
      />
    </>
  );
}
