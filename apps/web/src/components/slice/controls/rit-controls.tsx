import type { SliceController } from "@repo/flexlib";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { SliderToggle } from "~/components/ui/slider-toggle";
import type { SliceState } from "~/context/flexradio";
import { SlicePopoverContent } from "./slice-popover-content";

export const RitControls = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  return (
    <Popover>
      <PopoverTrigger>
        <span class="textbox-trim-both textbox-edge-cap-alphabetic">RIT</span>
      </PopoverTrigger>
      <SlicePopoverContent>
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
      </SlicePopoverContent>
    </Popover>
  );
};
