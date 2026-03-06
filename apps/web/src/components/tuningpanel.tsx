import useFlexRadio, {
  Meter,
  Panadapter,
  Waterfall,
} from "~/context/flexradio";
import { createEffect, createSignal, For } from "solid-js";
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
import { usePanafall } from "~/context/panafall";
import { PanadapterController, WaterfallController } from "@repo/flexlib";
import { SimpleMeter } from "./ui/simple-meter";

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

export function TuningPanel(props: {
  panadapter: Panadapter;
  waterfall: Waterfall;
  panadapterController: PanadapterController;
  waterfallController: WaterfallController;
}) {
  const { radio, state, setState } = useFlexRadio();
  const [gradients] = createStore(state.palette.gradients);
  const [rawFrequency, setRawFrequency] = createSignal(
    props.panadapterController.centerFrequencyMHz,
  );
  const [rawBandwidth, setRawBandwidth] = createSignal(
    props.panadapterController.bandwidthMHz,
  );
  const [rawHighDbm, setRawHighDbm] = createSignal(
    props.panadapterController.highDbm,
  );
  const [rawLowDbm, setRawLowDbm] = createSignal(
    props.panadapterController.lowDbm,
  );
  const [rawPanBackgroundColor, setRawPanBackgroundColor] = createSignal(
    state.display.panBackgroundColor,
  );

  createEffect(() =>
    setRawPanBackgroundColor(state.display.panBackgroundColor),
  );

  createEffect(() => {
    const rawColor = rawPanBackgroundColor();
    if (rawColor === state.display.panBackgroundColor) return;
    try {
      const color = parseColor(rawColor);
      console.log(color.toString("css"));
      setState("display", "panBackgroundColor", rawColor);
    } catch (_e) {
      // Invalid color, ignore
    }
  });

  createEffect(() => {
    if (!state.display.enableTransparencyEffects) {
      document.documentElement.classList.add("disable-transparency-effects");
    } else {
      document.documentElement.classList.remove("disable-transparency-effects");
    }
  });

  return (
    <div
      class="flex flex-col px-4 gap-4 size-full text-sm overflow-y-auto overflow-x-hidden select-none overscroll-y-contain"
      style={{ "scrollbar-width": "thin" }}
    >
      <Dialog>
        <DialogTrigger>Show Meters</DialogTrigger>
        <DialogContent class="size-full max-h-[90vh] overflow-y-hidden pr-3">
          <DialogHeader>
            <DialogTitle>Meters</DialogTitle>
          </DialogHeader>
          <div class="flex flex-col gap-4 overflow-y-auto pr-3">
            <For each={Object.values(state.status.meter)}>
              {(meter) => (
                <SimpleMeter
                  meter={meter}
                  showDescription
                  showTicks
                  showTickLabels
                  containTickLabels
                  minStops={6}
                />
              )}
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
        checked={state.display.smoothScroll}
        onChange={(isChecked) => {
          setState("display", "smoothScroll", isChecked);
        }}
        label="Smooth Scroll"
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
      <SegmentedControl
        value={state.display.gradientStyle}
        onChange={(value) => {
          console.log(value);
          if (!value) return;
          setState("display", "gradientStyle", value as "color" | "classic");
        }}
      >
        <SegmentedControlLabel>Gradient Style</SegmentedControlLabel>
        <SegmentedControlGroup>
          <SegmentedControlIndicator />
          <SegmentedControlItemsList>
            <For each={["color", "classic"]}>
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
        value={props.waterfall.gradientIndex}
        onChange={(value: number) => {
          if (value !== props.waterfall.gradientIndex)
            props.waterfallController.setGradientIndex(value);
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
        value={props.panadapter.rxAntenna}
        onChange={(value: string) => {
          if (!value) return;
          if (value !== props.panadapter.rxAntenna) {
            props.panadapterController.setRxAntenna(value);
          }
        }}
        options={Array.from(props.panadapter.rxAntennas)}
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
        value={props.panadapter.band}
        onChange={(value: string) => {
          if (!value || value === props.panadapter.band) return;
          props.panadapterController.setBand(value);
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
        rawValue={props.panadapter.centerFrequencyMHz}
        step={props.panadapter.bandwidthMHz / 10}
        largeStep={props.panadapter.bandwidthMHz}
        onFocusOut={() => {
          const value = rawFrequency();
          if (value !== props.panadapter.centerFrequencyMHz) {
            props.panadapterController.setCenterFrequency(value);
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
        rawValue={props.panadapter.bandwidthMHz}
        step={props.panadapter.bandwidthMHz / 2}
        largeStep={props.panadapter.bandwidthMHz}
        minValue={props.panadapter.minBandwidthMHz}
        maxValue={props.panadapter.maxBandwidthMHz}
        onFocusOut={() => {
          const value = rawBandwidth();
          if (value !== props.panadapter.bandwidthMHz) {
            props.panadapterController.setBandwidth(value);
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
        rawValue={props.panadapter.highDbm}
        onFocusOut={() => {
          const high = rawHighDbm();
          if (high !== props.panadapter.highDbm) {
            props.panadapterController.setDbmRange({ high, low: rawLowDbm() });
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
        rawValue={props.panadapter.lowDbm}
        onFocusOut={() => {
          const low = rawLowDbm();
          if (low !== props.panadapter.lowDbm) {
            props.panadapterController.setDbmRange({ high: rawHighDbm(), low });
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
        checked={props.panadapter.isBandZoomOn}
        onChange={(isChecked) => {
          props.panadapterController.setBandZoom(isChecked);
        }}
        label="Band Zoom"
      />
      <SimpleSwitch
        checked={props.panadapter.isSegmentZoomOn}
        onChange={(isChecked) => {
          props.panadapterController.setSegmentZoom(isChecked);
        }}
        label="Segment Zoom"
      />
      <SimpleSwitch
        checked={props.waterfall.autoBlackLevelEnabled}
        onChange={(isChecked) => {
          props.waterfallController.setAutoBlackLevelEnabled(isChecked);
        }}
        label="Auto Black Level"
      />
      <SimpleSwitch
        checked={props.panadapter.weightedAverage}
        onChange={(isChecked) => {
          props.panadapterController.setWeightedAverage(isChecked);
        }}
        label="Weighted Average"
      />
      <SliderToggle
        label="Noise Floor"
        switchChecked={props.panadapter.noiseFloorPositionEnabled}
        onSwitchChange={(isChecked) => {
          props.panadapterController.setNoiseFloorPositionEnabled(isChecked);
        }}
        minValue={0}
        maxValue={100}
        value={[100 - props.panadapter.noiseFloorPosition]}
        onChange={([value]) => {
          const position = 100 - value;
          if (position === props.panadapter.noiseFloorPosition) return;
          props.panadapterController.setNoiseFloorPosition(position);
        }}
        getValueLabel={(params) => `${params.values[0]}%`}
      />

      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[props.panadapter.average]}
        onChange={([value]) => {
          if (value === props.panadapter.average) return;
          props.panadapterController.setAverage(Math.floor(value));
        }}
        getValueLabel={(params) => params.values[0].toString()}
        label="Average"
      />
      <SimpleSlider
        minValue={1}
        maxValue={60}
        value={[props.panadapter.fps]}
        onChange={([value]) => {
          if (value === props.panadapter.fps) return;
          props.panadapterController.setFps(value);
        }}
        getValueLabel={(params) => params.values[0].toString()}
        label="FPS"
      />
      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[100 - props.waterfall.lineSpeed]}
        onChange={([value]) => {
          const speed = 100 - value;
          if (speed === props.waterfall.lineSpeed) return;
          props.waterfallController.setLineSpeed(speed);
        }}
        getValueLabel={() => `${props.waterfall.lineDurationMs} ms`}
        label="Line Duration"
      />
      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[props.waterfall.colorGain]}
        onChange={([value]) => {
          if (value === props.waterfall.colorGain) return;
          props.waterfallController.setColorGain(Math.floor(value));
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
        disabled={props.waterfall.autoBlackLevelEnabled}
        value={[props.waterfall.blackLevel]}
        onChange={([value]) => {
          if (value === props.waterfall.blackLevel) return;
          props.waterfallController.setBlackLevel(Math.floor(value));
        }}
        getValueLabel={(params) => params.values[0].toString()}
        label="Black Level"
      />
      <ColorField
        class="flex flex-col gap-2 select-none"
        value={rawPanBackgroundColor()}
        onChange={setRawPanBackgroundColor}
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
