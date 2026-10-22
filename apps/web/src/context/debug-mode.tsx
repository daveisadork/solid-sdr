import type { FlexTransport } from "@repo/flexlib";
import { createContext, useContext } from "solid-js";

export interface DebugModeContextValue {
  enabled: boolean;
  messageCount: () => number;
  logCount: () => number;
  wrapTransportIfEnabled: (t: FlexTransport) => FlexTransport;
  generateReport: (input: {
    state: unknown;
    firmwareVersion: string | null;
    model: string | null;
  }) => string;
}

export const DebugModeContext = createContext<DebugModeContextValue>();

export function useDebugMode(): DebugModeContextValue {
  const ctx = useContext(DebugModeContext);
  if (!ctx)
    throw new Error("useDebugMode must be used inside DebugModeProvider");
  return ctx;
}
