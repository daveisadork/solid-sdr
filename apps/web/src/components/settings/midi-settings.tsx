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
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  Switch,
  Match,
} from "solid-js";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/text-field";
import { SimpleSwitch } from "../ui/simple-switch";
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
import {
  CONTROL_DEFINITIONS,
  CONTROL_REGISTRY,
  type ControlTarget,
  type SliceSelector,
  useControls,
} from "~/context/controls";
import BaselineDelete from "~icons/ic/baseline-delete";

type InputType = MidiMapping["input"];
type Behavior = MidiMapping["behavior"];
type SliceOption = "active" | SliceSelector;
type ChoiceOption = { key: string; label: string; value: string | number };

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

const KINDS: Record<number, MidiSource["kind"]> = {
  8: "note",
  9: "note",
  11: "cc",
  14: "pitchBend",
};

const INPUT_LABELS: Record<InputType, string> = {
  button: "Button, key, or switch",
  ranged: "0% to 100% control",
  relative: "Free-spinning control",
};

const BEHAVIOR_LABELS: Record<Behavior, string> = {
  "set-value": "Set value",
  "select-from-list": "Pick from list",
  toggle: "Toggle",
  "follow-button": "Follow control state",
  press: "Run once when pressed",
  "set-item": "Pick this item",
  "change-item": "Move through list",
  "change-value": "Change value by an amount",
  "scale-value": "Multiply or divide by a factor",
};

const ITEM_DIRECTIONS = [
  { value: "next", label: "Next item" },
  { value: "previous", label: "Previous item" },
] as const;

