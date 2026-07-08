import type { AppState } from "~/context/flexradio";

declare global {
  interface Window {
    state?: AppState;
    sendCommand?: (command: string) => Promise<{
      response: number;
      message: string;
      debugOutput: string;
    }>;
  }

  // Chrome-only constraint, not yet in lib.dom.
  interface MediaTrackSupportedConstraints {
    voiceIsolation?: boolean;
  }
}
