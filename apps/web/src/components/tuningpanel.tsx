import useFlexRadio from "~/context/flexradio";
import { createSignal, For } from "solid-js";
import { createStore } from "solid-js/store";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldDescription,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
} from "./ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "./ui/switch";
import {
  Slider,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from "./ui/slider";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "./ui/segmented-control";

import { SliderToggle } from "./slider-toggle";

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

export function TuningPanel(props: { streamId: string }) {
  const streamId = () => props.streamId;
  const { session, state, setState } = useFlexRadio();
  const [pan] = createStore(state.status.panadapter[streamId()]);
  const panController = () => session()?.panadapter(streamId());
  const waterfallId = () => pan.waterfallStreamId;
  const wfController = () => session()?.waterfall(waterfallId());
  const [waterfall] = createStore(state.status.waterfall[waterfallId()]);
  const [gradients] = createStore(state.palette.gradients);
  const [rawFrequency, setRawFrequency] = createSignal(
    panController().centerFrequencyMHz,
  );
  const [rawBandwidth, setRawBandwidth] = createSignal(
    panController().bandwidthMHz,
  );

  return (
    <div class="flex flex-col px-4 gap-4 size-full text-sm overflow-y-auto overflow-x-hidden select-none overscroll-y-contain">
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
        value={gradients[waterfall.gradientIndex].name}
        onChange={(value: string) => {
          if (!value) return;
          wfController().setGradientIndex(
            gradients.findIndex((item) => item.name === value),
          );
        }}
        options={gradients.map((g) => g.name)}
        itemComponent={(props) => {
          return (
            <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
          );
        }}
      >
        <SelectTrigger class="w-[180px]">
          <SelectValue<"none" | "points" | "line">>
            {(state) => state.selectedOption()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <Select
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
        <SelectTrigger class="w-[180px]">
          <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <Select
        value={pan.band}
        onChange={(value: string) => {
          if (!value || value === pan.band) return;
          panController()?.setBand(value);
          // setPan("band", value);
        }}
        options={BANDS.map((b) => b.id)}
        itemComponent={(props) => (
          <SelectItem item={props.item}>
            {BANDS.find((b) => b.id === props.item.rawValue)?.label}
          </SelectItem>
        )}
      >
        <SelectTrigger class="w-[180px]">
          <SelectValue<string>>
            {(state) =>
              BANDS.find((b) => b.id === state.selectedOption())?.label
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <NumberField
        class="flex w-36 flex-col gap-2 select-none"
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
        <NumberFieldGroup class="select-none">
          <NumberFieldInput />
          <NumberFieldIncrementTrigger class="select-none" />
          <NumberFieldDecrementTrigger class="select-none" />
        </NumberFieldGroup>
      </NumberField>
      <NumberField
        class="flex w-36 flex-col gap-2 select-none"
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
        <NumberFieldDescription class="select-none">
          Bandwidth
        </NumberFieldDescription>
        <NumberFieldGroup class="select-none">
          <NumberFieldInput />
          <NumberFieldIncrementTrigger class="select-none" />
          <NumberFieldDecrementTrigger class="select-none" />
        </NumberFieldGroup>
      </NumberField>
      <Switch
        class="flex items-center space-x-2"
        checked={pan.isBandZoomOn}
        onChange={(isChecked) => {
          panController()?.setBandZoom(isChecked);
        }}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Band Zoom</SwitchLabel>
      </Switch>
      <Switch
        class="flex items-center space-x-2"
        checked={pan.isSegmentZoomOn}
        onChange={(isChecked) => {
          panController()?.setSegmentZoom(isChecked);
        }}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Segment Zoom</SwitchLabel>
      </Switch>
      <Switch
        class="flex items-center space-x-2"
        checked={waterfall.autoBlackLevelEnabled}
        onChange={(isChecked) => {
          wfController()?.setAutoBlackLevelEnabled(isChecked);
        }}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Auto Black Level</SwitchLabel>
      </Switch>
      <Switch
        class="flex items-center space-x-2"
        checked={pan.weightedAverage}
        onChange={(isChecked) => {
          panController()?.setWeightedAverage(isChecked);
        }}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Weighted Average</SwitchLabel>
      </Switch>
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

      <Slider
        minValue={0}
        maxValue={100}
        value={[pan.average]}
        onChange={([value]) => {
          if (value === pan.average) return;
          panController()?.setAverage(Math.floor(value));
        }}
        getValueLabel={(params) => params.values[0].toString()}
        class="space-y-3"
      >
        <div class="flex w-full justify-between">
          <SliderLabel>Average</SliderLabel>
          <SliderValueLabel />
        </div>
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <Slider
        minValue={1}
        maxValue={60}
        value={[pan.fps]}
        onChange={([value]) => {
          if (value === pan.fps) return;
          panController()?.setFps(value);
        }}
        getValueLabel={(params) => params.values[0].toString()}
        class="space-y-3"
      >
        <div class="flex w-full justify-between">
          <SliderLabel>FPS</SliderLabel>
          <SliderValueLabel />
        </div>
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <Slider
        minValue={0}
        maxValue={100}
        value={[100 - waterfall.lineSpeed]}
        onChange={([value]) => {
          const speed = 100 - value;
          if (speed === waterfall.lineSpeed) return;
          wfController()?.setLineSpeed(100 - speed);
        }}
        getValueLabel={() => `${waterfall.lineDurationMs} ms`}
        class="space-y-3"
      >
        <div class="flex w-full justify-between">
          <SliderLabel>Line Duration</SliderLabel>
          <SliderValueLabel />
        </div>
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <Slider
        minValue={0}
        maxValue={100}
        value={[waterfall.colorGain]}
        onChange={([value]) => {
          if (value === waterfall.colorGain) return;
          wfController()?.setColorGain(Math.floor(value));
        }}
        getValueLabel={(params) => `${params.values[0] / 5} dB`}
        class="space-y-3"
      >
        <div class="flex w-full justify-between">
          <SliderLabel>Color Gain</SliderLabel>
          <SliderValueLabel />
        </div>
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <Slider
        minValue={0}
        maxValue={100}
        value={[waterfall.blackLevel]}
        onChange={([value]) => {
          if (value === waterfall.blackLevel) return;
          wfController()?.setBlackLevel(Math.floor(value));
        }}
        getValueLabel={(params) => params.values[0].toString()}
        class="space-y-3"
      >
        <div class="flex w-full justify-between">
          <SliderLabel>Black Level</SliderLabel>
          <SliderValueLabel />
        </div>
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <pre class="block w-full overflow-x-auto overflow-y-visible shrink-0">
        {JSON.stringify(state.status.panadapter, null, 2)}
      </pre>
      <pre class="block w-full overflow-x-auto overflow-y-visible shrink-0">
        {JSON.stringify(state.status.waterfall, null, 2)}
      </pre>
    </div>
  );
}
