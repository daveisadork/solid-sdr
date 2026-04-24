/**
 * Static model capability metadata derived from the official FlexLib model
 * table used by SmartSDR for UI decisions such as DAX IQ channel limits.
 */

/**
 * FlexRadio hardware platform family.
 */
export type RadioPlatform =
  | "microburst"
  | "deep-eddy"
  | "big-bend"
  | "dragon-fire";

/**
 * RapidM modem support level for a radio model.
 */
export type ModemSupport =
  | "supported"
  | "not-supported"
  | "supported-dev-only";

/**
 * RapidM modem configuration variant supported by a model.
 */
export type ModemConfigurationType =
  | "single-modem"
  | "dual-modem-copro"
  | "dual-modem-independent";

/**
 * Static capabilities for a specific radio model.
 */
export interface RadioModelInfo {
  /** Canonical model string reported by the radio, e.g. "FLEX-6600". */
  readonly modelName: string;
  /** Hardware platform family. */
  readonly platform: RadioPlatform;
  /** Whether the model has an integrated front panel / M display. */
  readonly isMModel: boolean;
  /** Whether antenna diversity is supported. */
  readonly isDiversityAllowed: boolean;
  /** Whether the model includes an OLED front-panel display. */
  readonly hasOledDisplay: boolean;
  /** Whether oscillator selection controls are available. */
  readonly isOscillatorSelectAvailable: boolean;
  /** Whether the front panel has backlighting controls. */
  readonly hasBacklitFrontPanel: boolean;
  /** Whether the model includes a transmitter. */
  readonly hasTransmitter: boolean;
  /** Whether Loop A is available. */
  readonly hasLoopA: boolean;
  /** Whether Loop B is available. */
  readonly hasLoopB: boolean;
  /** Whether native 4 meter support is present. */
  readonly has4Meters: boolean;
  /** Whether native 2 meter support is present. */
  readonly has2Meters: boolean;
  /** Maximum panadapter DAX IQ channels exposed by SmartSDR for the model. */
  readonly maxDaxIqChannels: number;
  /** Whether the model includes the Overlord PA capability. */
  readonly hasOverlordPa: boolean;
  /** Whether the model includes a transmit amplifier. */
  readonly hasTxAmplifier: boolean;
  /** RapidM modem support level. */
  readonly supportsRapidMModem: ModemSupport;
  /** Supported RapidM modem configurations. */
  readonly supportedRapidMModemConfigTypes: readonly ModemConfigurationType[];
  /** SmartSDR image asset name associated with the model. */
  readonly imageName: string;
  /** Available slice labels for the model. */
  readonly sliceNames: readonly string[];
  /** Maximum simultaneous slices for the model. */
  readonly maxSliceCount: number;
}

type RadioModelInfoDefinition = Omit<
  RadioModelInfo,
  "modelName" | "maxSliceCount"
>;

function defineModelInfo(
  modelName: string,
  definition: RadioModelInfoDefinition,
): RadioModelInfo {
  return Object.freeze({
    modelName,
    ...definition,
    maxSliceCount: definition.sliceNames.length,
  });
}

