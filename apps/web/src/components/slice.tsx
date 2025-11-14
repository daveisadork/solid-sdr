import { createStore } from "solid-js/store";
import useFlexRadio, { Meter } from "~/context/flexradio";
import {
  createElementSize,
  createWindowSize,
} from "@solid-primitives/resize-observer";
import {
  batch,
  createEffect,
  createSignal,
  For,
  Show,
  splitProps,
} from "solid-js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

import { Meter as MeterElement } from "@kobalte/core/meter";

import type { Component, ComponentProps, JSX } from "solid-js";
import { createPointerListeners } from "@solid-primitives/pointer";
import { createElementBounds } from "@solid-primitives/bounds";
import BaselineChevronLeft from "~icons/ic/baseline-chevron-left";
import BaselineChevronRight from "~icons/ic/baseline-chevron-right";
import BaselineVolumeUp from "~icons/ic/baseline-volume-up";
import BaselineVolumeOff from "~icons/ic/baseline-volume-off";
import { Button } from "./ui/button";
import { Portal } from "solid-js/web";
import { Select, SelectContent, SelectItem, SelectValue } from "./ui/select";

import {
  Slider,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from "./ui/slider";

import { Trigger as SelectTrigger } from "@kobalte/core/select";
import { ToggleButton } from "@kobalte/core";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "./ui/switch";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "./ui/segmented-control";
import { cn } from "~/lib/utils";
import { FrequencyInput } from "./frequency-input";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

const StatusToggle: Component<ComponentProps<"span"> & { active?: boolean }> = (
  props,
) => {
  const [local, others] = splitProps(props, ["classList", "active"]);
  return (
    <span
      classList={{
        "text-blue-500": local.active,
        "text-neutral-500": !local.active,
        ...local.classList,
      }}
      {...others}
    />
  );
};

const Triangle: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class", "style"]);
  return (
    <div
      class={cn("h-1.5 aspect-[2]", local.class)}
      style={{
        "clip-path": "polygon(50% 100%,100% 0,0 0)",
        ...(local.style as JSX.CSSProperties),
      }}
      {...others}
    />
  );
};

type SliderToggleProps = ComponentProps<typeof Slider> & {
  label: JSX.Element | string;
  tooltip?: JSX.Element | string;
  switchChecked: boolean;
  onSwitchChange: (checked: boolean) => void;
  switchClass?: string;
  switchContainerClass?: string;
  switchDisabled?: boolean;
};

const SliderToggle: Component<SliderToggleProps> = (props) => {
  const [local, sliderProps] = splitProps(props, [
    "class",
    "label",
    "switchChecked",
    "onSwitchChange",
    "switchClass",
    "switchContainerClass",
    "switchDisabled",
    "tooltip",
  ]);

  return (
    <Slider class={cn("space-y-2", local.class)} {...sliderProps}>
      <Tooltip placement="top">
        <TooltipTrigger as="div" class="flex w-full justify-between">
          <SliderLabel>{local.label}</SliderLabel>
          <SliderValueLabel />
        </TooltipTrigger>
        <Show when={local.tooltip}>
          <TooltipContent>{local.tooltip}</TooltipContent>
        </Show>
      </Tooltip>
      <div
        class={cn(
          "flex w-full items-center justify-between space-x-2",
          local.switchContainerClass,
        )}
      >
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
        <Switch
          class={cn(
            "h-auto flex items-center origin-right scale-75",
            local.switchClass,
          )}
          checked={local.switchChecked}
          disabled={local.switchDisabled}
          onChange={local.onSwitchChange}
        >
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      </div>
    </Slider>
  );
};

