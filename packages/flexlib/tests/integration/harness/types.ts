/** Radio model family, derived from the model string during recon. */
export type RadioSeries = "6xxx" | "8xxx" | "aurora" | "other";

/** Endpoint of the radio the suite is running against. */
export interface RadioTarget {
  readonly host: string;
  readonly port: number;
}

/**
 * Facts gathered about the target radio during the recon phase
 * (global setup). Serializable — travels from the vitest main process
 * to test workers via provide/inject.
 *
 * Tests use these to gate model/option-specific cases via `skipIf`.
 */
export interface ReconInfo {
  readonly serial: string;
  readonly model: string;
  readonly series: RadioSeries;
  readonly nickname: string;
  readonly callsign: string;
  readonly version: string;
  /** Raw options string reported by the radio (installed options/licenses). */
  readonly radioOptions: string;
  readonly scuCount: number;
  readonly sliceCount: number;
  readonly txCount: number;
  readonly availableSlices: number;
  readonly availablePanadapters: number;
  readonly daxIqCapacity: number;
  readonly atuPresent: boolean;
  readonly gpsInstalled: boolean;
  readonly oscillatorGnssPresent: boolean;
  readonly oscillatorGpsdoPresent: boolean;
  readonly oscillatorTcxoPresent: boolean;
  readonly oscillatorExternalPresent: boolean;
  /** tx_inhibit value found on the radio BEFORE the suite forced it on. */
  readonly originalTxInhibit: boolean;
  /** Discovery metadata, when a discovery packet was seen for this radio. */
  readonly discovery?: {
    readonly status: string;
    readonly licensedClients: number;
    readonly availableClients: number;
    readonly maxSlices: number;
    readonly maxPanadapters: number;
    readonly maxLicensedVersion: string;
    readonly minSoftwareVersion: string;
  };
}

export function classifySeries(model: string): RadioSeries {
  if (model.startsWith("FLEX-6")) return "6xxx";
  if (model.startsWith("FLEX-8")) return "8xxx";
  if (model.startsWith("AU-")) return "aurora";
  return "other";
}

declare module "vitest" {
  export interface ProvidedContext {
    "flex:target": RadioTarget;
    "flex:recon": ReconInfo;
  }
}