const VALUE_DIRECTIONS = [
  { value: "increase", label: "Increase" },
  { value: "decrease", label: "Decrease" },
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

function sameSource(a: MidiSource, b: MidiSource) {
  return (
    a.port === b.port &&
    a.channel === b.channel &&
    a.kind === b.kind &&
    a.id === b.id
  );
}

function sourceToString(source: MidiSource) {
  switch (source.kind) {
    case "note":
      return `Ch ${source.channel + 1} Button ${source.id}`;
    case "cc":
      return `Ch ${source.channel + 1} Control ${source.id}`;
    case "pitchBend":
      return `Ch ${source.channel + 1} Pitch Wheel`;
  }
}

function controlNeedsSlice(target: ControlTarget | null) {
  if (!target) return false;
  const definition = CONTROL_REGISTRY[target];
  return definition.scope !== "radio" && target !== "slice.select";
}

function availableInputTypes(source: MidiSource | null): InputType[] {
  if (!source) return [];

  switch (source.kind) {
    case "note":
      return ["button"];
    case "pitchBend":
      return ["ranged"];
    case "cc":
      return ["button", "ranged", "relative"];
  }
}

function supportsInput(target: ControlTarget, input: InputType) {
  const editorKind = CONTROL_REGISTRY[target].editor.kind;

  switch (input) {
    case "button":
      return [
        "boolean",
        "command",
        "choice",
        "relative-step",
        "normalized",
        "signed-normalized",
        "scaled-number",
      ].includes(editorKind);
    case "ranged":
      return ["choice", "normalized", "signed-normalized"].includes(editorKind);
    case "relative":
      return [
        "choice",
        "relative-step",
        "normalized",
        "signed-normalized",
        "scaled-number",
      ].includes(editorKind);
  }
}

function behaviorOptions(
  input: InputType | undefined,
  target: ControlTarget | null,
): { value: Behavior; label: string }[] {
  if (!input || !target) return [];

  const editorKind = CONTROL_REGISTRY[target].editor.kind;

  switch (input) {
    case "button":
      switch (editorKind) {
        case "boolean":
          return [
            { value: "toggle", label: BEHAVIOR_LABELS.toggle },
            { value: "follow-button", label: BEHAVIOR_LABELS["follow-button"] },
          ];
        case "command":
          return [{ value: "press", label: BEHAVIOR_LABELS.press }];
        case "choice":
          return [
            { value: "set-item", label: BEHAVIOR_LABELS["set-item"] },
            { value: "change-item", label: BEHAVIOR_LABELS["change-item"] },
          ];
        case "relative-step":
        case "normalized":
        case "signed-normalized":
          return [
            { value: "change-value", label: BEHAVIOR_LABELS["change-value"] },
          ];
        case "scaled-number":
          return [
            { value: "scale-value", label: BEHAVIOR_LABELS["scale-value"] },
          ];
      }
      break;

    case "ranged":
      switch (editorKind) {
        case "choice":
          return [
            {
              value: "select-from-list",
              label: BEHAVIOR_LABELS["select-from-list"],
            },
          ];
        case "normalized":
        case "signed-normalized":
          return [{ value: "set-value", label: BEHAVIOR_LABELS["set-value"] }];
      }
      break;

    case "relative":
      switch (editorKind) {
        case "choice":
          return [
            { value: "change-item", label: BEHAVIOR_LABELS["change-item"] },
          ];
        case "relative-step":
        case "normalized":
        case "signed-normalized":
          return [
            { value: "change-value", label: BEHAVIOR_LABELS["change-value"] },
          ];
        case "scaled-number":
          return [
            { value: "scale-value", label: BEHAVIOR_LABELS["scale-value"] },
          ];
      }
      break;
  }

  return [];
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value: string, fallback: number) {
  const parsed = parseNumber(value, fallback);
  return Math.max(0, Math.min(100, parsed));
}

function describeControl(mapping: MidiMapping) {
  const label =
    CONTROL_REGISTRY[mapping.control.target]?.label ?? mapping.control.target;
  return mapping.control.slice ? `${label} (${mapping.control.slice})` : label;
}

function describeBehavior(mapping: MidiMapping) {
  switch (mapping.behavior) {
    case "set-value":
      return mapping.invert ? "Set value (reversed)" : "Set value";
    case "select-from-list":
      return "Pick from list by position";
    case "toggle":
      return "Toggle when pressed";
    case "follow-button":
      return mapping.invert
        ? "Follow control state (reversed)"
        : "Follow control state";
    case "press":
      return "Run once when pressed";
    case "set-item":
      return `Pick item: ${mapping.value}`;
    case "change-item":
      return mapping.input === "button"
        ? mapping.direction === "next"
          ? "Next item"
          : "Previous item"
        : "Move through list";
    case "change-value":
      return mapping.input === "button"
        ? `${mapping.direction === "increase" ? "Increase" : "Decrease"} by ${mapping.amount}`
        : `Change by ${mapping.amount}`;
    case "scale-value":
      return mapping.input === "button"
        ? `${mapping.direction === "increase" ? "Multiply" : "Divide"} by ${mapping.factor}`
        : `Multiply/divide by ${mapping.factor}`;
  }
}

function AddMappingDialog() {
  const { setPreferences } = usePreferences();
  const { inputs } = createMIDIPorts();
  const { getChoices } = useControls();

  const [open, setOpen] = createSignal(false);
  const [capturedSource, setCapturedSource] = createSignal<MidiSource | null>(
    null,
  );
  const [recentValues, setRecentValues] = createSignal<number[]>([]);
  const [inputType, setInputType] = createSignal<InputType>();
  const [target, setTarget] = createSignal<ControlTarget | null>(null);
  const [behavior, setBehavior] = createSignal<Behavior>();
  const [sliceOption, setSliceOption] = createSignal<SliceOption>("active");
  const [selectedChoiceKey, setSelectedChoiceKey] = createSignal<string>();
  const [thresholdPercent, setThresholdPercent] = createSignal("50");
  const [invert, setInvert] = createSignal(false);
  const [itemDirection, setItemDirection] = createSignal<"next" | "previous">(
    "next",
  );
  const [valueDirection, setValueDirection] = createSignal<
    "increase" | "decrease"
  >("increase");
  const [amount, setAmount] = createSignal("1");
  const [factor, setFactor] = createSignal("0.25");

  const inputOptions = createMemo(() => availableInputTypes(capturedSource()));

  const control = createMemo(() => {
    const value = target();
    return value ? CONTROL_REGISTRY[value] : undefined;
  });

  const selectedSlice = createMemo(() => {
    const value = sliceOption();
    return value === "active" ? undefined : value;
  });

  const choiceOptions = createMemo<ChoiceOption[]>(() => {
    const targetValue = target();
    if (
      !targetValue ||
      CONTROL_REGISTRY[targetValue].editor.kind !== "choice"
    ) {
      return [];
    }

    return getChoices(targetValue, selectedSlice()).map((value) => ({
      key: String(value),
      label: String(value),
      value,
    }));
  });

  const validTargets = createMemo(() => {
    const input = inputType();
    if (!input) return [] as ControlTarget[];

    return CONTROL_DEFINITIONS.filter((definition) =>
      supportsInput(definition.target, input),
    )
      .map((definition) => definition.target)
      .toSorted((a, b) =>
        CONTROL_REGISTRY[a].label.localeCompare(CONTROL_REGISTRY[b].label),
      );
  });

  const currentBehaviorOptions = createMemo(() =>
    behaviorOptions(inputType(), target()),
  );

  const draftMapping = createMemo((): MidiMapping | null => {
    const midi = capturedSource();
    const input = inputType();
    const targetValue = target();
    const chosenBehavior = behavior();

    if (!midi || !input || !targetValue || !chosenBehavior) return null;

    const controlRef =
      controlNeedsSlice(targetValue) && selectedSlice()
        ? { target: targetValue, slice: selectedSlice() }
        : { target: targetValue };

    if (input === "ranged") {
      if (midi.kind !== "cc" && midi.kind !== "pitchBend") return null;

      switch (chosenBehavior) {
        case "set-value":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            invert: invert(),
          } as MidiMapping;
        case "select-from-list":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
          } as MidiMapping;
        default:
          return null;
      }
    }

    if (input === "button") {
      if (midi.kind !== "cc" && midi.kind !== "note") return null;

      const threshold = clampPercent(thresholdPercent(), 50) / 100;

      switch (chosenBehavior) {
        case "toggle":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
          } as MidiMapping;
        case "follow-button":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
            invert: invert(),
          } as MidiMapping;
        case "press":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
          } as MidiMapping;
        case "set-item": {
          const option = choiceOptions().find(
            (entry) => entry.key === selectedChoiceKey(),
          );
          if (!option) return null;
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
            value: option.value,
          } as MidiMapping;
        }
        case "change-item":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
            direction: itemDirection(),
          } as MidiMapping;
        case "change-value":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
            direction: valueDirection(),
            amount: parseNumber(amount(), 1),
          } as MidiMapping;
        case "scale-value":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
            direction: valueDirection(),
            factor: parseNumber(factor(), 0.25),
          } as MidiMapping;
        default:
          return null;
      }
    }

    if (midi.kind !== "cc") return null;

    switch (chosenBehavior) {
      case "change-item":
        return {
          midi,
          input,
          behavior: chosenBehavior,
          control: controlRef,
          invert: invert(),
        } as MidiMapping;
      case "change-value":
        return {
          midi,
          input,
          behavior: chosenBehavior,
          control: controlRef,
          invert: invert(),
          amount: parseNumber(amount(), 1),
        } as MidiMapping;
      case "scale-value":
        return {
          midi,
          input,
          behavior: chosenBehavior,
          control: controlRef,
          invert: invert(),
          factor: parseNumber(factor(), 0.25),
        } as MidiMapping;
      default:
        return null;
    }
  });

  const activeItem = createMemo(() => {
    if (!capturedSource()) return 0;
    if (!inputType()) return 1;
    if (!target()) return 2;
    return draftMapping() ? 4 : 3;
  });

  createEffect(() => {
    if (!open()) {
      setCapturedSource(null);
      setRecentValues([]);
      setInputType(undefined);
      setTarget(null);
      setBehavior(undefined);
      setSliceOption("active");
      setSelectedChoiceKey(undefined);
      setThresholdPercent("50");
      setInvert(false);
      setItemDirection("next");
      setValueDirection("increase");
      setAmount("1");
      setFactor("0.25");
    }
  });

  createEffect(() => {
    if (!open()) return;

    const handleMessage = (event: MIDIMessageEvent) => {
      const source = eventToSource(event);
      if (!source) return;

      const currentSource = capturedSource();
      if (!currentSource) {
        setCapturedSource(source);
        setRecentValues([parseMidiMessage(event).value]);
        return;
      }

      if (!sameSource(currentSource, source)) return;
      const value = parseMidiMessage(event).value;
      setRecentValues((previous) => [...previous.slice(-11), value]);
    };

    inputs.forEach((input) =>
      input.addEventListener("midimessage", handleMessage),
    );
    onCleanup(() => {
      inputs.forEach((input) =>
        input.removeEventListener("midimessage", handleMessage),
      );
    });
  });

  createEffect(() => {
    const options = inputOptions();
    setInputType((current) =>
      current && options.includes(current) ? current : options[0],
    );
  });

  createEffect(() => {
    const currentTarget = target();
    if (currentTarget && !validTargets().includes(currentTarget)) {
      setTarget(null);
    }
  });

  createEffect(() => {
    const options = currentBehaviorOptions();
    setBehavior((current) =>
      current && options.some((option) => option.value === current)
        ? current
        : options[0]?.value,
    );
  });

  createEffect(() => {
    const options = choiceOptions();
    setSelectedChoiceKey((current) =>
      current && options.some((option) => option.key === current)
        ? current
        : options[0]?.key,
    );
  });

  const saveMapping = () => {
    const mapping = draftMapping();
    if (!mapping) return;
    setPreferences("midiMappings", (previous) => [...previous, mapping]);
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
              title: "Capture Control",
              description: (
                <Show
                  when={capturedSource()}
                  fallback={
                    <div class="inline-flex items-center gap-2">
                      <SvgSpinners180Ring />
                      <span>Move or press a control...</span>
                    </div>
                  }
                >
                  {(source) => (
                    <div class="flex flex-col gap-2">
                      <div>
                        {inputs.get(source().port ?? "")?.name ??
                          "Unknown device"}{" "}
                        {sourceToString(source())}
                      </div>
                      <Show when={recentValues().length > 0}>
                        <div class="text-xs text-muted-foreground">
                          Recent values: {recentValues().join(", ")}
                        </div>
                      </Show>
                      <Button
                        variant="outline"
                        size="sm"
                        class="w-fit"
                        onClick={() => {
                          setCapturedSource(null);
                          setRecentValues([]);
                        }}
                      >
                        Capture Again
                      </Button>
                    </div>
                  )}
                </Show>
              ),
            },
            {
              title: "Control Type",
              description: (
                <Show when={inputOptions().length > 0}>
                  <Show
                    when={inputOptions().length > 1}
                    fallback={
                      <div class="pt-2 text-sm">
                        {inputType() ? INPUT_LABELS[inputType()!] : ""}
                      </div>
                    }
                  >
                    <div class="pt-2">
                      <Select<InputType>
                        value={inputType()}
                        onChange={setInputType}
                        options={inputOptions()}
                        itemComponent={(props) => (
                          <SelectItem item={props.item}>
                            {INPUT_LABELS[props.item.rawValue]}
                          </SelectItem>
                        )}
                      >
                        <SelectLabel>
                          How should this control behave?
                        </SelectLabel>
                        <SelectTrigger>
                          <SelectValue<InputType>>
                            {(state) => INPUT_LABELS[state.selectedOption()]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                    </div>
                  </Show>
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
                    <SelectLabel>What should it control?</SelectLabel>
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
              title: "Behavior",
              description: (
                <Show when={control()}>
                  {(definition) => (
                    <div class="flex flex-col gap-4 pt-2">
                      <Show when={controlNeedsSlice(definition().target)}>
                        <Select<SliceOption>
                          value={sliceOption()}
                          onChange={setSliceOption}
                          options={[...SLICE_OPTIONS]}
                          itemComponent={(props) => (
                            <SelectItem item={props.item}>
                              {props.item.rawValue === "active"
                                ? "Active"
                                : `Slice ${props.item.rawValue}`}
                            </SelectItem>
                          )}
                        >
                          <SelectLabel>Which slice?</SelectLabel>
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

                      <Select<Behavior>
                        value={behavior()}
                        onChange={setBehavior}
                        options={currentBehaviorOptions().map(
                          (option) => option.value,
                        )}
                        itemComponent={(props) => (
                          <SelectItem item={props.item}>
                            {
                              currentBehaviorOptions().find(
                                (option) =>
                                  option.value === props.item.rawValue,
                              )?.label
                            }
                          </SelectItem>
                        )}
                      >
                        <SelectLabel>What should it do?</SelectLabel>
                        <SelectTrigger>
                          <SelectValue<Behavior>>
                            {(state) =>
                              currentBehaviorOptions().find(
                                (option) =>
                                  option.value === state.selectedOption(),
                              )?.label
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent />
                      </Select>

                      <Show when={inputType() === "button"}>
                        <TextField
                          value={thresholdPercent()}
                          onChange={setThresholdPercent}
                        >
                          <TextFieldLabel>Pressed At (%)</TextFieldLabel>
                          <TextFieldInput type="number" />
                        </TextField>
                      </Show>

                      <Switch>
                        <Match
                          when={
                            behavior() === "set-item" &&
                            choiceOptions().length > 0
                          }
                        >
                          <Select<string>
                            value={selectedChoiceKey()}
                            onChange={setSelectedChoiceKey}
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
                            <SelectLabel>Item</SelectLabel>
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
                        </Match>

                        <Match
                          when={
                            behavior() === "change-item" &&
                            inputType() === "button"
                          }
                        >
                          <Select<"next" | "previous">
                            value={itemDirection()}
                            onChange={setItemDirection}
                            options={ITEM_DIRECTIONS.map(
                              (option) => option.value,
                            )}
                            itemComponent={(props) => (
                              <SelectItem item={props.item}>
                                {
                                  ITEM_DIRECTIONS.find(
                                    (option) =>
                                      option.value === props.item.rawValue,
                                  )?.label
                                }
                              </SelectItem>
                            )}
                          >
                            <SelectLabel>Direction</SelectLabel>
                            <SelectTrigger>
                              <SelectValue<"next" | "previous">>
                                {(state) =>
                                  ITEM_DIRECTIONS.find(
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
                            behavior() === "change-value" &&
                            inputType() === "button"
                          }
                        >
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Select<"increase" | "decrease">
                              value={valueDirection()}
                              onChange={setValueDirection}
                              options={VALUE_DIRECTIONS.map(
                                (option) => option.value,
                              )}
                              itemComponent={(props) => (
                                <SelectItem item={props.item}>
                                  {
                                    VALUE_DIRECTIONS.find(
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
                                    VALUE_DIRECTIONS.find(
                                      (option) =>
                                        option.value === state.selectedOption(),
                                    )?.label
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent />
                            </Select>

                            <TextField value={amount()} onChange={setAmount}>
                              <TextFieldLabel>Amount</TextFieldLabel>
                              <TextFieldInput type="number" />
                            </TextField>
                          </div>
                        </Match>

                        <Match
                          when={
                            behavior() === "change-value" &&
                            inputType() === "relative"
                          }
                        >
                          <TextField value={amount()} onChange={setAmount}>
                            <TextFieldLabel>Amount Per Step</TextFieldLabel>
                            <TextFieldInput type="number" />
                          </TextField>
                        </Match>

                        <Match
                          when={
                            behavior() === "scale-value" &&
                            inputType() === "button"
                          }
                        >
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Select<"increase" | "decrease">
                              value={valueDirection()}
                              onChange={setValueDirection}
                              options={VALUE_DIRECTIONS.map(
                                (option) => option.value,
                              )}
                              itemComponent={(props) => (
                                <SelectItem item={props.item}>
                                  {
                                    VALUE_DIRECTIONS.find(
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
                                    VALUE_DIRECTIONS.find(
                                      (option) =>
                                        option.value === state.selectedOption(),
                                    )?.label
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent />
                            </Select>

                            <TextField value={factor()} onChange={setFactor}>
                              <TextFieldLabel>Factor</TextFieldLabel>
                              <TextFieldInput type="number" />
                            </TextField>
                          </div>
                        </Match>

                        <Match
                          when={
                            behavior() === "scale-value" &&
                            inputType() === "relative"
                          }
                        >
                          <TextField value={factor()} onChange={setFactor}>
                            <TextFieldLabel>Factor</TextFieldLabel>
                            <TextFieldInput type="number" />
                          </TextField>
                        </Match>
                      </Switch>

                      <Show
                        when={
                          behavior() === "set-value" ||
                          behavior() === "follow-button" ||
                          (inputType() === "relative" &&
                            (behavior() === "change-item" ||
                              behavior() === "change-value" ||
                              behavior() === "scale-value"))
                        }
                      >
                        <SimpleSwitch
                          checked={invert()}
                          onChange={setInvert}
                          label="Reverse Direction"
                        />
                      </Show>

                      <Show
                        when={
                          behavior() === "set-item" &&
                          choiceOptions().length === 0
                        }
                      >
                        <div class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                          No items are currently available for this control.
                        </div>
                      </Show>
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
                {describeControl(mapping())}: {describeBehavior(mapping())}
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
  const { inputs } = createMIDIPorts();
  const [lastCommand, setLastCommand] = createSignal("");

  function onMessage(this: MIDIInput, message: MIDIMessageEvent) {
    const source = eventToSource(message);
    if (!source) return;

    const parsed = parseMidiMessage(message);
    setLastCommand(`${sourceToString(source)} = ${parsed.value}`);
  }

  createEffect(() => {
    inputs.forEach((input) => input.addEventListener("midimessage", onMessage));
    onCleanup(() => {
      inputs.forEach((input) =>
        input.removeEventListener("midimessage", onMessage),
      );
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
                <TableHead>Control</TableHead>
                <TableHead>Does</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Physical Control</TableHead>
                <TableHead class="min-w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={preferences.midiMappings}>
                {(mapping, index) => (
                  <TableRow>
                    <TableCell>{describeControl(mapping)}</TableCell>
                    <TableCell>{describeBehavior(mapping)}</TableCell>
                    <TableCell>
                      {mapping.midi.port
                        ? (inputs.get(mapping.midi.port)?.name ?? "Missing")
                        : "Any device"}
                    </TableCell>
                    <TableCell>{sourceToString(mapping.midi)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setPreferences("midiMappings", (previous) =>
                            previous.toSpliced(index(), 1),
                          );
                        }}
                      >
                        <BaselineDelete />
                      </Button>
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
