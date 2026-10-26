import { createSignal, onCleanup, type ParentComponent } from "solid-js";
import {
  assembleReport,
  CaptureBuffers,
  installConsoleCapture,
  wrapTransport,
} from "~/lib/debug-mode";
import { APP_VERSION } from "~/lib/version";
import { DebugModeContext, type DebugModeContextValue } from "./debug-mode";

function readDebugFlag(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "true";
}

export const DebugModeProvider: ParentComponent = (props) => {
  const enabled = readDebugFlag();
  const buffers = new CaptureBuffers();
  const [messageCount, setMessageCount] = createSignal(0);
  const [logCount, setLogCount] = createSignal(0);

  if (enabled) {
    const teardown = installConsoleCapture(buffers);
    const interval = setInterval(() => {
      setMessageCount(buffers.messageCount);
      setLogCount(buffers.logCount);
    }, 500);
    onCleanup(() => {
      clearInterval(interval);
      teardown();
    });
  }

  const value: DebugModeContextValue = {
    enabled,
    messageCount,
    logCount,
    wrapTransportIfEnabled: (t) => (enabled ? wrapTransport(t, buffers) : t),
    generateReport: ({ state, firmwareVersion, model }) =>
      assembleReport({
        meta: {
          generatedAt: new Date().toISOString(),
          solidSdrVersion: APP_VERSION,
          firmwareVersion,
          model,
          captureDurationMs: buffers.captureDurationMs,
        },
        state,
        messages: buffers.messages,
        logs: buffers.logs,
      }),
  };

  return (
    <DebugModeContext.Provider value={value}>
      {props.children}
    </DebugModeContext.Provider>
  );
};
