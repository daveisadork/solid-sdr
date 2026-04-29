import {
  FillStyle,
  MidiMapping,
  MidiSource,
  PanadapterSettingsStyle,
  PeakStyle,
  usePreferences,
} from "../../context/preferences";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import MdiSettings from "~icons/mdi/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "../ui/segmented-control";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useColorMode } from "@kobalte/core";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/text-field";
import useFlexRadio from "~/context/flexradio";
import { ParsedMessage, parseMidiMessage } from "../midi-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ReactiveMap } from "@solid-primitives/map";
import { createMIDIAccess, createMIDIPorts } from "~/lib/midi";
import { Timeline } from "../ui/timeline";
import SvgSpinners180Ring from "~icons/svg-spinners/180-ring";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  CONTROL_DEFINITIONS,
  CONTROL_REGISTRY,
  ControlOp,
} from "~/context/controls";

const KINDS: Record<number, MidiSource["kind"]> = {
  8: "note",
  9: "note",
  11: "cc",
  14: "pitchBend",
};

function eventToSource(event: MIDIMessageEvent): MidiSource | null {
  const parsed = parseMidiMessage(event);
  const kind = KINDS[parsed.command];
  const base = {
    device: (event.target as MIDIInput).id,
    channel: parsed.channel,
  };
  switch (kind) {
    case "note":
      return { ...base, kind, note: parsed.note };
    case "cc":
      return { ...base, kind, controller: parsed.note };
    case "pitchBend":
      return { ...base, kind };
    default:
      return null;
  }
}

const sourceToString = (source: MidiSource): string => {
  switch (source.kind) {
    case "note":
      return `Ch ${source.channel + 1} Note ${source.note}`;
    case "cc":
      return `Ch ${source.channel + 1} CC ${source.controller}`;
    case "pitchBend":
      return `Ch ${source.channel + 1} Pitch Bend`;
  }
};

