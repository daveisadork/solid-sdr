import { Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { ReactiveMap } from "@solid-primitives/map";

export const createMIDIAccess = (
  options?: MIDIOptions,
): Accessor<MIDIAccess> => {
  const [access, setAccess] = createSignal<MIDIAccess | undefined>();

  navigator?.requestMIDIAccess?.(options).then(setAccess);

  return access;
};

export const createMIDIPorts = (options?: MIDIOptions) => {
  const inputs = new ReactiveMap<string, MIDIInput>();
  const outputs = new ReactiveMap<string, MIDIOutput>();
  const access = createMIDIAccess(options);

  const update = () => {
    const midi = access();
    if (!midi) {
      inputs.clear();
      outputs.clear();
      return;
    }
    inputs
      .keys()
      .filter((key) => !midi.inputs.has(key))
      .toArray()
      .forEach((key) => inputs.delete(key));
    midi.inputs.forEach((port, key) => {
      if (!inputs.has(key)) inputs.set(key, port);
    });
    outputs
      .keys()
      .filter((key) => !midi.outputs.has(key))
      .toArray()
      .forEach((key) => outputs.delete(key));
    midi.outputs.forEach((port, key) => {
      if (!outputs.has(key)) outputs.set(key, port);
    });
  };

  createEffect(() => {
    const midi = access();
    if (!midi) return;
    midi.addEventListener("statechange", update);
    onCleanup(() => midi.removeEventListener("statechange", update));
    update();
  });

  return { inputs, outputs };
};

export const createReactiveMIDIAccess = (
  options?: MIDIOptions,
): Accessor<MIDIAccess> => {
  const access = createMIDIAccess(options);
  const { inputs, outputs } = createMIDIPorts(options);
  const [proxy, setProxy] = createSignal<MIDIAccess | undefined>();

  createEffect(() => {
    const midi = access();
    if (!access) {
      setProxy();
      return;
    }
    setProxy(
      new Proxy(midi, {
        get(target, prop, receiver) {
          switch (prop) {
            case "inputs":
              return inputs;
            case "outputs":
              return outputs;
            default:
              return Reflect.get(target, prop, receiver);
          }
        },
      }),
    );
  });

  return proxy;
};
