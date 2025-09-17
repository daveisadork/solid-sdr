import {
  Component,
  ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  splitProps,
} from "solid-js";
import { createShortcut } from "@solid-primitives/keyboard";
import useFlexRadio, { PacketEvent } from "~/context/flexradio";
import { cn } from "~/lib/utils";
import { throttle } from "@solid-primitives/scheduled";

type FrameBins = {
  bins: number[];
  received: number;
  total: number;
};

type Target = {
  peakBin: number;
  leftBin: number;
  rightBin: number;
  tuneMHz: number;
};

const BASE_THRESHOLD = 0.1; // floor for detection (0..1, after normalization)
const PCT_FOR_THRESHOLD = 0.2; // adaptive: 80th percentile of window-energies
const SMOOTH_TAPS = 5; // moving average taps (odd, 3–7 is good)
const MIN_SEP_FACTOR = 1.0; // min separation between regions in units of filter-width
const CW_PITCH_HZ = 600; // default CW pitch if you want mode-aware CW

export const TabToSignal: Component<
  ComponentProps<"div"> & { streamId: string }
> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  const { events, state, setState, sendCommand } = useFlexRadio();

  const [peaks, setPeaks] = createSignal<number[]>([]); // for your overlay
  const [targets, setTargets] = createSignal<Target[]>([]); // mode-aware tune targets

  const frames = new Map<number, FrameBins>();

  // ---------- Utilities ----------
  const clamp = (x: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, x));

  function hzPerBin(bandwidthMHz: number, totalBins: number) {
    return (bandwidthMHz * 1e6) / totalBins;
  }

  function filterWidthInBins(
    filter_lo: number,
    filter_hi: number,
    bandwidthMHz: number,
    totalBins: number,
  ) {
    const widthHz = Math.max(1, filter_hi - filter_lo);
    return clamp(
      Math.round(widthHz / hzPerBin(bandwidthMHz, totalBins)),
      3,
      Math.max(3, Math.floor(totalBins / 8)),
    );
  }

  function binCenterToRF_MHz(
    bin: number,
    centerMHz: number,
    bandwidthMHz: number,
    totalBins: number,
  ) {
    const binWidthMHz = bandwidthMHz / totalBins;
    // center-of-bin to remove ~½-bin bias
    return centerMHz - bandwidthMHz / 2 + (bin + 0.5) * binWidthMHz;
  }

  function movingAverage(values: number[], taps: number): number[] {
    if (taps <= 1) return values.slice();
    const k = taps | 0;
    const half = (k - 1) >> 1;
    const n = values.length;
    const out = new Array<number>(n);
    let sum = 0;

    // prime window
    for (let i = 0; i < n; i++) {
      sum += values[i];
      if (i >= k) sum -= values[i - k];
      const idx = i;
      if (i >= k - 1) {
        out[idx - half] = sum / k;
      }
    }
    // pad edges with nearest computed value
    for (let i = 0; i < half; i++) out[i] = out[half];
    for (let i = n - half; i < n; i++) out[i] = out[n - half - 1];
    return out;
  }

  function slidingMean(values: number[], window: number): number[] {
    const outLen = Math.max(0, values.length - window + 1);
    const out = new Array<number>(outLen);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= window) sum -= values[i - window];
      if (i >= window - 1) out[i - (window - 1)] = sum / window;
    }
    return out;
  }

  function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const idx = clamp(Math.floor(p * (a.length - 1)), 0, a.length - 1);
    return a[idx];
  }

  // pick left-edges of strong windows (NMS with min separation)
  function pickWindowEdges(
    avg: number[],
    threshold: number,
    minSep: number,
  ): number[] {
    const edges: number[] = [];
    let last = -Infinity;
    for (let i = 1; i < avg.length - 1; i++) {
      if (avg[i] > threshold && avg[i] > avg[i - 1] && avg[i] > avg[i + 1]) {
        if (i - last >= minSep) {
          edges.push(i);
          last = i;
        }
      }
    }
    return edges;
  }

  // inside [L..R] choose a peak bin (local max of smoothed values), fallback to center
  function peakInside(values: number[], L: number, R: number): number {
    let best = -1,
      bestVal = -Infinity;
    const start = Math.max(1, L + 1);
    const end = Math.min(values.length - 2, R - 1);
    for (let i = start; i <= end; i++) {
      if (
        values[i] > values[i - 1] &&
        values[i] > values[i + 1] &&
        values[i] > bestVal
      ) {
        best = i;
        bestVal = values[i];
      }
    }
    return best >= 0 ? best : Math.floor((L + R) / 2);
  }

  // Compute a mode-aware dial target in MHz from a region
  function dialForMode(
    mode: string,
    peakRF_MHz: number,
    leftRF_MHz: number,
    rightRF_MHz: number,
    slice: any, // Slice
  ): number {
    const m = mode.toUpperCase();
    // AM-like: center on carrier
    if (m === "AM" || m === "SAM") {
      return (leftRF_MHz + rightRF_MHz) / 2;
    }
    // CW: place tone at pitch relative to dial; choose sign from passband
    if (m === "CW") {
      const { filter_lo, filter_hi } = slice;
      const sign = Math.abs(filter_hi) >= Math.abs(filter_lo) ? +1 : -1;
      return peakRF_MHz - (sign * CW_PITCH_HZ) / 1e6;
    }
    // FM-ish or everything else: use peak RF
    // (USB/LSB/DIGU/DIGL/RTTY generally feel best on the peak visually)
    return peakRF_MHz;
  }

  // ---------- Frame intake & detection ----------
  createEffect(() => {
    const stream_id = parseInt(props.streamId, 16);

    const handler = ({ packet }: PacketEvent<"panadapter">) => {
      if (packet.stream_id !== stream_id) return;
      const {
        payload: { startingBin, binsInThisFrame, totalBins, frame, bins },
      } = packet;

      // collect frame
      let f = frames.get(frame);
      if (!f) {
        f = {
          bins: new Array<number>(totalBins).fill(0),
          received: 0,
          total: totalBins,
        };
        frames.set(frame, f);
      }
      f.bins.splice(startingBin, binsInThisFrame, ...bins);
      f.received += binsInThisFrame;

      if (f.received >= totalBins) {
        detectAndStoreTargets(f.bins);
        frames.delete(frame);
      }
    };

    events.addEventListener("panadapter", handler);
    onCleanup(() => events.removeEventListener("panadapter", handler));
  });

  // Robust noise estimate using median & MAD
  function robustNoise(stats: number[]) {
    if (stats.length === 0) return { med: 0, sigma: 0 };
    const s = stats.slice().sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)];
    const abs = s.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = abs[Math.floor(abs.length / 2)] || 0;
    const sigma = 1.4826 * mad; // ~std for Gaussian
    return { med, sigma };
  }

  /**
   * Find the LEFT onset inside [L..R] for USB-like alignment.
   * We fuse two cues:
   *   (A) fractional-of-peak threshold crossing, and
   *   (B) steepest rising slope before the peak.
   * Then choose the earliest plausible onset that sustains for a couple bins.
   */
  function leftEdgeInWindow(
    values: number[], // smoothed, 0..1
    L: number,
    R: number,
    fracOfPeak = 0.25, // 25% of peak (~ -12 dB)
    slopeMin = 0.01, // minimum rise per bin after smoothing
    holdBins = 2, // require signal stays above thr for N bins
  ): number {
    const peakIdx =
      L +
      values
        .slice(L, R + 1)
        .reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
    const peakVal = values[peakIdx];

    // Local noise from a small band just before the window
    const preL = Math.max(0, L - (R - L + 1));
    const pre = values.slice(preL, L);
    const { med: noiseMed, sigma } = robustNoise(pre);
    const thrAbs = noiseMed + 2 * sigma; // noise-aware absolute floor
    const thrRel = peakVal * fracOfPeak; // relative to local peak
    const thr = Math.max(thrAbs, thrRel, 0.05); // clamp to minimal sanity

    // 1) Fractional-of-peak crossing with sustain & rising slope
    for (let i = L + 1; i <= peakIdx; i++) {
      const rising = values[i] - values[i - 1];
      if (values[i] >= thr && rising >= slopeMin) {
        let ok = true;
        for (let k = 1; k <= holdBins; k++) {
          if (i + k > peakIdx || values[i + k] < thr) {
            ok = false;
            break;
          }
        }
        if (ok) return i;
      }
    }

    // 2) Fallback: steepest rising slope prior to peak
    let bestI = L + 1,
      bestSlope = -Infinity;
    for (let i = L + 1; i <= peakIdx; i++) {
      const s = values[i] - values[i - 1];
      if (s > bestSlope) {
        bestSlope = s;
        bestI = i;
      }
    }
    return bestI;
  }

  const updatePeaks = throttle((bins: number[]) => setPeaks(bins), 200);
  const updateTargets = throttle((t: Target[]) => setTargets(t), 200);

  const detectAndStoreTargets = (rawBins: number[]) => {
    const pan = state.status.display.pan[props.streamId];
    if (!pan) return;

    const sliceId = activeSlice();
    if (!sliceId) return;
    const slice = state.status.slice[sliceId];
    if (!slice) return;

    const { x_pixels: totalBins, y_pixels: maxY, bandwidth, center } = pan;
    const { filter_lo, filter_hi } = slice;

    // normalize power: lower y = stronger → invert and scale to [0,1]
    const inv = rawBins.map((b) => (maxY || 1) - b);
    const minV = Math.min(...inv);
    const rng = Math.max(1, (maxY || 1) - minV);
    const norm = inv.map((b) => (b - minV) / rng);

    // smoothing
    const smoothed = movingAverage(norm, SMOOTH_TAPS);

    // windowing at filter width
    const wBins = filterWidthInBins(filter_lo, filter_hi, bandwidth, totalBins);
    const windowEnergy = slidingMean(smoothed, wBins);

    // adaptive threshold (percentile of window energies) with floor
    const adaptive = percentile(windowEnergy, PCT_FOR_THRESHOLD);
    const thr = clamp(Math.max(BASE_THRESHOLD, adaptive), 0.05, 0.9);

    // choose strong windows (left edges), enforce separation in window units
    const minSep = Math.max(10, Math.floor(wBins * MIN_SEP_FACTOR));
    const edges = pickWindowEdges(windowEnergy, thr, minSep);

    // build regions & compute tune targets
    const result: Target[] = [];
    const peakBinsForOverlay: number[] = [];

    for (const L of edges) {
      const R = Math.min(totalBins - 1, L + wBins - 1);

      // pick left onset (USB-style)
      const leftBin = leftEdgeInWindow(smoothed, L, R, 0.25, 0.01, 2);

      // still keep a “visual” peak for overlay if you want:
      // (you may keep your existing peakInside(...) to draw orange tick marks)
      const peakBin = peakInside(smoothed, L, R);

      const leftRF = binCenterToRF_MHz(leftBin, center, bandwidth, totalBins);
      const rightRF = binCenterToRF_MHz(R, center, bandwidth, totalBins);
      const peakRF = binCenterToRF_MHz(peakBin, center, bandwidth, totalBins);

      // ---- Mode-aware dial target (edge for SSB, center for AM, etc.) ----
      const mode = slice.mode.toUpperCase();

      let tuneMHz: number;
      if (mode === "USB" || mode === "DIGU" || mode === "RTTY") {
        tuneMHz = leftRF; // align to rising edge (what you want)
      } else if (mode === "LSB" || mode === "DIGL") {
        tuneMHz = rightRF; // mirror for LSB family
      } else if (mode === "AM" || mode === "SAM") {
        tuneMHz = (leftRF + rightRF) / 2;
      } else if (mode === "CW") {
        // place tone at CW pitch; sign follows which side of dial the passband favors
        const sign =
          Math.abs(slice.filter_hi) >= Math.abs(slice.filter_lo) ? +1 : -1;
        tuneMHz = peakRF - (sign * CW_PITCH_HZ) / 1e6;
      } else {
        // default: peak behavior
        tuneMHz = peakRF;
      }

      result.push({ peakBin, leftBin, rightBin: R, tuneMHz });
      peakBinsForOverlay.push(leftBin); // draw the LEFT edge as your overlay line
    }

    // sort by frequency (ascending bins)
    result.sort((a, b) => a.peakBin - b.peakBin);

    updatePeaks(peakBinsForOverlay);
    updateTargets(result);
  };

  // ---------- Slice helpers & tuning ----------
  const activeSlice = createMemo(() => {
    const streamId = props.streamId;
    if (!streamId) return null;
    return (
      Object.keys(state.status.slice).find((key) => {
        const s = state.status.slice[key];
        return s.pan === streamId && s.active;
      }) ?? null
    );
  });

  const currentFreq = createMemo(() => {
    const id = activeSlice();
    if (!id) return null;
    return state.status.slice[id]?.RF_frequency ?? null; // MHz
  });

  const tuneToFrequency = async (freqMHz: number) => {
    const id = activeSlice();
    if (!id) return;
    // const stepHz = state.status.slice[id].step; // Hz
    const stepHz = 1000;
    const stepMHz = (stepHz ?? 100) / 1e6;
    const rounded = Math.round(freqMHz / stepMHz) * stepMHz;

    await sendCommand(`slice t ${id} ${rounded}`);
    setState("status", "slice", id, "RF_frequency", Number(rounded));
  };

  const tuneToNextPeak = () => {
    const list = targets();
    if (list.length === 0) return;
    const cur = currentFreq() ?? -Infinity;
    const next = list.find((t) => t.tuneMHz > cur);
    if (next) tuneToFrequency(next.tuneMHz);
  };

  const tuneToPrevPeak = () => {
    const list = targets();
    if (list.length === 0) return;
    const cur = currentFreq() ?? Infinity;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].tuneMHz < cur) {
        tuneToFrequency(list[i].tuneMHz);
        break;
      }
    }
  };

  // ---------- Shortcuts ----------
  createShortcut(["]"], () => tuneToNextPeak(), {
    preventDefault: true,
    requireReset: true,
  });

  createShortcut(["["], () => tuneToPrevPeak(), {
    preventDefault: true,
    requireReset: true,
  });

  // ---------- Overlay ----------
  return (
    <div
      class={cn(
        "absolute inset-0 pointer-events-none translate-x-[var(--drag-offset)]",
        local.class,
      )}
      {...others}
    >
      <For each={peaks()}>
        {(bin) => (
          <div
            class="absolute inset-y-0 left-[var(--bin-offset)] w-px bg-amber-500"
            style={{ "--bin-offset": `${bin}px` }}
          />
        )}
      </For>
      {/* Optional: show window extents
      <For each={targets()}>
        {(t) => (
          <div
            class="absolute top-0 h-full bg-amber-500/10"
            style={{
              left: `${t.leftBin}px`,
              width: `${t.rightBin - t.leftBin + 1}px`,
            }}
          />
        )}
      </For> */}
    </div>
  );
};
