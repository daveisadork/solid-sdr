import { createReconnectingWS, makeWS } from "@solid-primitives/websocket";
import {
  batch,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  ParentComponent,
  useContext,
} from "solid-js";
import {
  createStore,
  produce,
  reconcile,
  SetStoreFunction,
} from "solid-js/store";
import { showToast } from "~/components/ui/toast";
import {
  decodeVita,
  DiscoveryPayload,
  PacketClass,
  VitaPacket,
} from "~/lib/vita49";
import { useRtc } from "./rtc";

type EventTypePacketClassMap = {
  ["meter"]: PacketClass.meter;
  ["panadapter"]: PacketClass.panadapter;
  ["waterfall"]: PacketClass.waterfall;
  ["opus"]: PacketClass.opus;
  ["daxReducedBw"]: PacketClass.daxReducedBw;
  ["daxIq24"]: PacketClass.daxIq24;
  ["daxIq48"]: PacketClass.daxIq48;
  ["daxIq96"]: PacketClass.daxIq96;
  ["daxIq192"]: PacketClass.daxIq192;
  ["daxAudio"]: PacketClass.daxAudio;
  ["discovery"]: PacketClass.discovery;
};

export type PacketEventType = keyof EventTypePacketClassMap;

export class PacketEvent<
  T extends PacketEventType = PacketEventType,
> extends Event {
  constructor(
    type: T,
    public readonly packet: VitaPacket<EventTypePacketClassMap[T]>,
  ) {
    super(type);
  }
}

const PacketClassEventMap: Record<string | number, PacketEventType> = {
  [PacketClass.meter]: "meter",
  [PacketClass.panadapter]: "panadapter",
  [PacketClass.waterfall]: "waterfall",
  [PacketClass.opus]: "opus",
  [PacketClass.daxReducedBw]: "daxReducedBw",
  [PacketClass.daxIq24]: "daxIq24",
  [PacketClass.daxIq48]: "daxIq48",
  [PacketClass.daxIq96]: "daxIq96",
  [PacketClass.daxIq192]: "daxIq192",
  [PacketClass.daxAudio]: "daxAudio",
  [PacketClass.discovery]: "discovery",
};

export interface DiscoveryRadio extends DiscoveryPayload {
  last_seen: Date;
}

export enum ConnectionState {
  disconnected,
  connecting,
  connected,
}

export enum ConnectionStage {
  TCP = 0,
  UDP = 1,
  Data = 2,
  Done = 3,
}

export enum MeterUnit {
  dB = "dB",
  dBm = "dBm", // dBm power, referenced generally to the radio input connector, as described in VITA-49 7.1.5.9. (Two's complement, radix between bits 6/7)
  dBFS = "dBFS", // power, referenced to full scale VITA-49 7.1.5.9. (Two's complement, radix between bits 6/7)
  Volts = "Volts", // voltage in two's complement volts with ten bits to the right of the radix point and six to the left
  Amps = "Amps", // amps in two's complement amps with ten bits to the right of the radix point and six to the left
  SWR = "SWR",
  degC = "degC",
  degF = "degF",
  RPM = "RPM",
}

export interface Meter {
  src: string; // "RAD
  num: number; // 0
  nam: string; // "Power"
  low: number; // 0
  hi: number; // 100
  desc: string; // "Power"
  unit: MeterUnit; // "dBm"
  fps: number; // 10
  scale: number; // 1.0
  value?: number;
}

export interface GPS {
  lat?: number;
  lon?: number;
  grid?: string; // "EM48sk"
  altitude?: string; // "0 m"
  tracked?: number;
  visible?: number;
  speed?: string; // "0 kts"
  freq_error?: string; // "0 ppb"
  status?: string; // "Fine Lock"
  time?: string; // "19:37:58Z"
  track?: number;
  gnss_powered_ant?: boolean;
}

const scalingMap = {
  [MeterUnit.dB]: 128.0,
  [MeterUnit.dBm]: 128.0,
  [MeterUnit.dBFS]: 128.0,
  [MeterUnit.SWR]: 128.0,
  [MeterUnit.Volts]: 256.0,
  [MeterUnit.Amps]: 256.0,
  [MeterUnit.degC]: 64.0,
  [MeterUnit.degF]: 64.0,
} as Record<MeterUnit, number>;

