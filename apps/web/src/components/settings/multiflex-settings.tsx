import { For, Show } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { Checkbox } from "../ui/checkbox";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function MultiflexSettings() {
  const { radio, state } = useFlexRadio();

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>multiFLEX Dashboard</DialogTitle>
      </DialogHeader>
      <SimpleSwitch
        checked={state.status.radio.mfEnabled}
        onChange={(isChecked) => radio()?.setMfEnabled(isChecked)}
        label="Enable multiFLEX"
      />

      <Table class="whitespace-nowrap">
        <TableHeader sticky>
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
              const txSlice = () => {
                const sliceId = client.transmitSliceId;
                return sliceId != null
                  ? state.status.slice[sliceId]
                  : undefined;
              };
              return (
                <TableRow>
                  <TableCell>
                    <Checkbox
                      disabled={!client.isThisClient}
                      checked={client.isLocalPtt}
                      onChange={(checked) =>
                        radio()?.setLocalPttEnabled(checked)
                      }
                    />
                  </TableCell>
                  <TableCell>{client.station}</TableCell>
                  <TableCell>{txSlice()?.txAntenna}</TableCell>
                  <TableCell>
                    <Show when={txSlice()}>
                      {(slice) => `${slice().frequencyMHz} MHz`}
                    </Show>
                  </TableCell>
                </TableRow>
              );
            }}
          </For>
        </TableBody>
      </Table>
    </DialogContent>
  );
}
