import { createEffect, createMemo, onCleanup } from "solid-js";
import { ControlAction, useControls } from "~/context/controls";
import { MidiMapping, usePreferences } from "~/context/preferences";
import { createMIDIPorts } from "~/lib/midi";

export enum MIDICommand {
  NoteOn = 8,
  NoteOff = 9,
  PolyAftertouch = 10,
  ControlChange = 11,
  ProgramChange = 12,
  ChanAftertouch = 13,
  PitchBend = 14,
  SystemMessage = 15,
}

export interface ParsedMidiMessage {
  // the id of the port where the message originated
  port: string;
  command: MIDICommand;
  channel: number;

  // Present for note/cc/poly-aftertouch, absent for pitch bend.
  id: number | null;

  // The thing you usually care about operationally.
  value: number;

  // Stable identity for mapping/routing.
  key: string;
}

export function parseMidiMessage(message: MIDIMessageEvent): ParsedMidiMessage {
  const [status = 0, data1, data2] = message.data;
  const command = status >> 4;
  const channel = status & 0x0f;
  const port = (message.target as MIDIPort).id;

  switch (command) {
    case MIDICommand.NoteOn:
    case MIDICommand.NoteOff:
    case MIDICommand.ControlChange:
    case MIDICommand.PolyAftertouch:
      return {
        port,
        command,
        channel,
        id: data1 ?? null,
        value: data2 ?? 0,
        key: `${command}:${channel}:${data1 ?? 0}`,
      };

    case MIDICommand.PitchBend: {
      const lsb = data1 ?? 0;
      const msb = data2 ?? 0;
      const value = (msb << 7) | lsb;

      return {
        port,
        command,
        channel,
        id: null,
        value,
        key: `${command}:${channel}:null`,
      };
    }

    case MIDICommand.ProgramChange:
    case MIDICommand.ChanAftertouch:
      return {
        port,
        command,
        channel,
        id: null,
        value: data1 ?? 0,
        key: `${command}:${channel}:null`,
      };

    default:
      return {
        port,
        command,
        channel,
        id: null,
        value: data2 ?? data1 ?? 0,
        key: `${command}:${channel}:null`,
      };
  }
}

const COMMANDS_MAP: Record<MidiMapping["midi"]["kind"], MIDICommand[]> = {
  note: [MIDICommand.NoteOn, MIDICommand.NoteOff],
  cc: [MIDICommand.ControlChange],
  pitchBend: [MIDICommand.PitchBend],
};

export function MidiControl() {
  const { preferences } = usePreferences();
  const { dispatch } = useControls();
  const { inputs } = createMIDIPorts();

  const createOnMessage = createMemo((mappings: Map<string, MidiMapping>) => {
    function onMessage(this: MIDIInput, message: MIDIMessageEvent) {
      const parsed = parseMidiMessage(message);
      const mapping = mappings.get(parsed.key);
      if (!mapping) {
        console.log("ignoring unmapped message", parsed);
      }
      // build and dispatch action
    }
    return onMessage;
  });

  const onMessage = createMemo(() => {
    const mappings = new Map<string, MidiMapping>();
    for (const mapping of preferences.midiMappings) {
      for (const command of COMMANDS_MAP[mapping.midi.kind]) {
        const key = `${command}:${mapping.midi.channel}:${mapping.midi.id}`;
        mappings.set(key, mapping);
      }
    }
    return function onMessage(this: MIDIInput, message: MIDIMessageEvent) {
      const parsed = parseMidiMessage(message);
      const mapping = mappings.get(parsed.key);
      if (!mapping) {
        console.log("ignoring unmapped message", parsed);
      }
      // build and dispatch action
    };
  });

  function oldOnMessage(this: MIDIInput, message: MIDIMessageEvent) {
    const parsed = parseMidiMessage(message);
    switch (parsed.key) {
      case "11:0:100":
        dispatch({
          target: "slice.frequency",
          op: "adjust",
          delta: parsed.value - 64,
        });
        break;
      case "11:0:101":
        dispatch({
          target: "slice.audio.level",
          op: "set",
          value: parsed.value / 127,
        });
        break;

      case "8:0:1": // button 1 on
      case "9:0:1": // button 1 off
        dispatch({
          target: "slice.rnn.enabled",
          op: "set",
          value: parsed.command === MIDICommand.NoteOn && parsed.value > 0,
        });
        break;
      case "8:0:2": // button 2
        break;
      case "8:0:3": // button 3
        dispatch({
          target: "panadapter.bandZoom",
          op: "toggle",
        });
        break;
      case "8:0:4": // button 4
        dispatch({
          target: "panadapter.segmentZoom",
          op: "toggle",
        });
        break;
      case "8:0:5": // button 5
        break;
      case "8:0:6": // button 6
        break;
      default:
        console.log(parsed);
    }
  }

  createEffect(() => {
    const handler = onMessage();
    inputs.forEach((input) => input.addEventListener("midimessage", handler));
    onCleanup(() =>
      inputs.forEach((input) =>
        input.removeEventListener("midimessage", handler),
      ),
    );
  });
  return <></>;
}