const LevelMeter = (props: { sliceIndex?: string }) => {
  const { state } = useFlexRadio();
  const [meterId, setMeterId] = createSignal<string>();

  createEffect(() => {
    const sliceIndex = Number(props.sliceIndex);
    if (state.status.slice[meterId()!]) {
      return;
    }
    for (const meterId in state.status.meter) {
      const meter: Meter = state.status.meter[meterId];
      if (
        meter.source === "SLC" &&
        meter.sourceIndex === sliceIndex &&
        meter.name === "LEVEL"
      ) {
        setMeterId(meterId);
        return;
      }
    }
    setMeterId(undefined);
  });

  return (
    <Show when={meterId()} keyed>
      {(id) => {
        const meter = state.status.meter[id];
        return (
          <MeterElement
            value={meter.value}
            minValue={-127}
            maxValue={-33}
            getValueLabel={() => {
              // This meter is in dBm. S9 is -73 dBm, and each S unit is 6 dB.
              // We start by adding 73 so S9 is 0. That way the rest of the math
              // is a little easier, we can divide by 6 and add 9 to get the S unit.
              // Anything above S9 is S9 + the number of dB over S9.
              const adjustedValue = Math.round((meter.value ?? meter.low) + 73);
              const label =
                adjustedValue > 0
                  ? `S9+${adjustedValue}`
                  : `S${Math.max(Math.floor(adjustedValue / 6) + 9, 0)}`;
              return label.padEnd(5, " ");
            }}
            class="flex w-full items-center"
          >
            <MeterElement.Track
              class="grow w-full h-2 rounded-sm overflow-visible flex items-center"
              style={{
                background: `linear-gradient(to right, #3b82f6, #34d399, #fbbf24, #f87171, #f87171, #f87171)`,
              }}
            >
              <MeterElement.Fill
                class="h-full w-[var(--kb-meter-fill-width)] bg-transparent"
                style={{
                  "transition-duration": `${1 / (meter.fps || 4)}s`,
                }}
              />
              <div class="shrink grow bg-background h-full" />
            </MeterElement.Track>
            <MeterElement.ValueLabel class="font-mono text-xs whitespace-pre" />
          </MeterElement>
        );
      }}
    </Show>
  );
};

export function DetachedSlice(props: { sliceIndex: string }) {
  const sliceIndex = () => props.sliceIndex;
  const { session, state } = useFlexRadio();
  const slice = () => state.status.slice[props.sliceIndex];
  const pan = () => state.status.panadapter[slice()?.panadapterStreamId];

  return (
    <Button
      variant="ghost"
      size="sm"
      class="font-black text-md font-mono z-10 pointer-events-auto text-shadow-md text-shadow-black"
      onClick={() => {
        session()
          ?.panadapter(slice().panadapterStreamId)
          ?.setCenterFrequency(slice().frequencyMHz);
        session()?.slice(sliceIndex())?.setActive(true);
      }}
    >
      <Show when={slice().frequencyMHz < pan().centerFrequencyMHz}>
        <BaselineChevronLeft />
      </Show>
      <span>{slice().indexLetter}</span>
      <Show when={slice().frequencyMHz > pan().centerFrequencyMHz}>
        <BaselineChevronRight />
      </Show>
    </Button>
  );
}

export function DetachedSlices(props: { streamId: string }) {
  const { state } = useFlexRadio();
  const pan = () => state.status.panadapter[props.streamId];

  return (
    <div class="flex absolute top-10 left-0 bottom-0 right-0 pointer-events-none">
      <div class="flex flex-col">
        <For
          each={Object.keys(state.status.slice).filter((sliceIndex) => {
            const slice = state.status.slice[sliceIndex];
            return (
              slice.panadapterStreamId === props.streamId &&
              slice.isInUse &&
              slice.isDetached &&
              slice.frequencyMHz < pan().centerFrequencyMHz
            );
          })}
        >
          {(sliceIndex) => <DetachedSlice sliceIndex={sliceIndex} />}
        </For>
      </div>
      <div class="grow" />
      <div class="flex flex-col">
        <For
          each={Object.keys(state.status.slice).filter((sliceIndex) => {
            const slice = state.status.slice[sliceIndex];
            return (
              slice.panadapterStreamId === props.streamId &&
              slice.isInUse &&
              slice.isDetached &&
              slice.frequencyMHz > pan().centerFrequencyMHz
            );
          })}
        >
          {(sliceIndex) => <DetachedSlice sliceIndex={sliceIndex} />}
        </For>
      </div>
    </div>
  );
}

