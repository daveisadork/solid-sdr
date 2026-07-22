import type { PolymorphicProps } from "@kobalte/core";
import { Trigger as SelectTriggerPrimitive } from "@kobalte/core/select";
import { ToggleButton } from "@kobalte/core/toggle-button";
import {
  filterPresetModeGroupFromSliceMode,
  type SliceController,
} from "@repo/flexlib";
import { createPointerListeners } from "@solid-primitives/pointer";
import { createElementSize } from "@solid-primitives/resize-observer";
import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  splitProps,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Dynamic, Portal } from "solid-js/web";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { type SliceSelector, useControls } from "~/context/controls";
import useFlexRadio, {
  type MeterState,
  type PanadapterState,
  type SliceState,
} from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";
import { type SliceTxMeter, usePreferences } from "~/context/preferences";
import { useRuntime } from "~/context/runtime";
import { cn, degToRad, radToDeg } from "~/lib/utils";
import MaterialSymbolsChevronLeft from "~icons/material-symbols/chevron-left";
import MaterialSymbolsChevronRight from "~icons/material-symbols/chevron-right";
import MdiLock from "~icons/material-symbols/lock-open-circle-outline";
import SplitIcon from "~icons/material-symbols/split-scene-left-outline";
import SwapIcon from "~icons/material-symbols/swap-horiz";
import MaterialSymbolsVolumeOff from "~icons/material-symbols/volume-off";
import MaterialSymbolsVolumeUp from "~icons/material-symbols/volume-up";
import MdiClose from "~icons/mdi/close-circle-outline";
import MdiPlay from "~icons/mdi/play-circle-outline";
import MdiRecord from "~icons/mdi/record-circle-outline";
import MdiSettings from "~icons/mdi/settings";
import MdiStop from "~icons/mdi/stop-circle-outline";
import { FrequencyInput } from "./frequency-input";
import { LevelMeter } from "./level-meter";
import { Button } from "./ui/button";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "./ui/number-field";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "./ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { SimpleSlider } from "./ui/simple-slider";
import { SimpleSwitch } from "./ui/simple-switch";
import { Slider, SliderFill, SliderThumb, SliderTrack } from "./ui/slider";
import { SliderToggle } from "./ui/slider-toggle";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { TxMeter } from "./ui/tx-meter";

const FILTER_MAX_HZ = 12_000;
const FILTER_MIN_HZ = -FILTER_MAX_HZ;

export interface FmTone {
  ns: string;
  pl: string;
  hz: string;
  name: string;
}

export const toneValues: FmTone[] = [
  { ns: "1", pl: "XZ", hz: "67.0", name: "\xa01\xa0XZ\xa0\xa067.0" },
  { ns: "", pl: "WZ", hz: "69.3", name: "\xa0\xa0\xa0WZ\xa0\xa069.3" },
  { ns: "2", pl: "XA", hz: "71.9", name: "\xa02\xa0XA\xa0\xa071.9" },
  { ns: "3", pl: "WA", hz: "74.4", name: "\xa03\xa0WA\xa0\xa074.4" },
  { ns: "4", pl: "XB", hz: "77.0", name: "\xa04\xa0XB\xa0\xa077.0" },
  { ns: "5", pl: "WB", hz: "79.7", name: "\xa05\xa0WB\xa0\xa079.7" },
  { ns: "6", pl: "YZ", hz: "82.5", name: "\xa06\xa0YZ\xa0\xa082.5" },
  { ns: "7", pl: "YA", hz: "85.4", name: "\xa07\xa0YA\xa0\xa085.4" },
  { ns: "8", pl: "YB", hz: "88.5", name: "\xa08\xa0YB\xa0\xa088.5" },
  { ns: "9", pl: "ZZ", hz: "91.5", name: "\xa09\xa0ZZ\xa0\xa091.5" },
  { ns: "10", pl: "ZA", hz: "94.8", name: "10\xa0ZA\xa0\xa094.8" },
  { ns: "11", pl: "ZB", hz: "97.4", name: "11\xa0ZB\xa0\xa097.4" },
  { ns: "12", pl: "1Z", hz: "100.0", name: "12\xa01Z\xa0100.0" },
  { ns: "13", pl: "1A", hz: "103.5", name: "13\xa01A\xa0103.5" },
  { ns: "14", pl: "1B", hz: "107.2", name: "14\xa01B\xa0107.2" },
  { ns: "15", pl: "2Z", hz: "110.9", name: "15\xa02Z\xa0110.9" },
  { ns: "16", pl: "2A", hz: "114.8", name: "16\xa02A\xa0114.8" },
  { ns: "17", pl: "2B", hz: "118.8", name: "17\xa02B\xa0118.8" },
  { ns: "18", pl: "3Z", hz: "123.0", name: "18\xa03Z\xa0123.0" },
  { ns: "19", pl: "3A", hz: "127.3", name: "19\xa03A\xa0127.3" },
  { ns: "20", pl: "3B", hz: "131.8", name: "20\xa03B\xa0131.8" },
  { ns: "21", pl: "4Z", hz: "136.5", name: "21\xa04Z\xa0136.5" },
  { ns: "22", pl: "4A", hz: "141.3", name: "22\xa04A\xa0141.3" },
  { ns: "23", pl: "4B", hz: "146.2", name: "23\xa04B\xa0146.2" },
  { ns: "NATO", pl: "", hz: "150.0", name: "NATO\xa0\xa0150.0" },
  { ns: "24", pl: "5Z", hz: "151.4", name: "24\xa05Z\xa0151.4" },
  { ns: "25", pl: "5A", hz: "156.7", name: "25\xa05A\xa0156.7" },
  { ns: "26", pl: "5B", hz: "162.2", name: "26\xa05B\xa0162.2" },
  { ns: "27", pl: "6Z", hz: "167.9", name: "27\xa06Z\xa0167.9" },
  { ns: "28", pl: "6A", hz: "173.8", name: "28\xa06A\xa0173.8" },
  { ns: "29", pl: "6B", hz: "179.9", name: "29\xa06B\xa0179.9" },
  { ns: "30", pl: "7Z", hz: "186.2", name: "30\xa07Z\xa0186.2" },
  { ns: "31", pl: "7A", hz: "192.8", name: "31\xa07A\xa0192.8" },
  { ns: "", pl: "", hz: "199.5", name: "\xa0\xa0\xa0\xa0\xa0\xa0199.5" },
  { ns: "", pl: "8Z", hz: "206.5", name: "\xa0\xa0\xa08Z\xa0206.5" },
  { ns: "", pl: "", hz: "213.8", name: "\xa0\xa0\xa0\xa0\xa0\xa0213.8" },
  { ns: "", pl: "", hz: "221.3", name: "\xa0\xa0\xa0\xa0\xa0\xa0221.3" },
  { ns: "", pl: "9Z", hz: "229.1", name: "\xa0\xa0\xa09Z\xa0229.1" },
  { ns: "", pl: "", hz: "237.1", name: "\xa0\xa0\xa0\xa0\xa0\xa0237.1" },
  { ns: "", pl: "", hz: "245.5", name: "\xa0\xa0\xa0\xa0\xa0\xa0245.5" },
  { ns: "", pl: "0Z", hz: "254.1", name: "\xa0\xa0\xa00Z\xa0254.1" },
  { ns: "", pl: "", hz: "159.8", name: "\xa0\xa0\xa0\xa0\xa0\xa0159.8" },
  { ns: "", pl: "", hz: "165.5", name: "\xa0\xa0\xa0\xa0\xa0\xa0165.5" },
  { ns: "", pl: "", hz: "171.3", name: "\xa0\xa0\xa0\xa0\xa0\xa0171.3" },
  { ns: "", pl: "", hz: "177.3", name: "\xa0\xa0\xa0\xa0\xa0\xa0177.3" },
  { ns: "", pl: "", hz: "183.5", name: "\xa0\xa0\xa0\xa0\xa0\xa0183.5" },
  { ns: "", pl: "", hz: "189.9", name: "\xa0\xa0\xa0\xa0\xa0\xa0189.9" },
  { ns: "", pl: "", hz: "196.6", name: "\xa0\xa0\xa0\xa0\xa0\xa0196.6" },
  { ns: "32", pl: "M1", hz: "203.5", name: "32\xa0M1\xa0203.5" },
  { ns: "33", pl: "M2", hz: "210.7", name: "33\xa0M2\xa0210.7" },
  { ns: "34", pl: "M3", hz: "218.1", name: "34\xa0M3\xa0218.1" },
  { ns: "35", pl: "M4", hz: "225.7", name: "35\xa0M4\xa0225.7" },
  { ns: "36", pl: "M5", hz: "233.6", name: "36\xa0M5\xa0233.6" },
  { ns: "37", pl: "M6", hz: "241.8", name: "37\xa0M6\xa0241.8" },
  { ns: "38", pl: "M7", hz: "250.3", name: "38\xa0M7\xa0250.3" },
];