const RADIO_MODEL_INFO_BY_NAME: Readonly<Record<string, RadioModelInfo>> =
  Object.freeze({
    DEFAULT: defineModelInfo("DEFAULT", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: false,
      hasBacklitFrontPanel: false,
      hasTransmitter: false,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6300-small.png",
      sliceNames: ["A", "B"],
    }),
    "FLEX-6300": defineModelInfo("FLEX-6300", {
      platform: "microburst",
      isMModel: false,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: false,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6300-small.png",
      sliceNames: ["A", "B"],
    }),
    "FLEX-6400": defineModelInfo("FLEX-6400", {
      platform: "deep-eddy",
      isMModel: false,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6600.png",
      sliceNames: ["A", "B"],
    }),
    "FLEX-6400M": defineModelInfo("FLEX-6400M", {
      platform: "deep-eddy",
      isMModel: true,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6600M.png",
      sliceNames: ["A", "B"],
    }),
    "FLEX-6500": defineModelInfo("FLEX-6500", {
      platform: "microburst",
      isMModel: false,
      isDiversityAllowed: false,
      hasOledDisplay: true,
      isOscillatorSelectAvailable: false,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: true,
      hasLoopB: false,
      has4Meters: true,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6000-Cutout.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "FLEX-6600": defineModelInfo("FLEX-6600", {
      platform: "deep-eddy",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "FLEX-6600M": defineModelInfo("FLEX-6600M", {
      platform: "deep-eddy",
      isMModel: true,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6600M.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "FLEX-6700": defineModelInfo("FLEX-6700", {
      platform: "microburst",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: true,
      isOscillatorSelectAvailable: false,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: true,
      hasLoopB: true,
      has4Meters: true,
      has2Meters: true,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6000-Cutout.png",
      sliceNames: ["A", "B", "C", "D", "E", "F", "G", "H"],
    }),
    "FLEX-6700R": defineModelInfo("FLEX-6700R", {
      platform: "microburst",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: true,
      isOscillatorSelectAvailable: false,
      hasBacklitFrontPanel: false,
      hasTransmitter: false,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "not-supported",
      supportedRapidMModemConfigTypes: [],
      imageName: "6000-Cutout.png",
      sliceNames: ["A", "B", "C", "D", "E", "F", "G", "H"],
    }),
    "FLEX-8400": defineModelInfo("FLEX-8400", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B"],
    }),
    "FLEX-8400M": defineModelInfo("FLEX-8400M", {
      platform: "big-bend",
      isMModel: true,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600M.png",
      sliceNames: ["A", "B"],
    }),
    "FLEX-8600": defineModelInfo("FLEX-8600", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "FLEX-8600M": defineModelInfo("FLEX-8600M", {
      platform: "big-bend",
      isMModel: true,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600M.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "ML-9600W": defineModelInfo("ML-9600W", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "ML-9600X": defineModelInfo("ML-9600X", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "ML-9600": defineModelInfo("ML-9600", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "MLS-9601": defineModelInfo("MLS-9601", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: true,
      supportsRapidMModem: "supported",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "CL-9300": defineModelInfo("CL-9300", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "CLS-9301": defineModelInfo("CLS-9301", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: false,
      hasTxAmplifier: true,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "6600.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "RT-2122": defineModelInfo("RT-2122", {
      platform: "dragon-fire",
      isMModel: false,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: false,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: false,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
      ],
      imageName: "6400.png",
      sliceNames: ["A", "B"],
    }),
    "AU-510": defineModelInfo("AU-510", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: true,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "A520.png",
      sliceNames: ["A", "B"],
    }),
    "AU-510M": defineModelInfo("AU-510M", {
      platform: "big-bend",
      isMModel: true,
      isDiversityAllowed: false,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 2,
      hasOverlordPa: true,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "A520M.png",
      sliceNames: ["A", "B"],
    }),
    "AU-520": defineModelInfo("AU-520", {
      platform: "big-bend",
      isMModel: false,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: true,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: true,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "A520.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
    "AU-520M": defineModelInfo("AU-520M", {
      platform: "big-bend",
      isMModel: true,
      isDiversityAllowed: true,
      hasOledDisplay: false,
      isOscillatorSelectAvailable: true,
      hasBacklitFrontPanel: false,
      hasTransmitter: true,
      hasLoopA: false,
      hasLoopB: false,
      has4Meters: false,
      has2Meters: false,
      maxDaxIqChannels: 4,
      hasOverlordPa: true,
      hasTxAmplifier: false,
      supportsRapidMModem: "supported-dev-only",
      supportedRapidMModemConfigTypes: [
        "single-modem",
        "dual-modem-copro",
        "dual-modem-independent",
      ],
      imageName: "A520M.png",
      sliceNames: ["A", "B", "C", "D"],
    }),
  });

/**
 * Default model metadata used when a radio reports an unknown model string.
 */
export const DEFAULT_RADIO_MODEL_INFO = RADIO_MODEL_INFO_BY_NAME.DEFAULT;

/**
 * Canonical model names known to the static model table, excluding DEFAULT.
 */
export const KNOWN_RADIO_MODEL_NAMES = Object.freeze(
  Object.keys(RADIO_MODEL_INFO_BY_NAME).filter((modelName) => modelName !== "DEFAULT"),
);

/**
 * Looks up static capabilities for a radio model.
 *
 * Unknown or empty model strings return the upstream DEFAULT entry.
 */
export function getModelInfo(modelName: string | null | undefined): RadioModelInfo {
  const normalized = normalizeModelName(modelName);
  return RADIO_MODEL_INFO_BY_NAME[normalized] ?? DEFAULT_RADIO_MODEL_INFO;
}

function normalizeModelName(modelName: string | null | undefined): string {
  const normalized = modelName?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : "DEFAULT";
}
