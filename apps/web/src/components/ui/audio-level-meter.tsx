import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { SimpleMeter } from "./simple-meter";
import type { DaxChannelMode } from "~/lib/dax-audio-sink/types";
import type { MeterState } from "~/context/flexradio";

const METER: MeterState = {
  id: "",
  low: -60,
  high: 0,
  fps: 20,
  units: "dBFS",
  name: "",
  source: "",
  sourceIndex: 0,
  description: "",
};

const PEAK_HOLD = 120;
const PEAK_DECAY = 0.2;

export function AudioLevelMeter(props: {
  label?: string | undefined;
  stream: MediaStream | undefined;
  channelMode: DaxChannelMode;
}) {
  const [level, setLevel] = createSignal(-Infinity);
  const [peak, setPeak] = createSignal(-Infinity);

  createEffect(() => {
    const stream = props.stream;
    if (!stream) {
      setLevel(-Infinity);
      setPeak(-Infinity);
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const buf = new Float32Array(analyser.fftSize);

    if (props.channelMode === "both") {
      source.connect(analyser);
    } else {
      const splitter = ctx.createChannelSplitter(2);
      source.connect(splitter);
      splitter.connect(analyser, props.channelMode === "left" ? 0 : 1);
    }

    let smoothedRms = 0;
    let currentPeak = -Infinity;
    let peakHoldFrames = 0;
    let rafId: number;

    const tick = () => {
      analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>);
      let sum = 0;
      let maxAbs = 0;
      for (const s of buf) {
        sum += s * s;
        const abs = Math.abs(s);
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

  return (
    <div
      classList={{
        "opacity-50": !props.stream,
      }}
    >
      <SimpleMeter
        label={props.label ?? "Level"}
        value={Math.max(level(), METER.low)}
        peakValue={Math.max(peak(), METER.low)}
        meter={METER}
        showTicks
        showTickLabels
        containTickLabels
        tickLabelFilter={({ index }) => index % 2 === 0}
      />
    </div>
  );
}
