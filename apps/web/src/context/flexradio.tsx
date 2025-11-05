import { createReconnectingWS, makeWS } from "@solid-primitives/websocket";
import {
  batch,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
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
  createFlexClient,
  createVitaDiscoveryAdapter,
  FlexCommandRejectedError,
  type FlexRadioSession,
  type SliceSnapshot,
  type PanadapterSnapshot,
  type RadioStateChange,
  type FlexWireMessage,
  type Subscription,
  type WaterfallSnapshot,
  parseVitaPacket,
  VitaPacketKind,
  VitaParsedPacket,
  VitaPacketMetadata,
} from "@repo/flexlib";
import type { DiscoverySession, FlexRadioDescriptor } from "@repo/flexlib";
import { createWebSocketFlexControlFactory } from "~/lib/flex-control";
import { useRtc } from "./rtc";

export type PacketEventType = VitaPacketKind;

type PacketDetailMap = {
  [K in PacketEventType]: Extract<VitaParsedPacket, { kind: K }>["packet"];
};

function toMetadata(parsed: VitaParsedPacket): VitaPacketMetadata {
  const { header, classId, streamId, timestampInt, timestampFrac } = parsed;
  return { header, classId, streamId, timestampInt, timestampFrac };
}

export class PacketEvent<
  T extends PacketEventType = PacketEventType,
> extends Event {
  public readonly packet: PacketDetailMap[T];
  public readonly metadata: VitaPacketMetadata;

  constructor(
    type: T,
    packet: PacketDetailMap[T],
    metadata: VitaPacketMetadata,
  ) {
    super(type);
    this.packet = packet;
    this.metadata = metadata;
  }
}

export interface DiscoveryRadio extends FlexRadioDescriptor {
  lastSeen: Date;
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
  dax_iq_channel: number; // "0";
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
    pan: Record<string, PanadapterSnapshot>;
    waterfall: Record<string, WaterfallSnapshot>;
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
  runtime: RuntimeState;
}

