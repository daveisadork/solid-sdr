import type { MeterState } from "~/context/flexradio";
import type { DaxChannelMode } from "~/lib/dax-audio-sink/types";
import { createStreamLevel } from "~/lib/stream-level";
import { SimpleMeter } from "./simple-meter";

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

export function AudioLevelMeter(props: {
  label?: string | undefined;
  stream: MediaStream | undefined;
  channelMode: DaxChannelMode;
}) {
  const { level, peak } = createStreamLevel(
    () => props.stream,
    () => props.channelMode,
  );

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