export interface FilterConstraint {
  low: number;
  high: number;
}

const filterConstraints: Record<string, FilterConstraint> = {
  AM: { low: -10_000, high: 10_000 },
  SAM: { low: -10_000, high: 10_000 },
  USB: { low: 0, high: 10_000 },
  LSB: { low: -10_000, high: 0 },
  DIGU: { low: 0, high: 12_000 },
  DIGL: { low: -12_000, high: 0 },
  FDVU: { low: 0, high: 12_000 },
  FDVL: { low: -12_000, high: 0 },
  RTTY: { low: -1_500, high: 1_500 },
  CW: { low: -1_500, high: 1_500 },
  NFM: { low: -5_500, high: 5_500 },
  FM: { low: -8_000, high: 8_000 },
  DFM: { low: -10_000, high: 10_000 },
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

export function FilterControls(props: {
  slice: SliceState;
  controller: SliceController;
}) {
  const { state } = useFlexRadio();

  const [rawDiglOffset, setRawDiglOffset] = createSignal(
    props.slice.diglOffsetHz,
  );
  const [rawDiguOffset, setRawDiguOffset] = createSignal(
    props.slice.diguOffsetHz,
  );
  const [rawFilterLow, setRawFilterLow] = createSignal(props.slice.filterLowHz);
  const [rawFilterHigh, setRawFilterHigh] = createSignal(
    props.slice.filterHighHz,
  );

  createEffect(() => setRawDiglOffset(props.slice.diglOffsetHz));
  createEffect(() => setRawDiguOffset(props.slice.diguOffsetHz));
  createEffect(() => setRawFilterLow(props.slice.filterLowHz));
  createEffect(() => setRawFilterHigh(props.slice.filterHighHz));

  const recenterFilter = (offset: number, mode: string) => {
    const halfWidth = Math.floor(
      (props.slice.filterHighHz - props.slice.filterLowHz) / 2,
    );
    if (mode === "DIGU" || mode === "FDVU") {
      const clamp = Math.max(offset, halfWidth) - offset;
      props.controller.setFilter(
        -halfWidth + clamp + offset,
        halfWidth + clamp + offset,
      );
    } else if (mode === "DIGL" || mode === "FDVL") {
      const clamp = Math.max(offset, halfWidth) - offset;
      props.controller.setFilter(
        -halfWidth - clamp - offset,
        halfWidth - clamp - offset,
      );
    }
  };

  const applyDiglOffset = async () => {
    if (rawDiglOffset() === props.slice.diglOffsetHz) return;
    await props.controller.setDigLOffset(rawDiglOffset());
    recenterFilter(rawDiglOffset(), "DIGL");
  };

  const applyDiguOffset = async () => {
    if (rawDiguOffset() === props.slice.diguOffsetHz) return;
    await props.controller.setDigUOffset(rawDiguOffset());
    recenterFilter(rawDiguOffset(), "DIGU");
  };

  const applyFilterLow = () =>
    rawFilterLow() !== props.slice.filterLowHz
      ? props.controller.setFilterLow(rawFilterLow())
      : null;

  const applyFilterHigh = () =>
    rawFilterHigh() !== props.slice.filterHighHz
      ? props.controller.setFilterHigh(rawFilterHigh())
      : null;

  const modeGroup = createMemo(() =>
    filterPresetModeGroupFromSliceMode(props.slice.mode),
  );

  const presetEntries = createMemo(() => {
    const group = modeGroup();
    return group ? state.status.filterPreset[group] : undefined;
  });

  // Presets are stored canonically for USB/DIGU/FDVU; LSB/DIGL/FDVL reflect
  // them over the slice frequency. The radio applies no carrier-offset shift
  // when setting a preset (unlike manual Low/High Hz edits).
  const mirrorForMode = (
    lowCut: number,
    highCut: number,
    mode: string,
  ): [number, number] =>
    mode === "LSB" || mode === "DIGL" || mode === "FDVL"
      ? [-highCut, -lowCut]
      : [lowCut, highCut];

  const selectedPreset = createMemo(() =>
    presetEntries()?.find((entry) => {
      const [low, high] = mirrorForMode(
        entry.filterLowHz,
        entry.filterHighHz,
        props.slice.mode,
      );
      return (
        low === props.slice.filterLowHz && high === props.slice.filterHighHz
      );
    }),
  );

  const filterMinHz = createMemo(
    () => filterConstraints[props.slice.mode]?.low ?? FILTER_MIN_HZ,
  );

  const filterMaxHz = createMemo(
    () => filterConstraints[props.slice.mode]?.high ?? FILTER_MAX_HZ,
  );

  return (
    <>
      <Show when={props.slice.mode === "DIGU"}>
        <NumberField
          class="flex flex-col gap-2 select-none"
          rawValue={rawDiguOffset()}
          format={false}
          minValue={0}
          maxValue={10_000}
          step={10}
          onRawValueChange={setRawDiguOffset}
          onFocusOut={applyDiguOffset}
        >
          <NumberFieldLabel class="select-none">Offset Hz</NumberFieldLabel>
          <NumberFieldGroup class="select-none">
            <NumberFieldInput />
            <NumberFieldIncrementTrigger class="select-none" />
            <NumberFieldDecrementTrigger class="select-none" />
          </NumberFieldGroup>
        </NumberField>
      </Show>
      <Show when={props.slice.mode === "DIGL"}>
        <NumberField
          class="flex flex-col gap-2 select-none"
          rawValue={rawDiglOffset()}
          format={false}
          minValue={-10_000}
          maxValue={0}
          step={10}
          onRawValueChange={setRawDiglOffset}
          onFocusOut={applyDiglOffset}
        >
          <NumberFieldLabel class="select-none">Offset Hz</NumberFieldLabel>
          <NumberFieldGroup class="select-none">
            <NumberFieldInput />
            <NumberFieldIncrementTrigger class="select-none" />
            <NumberFieldDecrementTrigger class="select-none" />
          </NumberFieldGroup>
        </NumberField>
      </Show>
      <Show when={presetEntries()}>
        {(entries) => (
          <ToggleGroup
            value={selectedPreset()?.index.toString()}
            onChange={(value: string) => {
              const entry = entries().find((e) => e.index.toString() === value);
              if (!entry) return;
              const [low, high] = mirrorForMode(
                entry.filterLowHz,
                entry.filterHighHz,
                props.slice.mode,
              );
              props.controller.setFilter(low, high);
            }}
            class="grid grid-cols-3"
          >
            <For each={entries()}>
              {(entry) => (
                <ToggleGroupItem
                  variant="outline"
                  value={entry.index.toString()}
                >
                  {entry.name}
                </ToggleGroupItem>
              )}
            </For>
          </ToggleGroup>
        )}
      </Show>
      <div class="grid grid-cols-2 gap-2">
        <NumberField
          class="flex flex-col gap-2 select-none"
          rawValue={rawFilterLow()}
          format={false}
          minValue={filterMinHz()}
          maxValue={props.slice.filterHighHz}
          onRawValueChange={setRawFilterLow}
          onFocusOut={applyFilterLow}
        >
          <NumberFieldLabel class="select-none">Low Hz</NumberFieldLabel>
          <NumberFieldGroup class="select-none">
            <NumberFieldInput />
            <NumberFieldIncrementTrigger class="select-none" />
            <NumberFieldDecrementTrigger class="select-none" />
          </NumberFieldGroup>
        </NumberField>
        <NumberField
          class="flex flex-col gap-2 select-none"
          rawValue={rawFilterHigh()}
          minValue={props.slice.filterLowHz}
          format={false}
          maxValue={filterMaxHz()}
          onRawValueChange={setRawFilterHigh}
          onFocusOut={applyFilterHigh}
        >
          <NumberFieldLabel class="select-none text-right">
            High Hz
          </NumberFieldLabel>
          <NumberFieldGroup class="select-none">
            <NumberFieldInput size={6} />
            <NumberFieldIncrementTrigger class="select-none" />
            <NumberFieldDecrementTrigger class="select-none" />
          </NumberFieldGroup>
        </NumberField>
      </div>
      <Slider
        minValue={filterMinHz()}
        maxValue={filterMaxHz()}
        step={25}
        value={[props.slice.filterLowHz, props.slice.filterHighHz]}
        onChange={([low, high]) => props.controller.setFilter(low, high)}
        class="gap-3"
      >
        <SliderTrack>
          <SliderFill />
          <div
            class="absolute w-0.75 bg-red-500 h-[200%] rounded-sm -translate-y-1/4"
            classList={{
              "left-0 -translate-x-1/2": filterMinHz() === 0,
              "right-0 translate-x-1/2": filterMaxHz() === 0,
              "left-1/2 -translate-x-1/2":
                filterMinHz() < 0 && filterMaxHz() > 0,
            }}
          />
          <SliderThumb />
          <SliderThumb />
        </SliderTrack>
      </Slider>
    </>
  );
}

const SliceFilter = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const filterText = createMemo(() => {
    let filterWidth =
      (props.slice?.filterHighHz ?? 0) - (props.slice?.filterLowHz ?? 0);
    const unit = filterWidth >= 1000 ? "k" : "";
    if (filterWidth >= 1000) filterWidth /= 1000;
    return `${filterWidth}${unit}`;
  });

  return (
    <Popover>
      <PopoverTrigger class="w-12 text-blue-500 text-xs text-center font-mono grow textbox-trim-both textbox-edge-cap-alphabetic">
        {filterText()}
      </PopoverTrigger>
      <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
        <PopoverArrow />
        <div class="p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
          <FilterControls slice={props.slice} controller={props.controller} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

const AudioControls = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const { state } = useFlexRadio();

  return (
    <Popover>
      <PopoverTrigger
        onContextMenu={(e) => {
          e.preventDefault();
          props.controller.setMute(!props.slice.isMuted);
        }}
      >
        <Show when={props.slice.isMuted} fallback={<MaterialSymbolsVolumeUp />}>
          <MaterialSymbolsVolumeOff />
        </Show>
      </PopoverTrigger>
      <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
        <PopoverArrow />
        <div class="p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
          <SimpleSwitch
            checked={props.slice.isMuted}
            onChange={(isChecked) => {
              props.controller.setMute(isChecked);
            }}
            label="Audio Mute"
          />
          <SimpleSlider
            minValue={0}
            maxValue={100}
            value={[props.slice.audioGain]}
            onChange={([value]) => {
              props.controller.setAudioGain(value);
            }}
            getValueLabel={(params) => `${params.values[0]}%`}
            label="Audio Level"
          />
          <SimpleSlider
            label="Audio Pan"
            minValue={0}
            maxValue={100}
            value={[props.slice.audioPan]}
            onChange={([value]) => {
              props.controller.setAudioPan(value);
            }}
            getValueLabel={(params) => {
              const value = params.values[0] - 50;
              if (value === 0) return "Center";
              return value < 0 ? `L${-value}` : `R${value}`;
            }}
            fromCenter
          />
          <SegmentedControl
            value={props.slice.agcMode}
            onChange={(value) => {
              props.controller.setAgcMode(value);
            }}
          >
            <SegmentedControlLabel>AGC Mode</SegmentedControlLabel>
            <SegmentedControlGroup>
              <SegmentedControlIndicator />
              <SegmentedControlItemsList>
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
            disabled={props.slice.agcMode === "off"}
            minValue={0}
            maxValue={100}
            value={[props.slice.agcThreshold]}
            onChange={([threshold]) => {
              props.controller.setAgcSettings({
                threshold,
              });
            }}
            getValueLabel={(params) => `${params.values[0]}%`}
            label="AGC Threshold"
          />
          <Show
            when={
              !["DIGU", "DIGL", "CW", "RTTY", "FDVL", "FDVU"].includes(
                props.slice.mode,
              )
            }
          >
            <SliderToggle
              disabled={!props.slice.squelchEnabled}
              minValue={0}
              maxValue={100}
              value={[props.slice.squelchLevel]}
              onChange={([value]) => {
                props.controller.setSquelchLevel(value);
              }}
              getValueLabel={(params) => `${params.values[0]}%`}
              label="Squelch"
              switchChecked={props.slice.squelchEnabled}
              onSwitchChange={(isChecked) => {
                props.controller.setSquelchEnabled(isChecked);
              }}
            />
          </Show>
          <SimpleSwitch
            checked={props.slice.diversityEnabled}
            disabled={props.slice.diversityChild}
            onChange={(isChecked) => {
              props.controller.setDiversityEnabled(isChecked);
            }}
            label="Diversity Reception"
          />
          <Show when={props.slice.diversityParent}>
            <Show
              when={state.status.featureLicense?.features?.DIV_ESC?.enabled}
            >
              <SimpleSwitch
                checked={props.slice.escEnabled}
                disabled={props.slice.diversityChild}
                onChange={(isChecked) => {
                  props.controller.setEscEnabled(isChecked);
                }}
                label="Enhanced Signal Clarity (ESC)"
              />
              <SimpleSlider
                disabled={!props.slice.escEnabled}
                value={[props.slice.escGain]}
                minValue={0.01}
                maxValue={2.0}
                step={0.01}
                onChange={([value]) => {
                  if (value === props.slice.escGain) return;
                  props.controller.setEscGain(value).catch(console.log);
                }}
                getValueLabel={(params) => `${params.values[0]}`}
                label="ESC Gain"
              />
              <SimpleSlider
                disabled={!props.slice.escEnabled}
                minValue={0}
                maxValue={360}
                value={[Math.round(radToDeg(props.slice.escPhaseShift))]}
                onChange={([value]) => {
                  const rad = degToRad(value);
                  if (rad === props.slice.escPhaseShift) return;
                  props.controller.setEscPhaseShift(rad).catch(console.log);
                }}
                getValueLabel={(params) => `${params.values[0]}°`}
                label="ESC Phase Shift"
              />
            </Show>
          </Show>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const OptDspControls = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const [rawRepeaterOffset, setRawRepeaterOffset] = createSignal(0);
  const [tuneToOffset, setTuneToOffset] = createSignal(false);

  createEffect(() => setRawRepeaterOffset(props.slice.fmRepeaterOffsetMHz));

  return (
    <>
      <Show when={props.slice.mode.endsWith("FM")}>
        <Popover>
          <PopoverTrigger>
            <span class="textbox-trim-both textbox-edge-cap-alphabetic">
              OPT
            </span>
          </PopoverTrigger>
          <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
            <PopoverArrow />
            <div class="elative p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
              <SegmentedControl
                value={props.slice.fmToneMode}
                onChange={(value) => {
                  props.controller.setFmToneMode(value);
                }}
              >
                <SegmentedControlLabel>Tone Mode</SegmentedControlLabel>
                <SegmentedControlGroup>
                  <SegmentedControlIndicator />
                  <SegmentedControlItemsList>
                    <For
                      each={[
                        { label: "Off", value: "OFF" },
                        {
                          label: "CTCSS TX",
                          value: "CTCSS_TX",
                        },
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
              <Select
                class="flex flex-col gap-2 select-none"
                value={props.slice.fmToneValue}
                options={toneValues.map((v) => v.hz)}
                onChange={(v: string) => {
                  if (!v || v === props.slice.fmToneValue) return;
                  props.controller.setFmToneValue(v);
                }}
                itemComponent={(props) => (
                  <SelectItem item={props.item} class="font-mono">
                    {toneValues
                      .find((v) => v.hz === props.item.rawValue)
                      ?.name.replaceAll(" ", "\xA0") || "None"}
                  </SelectItem>
                )}
              >
                <SelectLabel>Tone Value</SelectLabel>
                <SelectTrigger aria-label="FM Tone Value">
                  <SelectValue<string> class="font-mono">
                    {(state) =>
                      toneValues.find((v) => v.hz === state.selectedOption())
                        ?.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
              <SegmentedControl
                value={props.slice.repeaterOffsetDirection}
                onChange={(value) => {
                  props.controller.setRepeaterOffsetDirection(value);
                }}
              >
                <SegmentedControlLabel>Offset Direction</SegmentedControlLabel>
                <SegmentedControlGroup>
                  <SegmentedControlIndicator />
                  <SegmentedControlItemsList>
                    <For each={["DOWN", "SIMPLEX", "UP"]}>
                      {(value) => (
                        <SegmentedControlItem value={value}>
                          <SegmentedControlItemLabel class="capitalize">
                            {value.toLowerCase()}
                          </SegmentedControlItemLabel>
                        </SegmentedControlItem>
                      )}
                    </For>
                  </SegmentedControlItemsList>
                </SegmentedControlGroup>
              </SegmentedControl>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={rawRepeaterOffset()}
                format={false}
                onRawValueChange={setRawRepeaterOffset}
                onFocusOut={() => {
                  if (rawRepeaterOffset() === props.slice.fmRepeaterOffsetMHz)
                    return;
                  props.controller.setFmRepeaterOffsetFrequency(
                    rawRepeaterOffset(),
                  );
                }}
              >
                <NumberFieldLabel class="select-none">
                  Offset MHz
                </NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <SimpleSwitch
                checked={tuneToOffset()}
                onChange={(checked) => {
                  const offset =
                    props.slice.repeaterOffsetDirection === "UP"
                      ? props.slice.fmRepeaterOffsetMHz
                      : props.slice.repeaterOffsetDirection === "DOWN"
                        ? -props.slice.fmRepeaterOffsetMHz
                        : 0;
                  const freq = checked
                    ? props.slice.frequencyMHz + offset
                    : props.slice.frequencyMHz - offset;
                  props.controller.setFrequency(freq);
                  setTuneToOffset(checked);
                }}
                label="Reverse (Tune to Offset Freq)"
              />
            </div>
          </PopoverContent>
        </Popover>
      </Show>
      <Show when={!props.slice.mode.endsWith("FM")}>
        <Popover>
          <PopoverTrigger>
            <span class="textbox-trim-both textbox-edge-cap-alphabetic">
              DSP
            </span>
          </PopoverTrigger>
          <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
            <PopoverArrow />
            <div class="elative p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
              <SliderToggle
                disabled={!props.slice.wnbEnabled}
                minValue={0}
                maxValue={100}
                value={[props.slice.wnbLevel]}
                onChange={([value]) => {
                  props.controller.setWnbLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Wideband Noise Blanker (WNB)"
                switchChecked={props.slice.wnbEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setWnbEnabled(isChecked);
                }}
              />
              <SliderToggle
                disabled={!props.slice.nbEnabled}
                minValue={0}
                maxValue={100}
                value={[props.slice.nbLevel]}
                onChange={([value]) => {
                  props.controller.setNbLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Noise Blanker (NB)"
                switchChecked={props.slice.nbEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setNbEnabled(isChecked);
                }}
              />
              <SliderToggle
                disabled={!props.slice.nrEnabled}
                minValue={0}
                maxValue={99}
                value={[props.slice.nrLevel]}
                onChange={([value]) => {
                  props.controller.setNrLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Noise Reduction (NR)"
                switchChecked={props.slice.nrEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setNrEnabled(isChecked);
                }}
              />
              <SliderToggle
                disabled={!props.slice.nrsEnabled}
                minValue={0}
                maxValue={50}
                value={[props.slice.nrsLevel]}
                onChange={([value]) => {
                  props.controller.setNrsLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Spectral Subtraction (NRS)"
                switchChecked={props.slice.nrsEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setNrsEnabled(isChecked);
                }}
              />
              <SimpleSwitch
                checked={props.slice.nrfEnabled}
                onChange={(isChecked) => {
                  props.controller.setNrfEnabled(isChecked);
                }}
                label="Noise Reduction Filter (NRF)"
              />
              <Show when={props.slice.mode !== "CW"}>
                <SimpleSwitch
                  checked={props.slice.rnnEnabled}
                  onChange={(isChecked) => {
                    props.controller.setRnnEnabled(isChecked);
                  }}
                  label="AI Noise Reduction (RNN)"
                />
                <SliderToggle
                  disabled={!props.slice.anfEnabled}
                  minValue={0}
                  maxValue={99}
                  value={[props.slice.anfLevel]}
                  onChange={([value]) => {
                    props.controller.setAnfLevel(value);
                  }}
                  getValueLabel={(params) => `${params.values[0]}%`}
                  label="Automatic Notch Filter (ANF)"
                  switchChecked={props.slice.anfEnabled}
                  onSwitchChange={(isChecked) => {
                    props.controller.setAnfEnabled(isChecked);
                  }}
                />
                <SimpleSwitch
                  checked={props.slice.anftEnabled}
                  onChange={(isChecked) => {
                    props.controller.setAnftEnabled(isChecked);
                  }}
                  label=" FFT Auto Notch Filter (ANFT)"
                />
              </Show>
              <Show when={props.slice.mode === "CW"}>
                <SliderToggle
                  disabled={!props.slice.apfEnabled}
                  minValue={0}
                  maxValue={100}
                  value={[props.slice.apfLevel]}
                  onChange={([value]) => {
                    props.controller.setApfLevel(value);
                  }}
                  getValueLabel={(params) => `${params.values[0]}%`}
                  label="Automatic Peaking Filter (APF)"
                  switchChecked={props.slice.apfEnabled}
                  onSwitchChange={(isChecked) => {
                    props.controller.setApfEnabled(isChecked);
                  }}
                />
              </Show>
              <SliderToggle
                disabled={!props.slice.nrlEnabled}
                minValue={0}
                maxValue={100}
                value={[props.slice.nrlLevel]}
                onChange={([value]) => {
                  props.controller.setNrlLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Legacy Noise Reduction (NRL)"
                switchChecked={props.slice.nrlEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setNrlEnabled(isChecked);
                }}
              />
              <Show when={props.slice.mode !== "CW"}>
                <SliderToggle
                  disabled={!props.slice.anflEnabled}
                  minValue={0}
                  maxValue={100}
                  value={[props.slice.anflLevel]}
                  onChange={([value]) => {
                    props.controller.setAnflLevel(value);
                  }}
                  getValueLabel={(params) => `${params.values[0]}%`}
                  label="Legacy Auto Notch Filter (ANFL)"
                  switchChecked={props.slice.anflEnabled}
                  onSwitchChange={(isChecked) => {
                    props.controller.setAnflEnabled(isChecked);
                  }}
                />
              </Show>
            </div>
          </PopoverContent>
        </Popover>
      </Show>
    </>
  );
};

const RitControls = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  return (
    <Popover>
      <PopoverTrigger>
        <span class="textbox-trim-both textbox-edge-cap-alphabetic">RIT</span>
      </PopoverTrigger>
      <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
        <PopoverArrow />
        <div class="relative p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
          <SliderToggle
            disabled={!props.slice.ritEnabled}
            minValue={-100}
            maxValue={100}
            value={[props.slice.ritOffsetHz]}
            onChange={([value]) => {
              if (value === props.slice.ritOffsetHz) return;
              props.controller.setRitOffset(value);
            }}
            getValueLabel={(params) => `${params.values[0]} Hz`}
            label="RX Offset (RIT)"
            switchChecked={props.slice.ritEnabled}
            onSwitchChange={(isChecked) => {
              props.controller.setRitEnabled(isChecked);
            }}
          />
          <SliderToggle
            disabled={!props.slice.xitEnabled}
            minValue={-100}
            maxValue={100}
            value={[props.slice.xitOffsetHz]}
            onChange={([value]) => {
              if (value === props.slice.xitOffsetHz) return;
              props.controller.setXitOffset(value);
            }}
            getValueLabel={(params) => `${params.values[0]} Hz`}
            label="TX Offset (XIT)"
            switchChecked={props.slice.xitEnabled}
            onSwitchChange={(isChecked) => {
              props.controller.setXitEnabled(isChecked);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

const DaxChannelSelect = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const { state } = useFlexRadio();
  return (
    <Select
      value={props.slice.daxChannel}
      options={Array.from(
        { length: state.status.radio.sliceCount + 1 },
        (_, i) => i,
      )}
      onChange={(v: number) => {
        if (v === props.slice.daxChannel) return;
        props.controller.setDaxChannel(v);
      }}
      itemComponent={(props) => (
        <SelectItem item={props.item}>
          {props.item.rawValue || "None"}
        </SelectItem>
      )}
    >
      <SelectTriggerPrimitive
        aria-label="DAX Channel"
        class="h-auto p-0 textbox-trim-both textbox-edge-cap-alphabetic"
      >
        DAX
      </SelectTriggerPrimitive>
      <SelectContent />
    </Select>
  );
};

const SliceSettings = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const { preferences, setPreferences } = usePreferences();
  return (
    <Popover>
      <PopoverTrigger>
        <MdiSettings />
      </PopoverTrigger>
      <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
        <PopoverArrow />
        <div class="relative p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
          <NumberField
            class="flex flex-col gap-2 select-none"
            rawValue={props.slice.tuneStepHz}
            format={false}
            minValue={1}
            maxValue={1_000_000}
            onRawValueChange={(v) => props.controller.setTuneStep(v)}
          >
            <NumberFieldLabel class="select-none">
              Tune Step Hz
            </NumberFieldLabel>
            <div class="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  const ctrl = props.controller;
                  ctrl.setTuneStep(
                    ctrl.tuneStepListHz.findLast((v) => v < ctrl.tuneStepHz) ??
                      ctrl.tuneStepListHz.at(0),
                  );
                }}
              >
                <MaterialSymbolsChevronLeft />
              </Button>
              <NumberFieldGroup class="select-none">
                <NumberFieldInput />
              </NumberFieldGroup>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  const ctrl = props.controller;
                  ctrl.setTuneStep(
                    ctrl.tuneStepListHz.find((v) => v > ctrl.tuneStepHz) ??
                      ctrl.tuneStepListHz.at(-1),
                  );
                }}
              >
                <MaterialSymbolsChevronRight />
              </Button>
            </div>
          </NumberField>

          <Select
            class="flex flex-col gap-2 select-none"
            value={preferences.sliceTxMeter}
            onChange={(value: SliceTxMeter) => {
              if (!value) return;
              if (value !== preferences.sliceTxMeter) {
                setPreferences("sliceTxMeter", value);
              }
            }}
            options={["power", "swr"]}
            itemComponent={(props) => (
              <SelectItem item={props.item}>
                {{ power: "Power", swr: "SWR" }[props.item.rawValue]}
              </SelectItem>
            )}
          >
            <SelectLabel>TX Meter</SelectLabel>
            <SelectTrigger>
              <SelectValue<string>>
                {(state) =>
                  ({ power: "Power", swr: "SWR" })[state.selectedOption()]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const RxAntennaSelect = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  return (
    <Select
      value={props.slice.rxAntenna}
      options={Array.from(props.slice.availableRxAntennas)}
      onChange={(v: string) => {
        if (!v || v === props.slice.rxAntenna) return;
        props.controller.setRxAntenna(v);
      }}
      itemComponent={(props) => (
        <SelectItem item={props.item}>
          {props.item.rawValue.replaceAll("_", " ")}
        </SelectItem>
      )}
    >
      <SelectTriggerPrimitive
        aria-label="RX Antenna"
        class="flex items-center text-blue-500 font-medium"
      >
        <SelectValue<string> class="textbox-trim-both textbox-edge-cap-alphabetic">
          {(state) => state.selectedOption().replaceAll("_", "\xA0")}
        </SelectValue>
      </SelectTriggerPrimitive>
      <SelectContent />
    </Select>
  );
};

const TxAntennaSelect = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  return (
    <Select
      value={props.slice.txAntenna}
      options={Array.from(props.slice.availableTxAntennas)}
      onChange={(v: string) => {
        if (!v || v === props.slice.txAntenna) return;
        props.controller.setTxAntenna(v);
      }}
      itemComponent={(props) => (
        <SelectItem item={props.item}>
          {props.item.rawValue.replaceAll("_", " ")}
        </SelectItem>
      )}
    >
      <SelectTriggerPrimitive
        aria-label="TX Antenna"
        class="flex items-center text-red-500 font-medium"
      >
        <SelectValue<string> class="textbox-trim-both textbox-edge-cap-alphabetic">
          {(state) => state.selectedOption()?.replaceAll("_", "\xA0") ?? "????"}
        </SelectValue>
      </SelectTriggerPrimitive>
      <SelectContent />
    </Select>
  );
};

const ModeControls = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const [rawMark, setRawMark] = createSignal(2125);
  const [rawShift, setRawShift] = createSignal(170);

  createEffect(() => setRawMark(props.slice.rttyMarkHz));
  createEffect(() => setRawShift(props.slice.rttyShiftHz));

  return (
    <Popover>
      <PopoverTrigger
        class="textbox-trim-both textbox-edge-cap-alphabetic"
        disabled={props.slice.diversityChild}
      >
        {props.slice.mode.padEnd(4, "\xA0")}
      </PopoverTrigger>
      <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
        <PopoverArrow />
        <div class="p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
          <ToggleGroup
            value={props.slice.mode}
            onChange={(mode: string) => {
              if (!mode || mode === props.slice.mode) return;
              props.controller.setMode(mode);
            }}
            class="grid grid-cols-4"
          >
            <For each={props.slice.modeList}>
              {(mode) => (
                <ToggleGroupItem
                  variant="outline"
                  size="sm"
                  // class="data-pressed:bg-primary data-pressed:text-primary-foreground"
                  value={mode}
                >
                  {mode}
                </ToggleGroupItem>
              )}
            </For>
          </ToggleGroup>

          <Show when={props.slice.mode === "RTTY"}>
            <Separator />
            <div class="grid grid-cols-2 gap-2">
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={rawMark()}
                format={false}
                minValue={0}
                maxValue={10_000}
                step={10}
                onRawValueChange={setRawMark}
                onFocusOut={() => props.controller.setRttyMark(rawMark())}
              >
                <NumberFieldLabel class="select-none">Mark Hz</NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={rawShift()}
                format={false}
                minValue={0}
                maxValue={10_000}
                step={10}
                onRawValueChange={setRawShift}
                onFocusOut={() => props.controller.setRttyShift(rawShift())}
              >
                <NumberFieldLabel class="select-none">
                  Shift Hz
                </NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
            </div>
          </Show>
          <Separator />
          <FilterControls slice={props.slice} controller={props.controller} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ExtraSliceControls = <T extends ValidComponent = "div">(
  props: PolymorphicProps<
    T,
    {
      slice: SliceState;
      controller: SliceController;
      class?: string | undefined;
    }
  >,
) => {
  const [local, others] = splitProps(props, ["slice", "controller", "class"]);

  return (
    <div
      class={cn(
        "grid grid-rows-4 py-1 gap-1 opacity-75 [&_svg]:pointer-events-none [&_svg]:h-full *:aspect-square",
        local.class,
      )}
      {...others}
    >
      <ToggleButton onChange={() => local.controller.close()}>
        <MdiClose />
      </ToggleButton>
      <ToggleButton
        class="data-pressed:text-yellow-500"
        pressed={props.slice.isLocked}
        onChange={(pressed) => local.controller.setLocked(pressed)}
      >
        <MdiLock />
      </ToggleButton>
      <ToggleButton
        class="data-pressed:text-red-500"
        pressed={local.slice.recordingEnabled}
        onChange={(pressed) => local.controller.setRecordingEnabled(pressed)}
      >
        <Dynamic
          component={local.slice.recordingEnabled ? MdiStop : MdiRecord}
        />
      </ToggleButton>
      <ToggleButton
        class="data-pressed:text-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        pressed={local.slice.playbackEnabled}
        disabled={!local.slice.playbackAvailable}
        onChange={(pressed) => local.controller.setPlaybackEnabled(pressed)}
      >
        <Dynamic component={local.slice.playbackEnabled ? MdiStop : MdiPlay} />
      </ToggleButton>
    </div>
  );
};

export function Slice(props: { slice: SliceState; pan: PanadapterState }) {
  const { radio, state } = useFlexRadio();
  const {
    pxToMHz,
    panadapterController,
    freqToX,
    mhzToAnchorPx,
    clientXToCellX,
    visibleInsets,
    settledInsets,
    isSliceDetached,
    sliceAnchorX,
    visualAnchorX,
    panadapterWrapperSize,
    panafallPortalRef,
  } = usePanafall();
  const sliceController = createMemo(() => radio()?.slice(props.slice.id));
  const [flag, setFlag] = createSignal<HTMLElement>();
  const [filterWidth, setFilterWidth] = createSignal(0);
  const [filterOffset, setFilterOffset] = createSignal(0);
  const [txFilterWidth, setTxFilterWidth] = createSignal(0);
  const [txFilterOffset, setTxFilterOffset] = createSignal(0);
  const [dragState, setDragState] = createStore({
    dragging: false,
    originX: 0,
    originFreq: 0,
    offset: 0,
    contain: 0,
  });
  const flagSize = createElementSize(flag);
  const { preferences } = usePreferences();
  const { runtime, setRuntime } = useRuntime();
  const { dispatch } = useControls();
  const [compactLayout, setCompactLayout] = createSignal(false);

  const splitParent = createMemo(() => {
    const split = runtime.split[props.slice.id];
    return split ? state.status.slice[split.parent] : null;
  });

  const splitChild = createMemo(() => {
    const split = runtime.split[props.slice.id];
    return split ? state.status.slice[split.child] : null;
  });

  const splitPartner = () => splitParent() || splitChild();

  const splitDisabled = createMemo(() => {
    if (!state.status.radio.availableSlices) {
      return !splitChild();
    }
    return props.slice.diversityChild;
  });

  const diversityParent = createMemo(() => {
    if (!props.slice.diversityChild) return;
    return state.status.slice[props.slice.diversityIndex.toString()];
  });

  const isActive = createMemo(() => {
    return diversityParent()?.isActive ?? props.slice.isActive;
  });

  const levelMeter = createMemo(() => {
    const sliceIndex = Number(props.slice.id);
    for (const meterId in state.status.meter) {
      const meter: MeterState = state.status.meter[meterId];
      if (
        meter &&
        meter.source === "SLC" &&
        meter.sourceIndex === sliceIndex &&
        meter.name === "LEVEL"
      ) {
        return meter;
      }
    }
  });

  // Effect-mirrored so flagSide never pairs a new center frequency with the
  // not-yet-rebased dragOffset (rebasing happens in a Panafall effect) —
  // that transient would latch a spurious side flip.
  const [anchorX, setAnchorX] = createSignal(0);
  createEffect(() => setAnchorX(visualAnchorX(props.slice)));

  // Hysteresis reducer: keeps the current side until the flag would poke past
  // a visible edge, then flips to whichever side has more room.
  const flagSide = createMemo<"left" | "right">((side) => {
    if (props.slice.diversityParent) return "left";
    if (props.slice.diversityChild) return "right";

    if (splitPartner()?.frequencyMHz > props.slice.frequencyMHz) return "left";
    if (splitPartner()?.frequencyMHz < props.slice.frequencyMHz) return "right";

    const width = panadapterWrapperSize.width ?? 0;
    if (!width) return side;
    const insets = settledInsets();
    const x = anchorX();
    const flagWidth = flagSize.width ?? 0;
    const visRight = width - insets.right;
    const flagLeft = side === "left" ? x - flagWidth : x;
    const flagRight = side === "left" ? x : x + flagWidth;
    if (flagLeft < insets.left || flagRight > visRight) {
      return visRight - x >= x - insets.left ? "right" : "left";
    }
    return side;
  }, "left");

  createPointerListeners({
    onMove({ x }) {
      if (!dragState.dragging) return;
      const localX = clientXToCellX(x);
      const newOffset = dragState.originX - localX;

      // Round frequency to the nearest step
      const step = props.slice.tuneStepHz / 1e6; // Convert Hz to MHz
      const freqUnrounded = dragState.originFreq - pxToMHz(newOffset);
      const freqSteps = Math.round(freqUnrounded / step);
      const freq = freqSteps * step;

      if (freq === props.slice.frequencyMHz) {
        return;
      }

      const insets = visibleInsets();
      const offsetX = localX - insets.left;
      const xPercent = offsetX / insets.width;
      if (xPercent < 0.05 || xPercent > 0.95) {
        setDragState({
          contain: freq < props.pan.centerFrequencyMHz ? -1 : 1,
        });
        return;
      }

      setDragState("contain", 0);
      sliceController().setFrequency(freq, false);
    },
    onUp() {
      setDragState({ dragging: false, contain: 0 });
    },
    onLeave() {
      setDragState({ dragging: false, contain: 0 });
    },
  });

  createEffect(() => {
    if (!dragState.contain) return;
    const pan = panadapterController();
    const slice = sliceController();
    const stepMHz = (slice.tuneStepHz / 1e6) * dragState.contain;
    const xOffsetPx = filterWidth() / 2;

    const interval = setInterval(() => {
      const newSliceFreq = slice.frequencyMHz + stepMHz;
      batch(() => {
        pan.setCenterFrequency(pan.centerFrequencyMHz + stepMHz);
        slice.setFrequency(newSliceFreq, false);
      });
      setDragState({
        originFreq: newSliceFreq,
        originX: freqToX(newSliceFreq) + xOffsetPx,
      });
    }, 20);
    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    const txFilterLow =
      props.slice.mode === "CW"
        ? -50
        : ["USB", "DIGU", "FDVU"].includes(props.slice.mode)
          ? state.status.radio.txFilterLowHz
          : -state.status.radio.txFilterHighHz;
    const txFilterHigh =
      props.slice.mode === "CW"
        ? 50
        : ["LSB", "DIGL", "FDVL", "RTTY"].includes(props.slice.mode)
          ? -state.status.radio.txFilterLowHz
          : state.status.radio.txFilterHighHz;

    batch(() => {
      setFilterWidth(
        mhzToAnchorPx(
          (props.slice.filterHighHz - props.slice.filterLowHz) / 1e6,
        ),
      );
      setFilterOffset(mhzToAnchorPx(props.slice.filterLowHz / 1e6));
      setTxFilterWidth(mhzToAnchorPx((txFilterHigh - txFilterLow) / 1e6));
      setTxFilterOffset(
        mhzToAnchorPx(
          (props.slice.mode === "RTTY"
            ? props.slice.rttyMarkHz + txFilterLow
            : txFilterLow) / 1e6,
        ),
      );
    });
  });

  const tuneSlice = async (hz: number) => {
    if (!Number.isFinite(hz)) {
      return;
    }
    const freqMhz = hz / 1e6;
    if (Math.abs(freqMhz - props.slice.frequencyMHz) < 1e-9) {
      return;
    }
    try {
      await sliceController()?.setFrequency(freqMhz);
    } catch {
      // Ignore errors; the UI will reflect the previous baseline frequency.
    }
  };

  const makeActive = async () => {
    if (isActive()) return;
    sliceController()?.setActive(true);
  };

  createEffect(() => {
    // we have to compute and set the tx offset since the radio doesn't do it for us.
    const ctrl = sliceController();
    if (!props.slice.mode.endsWith("FM")) {
      ctrl.setTxOffsetFrequency(0);
      return;
    }
    switch (props.slice.repeaterOffsetDirection) {
      case "UP":
        ctrl.setTxOffsetFrequency(Math.abs(props.slice.fmRepeaterOffsetMHz));
        break;
      case "DOWN":
        ctrl.setTxOffsetFrequency(-Math.abs(props.slice.fmRepeaterOffsetMHz));
        break;
      default:
        ctrl.setTxOffsetFrequency(0);
    }
  });

  return (
    <Show when={!isSliceDetached(props.slice)}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard activation is handled via focus on child controls */
      /* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard activation is handled via focus on child controls */}
      <div
        class="absolute inset-y-0 translate-x-(--slice-offset) z-(--z-cell-overlays)"
        classList={{
          "translate-z-1": isActive(),
          "pointer-events-auto": !props.slice.diversityChild,
        }}
        style={{
          "--slice-offset": `${sliceAnchorX(props.slice)}px`,
        }}
        onClick={makeActive}
      >
        <Show when={!props.slice.diversityChild}>
          <div
            class="absolute inset-y-0 pointer-coarse:w-10 -translate-x-1/2 touch-none"
            classList={{
              "cursor-grab": !dragState.dragging,
              "cursor-grabbing": dragState.dragging,
            }}
            onPointerDown={(event) => {
              setDragState({
                dragging: true,
                originX: clientXToCellX(event.clientX),
                originFreq: props.slice.frequencyMHz,
                offset: 0,
              });
              makeActive();
            }}
          >
            <div class="absolute inset-y-0 left-1/2">
              <Show
                when={
                  preferences.showTxFilterInPan && props.slice.isTransmitEnabled
                }
              >
                <div
                  class="absolute inset-y-0 overflow-clip translate-x-(--tx-filter-offset) w-(--tx-filter-width) bg-radial from-red-500/25 to-red-500/20"
                  style={{
                    "--tx-filter-width": `${txFilterWidth()}px`,
                    "--tx-filter-offset": `${txFilterOffset()}px`,
                  }}
                >
                  <div class="absolute inset-0 border-x border-x-background/40" />
                </div>
              </Show>
              <div
                class="absolute inset-y-0 overflow-clip translate-x-(--filter-offset) w-(--filter-width) bg-radial from-sky-500/35 to-sky-500/25"
                style={{
                  "--filter-width": `${filterWidth()}px`,
                  "--filter-offset": `${filterOffset()}px`,
                }}
              >
                <div class="absolute inset-0 border-x border-x-background/40" />
              </div>
            </div>
          </div>
        </Show>
        <div
          class="absolute inset-y-0 max-w-px w-px flex flex-col items-center m-auto top-0 pointer-events-none"
          classList={{
            "bg-yellow-300 z-10": props.slice.isActive,
            "bg-red-500 -z-10":
              !props.slice.isActive && !props.slice.diversityChild,
          }}
        >
          <Show when={props.slice.isActive}>
            <Triangle
              class="relative top-0"
              classList={{
                "bg-red-500 -z-10": props.slice.diversityChild,
                "bg-yellow-300": !props.slice.diversityChild,
              }}
            />
            <Show when={props.slice.diversityEnabled}>
              <Triangle
                class="relative -translate-y-1/2"
                classList={{
                  "bg-red-500 -z-10 -translate-z-1":
                    props.slice.diversityParent,
                  "bg-yellow-300": props.slice.diversityChild,
                }}
              />
            </Show>
          </Show>
        </div>
        <Portal mount={panafallPortalRef()}>
          <div
            class="absolute top-0 left-0 w-0 max-w-0 translate-x-(--flag-offset) overflow-visible"
            classList={{
              "z-(--z-cell-flags)": isActive(),
              "z-(--z-cell-overlays)": !isActive(),
            }}
            style={{
              "--flag-offset": `calc(var(--drag-offset) + ${sliceAnchorX(props.slice)}px)`,
            }}
          >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-events-none panel; onMouseDown only stops propagation from children, not user interaction */}
            <div
              class="absolute top-0 pt-1 pb-4 px-1 z-20 overflow-visible pointer-events-none w-max"
              classList={{
                "left-px": flagSide() === "right",
                "right-0": flagSide() === "left",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              ref={setFlag}
            >
              <Show
                when={!compactLayout()}
                fallback={
                  <div
                    class="flex items-center gap-1 flex-row-reverse"
                    classList={{
                      "flex-row-reverse": flagSide() === "right",
                    }}
                  >
                    <span class="font-mono font-normal text-xl text-shadow-black text-shadow-sm">
                      {(props.slice.frequencyMHz * 1_000_000).toLocaleString(
                        "de-DE",
                      )}
                    </span>
                    <div class="flex flex-col items-center pointer-events-auto text-xs border rounded-sm overflow-clip font-extrabold">
                      <ToggleButton
                        pressed={compactLayout()}
                        onChange={setCompactLayout}
                        class="flex justify-around items-center bg-blue-500 p-0.5 w-full"
                      >
                        <span class="textbox-edge-cap-alphabetic textbox-trim-both">
                          {props.slice.indexLetter}
                        </span>
                      </ToggleButton>
                      <Separator />
                      <ToggleButton
                        class="flex justify-center items-center p-0.5 text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground font-stretch-ultra-condensed"
                        pressed={props.slice.isTransmitEnabled}
                        onChange={(pressed) => {
                          sliceController().enableTransmit(pressed);
                        }}
                      >
                        <span class="leading-tight textbox-trim-both textbox-edge-cap-alphabetic">
                          TX
                        </span>
                      </ToggleButton>
                    </div>
                  </div>
                }
              >
                <div
                  class="flex gap-0.5 pointer-events-auto"
                  classList={{ "flex-row-reverse": flagSide() === "right" }}
                >
                  <Show when={!props.slice.diversityChild}>
                    <ExtraSliceControls
                      slice={props.slice}
                      controller={sliceController()}
                    />
                  </Show>
                  <div
                    class="h-fit border rounded-md overflow-hidden flex flex-col p-1.5 gap-1 pointer-events-auto text-sm font-mono drop-shadow-black fancy-bg-background"
                    classList={{
                      "drop-shadow-lg": isActive(),
                      "drop-shadow-md": !isActive(),
                    }}
                  >
                    <div
                      class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-md"
                      classList={{
                        "bg-background/25": !isActive(),
                      }}
                    />
                    <div class="flex justify-between items-center gap-1">
                      <RxAntennaSelect
                        slice={props.slice}
                        controller={sliceController()}
                      />
                      <TxAntennaSelect
                        slice={props.slice}
                        controller={sliceController()}
                      />
                      <SliceFilter
                        slice={props.slice}
                        controller={sliceController()}
                      />
                      <Show when={!splitParent()}>
                        <ToggleButton
                          disabled={splitDisabled()}
                          class="flex justify-center items-center h-4.5 px-1 rounded-sm text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                          pressed={Boolean(splitChild())}
                          onChange={(pressed) =>
                            dispatch({
                              target: "slice.split.enabled",
                              slice: props.slice.indexLetter as SliceSelector,
                              op: "set",
                              value: pressed,
                            })
                          }
                        >
                          <SplitIcon />
                        </ToggleButton>
                      </Show>
                      <Show when={splitParent()}>
                        <ToggleButton
                          class="flex justify-center items-center h-4.5 px-1 rounded-sm text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground"
                          pressed={Boolean(splitChild())}
                          onChange={() =>
                            dispatch({
                              target: "slice.split.swap",
                              slice: props.slice.indexLetter as SliceSelector,
                            })
                          }
                        >
                          <SwapIcon />
                        </ToggleButton>
                      </Show>
                      <ToggleButton
                        class="flex justify-center items-center h-4.5 font-extrabold px-1 rounded-sm text-muted-foreground data-pressed:bg-red-500 data-pressed:text-foreground"
                        pressed={props.slice.isTransmitEnabled}
                        onChange={(pressed) => {
                          sliceController().enableTransmit(pressed);
                        }}
                      >
                        <span class="leading-tight textbox-trim-both textbox-edge-cap-alphabetic">
                          TX
                        </span>
                      </ToggleButton>
                      <ToggleButton
                        pressed={compactLayout()}
                        onChange={setCompactLayout}
                        class="flex items-center bg-blue-500 h-4.5 px-1 rounded-sm"
                      >
                        <span class="font-extrabold textbox-edge-cap-alphabetic textbox-trim-both">
                          {props.slice.indexLetter}
                        </span>
                      </ToggleButton>
                    </div>
                    <Show when={!props.slice.diversityChild}>
                      <div class="flex justify-between items-center">
                        <ModeControls
                          slice={props.slice}
                          controller={sliceController()}
                        />
                        <FrequencyInput
                          class="text-right bg-transparent text-lg/tight font-mono"
                          size={14}
                          valueHz={Math.round(props.slice.frequencyMHz * 1e6)}
                          onCommit={tuneSlice}
                          // `on:touchstart` binds directly to the element
                          // (non-passive); the camelCase `onTouchStart` is
                          // delegated to document, where Chrome forces passive
                          // and preventDefault() is ignored. We need
                          // preventDefault to open the panel instead of
                          // focusing the input (which pops the soft keyboard).
                          // Fires only on touch, so mouse/pen keep inline edit.
                          on:touchstart={(event) => {
                            event.preventDefault();
                            makeActive();
                            setRuntime("tuningPanelOpen", true);
                          }}
                        />
                      </div>
                    </Show>
                    <div
                      classList={{
                        hidden:
                          props.slice.isTransmitEnabled &&
                          state.status.radio.interlockTxClientHandle ===
                            state.clientHandleInt,
                      }}
                    >
                      <LevelMeter
                        meter={levelMeter()}
                        compressionFactor={0.6}
                        compressionThreshold={-73}
                      />
                    </div>
                    <Show when={props.slice.isTransmitEnabled}>
                      <div
                        classList={{
                          hidden:
                            state.status.radio.interlockTxClientHandle !==
                            state.clientHandleInt,
                        }}
                      >
                        <TxMeter />
                      </div>
                    </Show>
                    <div class="grid grid-cols-5  text-xs h-3.5 font-medium justify-evenly *:flex *:justify-center *:items-center *:h-full *:basis-0 *:grow *:shrink *:min-w-0">
                      <AudioControls
                        slice={props.slice}
                        controller={sliceController()}
                      />
                      <OptDspControls
                        slice={props.slice}
                        controller={sliceController()}
                      />
                      <RitControls
                        slice={props.slice}
                        controller={sliceController()}
                      />
                      <DaxChannelSelect
                        slice={props.slice}
                        controller={sliceController()}
                      />
                      <SliceSettings
                        slice={props.slice}
                        controller={sliceController()}
                      />
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Portal>
      </div>
    </Show>
  );
}
