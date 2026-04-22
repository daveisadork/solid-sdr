import { ReactiveMap } from "@solid-primitives/map";
import { createContext, ParentComponent, useContext } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";

export interface RuntimeState {
  fps: Record<string, number>;
}

const RuntimeContext = createContext<{
  fps: ReactiveMap<string, number>;
  runtime: RuntimeState;
  setRuntime: SetStoreFunction<RuntimeState>;
}>();

export function useRuntime() {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("useRuntime must be used within <RuntimeProvider>");
  return ctx;
}

export const RuntimeProvider: ParentComponent = (props) => {
  const [runtime, setRuntime] = createStore<RuntimeState>({
    fps: {},
  });
  const fps = new ReactiveMap<string, number>();

  return (
    <RuntimeContext.Provider value={{ runtime, setRuntime, fps }}>
      {props.children}
    </RuntimeContext.Provider>
  );
};
