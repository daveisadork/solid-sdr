import { createMemo, createSignal, For, JSX, Show, splitProps } from "solid-js";

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
import IconChevronDown from "~icons/mdi/chevron-down";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import useFlexRadio, { MemoryState } from "~/context/flexradio";

import * as TextFieldPrimitive from "@kobalte/core/text-field";
import * as NumberFieldPrimitive from "@kobalte/core/number-field";
import * as SelectPrimitive from "@kobalte/core/select";
import { cn } from "~/lib/utils";
import { SelectContent, SelectItem } from "../ui/select";
import { ConfirmButton } from "../ui/confirm-button";
import IcBaselinePlayCircleOutline from "~icons/ic/baseline-play-circle-outline";
import { toneValues } from "../slice";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const TextFieldCell = (
  props: TextFieldPrimitive.TextFieldRootProps & {
    class?: JSX.ElementClass | undefined;
  },
) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <TextFieldPrimitive.Root class={cn("flex", local.class)} {...others}>
      <TextFieldPrimitive.Input class="field-sizing-content min-w-full px-1" />
    </TextFieldPrimitive.Root>
  );
};

const NumberFieldCell = (
  props: NumberFieldPrimitive.NumberFieldRootProps & {
    class?: JSX.ElementClass | undefined;
  },
) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <NumberFieldPrimitive.Root
      class={cn("flex", local.class)}
      format={false}
      changeOnWheel={false}
      {...others}
    >
      <NumberFieldPrimitive.Input class="field-sizing-content min-w-full px-1" />
    </NumberFieldPrimitive.Root>
  );
};

