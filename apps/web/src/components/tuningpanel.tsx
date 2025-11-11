import useFlexRadio from "~/context/flexradio";
import { createEffect, createSignal, For } from "solid-js";
import { createStore } from "solid-js/store";
import { lineSpeedToDurationMs } from "@repo/flexlib";
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
import { debounce } from "@solid-primitives/scheduled";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "./ui/segmented-control";

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
  const [pan] = createStore(state.status.display.pan[streamId()]);
  const panController = () => session()?.panadapter(streamId());
  const waterfallId = () => pan.waterfallStreamId;
  const wfController = () => session()?.waterfall(waterfallId());
  const [waterfall] = createStore(
    state.status.display.waterfall[waterfallId()],
  );
  const [gradients] = createStore(state.palette.gradients);
  const [rawFrequency, setRawFrequency] = createSignal(
    panController().centerFrequencyMHz,
  );
  const [rawBandwidth, setRawBandwidth] = createSignal(
    panController().bandwidthMHz,
  );
  const [rawAverage, setRawAverage] = createSignal(panController().average);
  const [rawFps, setRawFps] = createSignal(pan.fps);
  const [rawLineSpeed, setRawLineSpeed] = createSignal(
    wfController().lineSpeed ?? 0,
  );
  const [rawColorGain, setRawColorGain] = createSignal(
    wfController().colorGain,
  );
  const [rawBlackLevel, setRawBlackLevel] = createSignal(
    wfController().blackLevel,
  );

  const updateAverage = debounce((value: number) => {
    console.log("Setting Average to", value);
    const controller = panController();
    controller.setAverage(value).catch(() => setRawAverage(controller.average));
  }, 250);

  createEffect(() => {
    console.log("Average effect triggered");
    const average = rawAverage();
    if (average !== pan.average) {
      updateAverage(average);
    }
  });

  const updateFps = debounce((value: number) => {
    console.log("Setting FPS to", value);
    panController()
      ?.setFps(value)
      .catch(() => setRawFps(pan.fps));
  }, 250);

  createEffect(() => {
    const fps = rawFps();
    if (fps !== pan.fps) {
      updateFps(fps);
    }
  });

  const updateLineDuration = debounce((value: number) => {
    console.log("Setting Line Duration to", value);
    const wf = wfController();
    wf.setLineSpeed(value).catch(() => setRawLineSpeed(wf.lineSpeed ?? 0));
  }, 250);

  createEffect(() => {
    console.log("Line duration effect triggered");
    const lineDuration = rawLineSpeed();
    if (lineDuration !== waterfall.lineSpeed) {
      updateLineDuration(lineDuration);
    }
  });

  const updateColorGain = debounce((value: number) => {
    console.log("Setting Color Gain to", value);
    const controller = wfController();
    controller.setColorGain(value).catch(() => {
      setRawColorGain(controller.colorGain);
    });
  }, 250);

  createEffect(() => {
    console.log("Color gain effect triggered");
    const colorGain = rawColorGain();
    if (colorGain !== waterfall.colorGain) {
      updateColorGain(colorGain);
    }
  });

  const updateBlackLevel = debounce((value: number) => {
    console.log("Setting Black Level to", value);
    const wf = wfController();
    wf.setBlackLevel(value).catch(() => setRawBlackLevel(wf.blackLevel));
  }, 250);

  createEffect(() => {
    const auto_black = waterfall.autoBlackLevelEnabled;
    const black_level = waterfall.blackLevel;
    const blackLevel = rawBlackLevel();
    if (auto_black) {
      setRawBlackLevel(black_level);
    } else if (blackLevel !== black_level) {
      updateBlackLevel(blackLevel);
    }
  });

  createEffect(() => setRawAverage(pan.average));
  createEffect(() => setRawFps(pan.fps));
  createEffect(() => setRawLineSpeed(waterfall.lineSpeed ?? 0));
  createEffect(() => setRawColorGain(waterfall.colorGain));

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
        onChange={(value) => {
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
        onChange={(value) => {
          if (!value) return;
          if (value !== pan.rxAntenna) {
            panController()?.setRxAntenna(value);
          }
        }}
        options={pan.rxAntennas}
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
        onChange={(value) => {
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
        onChange={(value) => console.log("bandwidth changed:", value)}
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

      <Slider
        minValue={0}
        maxValue={100}
        value={[rawAverage()]}
        onChange={([value]) => setRawAverage(value)}
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
        value={[rawFps()]}
        onChange={([value]) => setRawFps(value)}
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
        minValue={1}
        maxValue={100}
        value={[rawLineSpeed()]}
        onChange={([value]) => setRawLineSpeed(Math.round(value))}
        getValueLabel={(params) =>
          `${lineSpeedToDurationMs(params.values[0])} ms`
        }
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
        value={[rawColorGain()]}
        onChange={([value]) => setRawColorGain(Math.round(value))}
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
        value={[rawBlackLevel()]}
        onChange={([value]) => setRawBlackLevel(Math.round(value))}
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
        {JSON.stringify(state.status.display.pan, null, 2)}
      </pre>
      <pre class="block w-full overflow-x-auto overflow-y-visible shrink-0">
        {JSON.stringify(state.status.display.waterfall, null, 2)}
      </pre>
    </div>
  );
}