export interface Panadapter {
  client_handle: string; // "0x6EB67FCB"
  wnb: boolean; //"0"
  wnb_level: number; //"90"
  wnb_updating: boolean; //"0"
  band_zoom: boolean; //"0"
  segment_zoom: boolean; //"0"
  x_pixels: number; //"50"
  y_pixels: number; //"20"
  center: number; //"14.100000"
  bandwidth: number; //"0.200000"
  min_dbm: number; //"-135.00"
  max_dbm: number; //"-40.00"
  fps: number; //"25"
  average: number; //"50"
  weighted_average: boolean; //"0"
  rfgain: number; //"8"
  rxant: string; //"ANT1"
  wide: boolean; //"0"
  loopa: string; //"0"
  loopb: string; //"0"
  band: string; //"20"
  daxiq_channel: number; // "0"
  waterfall: string; // "0x42000000"
  min_bw: number; // "0.001230"
  max_bw: number; // "14.745601"
  xvtr: string; // ""
  pre: string; // "+8dB"
  ant_list: string[]; // "ANT1,ANT2,RX_A,RX_B,XVTA,XVTB"
}

export interface Waterfall {
  client_handle: string; // "0x6F77DF23"
  x_pixels: number;
  center: number; // "14.100000"
  bandwidth: number; // 0.200000
  band_zoom: boolean;
  segment_zoom: boolean;
  line_duration: number;
  rfgain: number; // 8
  rxant: string; // "ANT1"
  wide: boolean;
  loopa: boolean;
  loopb: boolean;
  band: string; // "20"
  daxiq_channel: number; // 0
  panadapter: string; // "0x40000000"
  color_gain: number; // 30
  auto_black: boolean;
  black_level: number; // 0
  gradient_index: number; // "1"
  xvtr: string; // ""
  y_pixels: number;
}

export interface Gradient {
  name: string;
  clip?: string; // Optional, used for gradients that have a clipping color
  colors: string[];
}

export interface IterlockBand {
  acc_tx_enabled: boolean; // "0"
  acc_txreq_enable: boolean; //  "0"
  band_name: string; // "630"
  rca_txreq_enable: boolean; // "0"
  tx1_enabled: boolean; // "0"
  tx2_enabled: boolean; // "0"
  tx3_enabled: boolean; // "0"
}

export interface Slice {
  in_use: boolean; // "1"
  sample_rate: number; // "24000",
  RF_frequency: number; // "14.099200",
  client_handle: string; // "0x2BD18D52",
  index_letter: string; // "A",
  rit_on: boolean; // "0",
  rit_freq: number; // "0",
  xit_on: boolean; // "0",
  xit_freq: number; // "0",
  rxant: string; // "ANT1",
  mode: string; // "AM",
  wide: boolean; // "0";
  filter_lo: number; // "-3000";
  filter_hi: number; // "3000";
  step: number; // "100";
  step_list: number[]; // "250,500,2500,3000,5000,9000,10000";
  agc_mode: string; // "med";
  agc_threshold: number; // "60";
  agc_off_level: number; // "1936681316";
  pan: string; // "0x40000000";
  txant: string; //"ANT1";
  loopa: boolean; // "0";
  loopb: boolean; // "0";
  qsk: boolean; // "0";
  dax: number; // "1";
  dax_clients: number; // "0";
  lock: boolean; // "0";
  tx: boolean; // "1";
  active: boolean; // "1";
  audio_level: number; //"100";
  audio_pan: number; // "50";
  audio_mute: boolean; // "0";
  record: boolean; // "0";
  play: string; // "disabled";
  record_time: number; // "0.0";
  anf: boolean; // "0";
  anf_level: number; // "0";
  nr: boolean; // "0";
  nr2: boolean; // "0";
  nr_level: number; // "0";
  nb: boolean; // "0";
  nb_level: number; // "50";
  wnb: boolean; // "0";
  wnb_level: number; // "90";
  apf: boolean; // "0";
  apf_level: number; // "0";
  squelch: boolean; // "0";
  squelch_level: number; // "20";
  squelch_triggered_weight: number; // "0";
  squelch_avg_factor: number; // "0";
  squelch_hang_delay_ms: number; // "0";
  diversity: boolean; // "0";
  diversity_parent: boolean; // "0";
  diversity_child: boolean; // "0";
  diversity_index: number; //  "1342177293";
  ant_list: string[]; // "ANT1,ANT2,RX_A,RX_B,XVTA,XVTB";
  mode_list: string[]; // "LSB,USB,AM,CW,DIGL,DIGU,SAM,FM,NFM,DFM,RTTY";
  fm_tone_mode: string; // "OFF";
  fm_tone_value: number; // "67.0";
  fm_repeater_offset_freq: number; // "0.000000";
  tx_offset_freq: number; // "0.000000";
  repeater_offset_dir: string; // "SIMPLEX";
  fm_tone_burst: boolean; // "0";
  fm_deviation: number; //  "5000";
  dfm_pre_de_emphasis: boolean; // "0";
  post_demod_low: number; // "300";
  post_demod_high: number; // "3300";
  rtty_mark: number; // "2125";
  rtty_shift: number; // "170";
  digl_offset: number; // "2210";
  digu_offset: number; // "1500";
  post_demod_bypass: boolean; // "0";
  rfgain: number; // "8";
  tx_ant_list: string[]; // "ANT1,ANT2,XVTA,XVTB";
  rx_error_mHz: number; //"-10.681152";
  detached: boolean; // "0";
}

