import {
  type MidiMapping,
  type MidiSource,
  usePreferences,
} from "../../context/preferences";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
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
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/text-field";
import { SimpleSwitch } from "../ui/simple-switch";
import useFlexRadio from "~/context/flexradio";
import { parseMidiMessage } from "../midi-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { createMIDIPorts } from "~/lib/midi";
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
import { BANDS } from "~/components/panafall/settings";
import {
  CONTROL_DEFINITIONS,
  CONTROL_REGISTRY,
  type ControlOp,
  type SliceSelector,
} from "~/context/controls";
import * as ButtonPrimitive from "@kobalte/core/button";
import BaselineDelete from "~icons/ic/baseline-delete";

type ControlTarget = keyof typeof CONTROL_REGISTRY;
type SliceOption = "active" | SliceSelector;
type TriggerKind = "press" | "release";
type RelativeEncoding = "offset-binary" | "twos-complement";
type StepDirection = "1" | "-1";
type ChoiceOption = { key: string; label: string; value: string | number };
type ChoiceHelpers = {
  getSlice: (selector?: SliceSelector) => unknown;
  getBandList: () => readonly string[];
  getSelectableSlices: () => readonly SliceSelector[];
};

const KINDS: Record<number, MidiSource["kind"]> = {
  8: "note",
  9: "note",
  11: "cc",
  14: "pitchBend",
};

const SLICE_OPTIONS: readonly SliceOption[] = [
  "active",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
];

const TRIGGER_OPTIONS: readonly TriggerKind[] = ["press", "release"];
const RELATIVE_ENCODINGS: readonly RelativeEncoding[] = [
  "offset-binary",
  "twos-complement",
];
const BOOLEAN_VALUES = [
  { value: "true", label: "On" },
  { value: "false", label: "Off" },
] as const;
const BANDWIDTH_DIRECTIONS = [
  { value: "increase", label: "Increase" },
  { value: "decrease", label: "Decrease" },
] as const;
const STEP_DIRECTIONS = [
  { value: "1", label: "Increase" },
  { value: "-1", label: "Decrease" },
] as const;

function eventToSource(event: MIDIMessageEvent): MidiSource | null {
  const { command, channel, port, id } = parseMidiMessage(event);
  const kind = KINDS[command];
  switch (kind) {
    case "pitchBend":
      return { port, channel, kind, id: null };
    case "cc":
    case "note":
      return { port, channel, kind, id };
    default:
      return null;
  }
}

const sourceToString = (source: MidiSource): string => {
  switch (source.kind) {
    case "note":
      return `Ch ${source.channel + 1} Note ${source.id}`;
    case "cc":
      return `Ch ${source.channel + 1} CC ${source.id}`;
    case "pitchBend":
      return `Ch ${source.channel + 1} Pitch Bend`;
  }
};

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function controlUsesSliceSelector(target: ControlTarget | null) {
  if (!target) return false;
  const control = CONTROL_REGISTRY[target];
  return control.scope !== "radio" && control.target !== "slice.select";
}

function getChoiceValues(
  target: ControlTarget,
  helpers: ChoiceHelpers,
  slice?: SliceSelector,
) {
  const definition = CONTROL_REGISTRY[target];
  if (definition.editor.kind !== "choice") return [] as const;

  const editor = definition.editor as {
    kind: "choice";
    getChoices: (
      ctx: ChoiceHelpers,
      action?: { target: ControlTarget; slice?: SliceSelector },
    ) => readonly (string | number)[];
  };

  const action =
    controlUsesSliceSelector(target) && slice ? { target, slice } : { target };

  return editor.getChoices(helpers, action);
}

