import { Trigger as SelectTriggerPrimitive } from "@kobalte/core/select";
import type { SliceController } from "@repo/flexlib";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "~/components/ui/select";
import type { SliceState } from "~/context/flexradio";

export const RxAntennaSelect = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  return (
    <Select
      value={props.slice.rxAntenna}
      options={Array.from(props.slice.availableRxAntennas)}
      onChange={(v) => {
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

export const TxAntennaSelect = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  return (
    <Select
      value={props.slice.txAntenna}
      options={Array.from(props.slice.availableTxAntennas)}
      onChange={(v) => {
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
