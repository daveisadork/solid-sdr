import { createEffect, createMemo, onCleanup } from "solid-js";
import { ControlAction, useControls } from "~/context/controls";

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

export interface ParsedMessage {
  key: number;
  command: MIDICommand;
  channel: number;
  note: number;
  velocity: number;
}

/**
 * Parse basic information out of a MIDI message.
 */
export function parseMidiMessage(message: MIDIMessageEvent): ParsedMessage {
  return {
    key: (message.data[0] << 8) + message.data[1],
    command: message.data[0] >> 4,
    channel: message.data[0] & 0xf,
    note: message.data[1],
    velocity: message.data[2],
  };
}
export function MidiControl() {
  const { dispatch } = useControls();

  const mapping = new Map<number, ControlAction["target"]>([
    [45156, "slice.frequency"],
    [36867, "panadapter.bandwidth"],
  ]);

  function onMessage(this: MIDIInput, message: MIDIMessageEvent) {
    const parsed = parseMidiMessage(message);
    switch (parsed.key) {
      case 45156:
        dispatch({
          target: "slice.frequency",
          op: "adjust",
          delta: parsed.velocity - 64,
        });
        break;
      case 45157:
        dispatch({
          target: "slice.audio.level",
          op: "set",
          value: parsed.velocity / 127,
        });
        break;

      case 36865: // button 1
        dispatch({
          target: "slice.rnn.enabled",
          op: "toggle",
        });
        break;
      case 36866: // button 2
        break;
      case 36867: // button 3
        dispatch({
          target: "panadapter.bandZoom",
          op: "toggle",
        });
        break;
      case 36868: // button 4
        dispatch({
          target: "panadapter.segmentZoom",
          op: "toggle",
        });
        break;
      case 36869: // button 5
        break;
      case 36870: // button 6
        break;
      default:
        console.log(parsed);
    }
  }

  createEffect(() => {
    const promise = navigator.requestMIDIAccess?.({ sysex: true });
    promise?.then((result) => {
      result.inputs.forEach((input) => {
        console.log("Adding event listener to", input.name);
        input.addEventListener("midimessage", onMessage);
      });
    });
    onCleanup(() => {
      promise?.then((result) => {
        result.inputs.forEach((input) => {
          console.log("Removing event listener from", input.name);
          input.removeEventListener("midimessage", onMessage);
        });
      });
    });
  });
  return <></>;
}
