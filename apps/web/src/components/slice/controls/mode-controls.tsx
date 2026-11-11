import type { SliceController } from "@repo/flexlib";
import { createEffect, createSignal, For, Show } from "solid-js";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "~/components/ui/number-field";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import type { SliceState } from "~/context/flexradio";
import { FilterControls } from "./filter-controls";

export const ModeControls = (props: {
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
            onChange={(mode) => {
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
