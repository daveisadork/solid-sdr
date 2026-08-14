import { inject } from "vitest";
import type { ReconInfo } from "./types.js";

/**
 * Capability accessors for gating tests on what the target radio supports.
 *
 * Usable at test-file top level (recon runs in global setup, before any
 * worker starts):
 *
 * ```ts
 * describe.skipIf(!hasGps())("GPS status", () => { ... });
 * it.runIf(is8xxx())("8xxx-only behavior", () => { ... });
 * ```
 */
export function recon(): ReconInfo {
  return inject("flex:recon");
}

export const is6xxx = (): boolean => recon().series === "6xxx";
export const is8xxx = (): boolean => recon().series === "8xxx";
export const isAurora = (): boolean => recon().series === "aurora";
export const hasGps = (): boolean => recon().gpsInstalled;
export const hasAtu = (): boolean => recon().atuPresent;
export const hasMultipleScus = (): boolean => recon().scuCount > 1;
export const hasGnssOscillator = (): boolean => recon().oscillatorGnssPresent;
