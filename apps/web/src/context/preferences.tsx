import { ConfigColorMode } from "@kobalte/core";
import { makePersisted } from "@solid-primitives/storage";
import {
  createContext,
  type ParentComponent,
  useContext,
  createEffect,
} from "solid-js";
import { createStore, reconcile, SetStoreFunction } from "solid-js/store";
import { DaxChannelMode } from "~/lib/dax-audio-sink/types";
import { MidiMapping } from "~/lib/midi";

export type PeakStyle = "none" | "points" | "line";
export type FillStyle = "none" | "solid" | "gradient";
export type GradientStyle = "color" | "classic";
export type PanadapterSettingsStyle = "sidebar" | "floating";

export interface Gradient {
  name: string;
  stops: { color: string; offset: number }[];
}

export interface PaletteSettings {
  gradients: Gradient[];
}

export interface DaxRxConfig {
  enabled: boolean;
  outputDeviceId: string;
  channelMode: DaxChannelMode;
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

export interface Preferences {
  stationName: string;
  smoothScroll: boolean;
  enableBlurEffects: boolean;
  midiMappings: MidiMapping[];
  enableTransparencyEffects: boolean;
  spots: SpotPreferences;
  showDisplayMarkers: boolean;
  peakStyle: PeakStyle;
  fillStyle: FillStyle;
  gradientStyle: GradientStyle;
  meterStyle: "instant" | "smooth" | "ballistic";
  theme: ConfigColorMode;
  panBackgroundColor: string;
  showFps: boolean;
  sMeterEnabled: boolean;
  showTuningGuide: boolean;
  preventScreenSleep: boolean;
  palette: PaletteSettings;
  enableRemoteAudio: boolean;
  inputDeviceId: string;
  outputDeviceId: string;
  panadapterSizes: number[][];
  panadapterSettingsOpen: boolean[];
  panadapterSettingsStyle: PanadapterSettingsStyle;
  radioPanelOpen: boolean;
  sidebarPanels: string[];
  daxRxConfig: Record<number, DaxRxConfig>;
  guiClientId: string | null;
  daxTxConfig: {
    enabled: boolean;
    inputDeviceId: string;
    reducedBandwidth: boolean;
    channelMode: DaxChannelMode;
  };
}

const PreferencesContext = createContext<{
  preferences: Preferences;
  setPreferences: SetStoreFunction<Preferences>;
}>();

const defaultDaxConfig = () => {
  const config: Record<number, DaxRxConfig> = {};
  for (let i = 1; i <= 8; i++) {
    config[i] = {
      enabled: false,
      outputDeviceId: "default",
      channelMode: "both",
    };
  }
  return config;
};

const getDefaults = (): Preferences => ({
  stationName: "",
  smoothScroll: true,
  enableBlurEffects: true,
  enableTransparencyEffects: true,
  showDisplayMarkers: true,
  guiClientId: null,
  midiMappings: [],
  spots: {
    enabled: true,
    levels: 3,
    position: 0,
    fontSize: 1,
    verticalSpacing: 20,
    overrideColor: null,
    overrideBackgroundColor: null,
  },
  peakStyle: "points",
  fillStyle: "solid",
  gradientStyle: "color",
  meterStyle: "smooth",
  theme: "dark",
  panBackgroundColor: "#02517e",
  showFps: false,
  sMeterEnabled: true,
  showTuningGuide: false,
  preventScreenSleep: false,
  panadapterSettingsStyle: "floating",
  panadapterSizes: [],
  enableRemoteAudio: true,
  inputDeviceId: "default",
  outputDeviceId: "default",
  radioPanelOpen: true,
  sidebarPanels: ["tx", "p-cw", "phone", "rx", "eq"],
  panadapterSettingsOpen: [false, false, false, false],
  daxRxConfig: defaultDaxConfig(),
  daxTxConfig: {
    enabled: false,
    inputDeviceId: "default",
    reducedBandwidth: true,
    channelMode: "both",
  },
  palette: {
    gradients: [
      {
        name: "SmartSDR",
        stops: [
          { color: "#000000", offset: 0.0 },
          { color: "#0000ff", offset: 0.15 },
          { color: "#00ffff", offset: 0.25 },
          { color: "#00ff00", offset: 0.35 },
          { color: "#ffff00", offset: 0.55 },
          { color: "#ff0000", offset: 0.9 },
          { color: "#ffffff", offset: 1.0 },
        ],
      },
      {
        name: "SmartSDR + Purple",
        stops: [
          { color: "#000000", offset: 0.0 },
          { color: "#0000ff", offset: 0.15 },
          { color: "#00ffff", offset: 0.225 },
          { color: "#00ff00", offset: 0.3 },
          { color: "#ffff00", offset: 0.45 },
          { color: "#ff0000", offset: 0.6 },
          { color: "#ff00ff", offset: 0.75 },
          { color: "#ffffff", offset: 1.0 },
        ],
      },

      {
        name: "Dark",
        stops: [
          { color: "#000000", offset: 0.0 },
          { color: "#0000ff", offset: 0.65 },
          { color: "#00ff00", offset: 0.9 },
          { color: "#ff0000", offset: 0.95 },
          { color: "#ffb6c1", offset: 1.0 },
        ],
      },
      {
        name: "Grayscale",
        stops: [
          { color: "#000000", offset: 0.0 },
          { color: "#ffffff", offset: 1.0 },
        ],
      },
      {
        name: "Deuteranopia",
        stops: [
          { color: "#000000", offset: 0.0 },
          { color: "#083c6b", offset: 0.15 },
          { color: "#84a2d6", offset: 0.5 },
          { color: "#a59673", offset: 0.65 },
          { color: "#ffff00", offset: 0.75 },
          { color: "#ffff00", offset: 0.95 },
          { color: "#ffffff", offset: 1.0 },
        ],
      },
      {
        name: "Tritanopia",
        stops: [
          { color: "#000000", offset: 0.0 },
          { color: "#004552", offset: 0.15 },
          { color: "#6bbad6", offset: 0.45 },
          { color: "#4a0818", offset: 0.46 },
          { color: "#ff0000", offset: 0.9 },
          { color: "#d67984", offset: 0.99 },
          { color: "#ffffff", offset: 1.0 },
        ],
      },
      // {
      //   name: "Vintage Warm",
      //   stops: [
      //     { color: "#000000", offset: 0.0 },
      //     { color: "#1d4877", offset: 0.15 },
      //     { color: "#1ba4a1", offset: 0.25 },
      //     { color: "#1b8a5a", offset: 0.35 },
      //     { color: "#fbb021", offset: 0.55 },
      //     { color: "#ee3e32", offset: 0.6 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      // {
      //   name: "Vintage Warm + Pink",
      //   stops: [
      //     { color: "#000000", offset: 0.0 },
      //     { color: "#1d4877", offset: 0.15 },
      //     { color: "#1ba4a1", offset: 0.225 },
      //     { color: "#1b8a5a", offset: 0.3 },
      //     { color: "#fbb021", offset: 0.45 },
      //     { color: "#f68838", offset: 0.525 },
      //     { color: "#ee3e32", offset: 0.6 },
      //     { color: "#f36a82", offset: 0.75 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      // {
      //   name: "CMYK",
      //   stops: [
      //     { color: "#000000", offset: 0.0 },
      //     { color: "#00ffff", offset: 0.25 },
      //     { color: "#ffff00", offset: 0.5 },
      //     { color: "#ff00ff", offset: 0.75 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      // {
      //   name: "RGB",
      //   stops: [
      //     { color: "#000000", offset: 0.0 },
      //     { color: "#0000ff", offset: 0.25 },
      //     { color: "#00ff00", offset: 0.5 },
      //     { color: "#ff0000", offset: 0.75 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      // {
      //   name: "Solarized",
      //   stops: [
      //     { color: "#002b36", offset: 0.0 },
      //     { color: "#268bd2", offset: 0.15 },
      //     { color: "#2aa198", offset: 0.25 },
      //     { color: "#859900", offset: 0.35 },
      //     { color: "#b58900", offset: 0.55 },
      //     { color: "#dc322f", offset: 0.9 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      // {
      //   name: "Solarized + Pink",
      //   stops: [
      //     { color: "#002b36", offset: 0.0 },
      //     { color: "#268bd2", offset: 0.15 },
      //     { color: "#2aa198", offset: 0.225 },
      //     { color: "#859900", offset: 0.3 },
      //     { color: "#b58900", offset: 0.45 },
      //     { color: "#cb4b16", offset: 0.525 },
      //     { color: "#dc322f", offset: 0.6 },
      //     { color: "#d33682", offset: 0.75 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      // {
      //   name: "High Contrast",
      //   stops: [
      //     { color: "#000000", offset: 0.0 },
      //     { color: "#000080", offset: 0.15 },
      //     { color: "#00ffff", offset: 0.25 },
      //     { color: "#00ff00", offset: 0.3 },
      //     { color: "#ffff00", offset: 0.45 },
      //     { color: "#ff0000", offset: 0.6 },
      //     { color: "#ff00ff", offset: 0.75 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      // {
      //   name: "Contrasty",
      //   stops: [
      //     { color: "#000000", offset: 0.1 },
      //     // { color: "#400040", offset: 0.2 },
      //     { color: "#2a1049", offset: 0.2 },
      //     // { color: "#1f6a96", offset: 0.3 },
      //     { color: "#0090e2", offset: 0.4 },
      //     { color: "#009bb1", offset: 0.5 },
      //     { color: "#bedf0d", offset: 0.6 },
      //     // { color: "#ff0000", offset: 0.6 },
      //     { color: "#ff00ff", offset: 0.7 },
      //     { color: "#ffffff", offset: 1.0 },
      //   ],
      // },
      {
        name: "Spectral",
        stops: [
          { color: "#000000", offset: 0.1 },
          { color: "#330033", offset: 0.2 },
          { color: "#00ffff", offset: 0.3 },
          { color: "#ffff00", offset: 0.5 },
          { color: "#ff00ff", offset: 0.7 },
          { color: "#ffffff", offset: 1.0 },
        ],
      },
      {
        name: "Aurora",
        stops: [
          { color: "#000000", offset: 0.1 },
          { color: "#5f2a84", offset: 0.2 },
          { color: "#524096", offset: 0.3 },
          { color: "#2082a6", offset: 0.4 },
          { color: "#01cbae", offset: 0.5 },
          { color: "#01efac", offset: 0.6 },
          // { color: "#ff0000", offset: 0.6 },
          // { color: "#ff00ff", offset: 0.7 },
          { color: "#ffffff", offset: 1.0 },
        ],
      },
    ],
  },
});

const deepMerge = <T extends object>(target: T, source: T): T => {
  for (const [key, value] of Object.entries(source)) {
    const targetValue = target[key];
    if (targetValue === value) continue;
    if (targetValue === undefined) {
      if (Array.isArray(target)) target[key] = value;
      continue;
    }
    target[key] =
      typeof value === "object" && value !== null
        ? deepMerge(target[key], value)
        : value;
  }
  return target;
};

export const PreferencesProvider: ParentComponent = (props) => {
  const [store, setStore] = createStore(getDefaults());
  const [preferences, setPreferences] = makePersisted([store, setStore], {
    name: "preferences",
  });

  // populate any missing defaults, and clean up any deprecated/removed prefs
  setPreferences(
    reconcile(
      deepMerge(getDefaults(), JSON.parse(JSON.stringify(preferences))),
    ),
  );

  createEffect(() => {
    if (!preferences.enableTransparencyEffects) {
      document.documentElement.classList.add("disable-transparency-effects");
    } else {
      document.documentElement.classList.remove("disable-transparency-effects");
    }
  });

  createEffect(() => {
    if (!preferences.enableBlurEffects) {
      document.documentElement.classList.add("disable-blur-effects");
    } else {
      document.documentElement.classList.remove("disable-blur-effects");
    }
  });

  return (
    <PreferencesContext.Provider value={{ preferences, setPreferences }}>
      {props.children}
    </PreferencesContext.Provider>
  );
};

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }

  return context;
}
