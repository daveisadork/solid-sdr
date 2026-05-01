import { type Accessor, createMemo, createSignal } from "solid-js";
import { ReactiveMap } from "@solid-primitives/map";
import { synchronizeMaps } from "../utils";

const inputs = new ReactiveMap<string, MIDIInput>();
const outputs = new ReactiveMap<string, MIDIOutput>();
const [access, setAccess] = createSignal<MIDIAccess | undefined>();

let accessRequest: Promise<MIDIAccess | undefined> | undefined;
let attachedAccess: MIDIAccess | undefined;

function syncPorts(midi?: MIDIAccess) {
  synchronizeMaps(inputs, midi?.inputs);
  synchronizeMaps(outputs, midi?.outputs);
}

function onStateChange() {
  syncPorts(attachedAccess);
}

function ensureMIDIAccess(options?: MIDIOptions) {
  if (accessRequest || typeof navigator === "undefined") return accessRequest;
  if (!navigator.requestMIDIAccess) return;

  accessRequest = navigator.requestMIDIAccess(options).then((midi) => {
    if (attachedAccess !== midi) {
      attachedAccess?.removeEventListener("statechange", onStateChange);
      attachedAccess = midi;
      midi.addEventListener("statechange", onStateChange);
    }

    setAccess(midi);
    syncPorts(midi);
    return midi;
  });

  return accessRequest;
}

export function createMIDIAccess(
  options?: MIDIOptions,
): Accessor<MIDIAccess | undefined> {
  void ensureMIDIAccess(options);
  return access;
}

export function createMIDIPorts(options?: MIDIOptions) {
  void ensureMIDIAccess(options);
  return { inputs, outputs };
}

export function createReactiveMIDIAccess(
  options?: MIDIOptions,
): Accessor<MIDIAccess | undefined> {
  const midiAccess = createMIDIAccess(options);

  const accessProxy = createMemo(() => {
    const midi = midiAccess();
    if (!midi) return undefined;

    return new Proxy(midi, {
      get(target, prop, receiver) {
        if (prop === "inputs") return inputs;
        if (prop === "outputs") return outputs;
        return Reflect.get(target, prop, receiver);
      },
    });
  });

  return accessProxy;
}
