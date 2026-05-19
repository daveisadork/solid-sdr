import { createSignal, For, Show } from "solid-js";

import type {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/solid-table";
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
} from "@tanstack/solid-table";
import IconDots from "~icons/mdi/dots-horizontal";
import IconChevronDown from "~icons/mdi/chevron-down";
import IconSelector from "~icons/mdi/chevron-up-down";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TextField, TextFieldInput } from "~/components/ui/text-field";
import useFlexRadio, { SpotState } from "~/context/flexradio";
import { Radio } from "@repo/flexlib";
import { SimpleSwitch } from "../ui/simple-switch";
import { usePreferences } from "~/context/preferences";
import { InfoItem } from "./common";
import { SimpleSlider } from "../ui/simple-slider";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export const columns: ColumnDef<SpotState>[] = [
  {
    id: "select",
    header: (props) => (
      <Checkbox
        checked={props.table.getIsAllPageRowsSelected()}
        indeterminate={props.table.getIsSomePageRowsSelected()}
        onChange={(value) => props.table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: (props) => (
      <Checkbox
        checked={props.row.getIsSelected()}
        onChange={(value) => props.row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "callsign",
    header: "Callsign",
    cell: (props) => (
      <div class="uppercase font-mono">{props.row.getValue("callsign")}</div>
    ),
  },
  {
    accessorKey: "rxFreqMHz",
    header: (props) => {
      return (
        <Button
          variant="ghost"
          onClick={() =>
            props.column.toggleSorting(props.column.getIsSorted() === "asc")
          }
        >
          RX Freq
          <IconSelector />
        </Button>
      );
    },
    cell: (props) => (
      <div class="lowercase font-mono">{props.row.getValue("rxFreqMHz")}</div>
    ),
  },
  {
    accessorKey: "amount",
    header: () => <div class="text-right">Amount</div>,
    cell: (props) => {
      const formatted = () => {
        const amount = parseFloat(props.row.getValue("amount"));
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
      };
      return <div class="text-right font-medium">{formatted()}</div>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: (props) => {
      return (
        <DropdownMenu placement="bottom-end">
          <DropdownMenuTrigger
            as={Button<"button">}
            variant="ghost"
            class="size-8 p-0"
          >
            <span class="sr-only">Open menu</span>
            <IconDots />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                navigator.clipboard.writeText(props.row.original.id)
              }
            >
              Copy payment ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View customer</DropdownMenuItem>
            <DropdownMenuItem>View payment details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function DataTableDemo() {
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    {},
  );
  const [rowSelection, setRowSelection] = createSignal({});
  const { state } = useFlexRadio();

  const table = createSolidTable({
    data: Object.values(state.status.spot),
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      get sorting() {
        return sorting();
      },
      get columnFilters() {
        return columnFilters();
      },
      get columnVisibility() {
        return columnVisibility();
      },
      get rowSelection() {
        return rowSelection();
      },
    },
  });

  return (
    <div class="w-full h-full">
      <div class="flex items-center py-4">
        <TextField
          value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
          onChange={(value) => table.getColumn("email")?.setFilterValue(value)}
        >
          <TextFieldInput placeholder="Filter emails..." class="max-w-sm" />
        </TextField>
        <DropdownMenu placement="bottom-end">
          <DropdownMenuTrigger
            as={Button<"button">}
            variant="outline"
            class="ml-auto"
          >
            Columns <IconChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <For
              each={table
                .getAllColumns()
                .filter((column) => column.getCanHide())}
            >
              {(column) => {
                return (
                  <DropdownMenuCheckboxItem
                    class="capitalize"
                    checked={column.getIsVisible()}
                    onChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              }}
            </For>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <TableRow>
                  <For each={headerGroup.headers}>
                    {(header) => {
                      return (
                        <TableHead>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    }}
                  </For>
                </TableRow>
              )}
            </For>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow data-state={row.getIsSelected() && "selected"}>
                  <For each={row.getVisibleCells()}>
                    {(cell) => (
                      <TableCell>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    )}
                  </For>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} class="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div class="flex items-center justify-end space-x-2 py-4">
        <div class="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div class="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

const FONT_SIZES = [
  "Extra Small",
  "Small",
  "Medium",
  "Large",
  "X Large",
  "2X Large",
  "3X Large",
  "4X Large",
  "5X Large",
  "6X Large",
  "7X Large",
  "8X Large",
  "9X Large",
];

function SpotsSettingsInner(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();

  return (
    <>
      <div class="flex flex-col gap-4">
        <SimpleSwitch
          checked={preferences.spots.enabled}
          onChange={(isChecked) =>
            setPreferences("spots", "enabled", isChecked)
          }
          label="Enable Spots"
        />
        <SimpleSlider
          minValue={1}
          maxValue={10}
          value={[preferences.spots.levels]}
          onChange={([value]) => setPreferences("spots", "levels", value)}
          getValueLabel={({ values }) => values[0].toString()}
          label="Levels"
        />
        <SimpleSlider
          minValue={0}
          maxValue={100}
          value={[preferences.spots.position]}
          onChange={([value]) => setPreferences("spots", "position", value)}
          getValueLabel={({ values }) => `${values[0]}%`}
          label="Position"
        />
        <SimpleSlider
          minValue={0}
          maxValue={100}
          value={[preferences.spots.verticalSpacing]}
          onChange={([value]) =>
            setPreferences("spots", "verticalSpacing", value)
          }
          getValueLabel={({ values }) => `${values[0]}%`}
          label="Vertical Spacing"
        />
        <SimpleSlider
          minValue={0}
          maxValue={FONT_SIZES.length - 1}
          value={[preferences.spots.fontSize]}
          onChange={([value]) => setPreferences("spots", "fontSize", value)}
          getValueLabel={({ values }) => FONT_SIZES[values[0]]}
          label="Font Size"
        />
        <InfoItem
          label="Total Spots"
          value={Object.keys(state.status.spot).length}
        />
      </div>
      <DialogFooter class="gap-2">
        <Button variant="destructive" onClick={() => props.radio.clearSpots()}>
          Clear All Spots
        </Button>
      </DialogFooter>
    </>
  );
}

export function SpotsSettings() {
  const { state, radio } = useFlexRadio();
  return (
    <DialogContent class="sm:max-w-sm text-sm">
      <DialogHeader>
        <DialogTitle>Spots</DialogTitle>
      </DialogHeader>
      <Show
        when={state.clientHandle}
        fallback={<div class="text-sm w-sm">Not Connected</div>}
      >
        <SpotsSettingsInner radio={radio()} />
      </Show>
    </DialogContent>
  );
}
