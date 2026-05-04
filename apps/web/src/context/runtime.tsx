import {
  createContext,
  createEffect,
  createSignal,
  ParentComponent,
  useContext,
} from "solid-js";
import { createStore, produce, SetStoreFunction } from "solid-js/store";
import useFlexRadio from "./flexradio";
import { usePreferences } from "./preferences";
import { createPageVisibility } from "@solid-primitives/page-visibility";

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
  const { state } = useFlexRadio();
  const { preferences } = usePreferences();
  const [runtime, setRuntime] = createStore<RuntimeState>({
    fps: {},
    split: {},
  });

  const visible = createPageVisibility();

  const [wakeLock, setWakeLock] = createSignal<WakeLockSentinel>();

  createEffect(() => {
    if (!(preferences.preventScreenSleep && state.clientHandle))
      return wakeLock()?.release();
    if (wakeLock()?.released !== false && visible()) {
      console.debug("Requesting wake lock");
      navigator.wakeLock?.request("screen").then(setWakeLock);
    }
  });

  createEffect(() => {
    const slices = new Set(Object.keys(state.status.slice));
    setRuntime(
      "split",
      produce((split) => {
        Object.entries(split).forEach(([key, value]) => {
          if (!(slices.has(key) && slices.has(value.child || value.parent))) {
            delete split[key];
          }
        });
      }),
    );
  });

  return (
    <RuntimeContext.Provider value={{ runtime, setRuntime }}>
      {props.children}
    </RuntimeContext.Provider>
  );
};
