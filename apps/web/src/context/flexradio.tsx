import type {
  ApdSnapshot,
  AudioStreamSnapshot,
  AutoDxSnapshot,
  CwDecoderSnapshot,
  CwxSnapshot,
  DisconnectedReason,
  DisplayMarkerSnapshot,
  DvkSnapshot,
  EqualizerSnapshot,
  FeatureLicenseSnapshot,
  FilterPresetSnapshot,
  FlexClient,
  FlexRadioDescriptor,
  GuiClientSnapshot,
  MemorySnapshot,
  MeterSnapshot,
  NtpSourceSnapshot,
  PanadapterSnapshot,
  PresetSnapshot,
  Radio,
  RadioSnapshot,
  SliceSnapshot,
  SpotSnapshot,
  TnfSnapshot,
  TxBandSettingSnapshot,
  WaterfallSnapshot,
  WaveformSnapshot,
  XvtrSnapshot,
} from "@repo/flexlib";
import type { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createContext, useContext } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";

declare global {
  // Debug handles exposed for use from the browser console
  var radio: Radio | null;
  var state: AppState;
  var sendCommand: (command: string) => Promise<{
    response: number;
    message: string;
    debugOutput?: string;
  }>;
  var flexradio: unknown;
}

export enum ConnectionState {
  disconnected,
  connecting,
  connected,
}

export enum ConnectionStage {
  TCP = 0,
  Data = 1,
  UDP = 2,
  Done = 3,
}

export interface Gradient {
  name: string;
  stops: { color: string; offset: number }[];
}

type MutableProps<T> = {
  -readonly [P in keyof T]: T[P];
};

export type RadioState = Omit<MutableProps<RadioSnapshot>, "raw">;
export type SliceState = Omit<MutableProps<SliceSnapshot>, "raw">;
export type PanadapterState = Omit<MutableProps<PanadapterSnapshot>, "raw">;
export type WaterfallState = Omit<MutableProps<WaterfallSnapshot>, "raw">;
export type AudioStreamState = Omit<MutableProps<AudioStreamSnapshot>, "raw">;
export type FeatureLicenseState = Omit<
  MutableProps<FeatureLicenseSnapshot>,
  "raw"
>;
export type GuiClientState = Omit<MutableProps<GuiClientSnapshot>, "raw">;
export type EqualizerState = Omit<MutableProps<EqualizerSnapshot>, "raw">;
export type APDState = Omit<MutableProps<ApdSnapshot>, "raw">;
export type TxBandSettingState = Omit<
  MutableProps<TxBandSettingSnapshot>,
  "raw"
>;
export type MeterState = Omit<MutableProps<MeterSnapshot>, "raw">;
export type XvtrState = Omit<MutableProps<XvtrSnapshot>, "raw">;
export type CwxState = Omit<MutableProps<CwxSnapshot>, "raw">;
export type DvkState = Omit<MutableProps<DvkSnapshot>, "raw">;
export type SpotState = Omit<MutableProps<SpotSnapshot>, "raw">;
export type TnfState = Omit<MutableProps<TnfSnapshot>, "raw">;
export type MemoryState = Omit<MutableProps<MemorySnapshot>, "raw">;
export type WaveformState = Omit<MutableProps<WaveformSnapshot>, "raw">;
export type DisplayMarkerState = Omit<
  MutableProps<DisplayMarkerSnapshot>,
  "raw"
>;
export type FilterPresetState = Omit<MutableProps<FilterPresetSnapshot>, "raw">;
export type CwDecoderState = Omit<MutableProps<CwDecoderSnapshot>, "raw">;
export type AutoDxState = Omit<MutableProps<AutoDxSnapshot>, "raw">;
export type PresetState = Omit<MutableProps<PresetSnapshot>, "raw">;
export type NtpSourceState = Omit<MutableProps<NtpSourceSnapshot>, "raw">;