function AddMappingDialog() {
  const { preferences, setPreferences } = usePreferences();
  const [capturedEvent, setCapturedEvent] =
    createSignal<MIDIMessageEvent | null>(null);
  const [source, setSource] = createSignal<MidiSource | null>(null);
  const [open, setOpen] = createSignal(false);
  const [target, setTarget] = createSignal<
    keyof typeof CONTROL_REGISTRY | null
  >(null);
  const [action, setAction] = createSignal<MidiMapping["action"] | null>(null);
  const [options, setOptions] = createSignal<MidiMapping["options"] | null>(
    null,
  );
  const [operation, setOperation] = createSignal<ControlOp>();

  const ports = createMIDIPorts();
  const control = () => CONTROL_REGISTRY[target()];

  createEffect(() => {
    const event = capturedEvent();
    setSource(event ? eventToSource(event) : null);
  });

  createEffect(() => {
    if (!open()) setCapturedEvent(null);
  });

  createEffect(() => {
    if (!open()) return;
    if (capturedEvent()) return;
    const inputs = ports.inputs.values().toArray();
    inputs.forEach((input) => {
      console.log("Adding event listener to", input.name);
      input.addEventListener("midimessage", setCapturedEvent, { once: true });
    });
    onCleanup(() => {
      inputs.forEach((input) => {
        console.log("Removing event listener from", input.name);
        input.removeEventListener("midimessage", setCapturedEvent);
      });
    });
  });

  const activeItem = createMemo(() => {
    if (!source()) return 0;
    if (!control()) return 1;
    if (!action()) return 2;
    return 3;
  });

  const validActions = createMemo(() => {
    switch (source()?.kind) {
      case "cc":
      case "pitchBend":
        return CONTROL_DEFINITIONS.filter((control) =>
          [
            "relative-step",
            "normalized",
            "signed-normalized",
            "bandwidth-scale",
          ].includes(control.editor.kind),
        ).map((control) => control.target);
      case "note":
        return CONTROL_DEFINITIONS.filter((control) =>
          ["boolean", "command", "choice", "relative-step"].includes(
            control.editor.kind,
          ),
        ).map((control) => control.target);
      default:
        return [];
    }
  });

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <DialogTrigger>Add Mapping</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Mapping</DialogTitle>
        </DialogHeader>
        <Timeline
          activeItem={activeItem()}
          items={[
            {
              title: <div class="inline-flex gap-1">MIDI Input</div>,
              description: (
                <Show
                  when={source()}
                  fallback={
                    <div class="inline-flex gap-1">
                      <SvgSpinners180Ring /> Waiting for Input...
                    </div>
                  }
                >
                  {(message) => {
                    const msg = message();
                    return (
                      <div>
                        {ports.inputs.get(msg.device).name}{" "}
                        {sourceToString(msg)}
                      </div>
                    );
                  }}
                </Show>
              ),
            },
            {
              title: "Target Control",
              description: (
                <Select
                  value={target()}
                  onChange={setTarget}
                  options={validActions()}
                  placeholder="Select Control..."
                  class="pt-2"
                  itemComponent={(props) => {
                    return (
                      <SelectItem item={props.item}>
                        {
                          CONTROL_REGISTRY[
                            props.item.rawValue as keyof typeof CONTROL_REGISTRY
                          ].label
                        }
                      </SelectItem>
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue<keyof typeof CONTROL_REGISTRY>>
                      {(state) =>
                        CONTROL_REGISTRY[state.selectedOption()].label
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              ),
            },
            {
              title: "Configuration",
              description: (
                <Show when={control()}>
                  {(control) => (
                    <div class="flex-col gap-2 pt-1">
                      <Show when={control().ops.length > 1}>
                        <SegmentedControl
                          value={operation()}
                          onChange={setOperation}
                        >
                          <SegmentedControlLabel>
                            Operation
                          </SegmentedControlLabel>
                          <SegmentedControlGroup>
                            <SegmentedControlIndicator />
                            <SegmentedControlItemsList>
                              <For each={control().ops}>
                                {(op) => (
                                  <SegmentedControlItem value={op}>
                                    <SegmentedControlItemLabel class="capitalize">
                                      {op}
                                    </SegmentedControlItemLabel>
                                  </SegmentedControlItem>
                                )}
                              </For>
                            </SegmentedControlItemsList>
                          </SegmentedControlGroup>
                        </SegmentedControl>
                      </Show>
                    </div>
                  )}
                </Show>
              ),
            },
          ]}
        />
        <DialogFooter>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MidiSettingsInner() {
  const { preferences, setPreferences } = usePreferences();
  const { setColorMode } = useColorMode();
  const { radio, state } = useFlexRadio();
  const [lastCommand, setLastCommand] = createSignal("");
  const ports = createMIDIPorts();

  function onMessage(this: MIDIInput, message: MIDIMessageEvent) {
    setLastCommand(sourceToString(eventToSource(message)));
  }

  createEffect(() => {
    const inputs = ports.inputs.values().toArray();
    inputs.forEach((input) => {
      console.log("Adding event listener to", input.name);
      input.addEventListener("midimessage", onMessage);
    });
    onCleanup(() => {
      inputs.forEach((input) => {
        console.log("Removing event listener from", input.name);
        input.removeEventListener("midimessage", onMessage);
      });
    });
  });
  return (
    <div class="flex flex-col gap-4 text-sm">
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>MIDI Controller Settings</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <span>{lastCommand()}</span>
          <Table class="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Event</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={preferences.midiMappings}>
                {(mapping) => (
                  <TableRow>
                    <TableCell>{mapping.action.target}</TableCell>
                    <TableCell>{mapping.options.mode}</TableCell>
                    <TableCell>{mapping.midi.device}</TableCell>
                    <TableCell>{sourceToString(mapping.midi)}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <AddMappingDialog />
        </CardFooter>
      </Card>
    </div>
  );
}

export function MidiSettings() {
  return (
    <Show
      when={navigator.requestMIDIAccess}
      fallback={
        <Card class="bg-transparent">
          <CardHeader>
            <CardTitle>Not supported in this browser</CardTitle>
          </CardHeader>
        </Card>
      }
    >
      <MidiSettingsInner />
    </Show>
  );
}
