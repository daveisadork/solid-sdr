import useFlexRadio, { Meter } from "~/context/flexradio";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { createStore } from "solid-js/store";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "./ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "./ui/segmented-control";

import { SliderToggle } from "./ui/slider-toggle";
import { SimpleSwitch } from "./ui/simple-switch";
import { SimpleSlider } from "./ui/simple-slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

import * as MeterPrimitive from "@kobalte/core/meter";
import { ColorField, ColorFieldInput, ColorFieldLabel } from "./ui/color-field";
import { ColorSwatch } from "@kobalte/core/color-swatch";
import { parseColor } from "@kobalte/core/colors";

const BANDS: { id: string; label: string }[] = [
  { id: "160", label: "160m" },
  { id: "80", label: "80m" },
  { id: "60", label: "60m" },
  { id: "40", label: "40m" },
  { id: "30", label: "30m" },
  { id: "20", label: "20m" },
  { id: "17", label: "17m" },
  { id: "15", label: "15m" },
  { id: "12", label: "12m" },
  { id: "10", label: "10m" },
  { id: "6", label: "6m" },
  { id: "33", label: "WWV" },
  { id: "34", label: "GEN" },
  { id: "2200", label: "2200m" },
  { id: "630", label: "630m" },
];

function MeterElement(props: { meter: Meter }) {
  return (
    <MeterPrimitive.Root
      value={props.meter.value}
      minValue={props.meter.low}
      maxValue={props.meter.high}
      getValueLabel={({ value }) => `${value.toFixed(2)} ${props.meter.units}`}
      class="flex flex-col gap-0.5 w-full items-center"
    >
      <div class="flex font-mono text-xs w-full">
        <MeterPrimitive.Label>
          {props.meter.name} {props.meter.source} {props.meter.sourceIndex}
        </MeterPrimitive.Label>
        <div class="grow" />
        <MeterPrimitive.ValueLabel />
      </div>
      <MeterPrimitive.Track class="relative w-full h-2.5">
        <div
          class="absolute inset-0 border border-transparent rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-60% to-red-500 bg-origin-border"
          style={{
            mask: "linear-gradient(black 0 0) padding-box, linear-gradient(black 0 0)",
            "mask-composite": "exclude",
          }}
        />
        <MeterPrimitive.Fill
          class="absolute inset-0 rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-60% to-red-500"
          style={{
            "clip-path": "inset(0 calc(100% - var(--kb-meter-fill-width)) 0 0)",
            "will-change": "clip-path",
            transition: `clip-path ${1 / (props.meter.fps || 4)}s linear`,
          }}
        />
      </MeterPrimitive.Track>
      <div class="flex w-full justify-between text-xs text-muted-foreground">
        {props.meter.description}
      </div>
    </MeterPrimitive.Root>
  );
}

function createGradientStyle(
  stops: { color: string; offset: number }[],
  to: string = "top",
) {
  return `linear-gradient(to ${to}, ${stops
    .map(({ color, offset }) => `${color} ${offset * 100}%`)
    .join(", ")})`;
}