export interface ConnectModalState {
  status: ConnectionState;
  selectedRadio: string | null;
  stage: ConnectionStage;
}

export interface StatusState {
  apd: APDState;
  meter: Record<string, MeterState>;
  equalizer: Record<string, EqualizerState>;
  slice: Record<string, SliceState>;
  panadapter: Record<string, PanadapterState>;
  waterfall: Record<string, WaterfallState>;
  radio: RadioState;
  featureLicense: FeatureLicenseState;
  audioStream: Record<string, AudioStreamState>;
  spot: Record<string, SpotState>;
  guiClient: Record<string, GuiClientState>;
  txBandSetting: Record<string, TxBandSettingState>;
  tnf: Record<string, TnfState>;
  memory: Record<string, MemoryState>;
  xvtr: Record<string, XvtrState>;
  waveform: Record<string, WaveformState>;
  cwx: CwxState;
  dvk: DvkState;
  displayMarker: Record<string, Record<string, DisplayMarkerState>>;
  filterPreset: FilterPresetState;
  cwDecoder: Record<string, CwDecoderState>;
  autoDx: Record<string, AutoDxState>;
  preset: Record<string, PresetState>;
  ntpSource: Record<string, NtpSourceState>;
}

export interface AppState {
  clientHandle: string | null;
  clientHandleInt: number | null;
  selectedPanadapter: string | null;
  discoveredRadios: Record<string, FlexRadioDescriptor>;
  connectModal: ConnectModalState;
  status: StatusState;
}

export const initialState = () =>
  ({
    clientHandle: null,
    clientHandleInt: null,
    selectedPanadapter: null,
    connectModal: {
      status: ConnectionState.disconnected,
    },
    discoveredRadios: {},
    status: {
      apd: {},
      meter: {},
      equalizer: {},
      slice: {},
      panadapter: {},
      waterfall: {},
      guiClient: {},
      radio: {},
      spot: {},
      featureLicense: {},
      audioStream: {},
      txBandSetting: {},
      xvtr: {},
      cwx: {},
      dvk: {},
      tnf: {},
      memory: {},
      displayMarker: {},
      filterPreset: {},
      waveform: {},
      autoDx: {},
      cwDecoder: {},
      ntpSource: {},
      preset: {},
    },
  }) as AppState;

/**
 * Feature names exactly as the radio announces them in
 * `license feature name=<NAME> enabled=<0|1> reason=<...>`. Closed on purpose
 * so a typo is a compile error; add a name here when firmware gains one.
 */
export type LicensedFeature =
  | "ALPHA"
  | "AUTO_TUNE"
  | "DIGITAL_VOICE_KEYER"
  | "DIV_ESC"
  | "FILTER_PRESET_CONF"
  | "MULTIFLEX"
  | "NAVTEX_WF"
  | "NOISE_FLOOR"
  | "NOISE_REDUCTION"
  | "PANADAPTER_VISUALS"
  | "RAPIDM_LOGGING"
  | "SMARTLINK"
  | "WFP";

export const FlexRadioContext = createContext<{
  state: AppState;
  setState: SetStoreFunction<AppState>;
  spots: ReactiveMap<string, SpotState>;
  bands: ReactiveMap<string, string>;
  radio: () => Radio | null;
  client: Accessor<FlexClient>;
  /** A feature the radio never announced is treated as unlicensed. */
  isLicensed: (feature: LicensedFeature) => boolean;
  connect: (addr: { host: string; port: number }) => void;
  disconnect: (reason?: DisconnectedReason) => void;
  sendCommand: (command: string) => Promise<{
    response: number;
    message: string;
    debugOutput?: string;
  }>;
}>();

export default function useFlexRadio() {
  const context = useContext(FlexRadioContext);
  globalThis.flexradio = context; // Expose for debugging
  if (!context) {
    throw new Error(
      "useFlexRadioContext must be used within a FlexRadioProvider",
    );
  }

  return context;
}