export interface Stream {
  client_handle: string; // "0x6EB67FCB"
  compression: string; // "OPUS"
  ip: string; // "10.10.10.10"
  type: string; // "remote_audio_rx"
}

export interface Gradient {
  name: string;
  clip?: string;
  colors: string[];
}

export interface DisplaySettings {
  scrollOffset: number;
  enableTransparencyEffects: boolean;
  peakStyle: "none" | "points" | "line";
  fillStyle: "none" | "solid" | "gradient";
}

export interface PaletteSettings {
  colorMin: number;
  colorMax: number;
  gradients: Gradient[];
}

export interface ConnectModalState {
  radios: Record<string, DiscoveryRadio>;
  open: boolean;
  status: ConnectionState;
  selectedRadio: string | null;
  stage: ConnectionStage;
}

export interface StatusState {
  meters: Record<number | string, Meter>;
  gps: GPS;
  eq: {
    rx: Record<string, unknown>;
    rxsc: Record<string, unknown>;
  };
  slice: Record<number | string, Slice>;
  display: {
    pan: Record<string, Panadapter>;
    waterfall: Record<string, Waterfall>;
  };
  interlock: {
    band: Record<string, IterlockBand>;
  };
  radio: {
    oscillator: Record<string, unknown>;
    static_net_params: Record<string, unknown>;
    filter_sharpness: {
      VOICE: Record<string, unknown>;
      CW: Record<string, unknown>;
      DIGITAL: Record<string, unknown>;
    };
  };
  stream: Record<string, Stream>;
}

export interface AppState {
  clientHandle: string | null;
  clientHandleInt: number | null;
  clientId: string | null;
  selectedPanadapter: string | null;
  display: DisplaySettings;
  palette: PaletteSettings;
  connectModal: ConnectModalState;
  status: StatusState;
}

export const initialState = () =>
  ({
    clientHandle: null,
    clientHandleInt: null,
    clientId: null,
    selectedPanadapter: null,
    display: {
      scrollOffset: 0,
      enableTransparencyEffects: true,
      peakStyle: "points",
      fillStyle: "solid",
    },
    palette: {
      colorMin: 0.0,
      colorMax: 1.0,
      gradients: [
        {
          name: "SmartSDR",
          clip: "#ffffff",
          colors: [
            "#000000",
            "#0000ff",
            "#00ffff",
            "#00ff00",
            "#ffff00",
            "#ff8000",
            "#ff0000",
          ],
        },
        {
          name: "SmartSDR + Purple",
          clip: "#ffffff",
          colors: [
            "#000000",
            "#0000ff",
            "#00ffff",
            "#00ff00",
            "#ffff00",
            "#ff8000",
            "#ff0000",
            "#ff00ff",
          ],
        },
        {
          name: "Vintage Warm",
          clip: "#ffffff",
          colors: [
            "#000000",
            "#1d4877",
            // "#1ba4a1",
            "#1b8a5a",
            "#fbb021",
            "#f68838",
            "#ee3e32",
          ],
        },
        {
          name: "Grayscale",
          colors: ["#000000", "#ffffff"],
        },
        {
          name: "CMYK",
          clip: "#ffffff",
          colors: ["#000000", "#00ffff", "#ffff00", "#ff00ff"],
        },
        {
          name: "RGB",
          clip: "#ffffff",
          colors: ["#000000", "#0000ff", "#00ff00", "#ff0000"],
        },
        {
          name: "Solarized",
          clip: "#ffffff",
          colors: [
            "#002b36",
            "#268bd2",
            // "#2aa198",
            "#859900",
            "#b58900",
            "#cb4b16",
            "#dc322f",
            // "#d33682",
          ],
        },
      ],
    },
    connectModal: {
      radios: {},
      open: true,
      status: ConnectionState.disconnected,
    },
    status: {
      meters: {},
      gps: {},
      eq: {
        rx: {},
        rxsc: {},
      },
      slice: {},
      display: {
        pan: {},
        waterfall: {},
      },
      interlock: {
        band: {},
      },
      radio: {
        // slices: 4,
        // panadapters: 4,
        // lineout_gain: 60,
        // lineout_mute: false,
        // headphone_gain: 50,
        // headphone_mute: false,
        // remote_on_enabled: false,
        // pll_done: 0,
        // freq_error_ppb: 0,
        // cal_freq: 15.0,
        // tnf_enabled: true,
        // nickname: "FLEX-8600",
        // callsign: "KF0SMY",
        // binaural_rx: false,
        // full_duplex_enabled: false,
        // band_persistence_enabled: true,
        // rtty_mark_default: 2125,
        // enforce_private_ip_connections: true,
        // backlight: 50,
        // mute_local_audio_when_remote: true,
        // daxiq_capacity: 16,
        // daxiq_available: 16,
        // alpha: 0,
        // low_latency_digital_modes: true,
        // mf_enable: true,
        // auto_save: true,
        oscillator: {},
        static_net_params: {},
        filter_sharpness: {
          VOICE: {},
          CW: {},
          DIGITAL: {},
        },
      },
      stream: {},
    },
  }) as AppState;

