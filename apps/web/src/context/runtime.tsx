import { createContext, ParentComponent, useContext } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";

export interface SliceSplitState {
  parent: string | null;
  child: string | null;
}

export interface RuntimeState {
  fps: Record<string, number>;
  split: Record<string, SliceSplitState>;
}

const RuntimeContext = createContext<{
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
    split: {},
  });

  return (
    <RuntimeContext.Provider value={{ runtime, setRuntime }}>
      {props.children}
    </RuntimeContext.Provider>
  );
};
