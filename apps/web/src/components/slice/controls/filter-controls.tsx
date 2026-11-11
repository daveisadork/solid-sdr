import {
  filterPresetModeGroupFromSliceMode,
  type SliceController,
} from "@repo/flexlib";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "~/components/ui/number-field";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import {
  Slider,
  SliderFill,
  SliderThumb,
  SliderTrack,
} from "~/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import useFlexRadio, { type SliceState } from "~/context/flexradio";
import { SlicePopoverContent } from "./slice-popover-content";

const FILTER_MAX_HZ = 12_000;
const FILTER_MIN_HZ = -FILTER_MAX_HZ;

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
            onChange={(value) => {
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

export const SliceFilter = (props: {
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
      <SlicePopoverContent>
        <FilterControls slice={props.slice} controller={props.controller} />
      </SlicePopoverContent>
    </Popover>
  );
};
