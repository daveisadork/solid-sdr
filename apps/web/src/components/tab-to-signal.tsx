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
import { throttle } from "@solid-primitives/scheduled";
import useFlexRadio, { PacketEvent } from "~/context/flexradio";
import { cn } from "~/lib/utils";

// ------------ Types ------------
type FrameBins = { bins: number[]; received: number; total: number };
type Candidate = {
  dialMHz: number;
  leftBin: number;
  rightBin: number;
  energy: number;
};
type Target = {
  dialMHz: number;
  leftBin: number;
  rightBin: number;
  energy: number;
};

// Persistent track with hysteresis & decay
type Track = {
  dialMHz: number;
  leftBin: number;
  rightBin: number;
  emaEnergy: number;
  lastEnergy: number;
  lastSeen: number; // ms
  holdUntil: number; // ms
};

// ------------ Tunables ------------
const BASE_ENERGY_THRESHOLD = 0.1; // 0..1 floor after normalization
const ADAPTIVE_PCT = 0.2; // 80th percentile of stop energies
const SCAN_THROTTLE_MS = 150; // rescan at most every 150ms

// Persistence & anti-bounce
const TARGET_TTL_MS = 4000; // keep tracks this long after last seen
const ENERGY_EMA_ALPHA = 0.35; // smoothing for track energy
const HOLD_MS = 700; // minimum time before allowing dial to hop
const HYSTERESIS_MARGIN = 0.1; // require +10% energy to hop to a nearby stop
const OVERLAY_WINDOWS = true; // set true to render ghost passbands

// ------------ Helpers ------------
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function hzPerBin(bandwidthMHz: number, totalBins: number) {
  return (bandwidthMHz * 1e6) / totalBins;
}

// Bin center <-> RF MHz mapping
function binCenterToRF_MHz(
  bin: number,
  centerMHz: number,
  bandwidthMHz: number,
  totalBins: number,
) {
  const w = bandwidthMHz / totalBins;
  return centerMHz - bandwidthMHz / 2 + (bin + 0.5) * w;
}
function rfMHzToBin(
  rfMHz: number,
  centerMHz: number,
  bandwidthMHz: number,
  totalBins: number,
) {
  const w = bandwidthMHz / totalBins;
  return (rfMHz - (centerMHz - bandwidthMHz / 2)) / w - 0.5;
}

function roundUpToStep(valueMHz: number, stepMHz: number) {
  return +(Math.ceil(valueMHz / stepMHz) * stepMHz).toFixed(10);
}

function percentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const i = clamp(Math.floor(p * (a.length - 1)), 0, a.length - 1);
  return a[i];
}

// Prefix sums -> O(1) range average
function makeRangeSummer(values: number[]) {
  const ps = new Array(values.length + 1);
  ps[0] = 0;
  for (let i = 0; i < values.length; i++) ps[i + 1] = ps[i] + values[i];
  return (L: number, R: number) => {
    const l = clamp(L, 0, values.length - 1);
    const r = clamp(R, 0, values.length - 1);
    if (r < l) return 0;
    return (ps[r + 1] - ps[l]) / (r - l + 1);
  };
}

function overlapsBins(aL: number, aR: number, bL: number, bR: number) {
  return aL <= bR && bL <= aR;
}

// collapse overlapping passbands, keep strongest
function dedupeOverlappingTargets(cands: Target[]): Target[] {
  if (cands.length <= 1) return cands;
  const a = [...cands].sort((x, y) => x.leftBin - y.leftBin);
  const out: Target[] = [];
  let best = a[0];
  let clusterR = a[0].rightBin;
  for (let i = 1; i < a.length; i++) {
    const t = a[i];
    if (t.leftBin <= clusterR) {
      clusterR = Math.max(clusterR, t.rightBin);
      if (t.energy > best.energy) best = t;
    } else {
      out.push(best);
      best = t;
      clusterR = t.rightBin;
    }
  }
  out.push(best);
  return out;
}

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  // Anything with role="textbox"
  if (el.getAttribute?.("role") === "textbox") return true;
  return false;
}

// ------------ Component ------------
export const TabToSignal: Component<
  ComponentProps<"div"> & { streamId: string }
> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  const { events, state, setState, sendCommand } = useFlexRadio();

  const frames = new Map<number, FrameBins>();
  const [targets, setTargets] = createSignal<Target[]>([]);
  let tracks: Track[] = []; // persistent across scans

  const pan = createMemo(
    () => state.status.display.pan[props.streamId] ?? null,
  );

  const activeSlice = createMemo(() => {
    const sid = props.streamId;
    if (!sid) return null;
    return (
      Object.keys(state.status.slice).find((key) => {
        const s = state.status.slice[key];
        return s.pan === sid && s.active;
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
    const stepHz = state.status.slice[id].step ?? 100; // Hz
    const stepMHz = stepHz / 1e6;
    const rounded = +(Math.round(freqMHz / stepMHz) * stepMHz).toFixed(6);
    await sendCommand(`slice t ${id} ${rounded}`);
    setState("status", "slice", id, "RF_frequency", Number(rounded));
  };

  const tuneToNextStop = () => {
    const list = targets()
      .slice()
      .sort((a, b) => a.dialMHz - b.dialMHz);
    if (list.length === 0) return;
    const cur = currentFreq() ?? -Infinity;
    const next = list.find((t) => t.dialMHz > cur);
    if (next) tuneToFrequency(next.dialMHz);
  };

  const tuneToPrevStop = () => {
    const list = targets()
      .slice()
      .sort((a, b) => a.dialMHz - b.dialMHz);
    if (list.length === 0) return;
    const cur = currentFreq() ?? Infinity;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].dialMHz < cur) {
        tuneToFrequency(list[i].dialMHz);
        break;
      }
    }
  };

  const pushTargets = throttle(
    (t: Target[]) => setTargets(t),
    SCAN_THROTTLE_MS,
  );

  // ---------- Track merging (persistence + hysteresis) ----------
  function mergeCandidatesIntoTracks(
    cands: Candidate[],
    thr: number,
    stickyHz: number,
    totalBins: number,
  ) {
    const now = Date.now();

    // 1) match or create tracks
    for (const c of cands) {
      // find an overlapping/close track
      let bestIdx = -1;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        const overlaps = overlapsBins(
          c.leftBin,
          c.rightBin,
          t.leftBin,
          t.rightBin,
        );
        const freqDistHz = Math.abs(c.dialMHz - t.dialMHz) * 1e6;
        const close = freqDistHz <= stickyHz;
        if (overlaps || close) {
          const d = Math.min(
            Math.abs(c.leftBin - t.leftBin),
            Math.abs(c.rightBin - t.rightBin),
          );
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
      }

      if (bestIdx >= 0) {
        // update existing track
        const t = tracks[bestIdx];
        // EMA energy
        t.emaEnergy =
          (1 - ENERGY_EMA_ALPHA) * t.emaEnergy + ENERGY_EMA_ALPHA * c.energy;
        t.lastEnergy = c.energy;
        t.lastSeen = now;
        // tighten window to current observation
        t.leftBin = c.leftBin;
        t.rightBin = c.rightBin;

        // Hysteresis: only hop dial if (a) out of hold AND (b) significantly stronger
        const hop =
          now >= t.holdUntil &&
          c.dialMHz !== t.dialMHz &&
          c.energy >= t.emaEnergy * (1 + HYSTERESIS_MARGIN);
        if (hop) {
          t.dialMHz = c.dialMHz;
          t.holdUntil = now + HOLD_MS;
        }
      } else {
        // create new track
        tracks.push({
          dialMHz: c.dialMHz,
          leftBin: c.leftBin,
          rightBin: c.rightBin,
          emaEnergy: c.energy,
          lastEnergy: c.energy,
          lastSeen: now,
          holdUntil: now + HOLD_MS,
        });
      }
    }

    // 2) expire old tracks
    tracks = tracks.filter(
      (t) => now - t.lastSeen <= TARGET_TTL_MS && t.emaEnergy >= thr * 0.6,
    );

    // 3) dedupe overlapping tracks by EMA energy
    const outs: Target[] = tracks.map((t) => ({
      dialMHz: t.dialMHz,
      leftBin: t.leftBin,
      rightBin: t.rightBin,
      energy: t.emaEnergy,
    }));
    const deduped = dedupeOverlappingTargets(outs);

    // sort for stable Tab order
    deduped.sort((a, b) => a.dialMHz - b.dialMHz);
    pushTargets(deduped);
  }

  // ---------- Scanner (step-quantized, passband-energy) ----------
  function scanDialStops(rawBins: number[]) {
    const p = pan();
    const sliceId = activeSlice();
    if (!p || !sliceId) return;
    const slice = state.status.slice[sliceId];
    if (!slice) return;

    const { x_pixels: totalBins, y_pixels: maxY, bandwidth, center } = p;
    const leftEdgeMHz = center - bandwidth / 2;
    const rightEdgeMHz = center + bandwidth / 2;

    // normalize to "power" 0..1 (lower y = stronger)
    const inv = rawBins.map((b) => (maxY || 1) - b);
    const minV = Math.min(...inv);
    const rng = Math.max(1, (maxY || 1) - minV);
    const power = inv.map((v) => (v - minV) / rng);

    const avgRange = makeRangeSummer(power);

    // dial grid
    // const stepHz = slice.step || 100;
    const stepHz = 1000;
    const stepMHz = stepHz / 1e6;

    // sticky tolerance ~ one step or a couple bins
    const stickyHz = Math.max(
      stepHz,
      Math.round(hzPerBin(bandwidth, totalBins) * 2),
    );

    let dial = roundUpToStep(leftEdgeMHz, stepMHz);
    const tmp: { dialMHz: number; L: number; R: number; e: number }[] = [];
    const energies: number[] = [];

    while (dial <= rightEdgeMHz + 1e-12) {
      const loHz = Math.min(slice.filter_lo, slice.filter_hi);
      const hiHz = Math.max(slice.filter_lo, slice.filter_hi);

      const L_MHz = dial + loHz / 1e6;
      const R_MHz = dial + hiHz / 1e6;

      let Lbin = Math.floor(rfMHzToBin(L_MHz, center, bandwidth, totalBins));
      let Rbin = Math.ceil(rfMHzToBin(R_MHz, center, bandwidth, totalBins));
      Lbin = clamp(Lbin, 0, totalBins - 1);
      Rbin = clamp(Rbin, 0, totalBins - 1);
      if (Rbin < Lbin) [Lbin, Rbin] = [Rbin, Lbin];
      if (Rbin === Lbin) Rbin = clamp(Lbin + 1, 0, totalBins - 1);

      const e = avgRange(Lbin, Rbin);
      tmp.push({ dialMHz: dial, L: Lbin, R: Rbin, e });
      energies.push(e);

      dial = +(dial + stepMHz).toFixed(10);
    }

    if (tmp.length < 3) {
      pushTargets([]);
      return;
    }

    const adaptive = percentile(energies, ADAPTIVE_PCT);
    const thr = Math.max(BASE_ENERGY_THRESHOLD, adaptive);

    // local maxima on dial stops
    const localMax: Candidate[] = [];
    for (let i = 1; i < tmp.length - 1; i++) {
      const p = tmp[i - 1].e,
        c = tmp[i].e,
        n = tmp[i + 1].e;
      if (c >= thr && c > p && c > n) {
        localMax.push({
          dialMHz: tmp[i].dialMHz,
          leftBin: tmp[i].L,
          rightBin: tmp[i].R,
          energy: c,
        });
      }
    }

    // collapse overlapping candidates (strongest wins), then merge into tracks
    const dedupOnce: Target[] = dedupeOverlappingTargets(localMax);
    mergeCandidatesIntoTracks(dedupOnce, thr, stickyHz, totalBins);
  }

  const scheduleScan = throttle(
    (bins: number[]) => scanDialStops(bins),
    SCAN_THROTTLE_MS,
  );

  // Intake FFT chunks, reassemble frames, then schedule a scan
  createEffect(() => {
    const stream_id = parseInt(props.streamId, 16);
    const handler = ({ packet }: PacketEvent<"panadapter">) => {
      if (packet.stream_id !== stream_id) return;
      const {
        payload: { startingBin, binsInThisFrame, totalBins, frame, bins },
      } = packet;

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
        scheduleScan(f.bins);
        frames.delete(frame);
      }
    };

    events.addEventListener("panadapter", handler);
    onCleanup(() => events.removeEventListener("panadapter", handler));
  });

  // Shortcuts
  createEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Only intercept Tab when we are NOT typing in an editable control
      if (e.key !== "Tab" || isEditableTarget(e.target)) return;

      // Block the browser's focus navigation *before* it happens
      e.preventDefault();
      e.stopPropagation();
      // some browsers expose stopImmediatePropagation
      // @ts-ignore
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      if (e.shiftKey) {
        tuneToPrevStop();
      } else {
        tuneToNextStop();
      }
    };

    // Capture phase so we beat any in-app handlers/focus traps
    window.addEventListener("keydown", onKeyDown, { capture: true });
    onCleanup(() =>
      window.removeEventListener("keydown", onKeyDown, { capture: true }),
    );
  });

  // ------------ Render ------------
  return (
    <div
      class={cn(
        "absolute inset-0 pointer-events-none translate-x-[var(--drag-offset)]",
        local.class,
      )}
      {...others}
    >
      {/* Dial stop markers (persisted & de-bounced) */}
      <For each={targets()}>
        {(t) => {
          const p = pan();
          if (!p) return null;
          const x =
            rfMHzToBin(t.dialMHz, p.center, p.bandwidth, p.x_pixels) + 0.5;
          return (
            <div
              class="absolute inset-y-0 w-px bg-amber-500"
              style={{ left: `${x - 2}px` }}
              title={`${t.dialMHz.toFixed(6)} MHz  (e=${t.energy.toFixed(2)})`}
            />
          );
        }}
      </For>

      {/* Optional: ghost passband window for each target */}
      {OVERLAY_WINDOWS && (
        <For each={targets()}>
          {(t) => (
            <div
              class="absolute top-0 h-full bg-amber-500/10"
              style={{
                left: `${t.leftBin - 2}px`,
                width: `${t.rightBin - t.leftBin - 1}px`,
              }}
            />
          )}
        </For>
      )}
    </div>
  );
};
