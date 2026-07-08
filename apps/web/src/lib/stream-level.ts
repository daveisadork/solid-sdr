import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import type { DaxChannelMode } from "~/lib/dax-audio-sink/types";

const PEAK_HOLD = 120;
const PEAK_DECAY = 0.2;

export interface StreamLevel {
  /** Smoothed RMS level in dBFS (-Infinity when no stream/signal). */
  level: Accessor<number>;
  /** Peak-hold level in dBFS (-Infinity when no stream/signal). */
  peak: Accessor<number>;
}

/**
 * Derives a smoothed RMS level (dBFS) and a peak-hold value from a MediaStream
 * using the Web Audio API. This reflects the browser's own view of the audio —
 * e.g. the microphone the browser has access to — independent of any radio-side
 * meter. Returns -Infinity for both while there is no stream.
 */
export function createStreamLevel(
  stream: Accessor<MediaStream | undefined>,
  channelMode: Accessor<DaxChannelMode> = () => "both",
): StreamLevel {
  const [level, setLevel] = createSignal(-Infinity);
  const [peak, setPeak] = createSignal(-Infinity);

  createEffect(() => {
    const src = stream();
    if (!src) {
      setLevel(-Infinity);
      setPeak(-Infinity);
      return;
    }

    const mode = channelMode();
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(src);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const buf = new Float32Array(analyser.fftSize);

    if (mode === "both") {
      source.connect(analyser);
    } else {
      const splitter = ctx.createChannelSplitter(2);
      source.connect(splitter);
      splitter.connect(analyser, mode === "left" ? 0 : 1);
    }

    let smoothedRms = 0;
    let currentPeak = -Infinity;
    let peakHoldFrames = 0;
    let rafId: number;

    const tick = () => {
      analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>);
      let sum = 0;
      let maxAbs = 0;
      for (const sample of buf) {
        sum += sample * sample;
        const abs = Math.abs(sample);
        if (abs > maxAbs) maxAbs = abs;
      }
      const rms = Math.sqrt(sum / buf.length);
      const alpha = rms > smoothedRms ? 0.3 : 0.05;
      smoothedRms = alpha * rms + (1 - alpha) * smoothedRms;

      const peakDb = 20 * Math.log10(Math.max(maxAbs, 1e-7));
      if (peakDb >= currentPeak) {
        currentPeak = peakDb;
        peakHoldFrames = PEAK_HOLD;
      } else if (peakHoldFrames > 0) {
        peakHoldFrames--;
      } else {
        currentPeak = Math.max(currentPeak - PEAK_DECAY, peakDb);
      }

      setLevel(20 * Math.log10(Math.max(smoothedRms, 1e-7)));
      setPeak(currentPeak);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    onCleanup(() => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      void ctx.close();
    });
  });

  return { level, peak };
}