const commands = {} as Record<
  string,
  {
    command: string;
    resolve: (value: {
      response: number;
      message: string;
      debugOutput?: string;
    }) => void;
    reject: (reason?: unknown) => void;
  }
>;

interface PacketEventListener<T extends PacketEventType = PacketEventType> {
  (evt: PacketEvent<T>): void;
}

interface PacketEventListenerObject<
  T extends PacketEventType = PacketEventType,
> {
  handleEvent(object: PacketEvent<T>): void;
}

type PacketEventListenerOrEventListenerObject<
  T extends PacketEventType = PacketEventType,
> = PacketEventListener<T> | PacketEventListenerObject<T>;

interface UDPEventTarget extends EventTarget {
  addEventListener<T extends PacketEventType>(
    type: T,
    callback: PacketEventListenerOrEventListenerObject<T> | null,
    options?: AddEventListenerOptions | boolean,
  ): void;
  dispatchEvent(event: PacketEvent): boolean;
  removeEventListener<T extends PacketEventType>(
    type: T,
    callback: PacketEventListenerOrEventListenerObject<T> | null,
    options?: EventListenerOptions | boolean,
  ): void;
}

const _events = new EventTarget() as UDPEventTarget;

const FlexRadioContext = createContext<{
  state: AppState;
  setState: SetStoreFunction<AppState>;
  connect: (addr: { host: string; port: number }) => void;
  disconnect: () => void;
  sendCommand: (command: string) => Promise<{
    response: number;
    message: string;
    debugOutput?: string;
  }>;
  events: UDPEventTarget;
}>();

