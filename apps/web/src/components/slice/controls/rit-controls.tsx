import type { SliceController } from "@repo/flexlib";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { SliderToggle } from "~/components/ui/slider-toggle";
import type { SliceState } from "~/context/flexradio";

export const RitControls = (props: {
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
