import { MIDICommand } from ".";

export interface ParsedMidiMessage {
  port: string;
  command: MIDICommand;
  channel: number;
  id: number | null;
  value: number;
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
      return {
        port,
        command,
        channel,
        id: null,
        value: (msb << 7) | lsb,
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
