import { usePreferences } from "../../context/preferences";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Card, CardHeader, CardTitle } from "../ui/card";
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
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "../ui/number-field";

import { SimpleSwitch } from "../ui/simple-switch";
import { SimpleSlider } from "../ui/simple-slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  createMIDIPorts,
  MidiMapping,
  MidiSource,
  ParsedMidiMessage,
  parseMidiMessage,
} from "~/lib/midi";
import { Timeline } from "../ui/timeline";
import SvgSpinners180Ring from "~icons/svg-spinners/180-ring";
import {
  Select,
  SelectContent,
  SelectDescription,
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
import MdiRefresh from "~icons/mdi/refresh";
import { MidiValueRing } from "../midi-value-ring";
import { reconcile } from "solid-js/store";
import useFlexRadio from "~/context/flexradio";
import {
  Combobox,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemLabel,
  ComboboxLabel,
  ComboboxSection,
  ComboboxTrigger,
  ComboboxContent,
} from "../ui/combobox";

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
  "change-item": "Cycle through list",
  "change-value": "Change value by an amount",
  "scale-value": "Multiply or divide by a factor",
};

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
    (!a.port || a.port === b.port) &&
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
      return ["relative"];
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

function describeControl(mapping: MidiMapping) {
  const label =
    CONTROL_REGISTRY[mapping.control.target]?.label ?? mapping.control.target;
  return mapping.control.slice ? `${label} (${mapping.control.slice})` : label;
}

interface TargetOption {
  value: ControlTarget;
  label: string;
  disabled: boolean;
}

interface TargetCategory {
  label: string;
  options: TargetOption[];
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
      return mapping.invert ? "Inactive while pressed" : "Active while pressed";
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
        ? `${mapping.direction === "increase" ? "Multiply" : "Divide"} by ${mapping.factor + 1}`
        : `Multiply/divide by ${mapping.factor + 1}`;
  }
}

