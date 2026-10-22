import type { ConfigColorMode } from "@kobalte/core";
import { createContext, useContext } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import type { DaxChannelMode } from "~/lib/dax-audio-sink/types";
import type { MidiMapping } from "~/lib/midi";

export type PeakStyle = "none" | "points" | "line";
export type FillStyle = "none" | "solid" | "gradient";
export type GradientStyle = "color" | "classic";
export type SliceTxMeter = "power" | "swr";

export interface Gradient {
  name: string;
  stops: { color: string; offset: number }[];
}

export interface PaletteSettings {
  gradients: Gradient[];
}

export interface TxAudioConfig {
  enabled: boolean;
  inputDeviceId: string;
  autoGainControl: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  voiceIsolation: boolean;
}

export interface RxAudioConfig {
  enabled: boolean;
  outputDeviceId: string;
}

export interface DaxTxConfig extends TxAudioConfig {
  reducedBandwidth: boolean;
  channelMode: DaxChannelMode;
}

export interface DaxRxConfig extends RxAudioConfig {
  channelMode: DaxChannelMode;
  gain: number;
}

export interface DaxIqConfig {
  enabled: boolean;
  sampleRate: number;
  outputDeviceId: string;
}

export interface SpotPreferences {
  enabled: boolean;
  levels: number;
  position: number;
  verticalSpacing: number;
  fontSize: number;
  overrideColor?: string | null;
  overrideBackgroundColor?: string | null;
}

export interface CwxPreferences {
  /** Live mode transmits each character as it is typed. */
  live: boolean;
  /** Enable Alt+1…Alt+= macro hotkeys while the CWX panel is visible. */
  macroHotkeys: boolean;
}

export interface DvkPreferences {
  /** Enable Alt+1…Alt+= playback hotkeys while the DVK panel is visible. */
  playbackHotkeys: boolean;
  compactLayout: boolean;
}

export interface Preferences {
  stationName: string;
  smoothScroll: boolean;
  mousewheelTuning: boolean;
  invertMousewheelTuning: boolean;
  enableBlurEffects: boolean;
  midiMappings: MidiMapping[];
  enableTransparencyEffects: boolean;
  spots: SpotPreferences;
  showDisplayMarkers: boolean;
  peakStyle: PeakStyle;
  fillStyle: FillStyle;
  gradientStyle: GradientStyle;
  sliceTxMeter: SliceTxMeter;
  meterStyle: "instant" | "smooth" | "ballistic";
  theme: ConfigColorMode;
  panBackgroundColor: string;
  showFps: boolean;
  sMeterEnabled: boolean;
  showTuningGuide: boolean;
  showTxFilterInPan: boolean;
  preventScreenSleep: boolean;
  palette: PaletteSettings;
  panadapterOffset: number;
  waterfallOffset: number;
  networkMtu: number;
  remoteAudio: {
    tx: TxAudioConfig;
    rx: RxAudioConfig;
  };
  dax: {
    tx: DaxTxConfig;
    rx: Record<number, DaxRxConfig>;
    iq: Record<number, DaxIqConfig>;
  };
  /** Per panafall index: fractions of the pan/waterfall vertical split. */
  panadapterSizes: [number, number][];
  radioPanelOpen: boolean;
  sidebarPanels: string[];
  toolsPanelOpen: boolean;
  toolsPanel: string;
  cwx: CwxPreferences;
  dvk: DvkPreferences;
  guiClientId: string | null;
}

export const PreferencesContext = createContext<{
  preferences: Preferences;
  setPreferences: SetStoreFunction<Preferences>;
}>();

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }

  return context;
}