interface RuntimeState {
  panSettledCenterMHz: Record<string, number | undefined>;
  panPendingCenterMHz: Record<string, number | undefined>;
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
    runtime: {
      panSettledCenterMHz: {},
      panPendingCenterMHz: {},
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
  session: () => FlexRadioSession | null;
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
  const [flexSession, setFlexSession] = createSignal<FlexRadioSession | null>(
    null,
  );

  const meterScratch = { ids: new Uint16Array(0), values: new Int16Array(0) };
  const panadapterScratch = { payload: new Uint16Array(0) };
  const waterfallScratch = { data: new Uint16Array(0) };
  const serialToHost = new Map<string, string>();
  const discoveryWs = createReconnectingWS("/ws/discovery");
  let discoverySession: DiscoverySession | null = null;
  let flexSessionSubscriptions: Subscription[] = [];
  let pendingHandleLine: string | null = null;
  let pingTimer: ReturnType<typeof setInterval> | undefined;

  discoveryWs.addEventListener("open", ({ target }) => {
    (target as WebSocket).binaryType = "arraybuffer";
  });

  const discoveryAdapter = createVitaDiscoveryAdapter({
    transportFactory: {
      async start(handlers) {
        let closed = false;

        const handleMessage = (event: MessageEvent) => {
          if (closed) return;
          const { data } = event;
          if (typeof data === "string") return;

          if (data instanceof ArrayBuffer) {
            handlers.onMessage(new Uint8Array(data));
            return;
          }

          if (data instanceof Blob) {
            data
              .arrayBuffer()
              .then((buffer) => {
                if (!closed) handlers.onMessage(new Uint8Array(buffer));
              })
              .catch((error) => handlers.onError?.(error));
            return;
          }

          if (data instanceof Uint8Array) {
            handlers.onMessage(data);
            return;
          }

          handlers.onError?.(
            new Error(`Unsupported discovery payload type: ${typeof data}`),
          );
        };

        const handleError = (error: Event) => {
          if (closed) return;
          handlers.onError?.(error);
        };

        discoveryWs.addEventListener("message", handleMessage);
        discoveryWs.addEventListener("error", handleError);

        return {
          async close() {
            if (closed) return;
            closed = true;
            discoveryWs.removeEventListener("message", handleMessage);
            discoveryWs.removeEventListener("error", handleError);
            discoveryWs.close();
          },
        };
      },
    },
    logger: {
      warn(message, meta) {
        console.warn(message, meta);
      },
      error(message, meta) {
        console.error(message, meta);
      },
    },
  });
  const controlFactory = createWebSocketFlexControlFactory({
    makeSocket(descriptor) {
      return makeWS(
        `/ws/radio?host=${descriptor.host}&port=${descriptor.port}`,
      );
    },
    logger: {
      warn(message, meta) {
        console.warn(message, meta);
      },
      error(message, meta) {
        console.error(message, meta);
      },
    },
  });
  const flexClient = createFlexClient(
    {
      discovery: discoveryAdapter,
      control: controlFactory,
      logger: {
        warn(message, meta) {
          console.warn(message, meta);
        },
        error(message, meta) {
          console.error(message, meta);
        },
      },
    },
    { defaultCommandTimeoutMs: 10_000 },
  );
  const formatClientHandle = (handle: number): string => {
    if (!handle) return "0x00000000";
    return `0x${handle.toString(16).toUpperCase().padStart(8, "0")}`;
  };

  const applySliceSnapshot = (snapshot: SliceSnapshot) => {
    const attributes = snapshot.raw;
    const applyUpdate = (partial: Partial<Slice>) => {
      const slice = partial as Record<string, unknown>;

      slice.sample_rate = snapshot.sampleRateHz;
      slice.RF_frequency = snapshot.frequencyMHz;
      slice.client_handle = formatClientHandle(snapshot.clientHandle);
      slice.index_letter = snapshot.indexLetter;
      slice.mode = snapshot.mode || (slice.mode as string | undefined) || "";
      slice.pan =
        snapshot.panadapterStream ??
        attributes["pan"] ??
        (slice.pan as string | undefined) ??
        "";
      slice.rxant =
        snapshot.rxAntenna || (slice.rxant as string | undefined) || "";
      slice.txant =
        snapshot.txAntenna || (slice.txant as string | undefined) || "";
      slice.loopa = snapshot.loopAEnabled;
      slice.loopb = snapshot.loopBEnabled;
      slice.qsk = snapshot.isQskEnabled;
      slice.dax = snapshot.daxChannel;
      slice.dax_iq_channel = snapshot.daxIqChannel;
      slice.dax_clients = snapshot.daxClientCount;
      slice.lock = snapshot.isLocked;
      slice.tx = snapshot.isTransmitEnabled;
      slice.active = snapshot.isActive;
      slice.audio_level = snapshot.audioGain;
      slice.audio_pan = snapshot.audioPan;
      slice.audio_mute = snapshot.isMuted;
      slice.record = snapshot.recordingEnabled;
      slice.play =
        attributes["play"] ??
        (snapshot.playbackAvailable
          ? snapshot.playbackEnabled
            ? "1"
            : "0"
          : "disabled");
      slice.record_time = snapshot.recordTimeSeconds;
      slice.anf = snapshot.anfEnabled;
      slice.anf_level = snapshot.anfLevel;
      slice.nr = snapshot.nrEnabled;
      slice.nr_level = snapshot.nrLevel;
      slice.nr2 = snapshot.nrlEnabled;
      slice.nb = snapshot.nbEnabled;
      slice.nb_level = snapshot.nbLevel;
      slice.wnb = snapshot.wnbEnabled;
      slice.wnb_level = snapshot.wnbLevel;
      slice.apf = snapshot.apfEnabled;
      slice.apf_level = snapshot.apfLevel;
      slice.squelch = snapshot.squelchEnabled;
      slice.squelch_level = snapshot.squelchLevel;
      slice.diversity = snapshot.diversityEnabled;
      slice.diversity_parent =
        attributes["diversity_parent"] !== undefined
          ? attributes["diversity_parent"] === "1"
          : Boolean(snapshot.diversityParent);
      slice.diversity_child =
        attributes["diversity_child"] !== undefined
          ? attributes["diversity_child"] === "1"
          : snapshot.diversityChild;
      slice.diversity_index = snapshot.diversityIndex;
      slice.ant_list = Array.from(snapshot.availableRxAntennas);
      slice.tx_ant_list = Array.from(snapshot.availableTxAntennas);
      slice.mode_list = Array.from(snapshot.modeList);
      slice.fm_tone_mode = snapshot.fmToneMode;
      const toneValue = attributes["fm_tone_value"] ?? snapshot.fmToneValue;
      const parsedTone =
        typeof toneValue === "string" ? Number.parseFloat(toneValue) : NaN;
      slice.fm_tone_value = Number.isFinite(parsedTone)
        ? parsedTone
        : ((slice.fm_tone_value as number | undefined) ?? 0);
      slice.fm_repeater_offset_freq = snapshot.fmRepeaterOffsetMHz;
      slice.tx_offset_freq = snapshot.txOffsetFrequencyMHz;
      slice.repeater_offset_dir =
        attributes["repeater_offset_dir"] ?? snapshot.repeaterOffsetDirection;
      slice.fm_tone_burst = snapshot.fmToneBurstEnabled;
      slice.fm_deviation = snapshot.fmDeviation;
      slice.dfm_pre_de_emphasis = snapshot.fmPreDeEmphasisEnabled;
      slice.post_demod_low = snapshot.postDemodLowHz;
      slice.post_demod_high = snapshot.postDemodHighHz;
      slice.post_demod_bypass = snapshot.postDemodBypass;
      slice.rtty_mark = snapshot.rttyMarkHz;
      slice.rtty_shift = snapshot.rttyShiftHz;
      slice.digl_offset = snapshot.diglOffsetHz;
      slice.digu_offset = snapshot.diguOffsetHz;
      slice.agc_mode = snapshot.agcMode;
      slice.agc_threshold = snapshot.agcThreshold;
      slice.agc_off_level = snapshot.agcOffLevel;
      slice.step = snapshot.tuneStepHz;
      slice.step_list = Array.from(snapshot.tuneStepListHz);
      slice.rit_on = snapshot.ritEnabled;
      slice.rit_freq = snapshot.ritOffsetHz;
      slice.xit_on = snapshot.xitEnabled;
      slice.xit_freq = snapshot.xitOffsetHz;
      slice.rfgain = snapshot.rfGain;
      slice.sample_rate = snapshot.sampleRateHz;
      slice.filter_lo = snapshot.filterLowHz;
      slice.filter_hi = snapshot.filterHighHz;
      slice.in_use =
        attributes["in_use"] !== undefined
          ? attributes["in_use"] === "1"
          : true;
      slice.detached =
        attributes["detached"] !== undefined
          ? attributes["detached"] === "1"
          : ((slice.detached as boolean | undefined) ?? false);
      slice.squelch_triggered_weight =
        attributes["squelch_triggered_weight"] !== undefined
          ? Number(attributes["squelch_triggered_weight"])
          : ((slice.squelch_triggered_weight as number | undefined) ?? 0);
      slice.squelch_avg_factor =
        attributes["squelch_avg_factor"] !== undefined
          ? Number(attributes["squelch_avg_factor"])
          : ((slice.squelch_avg_factor as number | undefined) ?? 0);
      slice.squelch_hang_delay_ms =
        attributes["squelch_hang_delay_ms"] !== undefined
          ? Number(attributes["squelch_hang_delay_ms"])
          : ((slice.squelch_hang_delay_ms as number | undefined) ?? 0);
      slice.rx_error_mHz =
        attributes["rx_error_mHz"] !== undefined
          ? Number(attributes["rx_error_mHz"])
          : ((slice.rx_error_mHz as number | undefined) ?? 0);
    };

    const existing = state.status.slice[snapshot.id];
    if (existing) {
      setState("status", "slice", snapshot.id, produce(applyUpdate));
    } else {
      const next = {} as Partial<Slice>;
      applyUpdate(next);
      setState("status", "slice", snapshot.id, next as Slice);
    }
  };

  const applyPanadapterSnapshot = (snapshot: PanadapterSnapshot) => {
    const key = snapshot.streamId || snapshot.id;
    // Keep the displayed center frequency pinned to the last settled value until
    // the data streams confirm the new frequency.
    const pendingCenterMHz = snapshot.centerFrequencyMHz;
    const centerFrequencyMHz =
      state.runtime.panSettledCenterMHz[key] ?? pendingCenterMHz;

    if (state.runtime.panSettledCenterMHz[key] === undefined) {
      setState("runtime", "panSettledCenterMHz", key, pendingCenterMHz);
    }
    setState("runtime", "panPendingCenterMHz", key, pendingCenterMHz);

    setState("status", "display", "pan", key, {
      ...snapshot,
      centerFrequencyMHz,
    });
  };

  const handlePanadapterChange = (change: RadioStateChange) => {
    if (change.entity !== "panadapter") return;
    if (change.snapshot) {
      applyPanadapterSnapshot(change.snapshot);
    } else {
      const key = change.previous?.streamId ?? change.id;
      setState(
        "status",
        "display",
        "pan",
        produce((pan) => {
          delete pan[key];
        }),
      );
      setState("runtime", "panSettledCenterMHz", key, undefined);
      setState("runtime", "panPendingCenterMHz", key, undefined);
      if (state.selectedPanadapter === key) {
        setState("selectedPanadapter", null);
      }
    }
  };

  const handleWaterfallChange = (change: RadioStateChange) => {
    if (change.entity !== "waterfall") return;
    const key = change.previous?.streamId ?? change.id;
    if (change.snapshot) {
      setState("status", "display", "waterfall", key, change.snapshot);
    } else {
      setState(
        "status",
        "display",
        "waterfall",
        produce((waterfalls) => {
          delete waterfalls[key];
        }),
      );
    }
  };

  const handleSliceChange = (change: RadioStateChange) => {
    if (change.entity !== "slice") return;
    if (change.snapshot) {
      applySliceSnapshot(change.snapshot);
    } else {
      const key = change.id ?? change.previous?.id;
      if (!key) return;
      setState(
        "status",
        "slice",
        produce((slices) => {
          delete slices[key];
        }),
      );
    }
  };

  const handleStateChange = (change: RadioStateChange) => {
    switch (change.entity) {
      case "slice":
        handleSliceChange(change);
        break;
      case "panadapter":
        handlePanadapterChange(change);
        break;
      case "waterfall":
        handleWaterfallChange(change);
        break;
      default:
        break;
    }
  };

  onMount(() => {
    let disposed = false;

    discoveryAdapter
      .start({
        onOnline(descriptor) {
          if (disposed) return;
          const lastSeenRaw = descriptor.discoveryMeta?.lastSeen;
          const lastSeen =
            typeof lastSeenRaw === "number"
              ? new Date(lastSeenRaw)
              : new Date();
          const previousHost = serialToHost.get(descriptor.serial);
          if (previousHost && previousHost !== descriptor.host) {
            setState("connectModal", "radios", (radios) => {
              const next = { ...radios };
              delete next[previousHost];
              return next;
            });
          }
          serialToHost.set(descriptor.serial, descriptor.host);
          setState("connectModal", "radios", descriptor.host, {
            ...descriptor,
            lastSeen,
          });
        },
        onOffline(serial) {
          if (disposed) return;
          const host = serialToHost.get(serial);
          if (!host) return;
          serialToHost.delete(serial);
          setState("connectModal", "radios", (radios) => {
            const next = { ...radios };
            delete next[host];
            return next;
          });
        },
        onError(error) {
          console.warn("Discovery adapter error", error);
        },
      })
      .then((session) => {
        if (disposed) {
          return session.stop().catch((error) => {
            console.error("Failed to stop discovery session", error);
          });
        }
        discoverySession = session;
      })
      .catch((error) => {
        console.error("Failed to start discovery session", error);
      });

    onCleanup(() => {
      disposed = true;
      if (discoverySession) {
        discoverySession
          .stop()
          .catch((error) =>
            console.error("Failed to stop discovery session", error),
          );
        discoverySession = null;
      }
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
    const currentSession = flexSession();
    if (!currentSession) {
      return Promise.reject(new Error("Not connected to a Flex radio"));
    }
    return currentSession
      .command(command)
      .then((response) => ({
        response: response.code ?? (response.accepted ? 0 : 1),
        message: response.message ?? "",
        debugOutput: response.raw,
      }))
      .catch((error) => {
        if (error instanceof FlexCommandRejectedError) {
          showToast({
            description: error.message,
            variant: "error",
          });
        }
        throw error;
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

  // function updateWaterfall(stream: string, split: string[]) {
  //   const applyUpdate = (waterfall: Partial<Waterfall>) => {
  //     split.forEach((item) => {
  //       const [key, value] = item.split("=");
  //       switch (key) {
  //         case "x_pixels":
  //         case "y_pixels":
  //         case "line_duration":
  //         case "color_gain":
  //         case "daxiq_channel":
  //         case "gradient_index":
  //         case "bandwidth":
  //         case "center":
  //         case "rfgain":
  //         case "black_level":
  //           waterfall[key] = Number(value);
  //           break;
  //         case "band_zoom":
  //         case "segment_zoom":
  //         case "auto_black":
  //         case "wide":
  //         case "loopa":
  //         case "loopb":
  //           waterfall[key] = value === "1";
  //           break;
  //         case "client_handle":
  //         case "rxant":
  //         case "xvtr":
  //         case "panadapter":
  //         case "band":
  //           waterfall[key] = value;
  //           break;
  //         default:
  //           console.log(split);
  //           console.warn(`Unknown key in waterfall update: ${key}`);
  //       }
  //     });
  //     return waterfall;
  //   };
  //
  //   if (stream in state.status.display.waterfall) {
  //     if (split.includes("removed")) {
  //       setState(
  //         "status",
  //         "display",
  //         "waterfall",
  //         produce((waterfall) => {
  //           delete waterfall[stream];
  //         }),
  //       );
  //     } else {
  //       setState(
  //         "status",
  //         "display",
  //         "waterfall",
  //         stream,
  //         produce(applyUpdate),
  //       );
  //     }
  //   } else {
  //     const newWaterfall = {} as Partial<Waterfall>;
  //     applyUpdate(newWaterfall);
  //     setState("status", "display", "waterfall", stream, newWaterfall);
  //   }
  // }

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

  // function updateDisplay(message: string) {
  //   const [_display, kind, stream, ...split] = message
  //     .split(" ")
  //     .filter((part) => part.length);
  //
  //   switch (kind) {
  //     case "pan":
  //       if (!flexSession()) {
  //         updatePanadapter(stream, split);
  //       }
  //       break;
  //     case "waterfall":
  //       if (!flexSession()) {
  //         updateWaterfall(stream, split);
  //       }
  //       break;
  //     default:
  //       console.warn("Received unknown display update:", message);
  //   }
  // }

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
    const clientHandle = parseInt(state.clientHandle, 16);
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
          state.status.display.pan[streamId]?.clientHandle === clientHandle,
      )[0] || null;
    console.log("Setting first owned panadapter:", firstOwnPan);
    setState("selectedPanadapter", firstOwnPan ?? null);
  });

  const handleControlLine = async (payload: string) => {
    switch (payload[0]) {
      case "V": {
        // Version preamble
        const version = payload.slice(1);
        console.log("Version:", version);
        break;
      }
      case "H": {
        // Handle preamble
        if (!flexSession()) {
          pendingHandleLine = payload;
          return;
        }
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
        const [, responseCode, message] = payload.split("|");
        if (responseCode && responseCode !== "0") {
          console.warn("Command reply", payload);
        }
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
            return;
          // return updateDisplay(message);
          case "slice":
            console.log("Slice state update:", message);
            // Slice state updates are provided via flexlib change events.
            return;
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
      const parsed = parseVitaPacket(new Uint8Array(data), {
        meter: meterScratch,
        panadapter: panadapterScratch,
        waterfall: waterfallScratch,
      });
      if (!parsed) {
        console.warn("Unhandled UDP packet");
        return;
      }

      const metadata = toMetadata(parsed);
      _events.dispatchEvent(
        new PacketEvent(
          parsed.kind,
          parsed.packet as PacketDetailMap[typeof parsed.kind],
          metadata,
        ),
      );
    } catch (error) {
      console.error("Error decoding UDP packet:", error);
      disconnect();
    }
  };

  createEffect(() => {
    _events.addEventListener("meter", ({ packet }) => {
      const meterPacket = packet;
      setState(
        "status",
        "meters",
        produce((meters) => {
          const count = meterPacket.numMeters;
          for (let i = 0; i < count; i++) {
            const id = meterPacket.ids[i];
            if (id in meters) {
              meters[id].value = meterPacket.values[i] / meters[id].scale;
            }
          }
        }),
      );
    });
  });

  const connect = (addr: { host: string; port: number }) => {
    console.log("Connecting to", addr);
    setState("connectModal", "status", ConnectionState.connecting);
    setState("connectModal", "selectedRadio", addr.host);
    setState("connectModal", "stage", ConnectionStage.TCP);
    const descriptor = state.connectModal.radios[addr.host];
    if (!descriptor) {
      showToast({
        description: "Selected radio is unavailable",
        variant: "error",
      });
      setState("connectModal", "status", ConnectionState.disconnected);
      setState("connectModal", "selectedRadio", null);
      return;
    }

    void (async () => {
      try {
        const currentSession = flexSession();
        if (currentSession) {
          setFlexSession(null);
          for (const sub of flexSessionSubscriptions) sub.unsubscribe();
          flexSessionSubscriptions = [];
          try {
            await currentSession.close();
          } catch (error) {
            console.error("Failed to close previous session", error);
          }
        }

        const newSession = await flexClient.connect(descriptor, {
          connectionParams: {
            onControlLine: (line) => {
              handleControlLine(line).catch((error) =>
                console.error("Control line handler error", error),
              );
            },
            onBinaryMessage: handleUdpPacket,
          },
        });
        setFlexSession(newSession);
        const changeSubscription = newSession.on("change", handleStateChange);
        const messageSubscription = newSession.on(
          "message",
          (message: FlexWireMessage) => {
            if (
              message.kind === "status" ||
              message.kind === "reply" ||
              message.kind === "notice"
            ) {
              handleControlLine(message.raw).catch((error) =>
                console.error("Failed to handle control message", error),
              );
            }
          },
        );
        const disconnectedSubscription = newSession.on("disconnected", () => {
          disconnect();
        });
        flexSessionSubscriptions = [
          changeSubscription,
          messageSubscription,
          disconnectedSubscription,
        ];
        const initial = newSession.snapshot();
        batch(() => {
          initial.slices.forEach((slice) => applySliceSnapshot(slice));
          initial.panadapters.forEach((pan) => applyPanadapterSnapshot(pan));
          initial.waterfalls.forEach((waterfall) =>
            applyWaterfallSnapshot(waterfall),
          );
        });
        if (pendingHandleLine) {
          const line = pendingHandleLine;
          pendingHandleLine = null;
          await handleControlLine(line);
        }
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          sendCommand("ping").catch((error) => {
            console.warn("Ping command failed", error);
          });
        }, 1_000);
      } catch (error) {
        console.error("Failed to connect to radio", error);
        showToast({
          description: "Failed to connect to radio",
          variant: "error",
        });
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = undefined;
        }
        pendingHandleLine = null;
        setState("connectModal", "status", ConnectionState.disconnected);
        setState("connectModal", "selectedRadio", null);
        setState("connectModal", "stage", ConnectionStage.TCP);
        const existing = flexSession();
        if (existing) {
          setFlexSession(null);
          try {
            await existing.close();
          } catch (closeError) {
            console.error("Error while closing failed session", closeError);
          }
        }
      }
    })();
  };

  createEffect(() => {
    const rtcSession = sessionRTC();
    if (!rtcSession) return;
    console.log("Setting up RTC data channel listener");
    rtcSession.data.addEventListener("message", handleUdpPacket);
    onCleanup(() => {
      console.log("Cleaning up RTC data channel listener");
      rtcSession.data.removeEventListener("message", handleUdpPacket);
    });
  });

  const disconnect = () => {
    sessionRTC()?.close();
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = undefined;
    }
    const currentSession = flexSession();
    setFlexSession(null);
    pendingHandleLine = null;
    for (const sub of flexSessionSubscriptions) sub.unsubscribe();
    flexSessionSubscriptions = [];
    if (currentSession) {
      currentSession
        .close()
        .catch((error) => console.error("Error closing flex session", error));
    }
    setState(reconcile(initialState()));
    serialToHost.clear();
  };

  return (
    <FlexRadioContext.Provider
      value={{
        events: _events,
        state,
        setState,
        sendCommand,
        connect,
        disconnect,
        session: flexSession,
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