export const FlexRadioProvider: ParentComponent = (props) => {
  const [state, setState] = createStore(initialState());
  const { connect: connectRTC, session: sessionRTC } = useRtc();

  const [ws, setWs] = createSignal<WebSocket | null>(null);
  const [cmdCount, setCmdCount] = createSignal(0);
  const discoveryWs = createReconnectingWS("/ws/discovery");

  discoveryWs.addEventListener("open", ({ target }) => {
    (target as WebSocket).binaryType = "arraybuffer";
  });

  createEffect(() => {
    discoveryWs.addEventListener("message", handleUdpPacket);
    onCleanup(() => {
      discoveryWs.removeEventListener("message", handleUdpPacket);
    });
  });

  createEffect(() => {
    if (state.connectModal.status !== ConnectionState.connecting) return;

    const handle = setTimeout(async () => {
      console.warn("Connection timed out");
      showToast({
        description: "Connection timed out",
        variant: "error",
      });
      disconnect();
    }, 15_000);
    onCleanup(() => clearTimeout(handle));
  });

  createEffect(() => {
    setState(
      "clientHandleInt",
      state.clientHandle === null ? null : parseInt(state.clientHandle, 16),
    );
  });

  const sendCommand = (command: string) => {
    const count = cmdCount() + 1;
    setCmdCount(count);
    const cmd = `C${count}|${command}\n`;
    ws()?.send(cmd);

    return new Promise<{
      response: number;
      message: string;
      debugOutput?: string;
    }>((resolve, reject) => {
      commands[`R${count}`] = { command, resolve, reject };
      setTimeout(async () => {
        if (count in commands) {
          console.warn(`Command ${command} timed out after 5 seconds`);
          reject(new Error("Command timed out"));
          delete commands[count];
        }
      }, 10_000);
    });
  };

  window.state = state;
  window.sendCommand = sendCommand; // Expose for debugging

  // window.state = state; // Expose for debugging
  function updateMeters(message: string) {
    const [key, ...rest] = message.split(" ") || [];
    if (key !== "meter") {
      console.warn("Received non-meter message:", message);
      return;
    }
    if (rest.length === 0) {
      console.warn("Received empty meter update:", message);
      return;
    }
    if (message.endsWith("removed")) {
      const meterId = parseInt(rest[0], 10);
      setState(
        "status",
        "meters",
        produce((newMeters) => {
          delete newMeters[meterId];
        }),
      );
      return;
    }
    setState(
      "status",
      "meters",
      produce((newMeters) => {
        rest
          .join(" ")
          .split("#")
          .filter((part) => part.length)
          .forEach((item) => {
            const [meterIdRaw, ...meterDataRaw] = item.split(".");
            const meterId = parseInt(meterIdRaw, 10);
            const meterData = meterDataRaw.join(".");
            const [key, rawValue] = meterData.split("=");
            if (!newMeters[meterId]) {
              newMeters[meterId] = {} as Meter;
            }
            switch (key) {
              case "desc":
              case "src":
              case "nam":
                newMeters[meterId][key] = rawValue;
                break;
              case "num":
                newMeters[meterId].num = parseInt(rawValue, 10);
                break;
              case "fps":
              case "value":
              case "low":
              case "hi":
                newMeters[meterId][key] = parseFloat(rawValue);
                break;
              case "unit":
                const unit = rawValue as MeterUnit;
                newMeters[meterId].unit = unit;
                newMeters[meterId].scale = scalingMap[unit] || 1.0;
                break;
              default:
                console.warn(`Unknown key in meter update: ${key}`);
            }
          });
      }),
    );
  }

  function updatePanadapter(stream: string, split: string[]) {
    const applyUpdate = (pan: Partial<Panadapter>) => {
      split.forEach((item) => {
        const [key, value] = item.split("=");
        switch (key) {
          case "x_pixels":
          case "y_pixels":
          case "center":
          case "bandwidth":
          case "min_dbm":
          case "max_dbm":
          case "fps":
          case "average":
          case "rfgain":
          case "daxiq_channel":
          case "min_bw":
          case "max_bw":
          case "wnb_level":
            pan[key] = Number(value);
            break;
          case "wnb":
          case "wnb_updating":
          case "band_zoom":
          case "segment_zoom":
          case "weighted_average":
          case "wide":
            pan[key] = value === "1";
            break;
          case "client_handle":
          case "rxant":
          case "loopa":
          case "loopb":
          case "band":
          case "waterfall":
          case "pre":
          case "xvtr":
            pan[key] = value;
            break;
          case "ant_list":
            pan[key] = value.split(",");
            break;
          default:
            console.log(split);
            console.warn(`Unknown key in panadapter update: ${key}`);
        }
      });
    };
    if (stream in state.status.display.pan) {
      if (split.includes("removed")) {
        setState(
          "status",
          "display",
          "pan",
          produce((pan) => {
            delete pan[stream];
          }),
        );
      } else {
        setState("status", "display", "pan", stream, produce(applyUpdate));
      }
      // If the stream already exists, we apply the update to the existing panadapter
    } else {
      const newPan = {} as Partial<Panadapter>;
      applyUpdate(newPan);
      setState("status", "display", "pan", stream, newPan);
    }
  }

  function updateSlice([index, ...split]: string[]) {
    const applyUpdate = (slice: Partial<Slice>) => {
      split.forEach((item) => {
        const [key, value] = item.split("=");
        switch (key) {
          case "in_use":
          case "rit_on":
          case "xit_on":
          case "wide":
          case "loopa":
          case "loopb":
          case "active":
          case "tx":
          case "anf":
          case "nr":
          case "nr2":
          case "nb":
          case "wnb":
          case "apf":
          case "squelch":
          case "diversity":
          case "post_demod_bypass":
          case "fm_tone_burst":
          case "qsk":
          case "dfm_pre_de_emphasis":
          case "audio_mute":
          case "lock":
          case "record":
          case "detached":
          case "diversity_parent":
          case "diversity_child":
            slice[key] = value === "1";
            break;
          case "sample_rate":
          case "RF_frequency":
          case "rit_freq":
          case "xit_freq":
          case "filter_lo":
          case "filter_hi":
          case "step":
          case "agc_threshold":
          case "agc_off_level":
          case "audio_level":
          case "audio_pan":
          case "rfgain":
          case "fm_tone_value":
          case "fm_repeater_offset_freq":
          case "tx_offset_freq":
          case "fm_deviation":
          case "post_demod_low":
          case "post_demod_high":
          case "rtty_mark":
          case "rtty_shift":
          case "digl_offset":
          case "digu_offset":
          case "record_time":
          case "dax":
          case "dax_clients":
          case "diversity_index":
          case "anf_level":
          case "nr_level":
          case "nb_level":
          case "apf_level":
          case "squelch_level":
          case "squelch_triggered_weight":
          case "squelch_avg_factor":
          case "squelch_hang_delay_ms":
          case "rx_error_mHz":
          case "wnb_level":
            slice[key] = Number(value);
            break;
          case "client_handle":
          case "index_letter":
          case "rxant":
          case "mode":
          case "pan":
          case "txant":
          case "repeater_offset_dir":
          case "fm_tone_mode":
          case "play":
          case "agc_mode":
            slice[key] = value;
            break;
          case "mode_list":
          case "ant_list":
          case "tx_ant_list":
            // Split the comma-separated values into an array
            slice[key] = value.split(",");
            break;
          case "step_list":
            slice[key] = value.split(",").map(Number);
            break;
          case "":
            // Ignore empty keys (can happen with trailing #)
            break;
          default:
            console.log(split);
            console.warn(`Unknown key in slice update: ${key}`);
        }
      });
    };
    if (index in state.status.slice) {
      if (split.includes("removed")) {
        setState(
          "status",
          "slice",
          produce((slices) => {
            delete slices[index];
          }),
        );
      } else {
        setState("status", "slice", index, produce(applyUpdate));
      }
      // If the slice already exists, we apply the update to the existing slice
    } else {
      const newSlice = {} as Partial<Slice>;
      applyUpdate(newSlice);
      setState("status", "slice", index, newSlice);
    }
  }

  function updateWaterfall(stream: string, split: string[]) {
    const applyUpdate = (waterfall: Partial<Waterfall>) => {
      split.forEach((item) => {
        const [key, value] = item.split("=");
        switch (key) {
          case "x_pixels":
          case "y_pixels":
          case "line_duration":
          case "color_gain":
          case "daxiq_channel":
          case "gradient_index":
          case "bandwidth":
          case "center":
          case "rfgain":
          case "black_level":
            waterfall[key] = Number(value);
            break;
          case "band_zoom":
          case "segment_zoom":
          case "auto_black":
          case "wide":
          case "loopa":
          case "loopb":
            waterfall[key] = value === "1";
            break;
          case "client_handle":
          case "rxant":
          case "xvtr":
          case "panadapter":
          case "band":
            waterfall[key] = value;
            break;
          default:
            console.log(split);
            console.warn(`Unknown key in waterfall update: ${key}`);
        }
      });
      return waterfall;
    };

    if (stream in state.status.display.waterfall) {
      if (split.includes("removed")) {
        setState(
          "status",
          "display",
          "waterfall",
          produce((waterfall) => {
            delete waterfall[stream];
          }),
        );
      } else {
        setState(
          "status",
          "display",
          "waterfall",
          stream,
          produce(applyUpdate),
        );
      }
    } else {
      const newWaterfall = {} as Partial<Waterfall>;
      applyUpdate(newWaterfall);
      setState("status", "display", "waterfall", stream, newWaterfall);
    }
  }

  function updateGPS(rest: string[]) {
    const split = rest.join(" ").split("#");

    const applyUpdate = (gps: Partial<GPS>) => {
      split.forEach((item) => {
        const [key, value] = item.split("=");
        switch (key) {
          case "lat":
          case "lon":
          case "tracked":
          case "visible":
          case "track":
            gps[key] = Number(value);
            break;
          case "gnss_powered_ant":
            gps[key] = value === "1";
            break;
          case "grid":
          case "altitude":
          case "speed":
          case "freq_error":
          case "status":
          case "time":
            gps[key] = value;
            break;
          default:
            console.warn(`Unknown key in GPS update: ${key}`);
        }
      });
      return gps;
    };
    setState("status", "gps", produce(applyUpdate));
  }

  function updateDisplay(message: string) {
    const [_display, kind, stream, ...split] = message
      .split(" ")
      .filter((part) => part.length);

    switch (kind) {
      case "pan":
        updatePanadapter(stream, split);
        break;
      case "waterfall":
        updateWaterfall(stream, split);
        break;
      default:
        console.warn("Received unknown display update:", message);
    }
  }

  function updateStream([stream, ...split]: string[]) {
    const applyUpdate = (streamData: Partial<Stream>) => {
      split.forEach((item) => {
        const [key, value] = item.split("=");
        switch (key) {
          case "client_handle":
          case "ip":
          case "compression":
          case "type":
            streamData[key] = value;
            break;
          default:
            console.warn(`Unknown key in stream update: ${key}`);
        }
      });
    };
    if (stream in state.status.stream) {
      if (split.includes("removed")) {
        setState(
          "status",
          "stream",
          produce((streams) => {
            delete streams[stream];
          }),
        );
      } else {
        setState("status", "stream", stream, produce(applyUpdate));
      }
      // If the stream already exists, we apply the update to the existing stream
    } else {
      const newStream = {} as Partial<Stream>;
      applyUpdate(newStream);
      setState("status", "stream", stream, newStream);
    }
  }
  createEffect(() => {
    if (!state.clientHandle) {
      return;
    }
    const clientHandle = `0x${state.clientHandle}`;
    const selectedPanadapter = state.selectedPanadapter;
    const panadapter = selectedPanadapter
      ? state.status.display.pan[selectedPanadapter]
      : null;

    if (panadapter) {
      return;
    }

    const firstOwnPan =
      Object.keys(state.status.display.pan).filter(
        (streamId) =>
          state.status.display.pan[streamId]?.client_handle === clientHandle,
      )[0] || null;
    console.log("Setting first owned panadapter:", firstOwnPan);
    setState("selectedPanadapter", firstOwnPan ?? null);
  });

  const handleTcpMessage = async (payload: string) => {
    switch (payload[0]) {
      case "V": {
        // Version preamble
        const version = payload.slice(1);
        console.log("Version:", version);
        break;
      }
      case "H": {
        // Handle preamble
        const handle = payload.slice(1);
        console.log("Handle:", handle);
        console.log("Connecting RTC with handle:", handle);
        setState("connectModal", "stage", ConnectionStage.UDP);
        await connectRTC(handle).catch(console.error);
        setState("connectModal", "stage", ConnectionStage.Data);
        console.log("Requesting initial data...");
        // setState("clientHandle", handle);
        try {
          // await sendCommand("client program SolidFlexRadio");
          await Promise.all([
            sendCommand("info"),
            sendCommand("version"),
            sendCommand("ant list"),
            sendCommand("mic list"),
            sendCommand("profile global info"),
            sendCommand("profile tx info"),
            sendCommand("profile mic info"),
            sendCommand("profile display info"),
            sendCommand("sub client all"),
            sendCommand("sub tx all"),
            sendCommand("sub atu all"),
            sendCommand("sub amplifier all"),
            sendCommand("sub meter all"),
            sendCommand("sub pan all"),
            sendCommand("sub slice all"),
            sendCommand("sub gps all"),
            sendCommand("sub audio_stream all"),
            sendCommand("sub cwx all"),
            sendCommand("sub xvtr all"),
            sendCommand("sub memories all"),
            sendCommand("sub daxiq all"),
            sendCommand("sub dax all"),
            sendCommand("sub usb_cable all"),
            sendCommand("sub tnf all"),
            sendCommand("sub spot all"),
            sendCommand("sub rapidm all"),
            sendCommand("sub ale all"),
            sendCommand("sub log_manager"),
            sendCommand("sub radio all"),
            // sendCommand("sub codec all"),
            sendCommand("sub apd all"),
            sendCommand("keepalive enable"),
          ]);
          const { message: clientId } = await sendCommand("client gui");
          await sendCommand(
            "stream create type=remote_audio_rx compression=OPUS",
          );
          setState("connectModal", "stage", ConnectionStage.Done);
          batch(() => {
            setState("clientHandle", handle);
            setState("clientId", clientId);
          });
          setTimeout(
            () => setState("connectModal", "status", ConnectionState.connected),
            300,
          );
        } catch (error) {
          console.error("Failed to subscribe to initial data:", error);
          showToast({
            description: "Failed to subscribe to initial data",
            variant: "error",
          });
          disconnect();
        }
        break;
      }
      case "R": {
        // Command response
        const [prefix, responseCode, message, debugOutput] = payload.split("|");
        const response = parseInt(responseCode);
        const command = commands[prefix];
        if (!command) return;
        if (response === 0) {
          command.resolve({ response, message, debugOutput });
        } else {
          command.reject(
            new Error(`${responseCode}: ${message}, ${command.command}`),
          );
        }
        delete commands[prefix];
        break;
      }
      case "M": {
        // Message
        const [, description] = payload.split("|");
        showToast({ description, variant: "info" });
        break;
      }
      case "S": {
        // Status message
        const [prefix, message] = payload.split("|");
        const handle = parseInt(prefix.slice(1), 16);
        if (
          handle &&
          state.clientHandleInt &&
          state.clientHandleInt !== handle
        ) {
          // Message not for us
          console.log("Ignoring message for handle", handle);
          return;
        }

        const [key, ...rest] = message.split(" ");
        switch (key) {
          case "gps":
            return updateGPS(rest);
          case "meter":
            return updateMeters(message);
          case "display":
            return updateDisplay(message);
          case "slice":
            return updateSlice(rest);
          case "stream":
            console.log(payload);
            return updateStream(rest);
        }

        const split = message.split(" ").filter((part) => part.length);
        const parts = split.filter((part) => !part.includes("="));

        const current = state.status;
        const currentPath = ["status"];
        for (const part of parts) {
          currentPath.push(part);
          if (!(part in current)) {
            try {
              setState(...currentPath, {});
            } catch (error) {
              console.error(
                "Failed to create status path:",
                currentPath,
                error,
              );
            }
          }
        }
        const data = Object.fromEntries(
          split
            .filter((part) => part.includes("="))
            .map((part) => part.split("=")),
        );
        try {
          setState(...currentPath, (prev) => ({ ...prev, ...data }));
        } catch (error) {
          console.error("Failed to update status:", error);
        }
        // console.log(JSON.stringify(state.status, null, 2));
        break;
      }
      default: {
        console.warn("Unhandled TCP message:", payload);
      }
    }
  };

  const handleUdpPacket = ({ data }: MessageEvent) => {
    try {
      const packet = decodeVita(new Uint8Array(data));
      if (!packet) {
        console.warn("Failed to decode UDP packet:", data);
        return;
      }
      const event = new PacketEvent(
        PacketClassEventMap[
          packet.class_id.packet_class_code
        ] as PacketEventType,
        packet,
      );
      _events.dispatchEvent(event);
    } catch (error) {
      console.error("Error decoding UDP packet:", error);
      return disconnect();
    }
  };

  createEffect(() => {
    _events.addEventListener("meter", ({ packet: { payload } }) => {
      setState(
        "status",
        "meters",
        produce((meters) =>
          payload.forEach(({ id, value }) => {
            if (id in meters) meters[id].value = value / meters[id].scale;
          }),
        ),
      );
    });
  });

  const connect = (addr: { host: string; port: number }) => {
    console.log("Connecting to", addr);
    setState("connectModal", {
      status: ConnectionState.connecting,
      selectedRadio: addr.host,
      stage: ConnectionStage.TCP,
    });
    const conn = makeWS(`/ws/radio?host=${addr.host}&port=${addr.port}`);
    conn.binaryType = "arraybuffer";

    setWs(conn);

    // const sessionId = crypto.randomUUID();
    // console.log("Connecting to RTC with session ID:", sessionId);
    // connectRTC(sessionId).catch(console.error);
    conn.addEventListener("message", (event) => {
      switch (typeof event.data) {
        case "string":
          handleTcpMessage(event.data);
          break;
        case "object":
          handleUdpPacket(event);
          break;
        default:
          console.warn("Unknown message type:", event.data);
      }
    });
  };

  createEffect(() => {
    const session = sessionRTC();
    if (!session) return;
    console.log("Setting up RTC data channel listener");
    session.data.addEventListener("message", handleUdpPacket);
    onCleanup(() => {
      console.log("Cleaning up RTC data channel listener");
      session.data.removeEventListener("message", handleUdpPacket);
    });
  });

  createEffect(() => {
    ws()?.addEventListener("close", () => disconnect(), { once: true });
  });

  const disconnect = () => {
    sessionRTC()?.close();
    ws()?.close();
    setWs(null);
    setState(reconcile(initialState()));
    setCmdCount(0);
  };

  createEffect(() => {
    const socket = ws();
    if (!socket) return;
    const interval = setInterval(() => sendCommand("ping"), 1000);
    onCleanup(() => clearInterval(interval));
  });

  return (
    <FlexRadioContext.Provider
      value={{
        events: _events,
        state,
        setState,
        sendCommand,
        connect,
        disconnect,
      }}
    >
      {props.children}
    </FlexRadioContext.Provider>
  );
};

export default function useFlexRadio() {
  const context = useContext(FlexRadioContext);
  if (!context) {
    throw new Error(
      "useFlexRadioContext must be used within a FlexRadioProvider",
    );
  }

  return context;
}