export function TuningPanel(props: { streamId: string }) {
  const streamId = () => props.streamId;
  const { radio, state, setState } = useFlexRadio();
  const [pan] = createStore(state.status.panadapter[streamId()]);
  const panController = () => radio()?.panadapter(streamId());
  const waterfallId = () => pan.waterfallStreamId;
  const wfController = () => radio()?.waterfall(waterfallId());
  const [waterfall] = createStore(state.status.waterfall[waterfallId()]);
  const [gradients] = createStore(state.palette.gradients);
  const [rawFrequency, setRawFrequency] = createSignal(
    panController().centerFrequencyMHz,
  );
  const [rawBandwidth, setRawBandwidth] = createSignal(
    panController().bandwidthMHz,
  );
  const [rawHighDbm, setRawHighDbm] = createSignal(panController().highDbm);
  const [rawLowDbm, setRawLowDbm] = createSignal(panController().lowDbm);

  createEffect(() => {
    if (!state.display.enableTransparencyEffects) {
      document.documentElement.classList.add("disable-transparency-effects");
    } else {
      document.documentElement.classList.remove("disable-transparency-effects");
    }
  });

  return (
    <div class="flex flex-col px-4 gap-4 size-full text-sm overflow-y-auto overflow-x-hidden select-none overscroll-y-contain">
      <Dialog>
        <DialogTrigger>Show Meters</DialogTrigger>
        <DialogContent class="size-full max-h-[90vh] overflow-y-hidden pr-3">
          <DialogHeader>
            <DialogTitle>Meters</DialogTitle>
          </DialogHeader>
          <div class="flex flex-col gap-4 overflow-y-auto pr-3">
            <For each={Object.values(state.status.meter)}>
              {(meter) => <MeterElement meter={meter} />}
            </For>
          </div>
        </DialogContent>
      </Dialog>
      <SimpleSwitch
        checked={state.display.enableTransparencyEffects}
        onChange={(isChecked) => {
          setState("display", "enableTransparencyEffects", isChecked);
        }}
        label="Blur Effects"
      />
      <SimpleSwitch
        checked={state.settings.showTuningGuide}
        onChange={(isChecked) => {
          setState("settings", "showTuningGuide", isChecked);
        }}
        label="Tuning Guide"
      />
      <SimpleSwitch
        checked={state.settings.showFps}
        onChange={(isChecked) => {
          setState("settings", "showFps", isChecked);
        }}
        label="Show FPS"
      />
      <SegmentedControl
        value={state.display.peakStyle}
        onChange={(value) => {
          console.log(value);
          if (!value) return;
          setState("display", "peakStyle", value as "none" | "points" | "line");
        }}
      >
        <SegmentedControlLabel>Peak Style</SegmentedControlLabel>
        <SegmentedControlGroup>
          <SegmentedControlIndicator />
          <SegmentedControlItemsList>
            <For each={["none", "points", "line"]}>
              {(style) => (
                <SegmentedControlItem value={style}>
                  <SegmentedControlItemLabel>{style}</SegmentedControlItemLabel>
                </SegmentedControlItem>
              )}
            </For>
          </SegmentedControlItemsList>
        </SegmentedControlGroup>
      </SegmentedControl>
      <SegmentedControl
        value={state.display.fillStyle}
        onChange={(value) => {
          console.log(value);
          if (!value) return;
          setState(
            "display",
            "fillStyle",
            value as "none" | "solid" | "gradient",
          );
        }}
      >
        <SegmentedControlLabel>Fill Style</SegmentedControlLabel>
        <SegmentedControlGroup>
          <SegmentedControlIndicator />
          <SegmentedControlItemsList>
            <For each={["none", "solid", "gradient"]}>
              {(style) => (
                <SegmentedControlItem value={style}>
                  <SegmentedControlItemLabel>{style}</SegmentedControlItemLabel>
                </SegmentedControlItem>
              )}
            </For>
          </SegmentedControlItemsList>
        </SegmentedControlGroup>
      </SegmentedControl>
      <Select
        class="flex flex-col gap-2 select-none"
        value={waterfall.gradientIndex}
        onChange={(value: number) => {
          if (value !== waterfall.gradientIndex)
            wfController().setGradientIndex(value);
        }}
        options={gradients.map((_, index) => index)}
        itemComponent={(props) => {
          const gradient = gradients.at(props.item.rawValue);
          return (
            <SelectItem item={props.item}>
              <div class="flex items-center gap-2">
                <div
                  class="h-6 w-6 rounded-sm"
                  style={{
                    "background-image": createGradientStyle(gradient.stops),
                  }}
                />
                <div>{gradient.name}</div>
              </div>
            </SelectItem>
          );
        }}
      >
        <SelectLabel>Waterfall Gradient</SelectLabel>
        <SelectTrigger>
          <SelectValue<number>>
            {(state) => gradients.at(state.selectedOption())?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <Select
        class="flex flex-col gap-2 select-none"
        value={pan.rxAntenna}
        onChange={(value: string) => {
          if (!value) return;
          if (value !== pan.rxAntenna) {
            panController()?.setRxAntenna(value);
          }
        }}
        options={Array.from(pan.rxAntennas)}
        itemComponent={(props) => (
          <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
        )}
      >
        <SelectLabel>RX Antenna</SelectLabel>
        <SelectTrigger>
          <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <Select
        class="flex flex-col gap-2 select-none"
        value={pan.band}
        onChange={(value: string) => {
          if (!value || value === pan.band) return;
          panController()?.setBand(value);
        }}
        options={BANDS.map((b) => b.id)}
        itemComponent={(props) => (
          <SelectItem item={props.item}>
            {BANDS.find((b) => b.id === props.item.rawValue)?.label}
          </SelectItem>
        )}
      >
        <SelectLabel>Band</SelectLabel>
        <SelectTrigger>
          <SelectValue<string>>
            {(state) =>
              BANDS.find((b) => b.id === state.selectedOption())?.label
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <NumberField
        class="flex flex-col gap-2 select-none"
        rawValue={pan.centerFrequencyMHz}
        step={pan.bandwidthMHz / 10}
        largeStep={pan.bandwidthMHz}
        onFocusOut={() => {
          const value = rawFrequency();
          if (value !== pan.centerFrequencyMHz) {
            panController()?.setCenterFrequency(value);
          }
        }}
        onRawValueChange={setRawFrequency}
      >
        <NumberFieldLabel class="select-none">Center Freq MHz</NumberFieldLabel>
        <NumberFieldGroup class="select-none">
          <NumberFieldInput />
          <NumberFieldIncrementTrigger class="select-none" />
          <NumberFieldDecrementTrigger class="select-none" />
        </NumberFieldGroup>
      </NumberField>
      <NumberField
        class="flex flex-col gap-2 select-none"
        rawValue={pan.bandwidthMHz}
        step={pan.bandwidthMHz / 2}
        largeStep={pan.bandwidthMHz}
        minValue={pan.minBandwidthMHz}
        maxValue={pan.maxBandwidthMHz}
        onFocusOut={() => {
          const value = rawBandwidth();
          if (value !== pan.bandwidthMHz) {
            panController()?.setBandwidth(value);
          }
        }}
        onRawValueChange={setRawBandwidth}
      >
        <NumberFieldLabel class="select-none">Bandwidth MHz</NumberFieldLabel>
        <NumberFieldGroup class="select-none">
          <NumberFieldInput />
          <NumberFieldIncrementTrigger class="select-none" />
          <NumberFieldDecrementTrigger class="select-none" />
        </NumberFieldGroup>
      </NumberField>
      <NumberField
        class="flex flex-col gap-2 select-none"
        rawValue={pan.highDbm}
        onFocusOut={() => {
          const high = rawHighDbm();
          if (high !== pan.highDbm) {
            panController()?.setDbmRange({ high, low: rawLowDbm() });
          }
        }}
        onRawValueChange={setRawHighDbm}
      >
        <NumberFieldLabel class="select-none">High dBm</NumberFieldLabel>
        <NumberFieldGroup class="select-none">
          <NumberFieldInput />
          <NumberFieldIncrementTrigger class="select-none" />
          <NumberFieldDecrementTrigger class="select-none" />
        </NumberFieldGroup>
      </NumberField>
      <NumberField
        class="flex flex-col gap-2 select-none"
        rawValue={pan.lowDbm}
        onFocusOut={() => {
          const low = rawLowDbm();
          if (low !== pan.lowDbm) {
            panController()?.setDbmRange({ high: rawHighDbm(), low });
          }
        }}
        onRawValueChange={setRawLowDbm}
      >
        <NumberFieldLabel class="select-none">Low dBm</NumberFieldLabel>
        <NumberFieldGroup class="select-none">
          <NumberFieldInput />
          <NumberFieldIncrementTrigger class="select-none" />
          <NumberFieldDecrementTrigger class="select-none" />
        </NumberFieldGroup>
      </NumberField>
      <SimpleSwitch
        checked={state.status.radio.showTxInWaterfall}
        onChange={(isChecked) => {
          radio()?.setShowTxInWaterfall(isChecked);
        }}
        label="Show TX in Waterfall"
      />
      <SimpleSwitch
        checked={pan.isBandZoomOn}
        onChange={(isChecked) => {
          panController()?.setBandZoom(isChecked);
        }}
        label="Band Zoom"
      />
      <SimpleSwitch
        checked={pan.isSegmentZoomOn}
        onChange={(isChecked) => {
          panController()?.setSegmentZoom(isChecked);
        }}
        label="Segment Zoom"
      />
      <SimpleSwitch
        checked={waterfall.autoBlackLevelEnabled}
        onChange={(isChecked) => {
          wfController()?.setAutoBlackLevelEnabled(isChecked);
        }}
        label="Auto Black Level"
      />
      <SimpleSwitch
        checked={pan.weightedAverage}
        onChange={(isChecked) => {
          panController()?.setWeightedAverage(isChecked);
        }}
        label="Weighted Average"
      />
      <SliderToggle
        label="Noise Floor"
        switchChecked={pan.noiseFloorPositionEnabled}
        onSwitchChange={(isChecked) => {
          panController()?.setNoiseFloorPositionEnabled(isChecked);
        }}
        minValue={0}
        maxValue={100}
        value={[100 - pan.noiseFloorPosition]}
        onChange={([value]) => {
          const position = 100 - value;
          if (position === pan.noiseFloorPosition) return;
          panController()?.setNoiseFloorPosition(position);
        }}
        getValueLabel={(params) => `${params.values[0]}%`}
      />

      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[pan.average]}
        onChange={([value]) => {
          if (value === pan.average) return;
          panController()?.setAverage(Math.floor(value));
        }}
        getValueLabel={(params) => params.values[0].toString()}
        label="Average"
      />
      <SimpleSlider
        minValue={1}
        maxValue={60}
        value={[pan.fps]}
        onChange={([value]) => {
          if (value === pan.fps) return;
          panController()?.setFps(value);
        }}
        getValueLabel={(params) => params.values[0].toString()}
        label="FPS"
      />
      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[100 - waterfall.lineSpeed]}
        onChange={([value]) => {
          const speed = 100 - value;
          if (speed === waterfall.lineSpeed) return;
          wfController()?.setLineSpeed(speed);
        }}
        getValueLabel={() => `${waterfall.lineDurationMs} ms`}
        label="Line Duration"
      />
      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[waterfall.colorGain]}
        onChange={([value]) => {
          if (value === waterfall.colorGain) return;
          wfController()?.setColorGain(Math.floor(value));
        }}
        getValueLabel={(params) => {
          const gain =
            20 * Math.log10(1 / Math.pow(1 - params.values[0] / 100, 3));
          return `${Math.round(gain * 10) / 10} dB`;
        }}
        label="Color Gain"
      />
      <SimpleSlider
        minValue={0}
        maxValue={100}
        disabled={waterfall.autoBlackLevelEnabled}
        value={[waterfall.blackLevel]}
        onChange={([value]) => {
          if (value === waterfall.blackLevel) return;
          wfController()?.setBlackLevel(Math.floor(value));
        }}
        getValueLabel={(params) => params.values[0].toString()}
        label="Black Level"
      />
      <ColorField
        class="flex flex-col gap-2 select-none"
        value={state.display.panBackgroundColor}
        onChange={(value) => setState("display", "panBackgroundColor", value)}
      >
        <ColorFieldLabel>Panadapter Background</ColorFieldLabel>
        <div class="relative">
          <ColorFieldInput />
          <ColorSwatch
            class="absolute top-2 right-2 rounded-sm w-6 h-6"
            value={parseColor(state.display.panBackgroundColor)}
          />
        </div>
      </ColorField>
      <pre class="block w-full overflow-x-auto overflow-y-visible shrink-0">
        {JSON.stringify(state.status.panadapter, null, 2)}
      </pre>
      <pre class="block w-full overflow-x-auto overflow-y-visible shrink-0">
        {JSON.stringify(state.status.waterfall, null, 2)}
      </pre>
    </div>
  );
}
