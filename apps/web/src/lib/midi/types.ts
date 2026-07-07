import type { ControlTarget, SliceSelector } from "~/context/controls";

export enum MIDICommand {
  NoteOff = 8,
  NoteOn = 9,
  PolyAftertouch = 10,
  ControlChange = 11,
  ProgramChange = 12,
  ChanAftertouch = 13,
  PitchBend = 14,
  SystemMessage = 15,
}

export type MidiSource =
  | { port?: string | null; channel: number; kind: "cc" | "note"; id: number }
  | {
      port?: string | null;
      channel: number;
      kind: "pitchBend";
      id?: null;
    };

type MidiControlRef = {
  target: ControlTarget;
  slice?: SliceSelector;
};

type AbsoluteMidiSource = Extract<MidiSource, { kind: "cc" | "pitchBend" }>;
type ButtonMidiSource = Extract<MidiSource, { kind: "cc" | "note" }>;
type RelativeMidiSource = Extract<MidiSource, { kind: "cc" }>;

type AbsoluteMidiMapping =
  | {
      midi: AbsoluteMidiSource;
      input: "ranged";
      behavior: "set-value";
      control: MidiControlRef;
      invert?: boolean;
    }
  | {
      midi: AbsoluteMidiSource;
      input: "ranged";
      behavior: "select-from-list";
      control: MidiControlRef;
    };

type ButtonMidiMappingBase = {
  midi: ButtonMidiSource;
  input: "button";
  control: MidiControlRef;
  threshold?: number;
};

type ButtonMidiMapping =
  | (ButtonMidiMappingBase & {
      behavior: "toggle";
    })
  | (ButtonMidiMappingBase & {
      behavior: "follow-button";
      invert?: boolean;
    })
  | (ButtonMidiMappingBase & {
      behavior: "press";
    })
  | (ButtonMidiMappingBase & {
      behavior: "set-item";
      value: string | number;
    })
  | (ButtonMidiMappingBase & {
      behavior: "change-item";
      direction: "next" | "previous";
    })
  | (ButtonMidiMappingBase & {
      behavior: "change-value";
      direction: "increase" | "decrease";
      amount: number;
    })
  | (ButtonMidiMappingBase & {
      behavior: "scale-value";
      direction: "increase" | "decrease";
      factor: number;
    });

type RelativeMidiMappingBase = {
  midi: RelativeMidiSource;
  input: "relative";
  control: MidiControlRef;
  invert?: boolean;
};

type RelativeMidiMapping =
  | (RelativeMidiMappingBase & {
      behavior: "change-item";
    })
  | (RelativeMidiMappingBase & {
      behavior: "change-value";
      amount: number;
    })
  | (RelativeMidiMappingBase & {
      behavior: "scale-value";
      factor: number;
    });

export type MidiMapping =
  | AbsoluteMidiMapping
  | ButtonMidiMapping
  | RelativeMidiMapping;
