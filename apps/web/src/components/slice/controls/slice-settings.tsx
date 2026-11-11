import type { SliceController } from "@repo/flexlib";
import { Button } from "~/components/ui/button";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldLabel,
} from "~/components/ui/number-field";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { SliceState } from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import MaterialSymbolsChevronLeft from "~icons/material-symbols/chevron-left";
import MaterialSymbolsChevronRight from "~icons/material-symbols/chevron-right";
import MdiSettings from "~icons/mdi/settings";
import { SlicePopoverContent } from "./slice-popover-content";

export const SliceSettings = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const { preferences, setPreferences } = usePreferences();
  return (
    <Popover>
      <PopoverTrigger>
        <MdiSettings />
      </PopoverTrigger>
      <SlicePopoverContent>
        <NumberField
          class="flex flex-col gap-2 select-none"
          rawValue={props.slice.tuneStepHz}
          format={false}
          minValue={1}
          maxValue={1_000_000}
          onRawValueChange={(v) => props.controller.setTuneStep(v)}
        >
          <NumberFieldLabel class="select-none">Tune Step Hz</NumberFieldLabel>
          <div class="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                const ctrl = props.controller;
                ctrl.setTuneStep(
                  ctrl.tuneStepListHz.findLast((v) => v < ctrl.tuneStepHz) ??
                    ctrl.tuneStepListHz.at(0) ??
                    ctrl.tuneStepHz,
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
                    ctrl.tuneStepListHz.at(-1) ??
                    ctrl.tuneStepHz,
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
          onChange={(value) => {
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
      </SlicePopoverContent>
    </Popover>
  );
};
