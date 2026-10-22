import { createContext, useContext } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import type {
  NetworkQuality,
  RuntimeNetworkState,
} from "~/lib/network-telemetry";

export interface SliceSplitState {
  parent: string | null;
  child: string | null;
}

export interface RuntimeState {
  fps: Record<string, number>;
  split: Record<string, SliceSplitState>;
  network: RuntimeNetworkState;
  /** Whether the touch tuning panel is open. Targets the active slice. */
  tuningPanelOpen: boolean;
}

export type { NetworkQuality };

export const RuntimeContext = createContext<{
  runtime: RuntimeState;
  setRuntime: SetStoreFunction<RuntimeState>;
}>();

export function useRuntime() {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("useRuntime must be used within <RuntimeProvider>");
  return ctx;
}