function defaultOperation(
  target: ControlTarget,
  sourceKind: MidiSource["kind"],
): ControlOp | undefined {
  const control = CONTROL_REGISTRY[target];
  if (control.ops.length === 0) return undefined;

  if (sourceKind === "note") {
    if (control.editor.kind === "boolean" && control.ops.includes("toggle")) {
      return "toggle";
    }
    if (control.editor.kind === "choice" && control.ops.includes("cycle")) {
      return "cycle";
    }
  }

  if (
    (sourceKind === "cc" || sourceKind === "pitchBend") &&
    (control.editor.kind === "normalized" ||
      control.editor.kind === "signed-normalized") &&
    control.ops.includes("set")
  ) {
    return "set";
  }

  return control.ops[0];
}

function AddMappingDialog() {
  const { setPreferences } = usePreferences();
  const { radio, state } = useFlexRadio();
  const ports = createMIDIPorts();

  const [open, setOpen] = createSignal(false);
  const [capturedEvent, setCapturedEvent] =
    createSignal<MIDIMessageEvent | null>(null);
  const [target, setTarget] = createSignal<ControlTarget | null>(null);
  const [operation, setOperation] = createSignal<ControlOp | undefined>();
  const [scopeSelector, setScopeSelector] = createSignal<SliceOption>("active");
  const [booleanValue, setBooleanValue] = createSignal<"true" | "false">(
    "true",
  );
  const [choiceValue, setChoiceValue] = createSignal<string>();
  const [trigger, setTrigger] = createSignal<TriggerKind>("press");
  const [relativeEncoding, setRelativeEncoding] =
    createSignal<RelativeEncoding>("offset-binary");
  const [invert, setInvert] = createSignal(false);
  const [scale, setScale] = createSignal("1");
  const [minimum, setMinimum] = createSignal("0");
  const [maximum, setMaximum] = createSignal("1");
  const [threshold, setThreshold] = createSignal("64");
  const [momentary, setMomentary] = createSignal(true);
  const [stepDirection, setStepDirection] = createSignal<StepDirection>("1");
  const [bandwidthChange, setBandwidthChange] = createSignal<
    "increase" | "decrease"
  >("increase");
  const [bandwidthFactor, setBandwidthFactor] = createSignal("0.25");

  const source = createMemo(() => {
    const event = capturedEvent();
    return event ? eventToSource(event) : null;
  });

  const control = createMemo(() => {
    const value = target();
    return value ? CONTROL_REGISTRY[value] : undefined;
  });

  const selectedSlice = createMemo(() => {
    const value = scopeSelector();
    return value === "active" ? undefined : value;
  });

  const sliceIdsBySelector = createMemo(() => {
    const map = new Map<SliceSelector, string>();

    for (const slice of Object.values(state.status.slice)) {
      if (!slice.isInUse || !slice.indexLetter) continue;
      map.set(slice.indexLetter as SliceSelector, slice.id);
    }

    return map;
  });

  const activeSlice = createMemo(() => {
    const slice = Object.values(state.status.slice).find(
      (entry) =>
        entry.clientHandle === state.clientHandleInt &&
        entry.isInUse &&
        entry.isActive,
    );

    if (!slice) return undefined;
    return radio()?.slice(slice.id);
  });

  const getSlice = (selector?: SliceSelector) => {
    if (!selector) return activeSlice();

    const id = sliceIdsBySelector().get(selector);
    if (!id) return undefined;
    return radio()?.slice(id);
  };

  const getSelectableSlices = createMemo(() =>
    Object.values(state.status.slice)
      .filter(
        (slice) =>
          slice.clientHandle === state.clientHandleInt &&
          slice.isInUse &&
          slice.indexLetter,
      )
      .map((slice) => slice.indexLetter as SliceSelector),
  );

  const getBandList = createMemo(() => [
    ...BANDS.map((band) => band.id),
    ...Object.keys(state.status.xvtr),
  ]);

  const choiceOptions = createMemo(() => {
    const definition = control();
    if (!definition || definition.editor.kind !== "choice") return [];

    const values = getChoiceValues(
      definition.target,
      {
        getSlice,
        getBandList,
        getSelectableSlices,
      },
      selectedSlice(),
    );

    return values.map((value) => ({
      key: String(value),
      label: String(value),
      value,
    }));
  });

  const validTargets = createMemo<ControlTarget[]>(() => {
    switch (source()?.kind) {
      case "cc":
      case "pitchBend":
        return CONTROL_DEFINITIONS.filter((definition) =>
          [
            "relative-step",
            "normalized",
            "signed-normalized",
            "bandwidth-scale",
          ].includes(definition.editor.kind),
        )
          .map((definition) => definition.target)
          .toSorted((a, b) =>
            CONTROL_REGISTRY[a].label.localeCompare(CONTROL_REGISTRY[b].label),
          );
      case "note":
        return CONTROL_DEFINITIONS.filter((definition) =>
          ["boolean", "command", "choice", "relative-step"].includes(
            definition.editor.kind,
          ),
        )
          .map((definition) => definition.target)
          .toSorted((a, b) =>
            CONTROL_REGISTRY[a].label.localeCompare(CONTROL_REGISTRY[b].label),
          );
      default:
        return [];
    }
  });

  const draftMapping = createMemo((): MidiMapping | null => {
    const midi = source();
    const definition = control();
    if (!midi || !definition) return null;

    const base =
      controlUsesSliceSelector(definition.target) && selectedSlice()
        ? { slice: selectedSlice() }
        : {};
    const currentOperation =
      definition.ops.length > 0 ? operation() : undefined;
    const direction = parseNumber(stepDirection(), 1);

    switch (definition.editor.kind) {
      case "command":
        return {
          midi,
          action: {
            target: definition.target,
            ...base,
          } as MidiMapping["action"],
          options: { mode: "trigger", trigger: trigger() },
        } as MidiMapping;

      case "boolean":
        if (currentOperation === "toggle") {
          return {
            midi,
            action: {
              target: definition.target,
              op: "toggle",
              ...base,
            } as MidiMapping["action"],
            options: { mode: "trigger", trigger: trigger() },
          } as MidiMapping;
        }

        if (currentOperation === "set") {
          return {
            midi,
            action: {
              target: definition.target,
              op: "set",
              value: booleanValue() === "true",
              ...base,
            } as MidiMapping["action"],
            options: {
              mode: "gate",
              threshold: parseNumber(threshold(), 64),
              momentary: momentary(),
            },
          } as MidiMapping;
        }

        return null;

      case "relative-step":
        if (currentOperation !== "adjust" && currentOperation !== "cycle") {
          return null;
        }

        return {
          midi,
          action: {
            target: definition.target,
            op: currentOperation,
            delta: direction,
            ...base,
          } as MidiMapping["action"],
          options: {
            mode: "relative",
            encoding: relativeEncoding(),
            scale: parseNumber(scale(), 1),
            invert: invert(),
          },
        } as MidiMapping;

      case "normalized":
        if (currentOperation === "adjust") {
          return {
            midi,
            action: {
              target: definition.target,
              op: "adjust",
              delta: direction,
              ...base,
            } as MidiMapping["action"],
            options: {
              mode: "relative",
              encoding: relativeEncoding(),
              scale: parseNumber(scale(), 1),
              invert: invert(),
            },
          } as MidiMapping;
        }

        if (currentOperation === "set") {
          return {
            midi,
            action: {
              target: definition.target,
              op: "set",
              value: 1,
              ...base,
            } as MidiMapping["action"],
            options: {
              mode: "absolute",
              min: parseNumber(minimum(), 0),
              max: parseNumber(maximum(), 1),
              invert: invert(),
            },
          } as MidiMapping;
        }

        return null;

      case "signed-normalized":
        if (currentOperation === "adjust") {
          return {
            midi,
            action: {
              target: definition.target,
              op: "adjust",
              delta: direction,
              ...base,
            } as MidiMapping["action"],
            options: {
              mode: "relative",
              encoding: relativeEncoding(),
              scale: parseNumber(scale(), 1),
              invert: invert(),
            },
          } as MidiMapping;
        }

        if (currentOperation === "set") {
          return {
            midi,
            action: {
              target: definition.target,
              op: "set",
              value: 0,
              ...base,
            } as MidiMapping["action"],
            options: {
              mode: "absolute",
              min: parseNumber(minimum(), -1),
              max: parseNumber(maximum(), 1),
              invert: invert(),
            },
          } as MidiMapping;
        }

        return null;

      case "choice":
        if (currentOperation === "cycle") {
          const options =
            midi.kind === "note"
              ? undefined
              : {
                  mode: "relative" as const,
                  encoding: relativeEncoding(),
                  scale: parseNumber(scale(), 1),
                  invert: invert(),
                };

          return {
            midi,
            action: {
              target: definition.target,
              op: "cycle",
              delta: direction,
              ...base,
            } as MidiMapping["action"],
            ...(options ? { options } : {}),
          } as MidiMapping;
        }

        if (currentOperation === "set") {
          const selected = choiceOptions().find(
            (option) => option.key === choiceValue(),
          );
          if (!selected) return null;

          return {
            midi,
            action: {
              target: definition.target,
              op: "set",
              value: selected.value,
              ...base,
            } as MidiMapping["action"],
            options: { mode: "trigger", trigger: trigger() },
          } as MidiMapping;
        }

        return null;

      case "bandwidth-scale":
        return {
          midi,
          action: {
            target: definition.target,
            change: bandwidthChange(),
            factor: parseNumber(bandwidthFactor(), 0.25),
            ...base,
          } as MidiMapping["action"],
          options: {
            mode: "relative",
            factor: parseNumber(bandwidthFactor(), 0.25),
          },
        } as MidiMapping;
    }
  });

  const activeItem = createMemo(() => {
    if (!source()) return 0;
    if (!target()) return 1;
    return draftMapping() ? 3 : 2;
  });

  createEffect(() => {
    if (!open()) {
      setCapturedEvent(null);
      setTarget(null);
      setOperation(undefined);
      setScopeSelector("active");
      setBooleanValue("true");
      setChoiceValue(undefined);
      setTrigger("press");
      setRelativeEncoding("offset-binary");
      setInvert(false);
      setScale("1");
      setMinimum("0");
      setMaximum("1");
      setThreshold("64");
      setMomentary(true);
      setStepDirection("1");
      setBandwidthChange("increase");
      setBandwidthFactor("0.25");
    }
  });

  createEffect(() => {
    if (!open() || capturedEvent()) return;

    const inputs = Array.from(ports.inputs.values());
    inputs.forEach((input) => {
      input.addEventListener("midimessage", setCapturedEvent, { once: true });
    });

    onCleanup(() => {
      inputs.forEach((input) => {
        input.removeEventListener("midimessage", setCapturedEvent);
      });
    });
  });

  createEffect(() => {
    const currentSource = source();
    const currentTarget = target();
    if (!currentSource || !currentTarget) {
      setOperation(undefined);
      return;
    }

    const nextDefault = defaultOperation(currentTarget, currentSource.kind);
    const controlDefinition = CONTROL_REGISTRY[currentTarget];
    setOperation((current) =>
      current && controlDefinition.ops.includes(current)
        ? current
        : nextDefault,
    );
  });

  createEffect(() => {
    const options = choiceOptions();
    setChoiceValue((current) =>
      current && options.some((option) => option.key === current)
        ? current
        : options[0]?.key,
    );
  });

  createEffect(() => {
    const currentTarget = target();
    if (currentTarget && !validTargets().includes(currentTarget)) {
      setTarget(null);
    }
  });

  const saveMapping = () => {
    const mapping = draftMapping();
    if (!mapping) return;

    setPreferences("midiMappings", (mappings) => [...mappings, mapping]);
    setOpen(false);
  };

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <DialogTrigger as={Button}>Add Mapping</DialogTrigger>
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Mapping</DialogTitle>
        </DialogHeader>
        <Timeline
          activeItem={activeItem()}
          items={[
            {
              title: "MIDI Input",
              description: (
                <Show
                  when={source()}
                  fallback={
                    <div class="inline-flex items-center gap-2">
                      <SvgSpinners180Ring />
                      <span>Waiting for input...</span>
                    </div>
                  }
                >
                  {(midiSource) => (
                    <div class="flex flex-col gap-2">
                      <div>
                        {ports.inputs.get(midiSource().port)?.name ??
                          midiSource().port}{" "}
                        {sourceToString(midiSource())}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        class="w-fit"
                        onClick={() => setCapturedEvent(null)}
                      >
                        Capture Again
                      </Button>
                    </div>
                  )}
                </Show>
              ),
            },
            {
              title: "Target Control",
              description: (
                <div class="pt-2">
                  <Select<ControlTarget>
                    value={target() ?? undefined}
                    onChange={setTarget}
                    options={validTargets()}
                    placeholder="Select control..."
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {CONTROL_REGISTRY[props.item.rawValue].label}
                      </SelectItem>
                    )}
                  >
                    <SelectLabel>Control</SelectLabel>
                    <SelectTrigger>
                      <SelectValue<ControlTarget>>
                        {(state) =>
                          CONTROL_REGISTRY[state.selectedOption()]?.label
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>
              ),
            },
            {
              title: "Configuration",
              description: (
                <Show when={control()}>
                  {(definition) => (
                    <div class="flex flex-col gap-4 pt-2">
                      <Show
                        when={controlUsesSliceSelector(definition().target)}
                      >
                        <Select<SliceOption>
                          value={scopeSelector()}
                          onChange={setScopeSelector}
                          options={[...SLICE_OPTIONS]}
                          itemComponent={(props) => (
                            <SelectItem item={props.item}>
                              {props.item.rawValue === "active"
                                ? "Active"
                                : `Slice ${props.item.rawValue}`}
                            </SelectItem>
                          )}
                        >
                          <SelectLabel>
                            {definition().scope === "panadapter"
                              ? "Source Slice"
                              : "Target Slice"}
                          </SelectLabel>
                          <SelectTrigger>
                            <SelectValue<SliceOption>>
                              {(state) =>
                                state.selectedOption() === "active"
                                  ? "Active"
                                  : `Slice ${state.selectedOption()}`
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent />
                        </Select>
                      </Show>

                      <Show when={definition().ops.length > 1}>
                        <SegmentedControl
                          value={operation()}
                          onChange={(value) => setOperation(value as ControlOp)}
                        >
                          <SegmentedControlLabel>
                            Operation
                          </SegmentedControlLabel>
                          <SegmentedControlGroup>
                            <SegmentedControlIndicator />
                            <SegmentedControlItemsList>
                              <For each={definition().ops}>
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

                      <Switch>
                        <Match
                          when={
                            definition().editor.kind === "boolean" &&
                            operation() === "set"
                          }
                        >
                          <Select<"true" | "false">
                            value={booleanValue()}
                            onChange={setBooleanValue}
                            options={BOOLEAN_VALUES.map(
                              (option) => option.value,
                            )}
                            itemComponent={(props) => (
                              <SelectItem item={props.item}>
                                {
                                  BOOLEAN_VALUES.find(
                                    (option) =>
                                      option.value === props.item.rawValue,
                                  )?.label
                                }
                              </SelectItem>
                            )}
                          >
                            <SelectLabel>Value</SelectLabel>
                            <SelectTrigger>
                              <SelectValue<"true" | "false">>
                                {(state) =>
                                  BOOLEAN_VALUES.find(
                                    (option) =>
                                      option.value === state.selectedOption(),
                                  )?.label
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent />
                          </Select>
                        </Match>

                        <Match
                          when={
                            definition().editor.kind === "choice" &&
                            operation() === "set"
                          }
                        >
                          <Show
                            when={choiceOptions().length > 0}
                            fallback={
                              <div class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                No values are currently available for this
                                control.
                              </div>
                            }
                          >
                            <Select<string>
                              value={choiceValue()}
                              onChange={setChoiceValue}
                              options={choiceOptions().map(
                                (option) => option.key,
                              )}
                              itemComponent={(props) => (
                                <SelectItem item={props.item}>
                                  {
                                    choiceOptions().find(
                                      (option) =>
                                        option.key === props.item.rawValue,
                                    )?.label
                                  }
                                </SelectItem>
                              )}
                            >
                              <SelectLabel>Value</SelectLabel>
                              <SelectTrigger>
                                <SelectValue<string>>
                                  {(state) =>
                                    choiceOptions().find(
                                      (option) =>
                                        option.key === state.selectedOption(),
                                    )?.label
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent />
                            </Select>
                          </Show>
                        </Match>

                        <Match
                          when={definition().editor.kind === "bandwidth-scale"}
                        >
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Select<"increase" | "decrease">
                              value={bandwidthChange()}
                              onChange={setBandwidthChange}
                              options={BANDWIDTH_DIRECTIONS.map(
                                (option) => option.value,
                              )}
                              itemComponent={(props) => (
                                <SelectItem item={props.item}>
                                  {
                                    BANDWIDTH_DIRECTIONS.find(
                                      (option) =>
                                        option.value === props.item.rawValue,
                                    )?.label
                                  }
                                </SelectItem>
                              )}
                            >
                              <SelectLabel>Direction</SelectLabel>
                              <SelectTrigger>
                                <SelectValue<"increase" | "decrease">>
                                  {(state) =>
                                    BANDWIDTH_DIRECTIONS.find(
                                      (option) =>
                                        option.value === state.selectedOption(),
                                    )?.label
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent />
                            </Select>

                            <TextField
                              value={bandwidthFactor()}
                              onChange={setBandwidthFactor}
                            >
                              <TextFieldLabel>Factor</TextFieldLabel>
                              <TextFieldInput type="number" />
                            </TextField>
                          </div>
                        </Match>
                      </Switch>

                      <Show
                        when={
                          operation() === "adjust" || operation() === "cycle"
                        }
                      >
                        <Select<StepDirection>
                          value={stepDirection()}
                          onChange={setStepDirection}
                          options={STEP_DIRECTIONS.map(
                            (option) => option.value,
                          )}
                          itemComponent={(props) => (
                            <SelectItem item={props.item}>
                              {
                                STEP_DIRECTIONS.find(
                                  (option) =>
                                    option.value === props.item.rawValue,
                                )?.label
                              }
                            </SelectItem>
                          )}
                        >
                          <SelectLabel>Direction</SelectLabel>
                          <SelectTrigger>
                            <SelectValue<StepDirection>>
                              {(state) =>
                                STEP_DIRECTIONS.find(
                                  (option) =>
                                    option.value === state.selectedOption(),
                                )?.label
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent />
                        </Select>
                      </Show>

                      <Switch>
                        <Match
                          when={
                            definition().editor.kind === "command" ||
                            (definition().editor.kind === "boolean" &&
                              operation() === "toggle") ||
                            (definition().editor.kind === "choice" &&
                              operation() === "set")
                          }
                        >
                          <Select<TriggerKind>
                            value={trigger()}
                            onChange={setTrigger}
                            options={[...TRIGGER_OPTIONS]}
                            itemComponent={(props) => (
                              <SelectItem item={props.item}>
                                {titleCase(props.item.rawValue)}
                              </SelectItem>
                            )}
                          >
                            <SelectLabel>Trigger</SelectLabel>
                            <SelectTrigger>
                              <SelectValue<TriggerKind>>
                                {(state) => titleCase(state.selectedOption())}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent />
                          </Select>
                        </Match>

                        <Match
                          when={
                            definition().editor.kind === "boolean" &&
                            operation() === "set"
                          }
                        >
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextField
                              value={threshold()}
                              onChange={setThreshold}
                            >
                              <TextFieldLabel>Threshold</TextFieldLabel>
                              <TextFieldInput type="number" />
                            </TextField>

                            <div class="pt-7">
                              <SimpleSwitch
                                checked={momentary()}
                                onChange={setMomentary}
                                label="Momentary"
                              />
                            </div>
                          </div>
                        </Match>

                        <Match
                          when={
                            definition().editor.kind === "relative-step" ||
                            (definition().editor.kind === "normalized" &&
                              operation() === "adjust") ||
                            (definition().editor.kind === "signed-normalized" &&
                              operation() === "adjust") ||
                            (definition().editor.kind === "choice" &&
                              operation() === "cycle")
                          }
                        >
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Select<RelativeEncoding>
                              value={relativeEncoding()}
                              onChange={setRelativeEncoding}
                              options={[...RELATIVE_ENCODINGS]}
                              itemComponent={(props) => (
                                <SelectItem item={props.item}>
                                  {props.item.rawValue}
                                </SelectItem>
                              )}
                            >
                              <SelectLabel>Encoding</SelectLabel>
                              <SelectTrigger>
                                <SelectValue<RelativeEncoding>>
                                  {(state) => state.selectedOption()}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent />
                            </Select>

                            <TextField value={scale()} onChange={setScale}>
                              <TextFieldLabel>Scale</TextFieldLabel>
                              <TextFieldInput type="number" />
                            </TextField>

                            <div class="sm:col-span-2">
                              <SimpleSwitch
                                checked={invert()}
                                onChange={setInvert}
                                label="Invert"
                              />
                            </div>
                          </div>
                        </Match>

                        <Match
                          when={
                            (definition().editor.kind === "normalized" &&
                              operation() === "set") ||
                            (definition().editor.kind === "signed-normalized" &&
                              operation() === "set")
                          }
                        >
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextField value={minimum()} onChange={setMinimum}>
                              <TextFieldLabel>Min</TextFieldLabel>
                              <TextFieldInput type="number" />
                            </TextField>

                            <TextField value={maximum()} onChange={setMaximum}>
                              <TextFieldLabel>Max</TextFieldLabel>
                              <TextFieldInput type="number" />
                            </TextField>

                            <div class="sm:col-span-2">
                              <SimpleSwitch
                                checked={invert()}
                                onChange={setInvert}
                                label="Invert"
                              />
                            </div>
                          </div>
                        </Match>
                      </Switch>
                    </div>
                  )}
                </Show>
              ),
            },
          ]}
        />
        <DialogFooter class="justify-between">
          <Show when={draftMapping()}>
            {(mapping) => (
              <div class="text-xs text-muted-foreground">
                Saves as {mapping().action.target}
                {"options" in mapping() && mapping().options
                  ? ` (${mapping().options.mode})`
                  : ""}
              </div>
            )}
          </Show>
          <Button onClick={saveMapping} disabled={!draftMapping()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MidiSettingsInner() {
  const { preferences, setPreferences } = usePreferences();
  const [lastCommand, setLastCommand] = createSignal("");
  const { inputs } = createMIDIPorts();

  function onMessage(this: MIDIInput, message: MIDIMessageEvent) {
    const source = eventToSource(message);
    if (!source) return;
    setLastCommand(sourceToString(source));
  }

  createEffect(() => {
    inputs.forEach((input) => {
      input.addEventListener("midimessage", onMessage);
    });

    onCleanup(() => {
      inputs.forEach((input) => {
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
                <TableHead class="min-w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={preferences.midiMappings}>
                {(mapping, index) => (
                  <TableRow>
                    <TableCell>{mapping.action.target}</TableCell>
                    <TableCell>{mapping.options?.mode ?? "trigger"}</TableCell>
                    <TableCell>
                      {inputs.get(mapping.midi.port)?.name ?? "Missing"}
                    </TableCell>
                    <TableCell>{sourceToString(mapping.midi)}</TableCell>
                    <TableCell>
                      <ButtonPrimitive.Button
                        onClick={() => {
                          setPreferences("midiMappings", (prev) =>
                            prev.toSpliced(index(), 1),
                          );
                        }}
                      >
                        <BaselineDelete />
                      </ButtonPrimitive.Button>
                    </TableCell>
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
