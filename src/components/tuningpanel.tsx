import useFlexRadio from "~/context/flexradio";
import { createEffect, createSignal, For } from "solid-js";
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
  const { state, sendCommand, setState } = useFlexRadio();
  const [pan, setPan] = createStore(state.status.display.pan[streamId()]);
  const waterfallId = () => pan.waterfall;
  const [waterfall, setWaterfall] = createStore(
    state.status.display.waterfall[waterfallId()],
  );
  const [gradients] = createStore(state.palette.gradients);
  const [rawFrequency, setRawFrequency] = createSignal(pan.center);
  const [rawBandwidth, setRawBandwidth] = createSignal(pan.bandwidth);
  const [rawAverage, setRawAverage] = createSignal(pan.average);
  const [rawFps, setRawFps] = createSignal(pan.fps);
  const [rawLineDuration, setRawLineDuration] = createSignal(
    waterfall.line_duration,
  );
  const [rawColorGain, setRawColorGain] = createSignal(waterfall.color_gain);
  const [rawBlackLevel, setRawBlackLevel] = createSignal(waterfall.black_level);

  const updateAverage = debounce((value: number) => {
    sendCommand(`display pan s ${streamId()} average=${value}`)
      .then(() => {
        setPan("average", value);
      })
      .catch(() => setRawAverage(pan.average));
  }, 250);

  createEffect(() => {
    const average = rawAverage();
    if (average !== pan.average) {
      updateAverage(average);
    }
  });

  const updateFps = debounce((value: number) => {
    sendCommand(`display pan s ${streamId()} fps=${value}`)
      .then(() => {
        setPan("fps", value);
      })
      .catch(() => setRawFps(pan.fps));
  }, 250);

  createEffect(() => {
    const fps = rawFps();
    if (fps !== pan.fps) {
      updateFps(fps);
    }
  });

  const updateLineDuration = debounce((value: number) => {
    sendCommand(`display pan s ${pan.waterfall} line_duration=${value}`)
      .then(() => {
        setWaterfall("line_duration", value);
      })
      .catch(() => setRawLineDuration(waterfall.line_duration));
  }, 250);

  createEffect(() => {
    const lineDuration = rawLineDuration();
    if (lineDuration !== waterfall.line_duration) {
      updateLineDuration(lineDuration);
    }
  });

  const updateColorGain = debounce((value: number) => {
    sendCommand(`display pan s ${pan.waterfall} color_gain=${value}`).catch(
      () => setRawColorGain(waterfall.color_gain),
    );
  }, 250);

  createEffect(() => {
    const colorGain = rawColorGain();
    if (colorGain !== waterfall.color_gain) {
      setWaterfall("color_gain", colorGain);
      updateColorGain(colorGain);
    }
  });

  const updateBlackLevel = debounce((value: number) => {
    sendCommand(`display pan s ${pan.waterfall} black_level=${value}`).catch(
      () => setRawBlackLevel(waterfall.black_level),
    );
  }, 250);

  createEffect(() => {
    const auto_black = waterfall.auto_black;
    const black_level = waterfall.black_level;
    const blackLevel = rawBlackLevel();
    if (auto_black) {
      setRawBlackLevel(black_level);
    } else if (blackLevel !== black_level) {
      setWaterfall("black_level", blackLevel);
      updateBlackLevel(blackLevel);
    }
  });

  createEffect(() => setRawAverage(pan.average));
  createEffect(() => setRawFps(pan.fps));
  createEffect(() => setRawLineDuration(waterfall.line_duration));
  createEffect(() => setRawColorGain(waterfall.color_gain));

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
        value={gradients[waterfall.gradient_index].name}
        onChange={(value) => {
          if (!value) return;
          setWaterfall(
            "gradient_index",
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
        value={pan.rxant}
        onChange={(value) => {
          if (!value) return;
          sendCommand(`display pan s ${streamId()} rxant=${value}`).then(() =>
            setPan("rxant", value),
          );
        }}
        options={pan.ant_list}
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
          sendCommand(`display pan s ${streamId()} band=${value}`);
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
        rawValue={pan.center}
        step={pan.bandwidth / 10}
        largeStep={pan.bandwidth}
        onFocusOut={() => {
          const value = rawFrequency();
          if (value !== pan.center) {
            sendCommand(`display pan s ${streamId()} center=${value}`);
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
        rawValue={pan.bandwidth}
        step={pan.bandwidth / 2}
        largeStep={pan.bandwidth}
        minValue={pan.min_bw}
        maxValue={pan.max_bw}
        onFocusOut={() => {
          const value = rawBandwidth();
          if (value !== pan.bandwidth) {
            sendCommand(`display pan s ${streamId()} bandwidth=${value}`).then(
              () => setPan("bandwidth", value),
            );
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
        checked={pan.band_zoom}
        onChange={(isChecked) => {
          sendCommand(`display pan s ${streamId()} band_zoom=${isChecked}`);
        }}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Band Zoom</SwitchLabel>
      </Switch>
      <Switch
        class="flex items-center space-x-2"
        checked={pan.segment_zoom}
        onChange={(isChecked) => {
          sendCommand(`display pan s ${streamId()} segment_zoom=${isChecked}`);
        }}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Segment Zoom</SwitchLabel>
      </Switch>
      <Switch
        class="flex items-center space-x-2"
        checked={waterfall.auto_black}
        onChange={(isChecked) => {
          sendCommand(
            `display pan s ${pan.waterfall} auto_black=${isChecked ? 1 : 0}`,
          ).then(() => setWaterfall("auto_black", isChecked));
        }}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Auto Black Level</SwitchLabel>
      </Switch>
      <Switch
        class="flex items-center space-x-2"
        checked={pan.weighted_average}
        onChange={(isChecked) => {
          sendCommand(
            `display pan s ${streamId()} weighted_average=${isChecked ? 1 : 0}`,
          ).then(() => setPan("weighted_average", isChecked));
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
        value={[rawLineDuration()]}
        onChange={([value]) => setRawLineDuration(Math.round(value))}
        getValueLabel={(params) => params.values[0].toString()}
        class="space-y-3"
      >
        <div class="flex w-full justify-between">
          <SliderLabel>Waterfall Speed</SliderLabel>
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