function MemorySettingsInner() {
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    {},
  );
  const [rowSelection, setRowSelection] = createSignal({});
  const { state, radio } = useFlexRadio();

  const modeList = createMemo(() => {
    return Array.from(
      Object.values(state.status.slice)[0]?.modeList ?? [
        "LSB",
        "USB",
        "AM",
        "CW",
        "DIGL",
        "DIGU",
        "SAM",
        "FM",
        "NFM",
        "DFM",
        "RTTY",
      ],
    );
  });

  const columns: ColumnDef<MemoryState>[] = [
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
      id: "activate",
      enableHiding: false,
      cell: (props) => {
        return (
          <Button
            class="size-6 p-0"
            onClick={() => radio().memory(props.row.original.id)?.apply()}
          >
            <IcBaselinePlayCircleOutline />
          </Button>
        );
      },
    },
    {
      accessorKey: "group",
      header: "Group",
      cell: (props) => (
        <TextFieldCell
          value={props.row.original.group}
          onChange={(value) =>
            radio().memory(props.row.original.id)?.setGroup(value)
          }
        />
      ),
    },
    {
      accessorKey: "owner",
      header: "Owner",
      cell: (props) => (
        <TextFieldCell
          value={props.row.original.owner}
          onChange={(value) =>
            radio().memory(props.row.original.id)?.setOwner(value)
          }
        />
      ),
    },
    {
      accessorKey: "frequencyMHz",
      header: "Frequency",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.frequencyMHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setFrequency(value)
          }
        />
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: (props) => (
        <TextFieldCell
          value={props.row.original.name}
          onChange={(value) =>
            radio().memory(props.row.original.id)?.setName(value)
          }
        />
      ),
    },
    {
      accessorKey: "mode",
      header: "Mode",
      cell: (props) => (
        <SelectPrimitive.Root
          options={modeList()}
          value={props.row.original.mode?.trim()}
          onChange={(value?: string) => {
            if (!value || value == props.row.original.mode) return;
            radio().memory(props.row.original.id)?.setMode(value);
          }}
          itemComponent={(props) => {
            return (
              <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
            );
          }}
        >
          <SelectPrimitive.Trigger class="w-full">
            <SelectPrimitive.Value<string>>
              {(state) =>
                state.selectedOption() ?? `${props.row.original.mode}⚠`
              }
            </SelectPrimitive.Value>
          </SelectPrimitive.Trigger>

          <SelectContent />
        </SelectPrimitive.Root>
      ),
    },
    {
      accessorKey: "stepHz",
      header: "Step",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.stepHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setStep(value)
          }
        />
      ),
    },
    {
      accessorKey: "repeaterOffsetDirection",
      header: "FM TX Offset Direction",
      cell: (props) => (
        <SelectPrimitive.Root
          options={["DOWN", "SIMPLEX", "UP"]}
          value={props.row.original.repeaterOffsetDirection}
          onChange={(value?: string) => {
            if (!value || value == props.row.original.repeaterOffsetDirection)
              return;
            radio()
              .memory(props.row.original.id)
              ?.setRepeaterOffsetDirection(value);
          }}
          itemComponent={(props) => {
            return (
              <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
            );
          }}
        >
          <SelectPrimitive.Trigger>
            <SelectPrimitive.Value<string>>
              {(state) => state.selectedOption()}
            </SelectPrimitive.Value>
          </SelectPrimitive.Trigger>

          <SelectContent />
        </SelectPrimitive.Root>
      ),
    },
    {
      accessorKey: "repeaterOffsetMHz",
      header: "Repeater Offset",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.repeaterOffsetMHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setRepeaterOffset(value)
          }
        />
      ),
    },
    {
      accessorKey: "fmToneMode",
      header: "Tone Mode",
      cell: (props) => (
        <SelectPrimitive.Root
          options={["OFF", "CTCSS_TX"]}
          value={props.row.original.fmToneMode}
          onChange={(value?: string) => {
            if (!value || value == props.row.original.fmToneMode) return;
            radio().memory(props.row.original.id)?.setFmToneMode(value);
          }}
          itemComponent={(props) => {
            return (
              <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
            );
          }}
        >
          <SelectPrimitive.Trigger>
            <SelectPrimitive.Value<string>>
              {(state) => state.selectedOption()}
            </SelectPrimitive.Value>
          </SelectPrimitive.Trigger>

          <SelectContent />
        </SelectPrimitive.Root>
      ),
    },
    {
      accessorKey: "fmToneValue",
      header: "Tone Value",
      cell: (props) => (
        <SelectPrimitive.Root
          options={toneValues.map((v) => v.hz)}
          value={props.row.original.fmToneValue}
          onChange={(value?: string) => {
            if (!value || value == props.row.original.fmToneValue) return;
            radio().memory(props.row.original.id)?.setFmToneMode(value);
          }}
          itemComponent={(props) => (
            <SelectItem item={props.item} class="font-mono">
              {toneValues
                .find((v) => v.hz === props.item.rawValue)
                ?.name.replaceAll(" ", "\xA0") || "None"}
            </SelectItem>
          )}
        >
          <SelectPrimitive.Trigger aria-label="FM Tone Value">
            <SelectPrimitive.Value<string>>
              {(state) => state.selectedOption()}
            </SelectPrimitive.Value>
          </SelectPrimitive.Trigger>
          <SelectContent />
        </SelectPrimitive.Root>
      ),
    },
    {
      accessorKey: "squelchEnabled",
      header: "Squelch",
      cell: (props) => (
        <Checkbox
          checked={props.row.original.squelchEnabled}
          onChange={(enabled) =>
            radio().memory(props.row.original.id)?.setSquelchEnabled(enabled)
          }
          aria-label="Select row"
        />
      ),
    },
    {
      accessorKey: "squelchLevel",
      header: "Squelch Level",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.squelchLevel}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setSquelchLevel(value)
          }
        />
      ),
    },
    {
      accessorKey: "filterLowHz",
      header: "RX Filter Low",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.filterLowHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setFilterLow(value)
          }
        />
      ),
    },
    {
      accessorKey: "filterHighHz",
      header: "RX Filter High",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.filterHighHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setFilterHigh(value)
          }
        />
      ),
    },
    {
      accessorKey: "rttyMarkHz",
      header: "RTTY Mark",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.rttyMarkHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setRttyMark(value)
          }
        />
      ),
    },
    {
      accessorKey: "rttyShiftHz",
      header: "RTTY Shift",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.rttyShiftHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setRttyShift(value)
          }
        />
      ),
    },
    {
      accessorKey: "diglOffsetHz",
      header: "DIGL Offset",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.diglOffsetHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setDiglOffset(value)
          }
        />
      ),
    },
    {
      accessorKey: "diguOffsetHz",
      header: "DIGU Offset",
      cell: (props) => (
        <NumberFieldCell
          rawValue={props.row.original.diguOffsetHz}
          onRawValueChange={(value) =>
            radio().memory(props.row.original.id)?.setDiguOffset(value)
          }
        />
      ),
    },
  ];

  const table = createMemo(() =>
    createSolidTable({
      data: Object.values(state.status.memory),
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
    }),
  );

  return (
    <>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-hidden shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <div class="flex items-center">
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
                each={table()
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
                      {column.columnDef.header.toString() ?? column.id}
                    </DropdownMenuCheckboxItem>
                  );
                }}
              </For>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div class="relative rounded-md border shrink overflow-hidden flex flex-col">
          <Table class="shrink">
            <TableHeader>
              <For each={table().getHeaderGroups()}>
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
              {table().getRowModel().rows?.length ? (
                table()
                  .getRowModel()
                  .rows.map((row) => (
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
        <div class="flex items-center justify-end space-x-2">
          <div class="flex-1 text-sm text-muted-foreground">
            {table().getFilteredSelectedRowModel().rows.length} of{" "}
            {table().getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div class="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table().previousPage()}
              disabled={!table().getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table().nextPage()}
              disabled={!table().getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <ConfirmButton
          variant="destructive"
          disabled={table().getSelectedRowModel().rows.length === 0}
          onConfirm={() => {
            Promise.all(
              table()
                .getSelectedRowModel()
                .flatRows.map((mem) =>
                  radio().memory(mem.original.id).remove(),
                ),
            ).then(() => table().setRowSelection({}));
          }}
        >
          Delete Selected
        </ConfirmButton>
        <Button
          onClick={() => {
            console.log("Creating memory");
            radio().createMemory().catch(console.error);
          }}
        >
          Add New
        </Button>
      </DialogFooter>
    </>
  );
}

export function MemorySettings() {
  const { state } = useFlexRadio();
  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden sm:max-w-10/12 sm:w-auto">
      <DialogHeader>
        <DialogTitle>Memory Settings</DialogTitle>
      </DialogHeader>
      <Show
        when={state.clientHandle}
        fallback={<div class="text-sm w-sm">Not Connected</div>}
      >
        <MemorySettingsInner />
      </Show>
    </DialogContent>
  );
}
