import { Trigger as SelectTriggerPrimitive } from "@kobalte/core/select";
import type { SliceController } from "@repo/flexlib";
import { Select, SelectContent, SelectItem } from "~/components/ui/select";
import useFlexRadio, { type SliceState } from "~/context/flexradio";

export const DaxChannelSelect = (props: {
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
      onChange={(v) => {
        if (v == null || v === props.slice.daxChannel) return;
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
