import { createEffect, createMemo, onCleanup } from "solid-js";
import {
  CONTROL_REGISTRY,
  type ControlAction,
  useControls,
} from "~/context/controls";
import { usePreferences } from "~/context/preferences";
import {
  createMIDIPorts,
  MIDICommand,
  type MidiMapping,
  type ParsedMidiMessage,
  parseMidiMessage,
} from "~/lib/midi";

const COMMANDS_MAP: Record<MidiMapping["midi"]["kind"], MIDICommand[]> = {
  note: [MIDICommand.NoteOn, MIDICommand.NoteOff],
  cc: [MIDICommand.ControlChange],
  pitchBend: [MIDICommand.PitchBend],
};

function normalizedMidiValue(parsed: ParsedMidiMessage) {
  return parsed.command === MIDICommand.PitchBend
    ? parsed.value / 16383
    : parsed.value / 127;
}

function isButtonOn(parsed: ParsedMidiMessage, threshold = 0.5) {
  if (parsed.command === MIDICommand.NoteOff) return false;
  return normalizedMidiValue(parsed) >= threshold;
}

function relativeDelta(parsed: ParsedMidiMessage) {
  if (parsed.command !== MIDICommand.ControlChange) return 0;
  return parsed.value - 64;
}

function mappingLookupKey(mapping: MidiMapping, command: MIDICommand) {
  return `${command}:${mapping.midi.channel}:${mapping.midi.id}`;
}

export function MidiControl() {
  const { preferences } = usePreferences();
  const { dispatch, getChoices } = useControls();
  const { inputs } = createMIDIPorts();

  const onMessage = createMemo(() => {
    const lookup = new Map<string, { index: number; mapping: MidiMapping }[]>();
    const buttonStates = new Map<number, boolean>();

    preferences.midiMappings.forEach((mapping, index) => {
      for (const command of COMMANDS_MAP[mapping.midi.kind]) {
        const key = mappingLookupKey(mapping, command);
        const group = lookup.get(key);
        if (group) {
          group.push({ index, mapping });
        } else {
          lookup.set(key, [{ index, mapping }]);
        }
      }
    });

    return function onMessage(this: MIDIInput, message: MIDIMessageEvent) {
      const parsed = parseMidiMessage(message);
      const matches = lookup.get(parsed.key);
      if (!matches) return;

      for (const { index, mapping } of matches) {
        if (mapping.midi.port && mapping.midi.port !== parsed.port) continue;

        const definition = CONTROL_REGISTRY[mapping.control.target];
        const baseAction = mapping.control.slice
          ? { target: mapping.control.target, slice: mapping.control.slice }
          : { target: mapping.control.target };

        switch (mapping.behavior) {
          case "set-value": {
            if (
              definition.editor.kind !== "normalized" &&
              definition.editor.kind !== "signed-normalized"
            ) {
              continue;
            }

            let value = normalizedMidiValue(parsed);
            if (mapping.invert) value = 1 - value;

            dispatch({
              ...baseAction,
              op: "set",
              value:
                definition.editor.kind === "signed-normalized"
                  ? value * 2 - 1
                  : value,
            } as ControlAction);
            continue;
          }

          case "select-from-list": {
            if (definition.editor.kind !== "choice") continue;
            const choices = getChoices(
              mapping.control.target,
              mapping.control.slice,
            );
            if (choices.length === 0) continue;

            const percent = normalizedMidiValue(parsed);
            const choiceIndex = Math.min(
              choices.length - 1,
              Math.floor(percent * choices.length),
            );

            dispatch({
              ...baseAction,
              op: "set",
              value: choices[choiceIndex],
            } as ControlAction);
            continue;
          }

          case "toggle": {
            const current = isButtonOn(parsed, mapping.threshold ?? 0.5);
            const previous = buttonStates.get(index) ?? false;
            buttonStates.set(index, current);
            if (!current || previous) continue;

            dispatch({
              ...baseAction,
              op: "toggle",
            } as ControlAction);
            continue;
          }

          case "follow-button": {
            const current = isButtonOn(parsed, mapping.threshold ?? 0.5);
            const previous = buttonStates.get(index);
            buttonStates.set(index, current);
            if (previous === current) continue;

            dispatch({
              ...baseAction,
              op: "set",
              value: mapping.invert ? !current : current,
            } as ControlAction);
            continue;
          }

          case "press": {
            const current = isButtonOn(parsed, mapping.threshold ?? 0.5);
            const previous = buttonStates.get(index) ?? false;
            buttonStates.set(index, current);
            if (!current || previous) continue;

            dispatch(baseAction as ControlAction);
            continue;
          }

          case "set-item": {
            const current = isButtonOn(parsed, mapping.threshold ?? 0.5);
            const previous = buttonStates.get(index) ?? false;
            buttonStates.set(index, current);
            if (!current || previous) continue;

            dispatch({
              ...baseAction,
              op: "set",
              value: mapping.value,
            } as ControlAction);
            continue;
          }

          case "change-item": {
            let delta = 0;

            if (mapping.input === "button") {
              const current = isButtonOn(parsed, mapping.threshold ?? 0.5);
              const previous = buttonStates.get(index) ?? false;
              buttonStates.set(index, current);
              if (!current || previous) continue;
              delta = mapping.direction === "next" ? 1 : -1;
            } else {
              const raw = relativeDelta(parsed);
              if (raw === 0) continue;
              delta = (mapping.invert ? -raw : raw) > 0 ? 1 : -1;
            }

            dispatch({
              ...baseAction,
              op: "cycle",
              delta,
            } as ControlAction);
            continue;
          }

          case "change-value": {
            let delta = 0;

            if (mapping.input === "button") {
              const current = isButtonOn(parsed, mapping.threshold ?? 0.5);
              const previous = buttonStates.get(index) ?? false;
              buttonStates.set(index, current);
              if (!current || previous) continue;
              delta =
                (mapping.direction === "increase" ? 1 : -1) * mapping.amount;
            } else {
              const raw = relativeDelta(parsed);
              if (raw === 0) continue;
              delta = raw * mapping.amount * (mapping.invert ? -1 : 1);
            }

            dispatch({
              ...baseAction,
              op: "adjust",
              delta,
            } as ControlAction);
            continue;
          }

          case "scale-value": {
            if (mapping.control.target !== "panadapter.bandwidth") continue;

            let change: "increase" | "decrease";

            if (mapping.input === "button") {
              const current = isButtonOn(parsed, mapping.threshold ?? 0.5);
              const previous = buttonStates.get(index) ?? false;
              buttonStates.set(index, current);
              if (!current || previous) continue;
              change = mapping.direction;
            } else {
              const raw = relativeDelta(parsed);
              if (raw === 0) continue;
              change =
                (mapping.invert ? -raw : raw) > 0 ? "increase" : "decrease";
            }

            dispatch({
              ...baseAction,
              target: "panadapter.bandwidth",
              change,
              factor: mapping.factor,
            } as ControlAction);
          }
        }
      }
    };
  });

  createEffect(() => {
    const handler = onMessage();
    inputs.forEach((input) => {
      input.addEventListener("midimessage", handler);
    });
    onCleanup(() =>
      inputs.forEach((input) => {
        input.removeEventListener("midimessage", handler);
      }),
    );
  });
}
