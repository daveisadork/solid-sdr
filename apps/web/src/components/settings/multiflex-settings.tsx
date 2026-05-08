import { SimpleSwitch } from "../ui/simple-switch";
import { createEffect, For, onCleanup } from "solid-js";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import useFlexRadio from "~/context/flexradio";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";

export function MultiflexSettings() {
  const { client, radio, state } = useFlexRadio();

  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
      <DialogHeader>
        <DialogTitle>multiFLEX Dashboard</DialogTitle>
      </DialogHeader>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <SimpleSwitch
          checked={state.status.radio.mfEnabled}
          onChange={(isChecked) => radio().setMfEnabled(isChecked)}
          label="Enable multiFLEX"
        />
        <Table class="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>Local PTT</TableHead>
              <TableHead>Station</TableHead>
              <TableHead>TX Antenna</TableHead>
              <TableHead>TX Freq</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={Object.values(state.status.guiClient)}>
              {(client) => {
                const txSlice = () =>
                  state.status.slice[client.transmitSliceId];
                return (
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        disabled={!client.isThisClient}
                        checked={client.isLocalPtt}
                        onChange={(checked) =>
                          radio().setLocalPttEnabled(checked)
                        }
                      />
                    </TableCell>
                    <TableCell>{client.station}</TableCell>
                    <TableCell>{txSlice()?.txAntenna}</TableCell>
                    <TableCell>
                      {txSlice() ? `${txSlice().frequencyMHz} MHz` : ""}
                    </TableCell>
                  </TableRow>
                );
              }}
            </For>
          </TableBody>
        </Table>
      </div>
    </DialogContent>
  );
}