export function Slice(props: { sliceIndex: string }) {
  const sliceIndex = () => props.sliceIndex;
  const { session, state } = useFlexRadio();
  const [slice, setSlice] = createStore(state.status.slice[sliceIndex()]);
  const sliceController = () => session()?.slice(sliceIndex());
  const streamId = () => slice.panadapterStreamId;
  const [pan] = createStore(state.status.panadapter[streamId()]);
  const [offset, setOffset] = createSignal(0);
  const [ref, setRef] = createSignal<HTMLDivElement>();
  const [sentinel, setSentinel] = createSignal<HTMLDivElement>();
  const [wrapper, setWrapper] = createSignal<HTMLElement>();
  const [flag, setFlag] = createSignal<HTMLElement>();
  const [filterWidth, setFilterWidth] = createSignal(0);
  const [filterOffset, setFilterOffset] = createSignal(0);
  const [filterText, setFilterText] = createSignal("");
  const [flagSide, setFlagSide] = createSignal<"left" | "right">("left");
  const [dragState, setDragState] = createStore({
    dragging: false,
    originX: 0,
    originFreq: 0,
    offset: 0,
  });
  const windowSize = createWindowSize();
  const wrapperSize = createElementSize(wrapper);
  const sentinelBounds = createElementBounds(sentinel);
  const flagBounds = createElementBounds(flag);

  createEffect(() => {
    if (slice.diversityParent) {
      return setFlagSide("left");
    }
    if (slice.diversityChild) {
      return setFlagSide("right");
    }
    if (flagBounds.left! < 0) {
      setFlagSide("right");
    } else if (flagBounds.right! > wrapperSize.width!) {
      setFlagSide("left");
    }
  });

  createPointerListeners({
    async onMove(event) {
      if (!dragState.dragging) return;
      const newX = Math.max(0, Math.min(event.x, pan.width - 1));
      const newOffset = dragState.originX - newX;

      const mhzPerPx = pan.bandwidthMHz / pan.width;
      // Round frequency to the nearest step
      const step = slice.tuneStepHz / 1e6; // Convert Hz to MHz
      const freqUnrounded = dragState.originFreq - newOffset * mhzPerPx;
      const freqSteps = Math.round(freqUnrounded / step);
      const freq = freqSteps * step;

      if (freq === slice.frequencyMHz) {
        return;
      }

      await sliceController()?.setFrequency(freq);
    },
    onUp() {
      setDragState("dragging", false);
    },
    onLeave() {
      setDragState("dragging", false);
    },
  });

  createEffect((center) => {
    if (pan.centerFrequencyMHz !== center) {
      setDragState("dragging", false);
    }
    return pan.centerFrequencyMHz;
  });

  createEffect(() => {
    const parent = ref()?.parentElement;
    if (!parent) return;
    setWrapper(parent);
  });

  createEffect(() => {
    const { width } = windowSize;
    if (!width) return;
    const leftFreq = pan.centerFrequencyMHz - pan.bandwidthMHz / 2;
    const offsetMhz = slice.frequencyMHz - leftFreq;
    const offsetPixels = (offsetMhz / pan.bandwidthMHz) * width;
    const filterWidthMhz = (slice.filterHighHz - slice.filterLowHz) / 1e6; // Convert Hz to MHz
    batch(() => {
      setFilterWidth((filterWidthMhz / pan.bandwidthMHz) * width);
      setFilterOffset((slice.filterLowHz / 1e6 / pan.bandwidthMHz) * width);
      setFilterText(`${(slice.filterHighHz - slice.filterLowHz) / 1e3}K`);
      // panadapter display is off by 2 pixels, so adjust
      setOffset(offsetPixels - 2);
    });
  });

  const tuneSlice = async (hz: number) => {
    if (!Number.isFinite(hz)) {
      return;
    }
    const freqMhz = hz / 1e6;
    if (Math.abs(freqMhz - slice.frequencyMHz) < 1e-9) {
      return;
    }
    try {
      await sliceController()?.setFrequency(freqMhz);
    } catch {
      // Ignore errors; the UI will reflect the previous baseline frequency.
    }
  };

  const makeActive = async () => {
    if (slice.isActive) return;
    sliceController()?.setActive(true);
  };

  createEffect(() => {
    const detached =
      sentinelBounds.left! < 0 || sentinelBounds.right! > wrapperSize.width!;
    if (detached === slice.isDetached) return;
    setSlice("isDetached", detached);
  });

  return (
    <>
      <Show when={!slice.isDetached}>
        <div
          class="absolute h-full left-[var(--slice-offset)] translate-x-[var(--drag-offset)] cursor-ew-resize"
          classList={{
            "z-0": !slice.isActive,
            "z-10": slice.isActive,
          }}
          style={{
            "--slice-offset": `${offset()}px`,
          }}
          onMouseDown={(event) => {
            setDragState({
              dragging: true,
              originX: event.clientX,
              originFreq: slice.frequencyMHz,
              offset: 0,
            });
            makeActive();
          }}
          onClick={makeActive}
          ref={setRef}
        >
          <div
            class="absolute h-full translate-x-[var(--filter-offset)] w-[var(--filter-width)] "
            classList={{
              "backdrop-brightness-125 backdrop-contrast-75":
                !slice.diversityChild,
            }}
            style={{
              "--filter-width": `${filterWidth()}px`,
              "--filter-offset": `${filterOffset()}px`,
            }}
          />
          <div
            class="absolute h-full max-w-px w-px flex flex-col items-center m-auto top-0 -translate-x-1/2 transform-3d"
            classList={{
              "bg-yellow-300": slice.isActive,
              "bg-red-500": !slice.isActive,
            }}
          >
            <Show when={slice.isActive}>
              <Triangle
                class="relative top-0"
                classList={{
                  "bg-red-500": slice.diversityChild,
                  "bg-yellow-300": !slice.diversityChild,
                }}
              />
              <Show when={slice.diversityEnabled}>
                <Triangle
                  class="relative -translate-y-1/2"
                  classList={{
                    "bg-red-500 -translate-z-1": slice.diversityParent,
                    "bg-yellow-300 translate-z-1": slice.diversityChild,
                  }}
                />
              </Show>
            </Show>
          </div>
          <Portal>
            <div
              class="absolute top-0 left-[var(--flag-offset)] pt-1.5 pl-1 pr-1 z-20"
              classList={{
                "-translate-x-full": flagSide() === "left",
              }}
              style={{
                "--flag-offset": `${sentinelBounds.left! + 0.5}px`,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              ref={setFlag}
            >
              <div
                class="border border-gray-500 rounded-md flex flex-col p-2 pointer-events-auto text-sm font-mono bg-background drop-shadow-black"
                classList={{
                  "drop-shadow-lg": slice.isActive,
                  "drop-shadow-md": !slice.isActive,
                }}
              >
                <div
                  class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-md"
                  classList={{
                    "backdrop-brightness-75 backdrop-grayscale-25":
                      !slice.isActive,
                  }}
                />
                <div class="flex justify-between items-center space-x-2">
                  <Select
                    value={slice.rxAntenna}
                    options={Array.from(slice.availableRxAntennas)}
                    onChange={(v) => {
                      if (!v || v === slice.rxAntenna) return;
                      sliceController().setRxAntenna(v);
                    }}
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {props.item.rawValue}
                      </SelectItem>
                    )}
                  >
                    <SelectTrigger
                      aria-label="RX Antenna"
                      class="text-blue-500 font-medium"
                    >
                      <SelectValue<string>>
                        {(state) => state.selectedOption()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  <Select
                    value={slice.txAntenna}
                    options={Array.from(slice.availableTxAntennas)}
                    onChange={(v) => {
                      if (!v || v === slice.txAntenna) return;
                      sliceController().setTxAntenna(v);
                    }}
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {props.item.rawValue}
                      </SelectItem>
                    )}
                  >
                    <SelectTrigger
                      aria-label="TX Antenna"
                      class="text-red-500 font-medium"
                    >
                      <SelectValue<string>>
                        {(state) => state.selectedOption()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  <span class="grow text-xs text-center">{filterText()}</span>
                  <ToggleButton.Root
                    class="text-center font-bold pl-1 pr-1 rounded-sm"
                    classList={{
                      "bg-red-500": slice.isTransmitEnabled,
                      "opacity-50": !slice.isTransmitEnabled,
                    }}
                    pressed={slice.isTransmitEnabled}
                    onChange={(pressed) => {
                      sliceController().enableTransmit(pressed);
                    }}
                  >
                    TX
                  </ToggleButton.Root>
                  <span class="text-center font-bold bg-blue-500 pl-1 pr-1 rounded-sm">
                    <Popover>
                      <PopoverTrigger>{slice.indexLetter}</PopoverTrigger>
                      <PopoverContent class="flex flex-col overflow-hidden w-96 max-h-[var(--kb-popper-content-available-height)]">
                        <pre class="size-full overflow-auto text-sm">
                          {JSON.stringify(slice, null, 2)}
                        </pre>
                      </PopoverContent>
                    </Popover>
                  </span>
                </div>
                <Show when={!slice.diversityChild}>
                  <div class="flex justify-between items-center space-x-2">
                    <span>{slice.mode}</span>
                    <FrequencyInput
                      class="text-right bg-transparent text-lg font-mono"
                      size={14}
                      valueHz={Math.round(slice.frequencyMHz * 1e6)}
                      onCommit={tuneSlice}
                    />
                  </div>
                </Show>
                <div>
                  <LevelMeter sliceIndex={props.sliceIndex} />
                </div>
                <div class="flex items-center text-xs font-bold justify-between *:basis-64 *:flex *:flex-col *:items-center">
                  <Popover>
                    <PopoverTrigger
                      onContextMenu={(e) => {
                        e.preventDefault();
                        sliceController().setMute(!slice.isMuted);
                      }}
                    >
                      <Show
                        when={slice.isMuted}
                        fallback={<BaselineVolumeUp />}
                      >
                        <BaselineVolumeOff />
                      </Show>
                    </PopoverTrigger>
                    <PopoverContent
                      class="space-y-6 shadow-black shadow-lg"
                      classList={{
                        "bg-background/50 backdrop-blur-xl":
                          state.display.enableTransparencyEffects,
                      }}
                    >
                      <Switch
                        class="flex items-center space-x-2 justify-between"
                        checked={slice.isMuted}
                        onChange={(isChecked) => {
                          sliceController().setMute(isChecked);
                        }}
                      >
                        <SwitchLabel>Audio Mute</SwitchLabel>
                        <SwitchControl>
                          <SwitchThumb />
                        </SwitchControl>
                      </Switch>
                      <Slider
                        minValue={0}
                        maxValue={100}
                        value={[slice.audioGain]}
                        onChange={([value]) => {
                          sliceController().setAudioGain(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        class="space-y-3"
                      >
                        <div class="flex w-full justify-between">
                          <SliderLabel>Audio Level</SliderLabel>
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
                        value={[slice.audioPan]}
                        onChange={([value]) => {
                          sliceController().setAudioPan(value);
                        }}
                        getValueLabel={(params) => {
                          const value = params.values[0] - 50;
                          if (value === 0) return "Center";
                          return value < 0 ? `L${-value}` : `R${value}`;
                        }}
                        class="space-y-3"
                      >
                        <div class="flex w-full justify-between">
                          <SliderLabel>Audio Pan</SliderLabel>
                          <SliderValueLabel />
                        </div>
                        <SliderTrack>
                          <SliderFill
                            style={{
                              right:
                                slice.audioPan > 50
                                  ? `${100 - slice.audioPan}%`
                                  : "50%",
                              left:
                                slice.audioPan <= 50
                                  ? `${slice.audioPan}%`
                                  : "50%",
                            }}
                          />
                          <SliderThumb />
                        </SliderTrack>
                      </Slider>
                      <SegmentedControl
                        value={slice.agcMode}
                        onChange={(value) => {
                          sliceController().setAgcMode(value);
                        }}
                      >
                        <SegmentedControlLabel>AGC Mode</SegmentedControlLabel>
                        <SegmentedControlGroup>
                          <SegmentedControlIndicator />
                          <SegmentedControlItemsList class="bg-muted/50">
                            <For
                              each={[
                                { label: "Off", value: "off" },
                                { label: "Slow", value: "slow" },
                                { label: "Med", value: "med" },
                                { label: "Fast", value: "fast" },
                              ]}
                            >
                              {({ label, value }) => (
                                <SegmentedControlItem value={value}>
                                  <SegmentedControlItemLabel>
                                    {label}
                                  </SegmentedControlItemLabel>
                                </SegmentedControlItem>
                              )}
                            </For>
                          </SegmentedControlItemsList>
                        </SegmentedControlGroup>
                      </SegmentedControl>
                      <Slider
                        disabled={slice.agcMode === "off"}
                        minValue={0}
                        maxValue={100}
                        value={[slice.agcThreshold]}
                        onChange={([threshold]) => {
                          sliceController().setAgcSettings({ threshold });
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        class="space-y-3"
                      >
                        <div class="flex w-full justify-between">
                          <SliderLabel>AGC Threshold</SliderLabel>
                          <SliderValueLabel />
                        </div>
                        <SliderTrack>
                          <SliderFill />
                          <SliderThumb />
                        </SliderTrack>
                      </Slider>

                      <Switch
                        class="flex items-center space-x-2 justify-between"
                        checked={slice.diversityEnabled}
                        disabled={slice.diversityChild}
                        onChange={(isChecked) => {
                          sliceController().setDiversityEnabled(isChecked);
                        }}
                      >
                        <SwitchLabel>Diversity Reception</SwitchLabel>
                        <SwitchControl>
                          <SwitchThumb />
                        </SwitchControl>
                      </Switch>
                      <Show when={slice.diversityParent}>
                        <Switch
                          class="flex items-center space-x-2 justify-between"
                          checked={slice.escEnabled}
                          disabled={slice.diversityChild}
                          onChange={(isChecked) => {
                            sliceController().setEscEnabled(isChecked);
                          }}
                        >
                          <SwitchLabel>
                            Enhanced Signal Clarity (ESC)
                          </SwitchLabel>
                          <SwitchControl>
                            <SwitchThumb />
                          </SwitchControl>
                        </Switch>
                        <Slider
                          disabled={!slice.escEnabled}
                          value={[slice.escGain]}
                          minValue={0.01}
                          maxValue={2.0}
                          step={0.01}
                          onChange={([value]) => {
                            console.log(value);
                            sliceController()
                              .setEscGain(value)
                              .catch(console.log);
                          }}
                          getValueLabel={(params) => `${params.values[0]}`}
                          class="space-y-3"
                        >
                          <div class="flex w-full justify-between">
                            <SliderLabel>ESC Gain</SliderLabel>
                            <SliderValueLabel />
                          </div>
                          <SliderTrack>
                            <SliderFill />
                            <SliderThumb />
                          </SliderTrack>
                        </Slider>
                        <Slider
                          disabled={!slice.escEnabled}
                          minValue={0}
                          maxValue={360}
                          value={[
                            Math.round(slice.escPhaseShift * (Math.PI / 180)),
                          ]}
                          onChange={([value]) => {
                            const radians = value * (180 / Math.PI);
                            if (radians === slice.escPhaseShift) return;
                            sliceController()
                              .setEscPhaseShift(radians)
                              .catch(console.log);
                          }}
                          getValueLabel={(params) => `${params.values[0]}°`}
                          class="space-y-3"
                        >
                          <div class="flex w-full justify-between">
                            <SliderLabel>ESC Phase Shift</SliderLabel>
                            <SliderValueLabel />
                          </div>
                          <SliderTrack>
                            <SliderFill />
                            <SliderThumb />
                          </SliderTrack>
                        </Slider>
                      </Show>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger>DSP</PopoverTrigger>
                    <PopoverContent
                      class="space-y-6 shadow-black shadow-lg"
                      classList={{
                        "bg-background/50 backdrop-blur-xl":
                          state.display.enableTransparencyEffects,
                      }}
                    >
                      <SliderToggle
                        disabled={!slice.wnbEnabled}
                        minValue={0}
                        maxValue={100}
                        value={[slice.wnbLevel]}
                        onChange={([value]) => {
                          sliceController().setWnbLevel(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        label="Wideband Noise Blanker (WNB)"
                        switchChecked={slice.wnbEnabled}
                        onSwitchChange={(isChecked) => {
                          sliceController().setWnbEnabled(isChecked);
                        }}
                      />
                      <SliderToggle
                        disabled={!slice.nbEnabled}
                        minValue={0}
                        maxValue={100}
                        value={[slice.nbLevel]}
                        onChange={([value]) => {
                          sliceController().setNbLevel(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        label="Noise Blanker (NB)"
                        switchChecked={slice.nbEnabled}
                        onSwitchChange={(isChecked) => {
                          sliceController().setNbEnabled(isChecked);
                        }}
                      />
                      <SliderToggle
                        disabled={!slice.nrEnabled}
                        minValue={0}
                        maxValue={100}
                        value={[slice.nrLevel]}
                        onChange={([value]) => {
                          sliceController().setNrLevel(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        label="Noise Reduction (NR)"
                        switchChecked={slice.nrEnabled}
                        onSwitchChange={(isChecked) => {
                          sliceController().setNrEnabled(isChecked);
                        }}
                      />
                      <Switch
                        class="flex items-center space-x-2 justify-between"
                        checked={slice.nrsEnabled}
                        onChange={(isChecked) => {
                          sliceController().setNrsEnabled(isChecked);
                        }}
                      >
                        <SwitchLabel>Spectral Subtraction (NRS)</SwitchLabel>
                        <SwitchControl>
                          <SwitchThumb />
                        </SwitchControl>
                      </Switch>
                      <Switch
                        class="flex items-center space-x-2 justify-between"
                        checked={slice.nrfEnabled}
                        onChange={(isChecked) => {
                          sliceController().setNrfEnabled(isChecked);
                        }}
                      >
                        <SwitchLabel>Noise Reduction Filter (NRF)</SwitchLabel>
                        <SwitchControl>
                          <SwitchThumb />
                        </SwitchControl>
                      </Switch>
                      <Switch
                        class="flex items-center space-x-2 justify-between"
                        checked={slice.rnnEnabled}
                        onChange={(isChecked) => {
                          sliceController().setRnnEnabled(isChecked);
                        }}
                      >
                        <SwitchLabel>AI Noise Reduction (RNN)</SwitchLabel>
                        <SwitchControl>
                          <SwitchThumb />
                        </SwitchControl>
                      </Switch>
                      <SliderToggle
                        disabled={!slice.anfEnabled}
                        minValue={0}
                        maxValue={100}
                        value={[slice.anfLevel]}
                        onChange={([value]) => {
                          sliceController().setAnfLevel(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        label="Automatic Notch Filter (ANF)"
                        switchChecked={slice.anfEnabled}
                        onSwitchChange={(isChecked) => {
                          sliceController().setAnfEnabled(isChecked);
                        }}
                      />
                      <Switch
                        class="flex items-center space-x-2 justify-between"
                        checked={slice.anftEnabled}
                        onChange={(isChecked) => {
                          sliceController().setAnftEnabled(isChecked);
                        }}
                      >
                        <SwitchLabel>FFT Auto Notch Filter (ANFT)</SwitchLabel>
                        <SwitchControl>
                          <SwitchThumb />
                        </SwitchControl>
                      </Switch>
                      <SliderToggle
                        disabled={!slice.apfEnabled}
                        minValue={0}
                        maxValue={100}
                        value={[slice.apfLevel]}
                        onChange={([value]) => {
                          sliceController().setApfLevel(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        label="Automatic Peaking Filter (APF)"
                        switchChecked={slice.apfEnabled}
                        onSwitchChange={(isChecked) => {
                          sliceController().setApfEnabled(isChecked);
                        }}
                      />
                      <SliderToggle
                        disabled={!slice.nrlEnabled}
                        minValue={0}
                        maxValue={100}
                        value={[slice.nrlLevel]}
                        onChange={([value]) => {
                          sliceController().setNrlLevel(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        label="Legacy Noise Reduction (NRL)"
                        switchChecked={slice.nrlEnabled}
                        onSwitchChange={(isChecked) => {
                          sliceController().setNrlEnabled(isChecked);
                        }}
                      />
                      <SliderToggle
                        disabled={!slice.anflEnabled}
                        minValue={0}
                        maxValue={100}
                        value={[slice.anfLevel]}
                        onChange={([value]) => {
                          sliceController().setAnflLevel(value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        label="Legacy Auto Notch Filter (ANFL)"
                        switchChecked={slice.anflEnabled}
                        onSwitchChange={(isChecked) => {
                          sliceController().setAnflEnabled(isChecked);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger disabled={slice.diversityChild}>
                      {slice.mode}
                    </PopoverTrigger>
                    <PopoverContent
                      class="space-y-6 shadow-black shadow-lg"
                      classList={{
                        "bg-background/50 backdrop-blur-xl":
                          state.display.enableTransparencyEffects,
                      }}
                    >
                      <ToggleGroup
                        value={slice.mode}
                        onChange={(mode) => {
                          if (!mode || mode === slice.mode) return;
                          sliceController().setMode(mode);
                        }}
                        class="grid grid-cols-4"
                      >
                        <For each={slice.modeList}>
                          {(mode) => (
                            <ToggleGroupItem
                              variant="outline"
                              size="sm"
                              class="border-muted-foreground data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
                              value={mode}
                            >
                              {mode}
                            </ToggleGroupItem>
                          )}
                        </For>
                      </ToggleGroup>
                    </PopoverContent>
                  </Popover>
                  <StatusToggle active={slice.ritEnabled || slice.xitEnabled}>
                    RIT
                  </StatusToggle>
                  <StatusToggle active={!!slice.daxChannel}>DAX</StatusToggle>
                </div>
              </div>
            </div>
          </Portal>
        </div>
      </Show>
      <div
        ref={setSentinel}
        class="absolute left-[var(--slice-offset)] translate-x-[var(--drag-offset)] pointer-events-none"
        style={{
          "--slice-offset": `${offset()}px`,
        }}
      />
    </>
  );
}