function AddMappingDialog(props: { class?: string | undefined }) {
  const { setPreferences } = usePreferences();
  const { inputs } = createMIDIPorts();
  const { getChoices } = useControls();
  const { bands } = useFlexRadio();

  const [open, setOpen] = createSignal(false);
  const [capturedSource, setCapturedSource] = createSignal<MidiSource | null>(
    null,
  );
  const [lastMessage, setLastMessage] = createSignal<ParsedMidiMessage>();
  const [inputType, setInputType] = createSignal<InputType>();
  const [target, setTarget] = createSignal<TargetOption | null>(null);
  const [behavior, setBehavior] = createSignal<Behavior>();
  const [sliceOption, setSliceOption] = createSignal<SliceOption>("active");
  const [selectedChoiceKey, setSelectedChoiceKey] = createSignal<string>();
  const [thresholdPercent, setThresholdPercent] = createSignal(50);
  const [invert, setInvert] = createSignal(false);
  const [itemDirection, setItemDirection] = createSignal<"next" | "previous">(
    "next",
  );
  const [valueDirection, setValueDirection] = createSignal<
    "increase" | "decrease"
  >("increase");
  const [amount, setAmount] = createSignal(1);
  const [factor, setFactor] = createSignal(0.25);
  const [selectedPort, setSelectedPort] = createSignal<string | null>(null);

  const inputOptions = createMemo(() => availableInputTypes(capturedSource()));

  const control = createMemo(() => {
    const value = target();
    return value ? CONTROL_REGISTRY[value.value] : undefined;
  });

  const selectedSlice = createMemo(() => {
    const value = sliceOption();
    return value === "active" ? undefined : value;
  });

  const choiceOptions = createMemo<ChoiceOption[]>(() => {
    const targetValue = target()?.value;
    if (
      !targetValue ||
      CONTROL_REGISTRY[targetValue].editor.kind !== "choice"
    ) {
      return [];
    }

    return getChoices(targetValue, selectedSlice()).map((value) => ({
      key: String(value),
      label:
        targetValue === "panadapter.band"
          ? bands.get(String(value))
          : String(value),
      value,
    }));
  });

  const validTargets = createMemo(() => {
    const input = inputType();
    if (!input) return [] as TargetCategory[];

    const categories = new Map<string, TargetCategory>();

    for (const control of CONTROL_DEFINITIONS.toSorted((a, b) =>
      a.label.localeCompare(b.label),
    )) {
      const { target, label } = control;
      const [category, _] = control.target.split(".");
      if (!categories.has(category)) {
        categories.set(category, {
          label: `${category.charAt(0).toLocaleUpperCase() + category.slice(1)} Controls`,
          options: [],
        });
      }
      categories.get(category)!.options.push({
        value: target,
        label,
        disabled: !supportsInput(target, input),
      });
    }
    return categories.values().toArray();
  });

  const currentBehaviorOptions = createMemo(() =>
    behaviorOptions(inputType(), target()?.value),
  );

  const draftMapping = createMemo((): MidiMapping | null => {
    const midi = { ...capturedSource(), port: selectedPort() };
    const input = inputType();
    const targetValue = target()?.value;
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

      const threshold = thresholdPercent() / 100;

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
            amount: amount(),
          } as MidiMapping;
        case "scale-value":
          return {
            midi,
            input,
            behavior: chosenBehavior,
            control: controlRef,
            threshold,
            direction: valueDirection(),
            factor: factor(),
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
          amount: amount(),
        } as MidiMapping;
      case "scale-value":
        return {
          midi,
          input,
          behavior: chosenBehavior,
          control: controlRef,
          invert: invert(),
          factor: factor(),
        } as MidiMapping;
      default:
        return null;
    }
  });

  const draftMappingDescription = () => {
    const mapping = draftMapping();
    return mapping
      ? `${describeControl(mapping)}: ${describeBehavior(mapping)}`
      : "";
  };

  const activeItem = createMemo(() => {
    if (!capturedSource()) return 0;
    if (!inputType()) return 1;
    if (!target()) return 2;
    return draftMapping() ? 4 : 3;
  });

  createEffect(() => {
    if (!open()) {
      setCapturedSource(null);
      setInputType(undefined);
      setTarget(null);
      setBehavior(undefined);
      setSliceOption("active");
      setSelectedChoiceKey(undefined);
      setThresholdPercent(50);
      setInvert(false);
      setItemDirection("next");
      setValueDirection("increase");
      setAmount(1);
      setFactor(0.25);
    }
  });

  createEffect(() => {
    if (!open()) return;

    const handleMessage = (event: MIDIMessageEvent) => {
      const source = eventToSource(event);
      if (!source) return;
      const port = selectedPort();

      if (port && source.port !== port) {
        return;
      }
      source.port = port;

      const parsed = parseMidiMessage(event);
      const currentSource = capturedSource();
      if (!currentSource) {
        setCapturedSource(source);
        setLastMessage(parsed);
        return;
      }

      if (!sameSource(currentSource, source)) return;
      setLastMessage(parsed);
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
    const currentTarget = target()?.value;
    if (currentTarget && !supportsInput(currentTarget, inputType())) {
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
      <DialogTrigger as={Button} class={props.class}>
        New
      </DialogTrigger>
      <DialogContent class="translate-y-0 flex flex-col top-1/12 max-h-10/12 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Mapping</DialogTitle>
        </DialogHeader>

        <div class="shrink overflow-auto">
          <Timeline
            activeItem={activeItem()}
            items={[
              {
                title: "Capture Control",
                description: (
                  <div class="pt-2 flex gap-2 justify-between items-center">
                    <Select<string | null>
                      class="flex flex-col gap-2 grow"
                      value={selectedPort()}
                      onChange={setSelectedPort}
                      options={inputs.keys().toArray()}
                      placeholder="Any Device"
                      itemComponent={(props) => (
                        <SelectItem item={props.item}>
                          {inputs.get(props.item.rawValue)?.name}
                        </SelectItem>
                      )}
                    >
                      <SelectLabel>Which device?</SelectLabel>
                      <SelectTrigger>
                        <SelectValue<InputType>>
                          {(state) => inputs.get(state.selectedOption())?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectDescription>
                        <Show
                          when={capturedSource()}
                          fallback={<span>Listening for input...</span>}
                        >
                          {(source) => (
                            <span>
                              Captured{" "}
                              <span class="text-green-500">
                                {sourceToString(source())}
                              </span>
                            </span>
                          )}
                        </Show>
                      </SelectDescription>
                      <SelectContent />
                    </Select>
                    <Button
                      variant="outline"
                      class="grow-0 shrink-0"
                      size="icon"
                      disabled={!capturedSource()}
                      onClick={() => {
                        setCapturedSource(null);
                      }}
                    >
                      <Show
                        when={capturedSource()}
                        fallback={<SvgSpinners180Ring class="size-full" />}
                      >
                        <MdiRefresh class="size-full" />
                      </Show>
                    </Button>
                    <div class="size-16">
                      <Show when={lastMessage()}>
                        <MidiValueRing
                          message={lastMessage()}
                          forceNote={inputType() === "button"}
                        />
                      </Show>
                    </div>
                  </div>
                ),
              },
              {
                title: "Control Type",
                description: (
                  <div class="pt-2 flex flex-col gap-4">
                    <div>
                      <Select<InputType>
                        class="flex flex-col gap-2"
                        disabled={inputOptions().length < 2}
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

                    <Show when={inputType() === "button"}>
                      <SimpleSlider
                        class="w-fit"
                        label="Activation Threshold"
                        value={[thresholdPercent()]}
                        onChange={setThresholdPercent}
                        minValue={1}
                        maxValue={100}
                        getValueLabel={({ values: [value] }) => `${value}%`}
                      />
                    </Show>
                  </div>
                ),
              },
              {
                title: "Target Control",
                description: (
                  <div class="pt-2 flex flex-col gap-4">
                    <Combobox<TargetOption, TargetCategory>
                      class="flex flex-col gap-2"
                      value={target() ?? undefined}
                      disabled={validTargets().length === 0}
                      onChange={setTarget}
                      options={validTargets()}
                      optionValue="value"
                      optionTextValue="label"
                      optionLabel="label"
                      optionDisabled="disabled"
                      optionGroupChildren="options"
                      placeholder="Type to search controls..."
                      triggerMode="focus"
                      itemComponent={(props) => (
                        <ComboboxItem item={props.item}>
                          <ComboboxItemLabel>
                            {props.item.rawValue.label}
                          </ComboboxItemLabel>
                          <ComboboxItemIndicator />
                        </ComboboxItem>
                      )}
                      sectionComponent={(props) => (
                        <ComboboxSection>
                          {props.section.rawValue.label}
                        </ComboboxSection>
                      )}
                    >
                      <ComboboxLabel>What should it control?</ComboboxLabel>
                      <ComboboxControl aria-label="Target Control">
                        <ComboboxInput />
                        <ComboboxTrigger />
                      </ComboboxControl>
                      <ComboboxContent class="overflow-auto" />
                    </Combobox>
                    <Show when={controlNeedsSlice(control()?.target)}>
                      <Select<SliceOption>
                        class="flex flex-col gap-2"
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
                        <SelectLabel>
                          Which{" "}
                          {target()?.value.startsWith("panadapter")
                            ? "slice's panadapter"
                            : target()?.value.startsWith("waterfall")
                              ? "slice's waterfall"
                              : "slice"}
                          ?
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
                  </div>
                ),
              },
              {
                title: "Behavior",
                description: (
                  <Show when={control()}>
                    <div class="flex flex-col gap-4 pt-2">
                      <Select<Behavior>
                        class="flex flex-col gap-2"
                        value={behavior()}
                        onChange={setBehavior}
                        disabled={currentBehaviorOptions().length <= 1}
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

                      <Switch>
                        <Match
                          when={
                            behavior() === "set-item" &&
                            choiceOptions().length > 0
                          }
                        >
                          <Select<string>
                            class="flex flex-col gap-2"
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
                            class="flex flex-col gap-2"
                            value={itemDirection()}
                            onChange={setItemDirection}
                            options={["previous", "next"]}
                            itemComponent={(props) => (
                              <SelectItem item={props.item} class="capitalize">
                                {props.item.rawValue}
                              </SelectItem>
                            )}
                          >
                            <SelectLabel>Direction</SelectLabel>
                            <SelectTrigger>
                              <SelectValue<
                                "next" | "previous"
                              > class="capitalize">
                                {(state) => state.selectedOption()}
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
                              class="flex flex-col gap-2"
                              value={valueDirection()}
                              onChange={setValueDirection}
                              options={["decrease", "increase"]}
                              itemComponent={(props) => (
                                <SelectItem
                                  item={props.item}
                                  class="capitalize"
                                >
                                  {props.item.rawValue}
                                </SelectItem>
                              )}
                            >
                              <SelectLabel>Direction</SelectLabel>
                              <SelectTrigger>
                                <SelectValue<
                                  "increase" | "decrease"
                                > class="capitalize">
                                  {(state) => state.selectedOption()}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent />
                            </Select>

                            <NumberField
                              class="flex flex-col gap-2 select-none"
                              rawValue={amount()}
                              minValue={0.000001}
                              onRawValueChange={setAmount}
                              changeOnWheel={false}
                              format={false}
                            >
                              <NumberFieldLabel class="select-none">
                                Amount
                              </NumberFieldLabel>
                              <NumberFieldGroup class="select-none">
                                <NumberFieldInput />
                                <NumberFieldIncrementTrigger class="select-none" />
                                <NumberFieldDecrementTrigger class="select-none" />
                              </NumberFieldGroup>
                            </NumberField>
                          </div>
                        </Match>

                        <Match
                          when={
                            behavior() === "change-value" &&
                            inputType() === "relative"
                          }
                        >
                          <NumberField
                            class="flex flex-col gap-2 select-none"
                            rawValue={amount()}
                            minValue={0.000001}
                            onRawValueChange={setAmount}
                            changeOnWheel={false}
                            format={false}
                          >
                            <NumberFieldLabel class="select-none">
                              Amount Per Step
                            </NumberFieldLabel>
                            <NumberFieldGroup class="select-none">
                              <NumberFieldInput />
                              <NumberFieldIncrementTrigger class="select-none" />
                              <NumberFieldDecrementTrigger class="select-none" />
                            </NumberFieldGroup>
                          </NumberField>
                        </Match>

                        <Match
                          when={
                            behavior() === "scale-value" &&
                            inputType() === "button"
                          }
                        >
                          <Select<"increase" | "decrease">
                            class="flex flex-col gap-2"
                            value={valueDirection()}
                            onChange={setValueDirection}
                            options={["increase", "decrease"]}
                            itemComponent={(props) => (
                              <SelectItem item={props.item} class="capitalize">
                                {props.item.rawValue === "increase"
                                  ? "Multiply"
                                  : "Divide"}
                              </SelectItem>
                            )}
                          >
                            <SelectLabel>Operation</SelectLabel>
                            <SelectTrigger>
                              <SelectValue<
                                "increase" | "decrease"
                              > class="capitalize">
                                {(state) =>
                                  state.selectedOption() === "increase"
                                    ? "Multiply"
                                    : "Divide"
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent />
                          </Select>

                          <SimpleSlider
                            label="Factor"
                            value={[factor()]}
                            onChange={setFactor}
                            minValue={0}
                            maxValue={1}
                            step={0.01}
                            getValueLabel={({ values: [value] }) =>
                              `${value * 100}%`
                            }
                          />
                        </Match>

                        <Match
                          when={
                            behavior() === "scale-value" &&
                            inputType() === "relative"
                          }
                        >
                          <SimpleSlider
                            label="Factor"
                            value={[factor()]}
                            onChange={setFactor}
                            minValue={0}
                            maxValue={1}
                            step={0.01}
                            getValueLabel={({ values: [value] }) =>
                              `${value * 100}%`
                            }
                          />
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
                          label="Invert"
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
                  </Show>
                ),
              },
            ]}
          />
        </div>

        <DialogFooter class="flex-row justify-between sm:justify-between items-center gap-4">
          <div class="text-xs text-muted-foreground">
            {draftMappingDescription()}
          </div>
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
  const [importFile, setImportFile] = createSignal<File>();

  const downloadUrl = createMemo(() => {
    const blob = new Blob([JSON.stringify(preferences.midiMappings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });

  createEffect(() => {
    const file = importFile();
    if (!file) return;
    const reader = new FileReader();
    const onLoad = (event: ProgressEvent<FileReader>) => {
      const mappings = JSON.parse(event.target.result as string);
      setPreferences("midiMappings", reconcile(mappings));
    };
    reader.addEventListener("load", onLoad, { once: true });
    reader.readAsText(file);
    onCleanup(() => reader.removeEventListener("load", onLoad));
  });

  return (
    <>
      <div class="flex flex-col gap-4 overflow-auto shrink">
        <Table class="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>MIDI</TableHead>
              <TableHead>Control</TableHead>
              <TableHead>Action</TableHead>
              <TableHead class="min-w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={preferences.midiMappings}>
              {(mapping, index) => (
                <TableRow>
                  <TableCell>
                    {mapping.midi.port
                      ? (inputs.get(mapping.midi.port)?.name ?? "Missing")
                      : "Any device"}
                  </TableCell>
                  <TableCell>{sourceToString(mapping.midi)}</TableCell>
                  <TableCell>{describeControl(mapping)}</TableCell>
                  <TableCell>{describeBehavior(mapping)}</TableCell>
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
      </div>
      <DialogFooter>
        <div class="sm:grow flex flex-col-reverse sm:flex-row gap-2">
          <Button as="label">
            <input
              class="hidden"
              type="file"
              onChange={(event) => {
                setImportFile(event.target.files.item(0));
              }}
            />
            Import
          </Button>
          <Button
            as="a"
            href={downloadUrl()}
            download="solid-sdr-midi-mappings.json"
          >
            Export
          </Button>
        </div>
        <AddMappingDialog />
      </DialogFooter>
    </>
  );
}

export function MidiSettings() {
  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden sm:max-w-10/12 sm:w-auto">
      <DialogHeader>
        <DialogTitle>MIDI Controllers</DialogTitle>
      </DialogHeader>
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
    </DialogContent>
  );
}
