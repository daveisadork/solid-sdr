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
import { NumberField } from "@kobalte/core/number-field";

import type { Component, ComponentProps, JSX } from "solid-js";
import { createPointerListeners } from "@solid-primitives/pointer";
import { createMousePosition } from "@solid-primitives/mouse";
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

const LevelMeter = (props: { sliceIndex?: string | number }) => {
  const { state } = useFlexRadio();
  const [meterId, setMeterId] = createSignal<string | number>();

  createEffect(() => {
    const sliceIndex = props.sliceIndex;
    if (state.status.slice[meterId()!]) {
      return;
    }
    for (const meterId in state.status.meters) {
      const meter: Meter = state.status.meters[meterId];
      if (
        meter.src === "SLC" &&
        meter.num == sliceIndex &&
        meter.nam === "LEVEL"
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
        const meter = state.status.meters[id];
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

export function DetachedSlice(props: { sliceIndex: number | string }) {
  const sliceIndex = () => props.sliceIndex;
  const { sendCommand, state, setState } = useFlexRadio();
  const [slice, setSlice] = createStore(state.status.slice[sliceIndex()]);
  const streamId = () => slice.pan;
  const [pan] = createStore(state.status.display.pan[streamId()]);

  const makeActive = async () => {
    if (slice.active) return;
    await sendCommand(`slice s ${props.sliceIndex} active=1`);
    const ownedSlices = Object.keys(state.status.slice).filter(
      (key) =>
        state.status.slice[key].pan === streamId() &&
        state.status.slice[key].in_use,
    );
    setState("status", "slice", ownedSlices, "active", false);
    setSlice("active", !slice.active);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      class="font-black text-md font-mono z-10 pointer-events-auto text-shadow-md text-shadow-black"
      onClick={() => {
        sendCommand(`display pan s ${streamId()} center=${slice.RF_frequency}`);
        makeActive();
      }}
    >
      <Show when={slice.RF_frequency < pan.center}>
        <BaselineChevronLeft />
      </Show>
      <span>{slice.index_letter}</span>
      <Show when={slice.RF_frequency > pan.center}>
        <BaselineChevronRight />
      </Show>
    </Button>
  );
}

export function DetachedSlices(props: { streamId: number | string }) {
  const { state } = useFlexRadio();
  const streamId = () => props.streamId;
  const [pan] = createStore(state.status.display.pan[streamId()]);

  return (
    <div class="flex absolute top-10 left-0 bottom-0 right-0 pointer-events-none">
      <div class="flex flex-col">
        <For
          each={Object.keys(state.status.slice).filter((sliceIndex) => {
            const slice = state.status.slice[sliceIndex];
            return (
              slice.pan === props.streamId &&
              slice.in_use &&
              slice.detached &&
              slice.RF_frequency < pan.center
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
              slice.pan === props.streamId &&
              slice.in_use &&
              slice.detached &&
              slice.RF_frequency > pan.center
            );
          })}
        >
          {(sliceIndex) => <DetachedSlice sliceIndex={sliceIndex} />}
        </For>
      </div>
    </div>
  );
}

export function Slice(props: { sliceIndex: number | string }) {
  const sliceIndex = () => props.sliceIndex;
  const { state, sendCommand, setState } = useFlexRadio();
  const [slice, setSlice] = createStore(state.status.slice[sliceIndex()]);
  const streamId = () => slice.pan;
  const [pan] = createStore(state.status.display.pan[streamId()]);
  const [offset, setOffset] = createSignal(0);
  const [ref, setRef] = createSignal<HTMLDivElement>();
  const [sentinel, setSentinel] = createSignal<HTMLDivElement>();
  const [wrapper, setWrapper] = createSignal<HTMLElement>();
  const [flag, setFlag] = createSignal<HTMLElement>();
  const [filterWidth, setFilterWidth] = createSignal(0);
  const [filterOffset, setFilterOffset] = createSignal(0);
  const [filterText, setFilterText] = createSignal("");
  const [frequency, setFrequency] = createSignal<string>();
  const [rawFrequency, setRawFrequency] = createSignal<number>();
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
    if (slice.diversity_parent) {
      return setFlagSide("left");
    }
    if (slice.diversity_child) {
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
      const { dragging, originX, originFreq } = dragState;
      if (!dragging) return;
      const { bandwidth, x_pixels } = pan;
      const newX = Math.max(0, Math.min(event.x, x_pixels - 1));
      const newOffset = originX - newX;

      const mhzPerPx = bandwidth / x_pixels;
      // Round frequency to the nearest step
      const step = slice.step / 1e6; // Convert Hz to MHz
      const freqUnrounded = originFreq - newOffset * mhzPerPx;
      const freqSteps = Math.round(freqUnrounded / step);
      const freq = freqSteps * step;

      if (freq === slice.RF_frequency) {
        return;
      }

      await sendCommand(`slice t ${props.sliceIndex} ${freq}`);
      const groupedSlices = Object.keys(state.status.slice).filter(
        (key) =>
          state.status.slice[key].pan === streamId() &&
          state.status.slice[key].in_use &&
          state.status.slice[key].diversity_index === slice.diversity_index,
      );

      setState("status", "slice", groupedSlices, "RF_frequency", freq);
    },
    onUp() {
      setDragState("dragging", false);
    },
    onLeave() {
      setDragState("dragging", false);
    },
  });

  createEffect((center) => {
    if (pan.center !== center) {
      setDragState("dragging", false);
    }
    return pan.center;
  });

  createEffect(() => {
    const parent = ref()?.parentElement;
    if (!parent) return;
    setWrapper(parent);
  });

  createEffect(() => {
    const { width } = windowSize;
    if (!width) return;
    const leftFreq = pan.center - pan.bandwidth / 2;
    const offsetMhz = slice.RF_frequency - leftFreq;
    const offsetPixels = (offsetMhz / pan.bandwidth) * width;
    const filterWidthMhz = (slice.filter_hi - slice.filter_lo) / 1e6; // Convert Hz to MHz
    batch(() => {
      setFilterWidth((filterWidthMhz / pan.bandwidth) * width);
      setFilterOffset((slice.filter_lo / 1e6 / pan.bandwidth) * width);
      setFilterText(`${(slice.filter_hi - slice.filter_lo) / 1e3}K`);
      // panadapter display is off by 2 pixels, so adjust
      setOffset(offsetPixels - 2);
    });
  });

  const tuneSlice = async () => {
    const freq = rawFrequency() ?? slice.RF_frequency;
    if (freq === slice.RF_frequency) {
      setFrequency((slice.RF_frequency * 1e6).toLocaleString()); // Reset display
      return;
    }
    try {
      await sendCommand(`slice t ${props.sliceIndex} ${freq.toFixed(6)}`);
      const groupedSlices = Object.keys(state.status.slice).filter(
        (key) =>
          state.status.slice[key].pan === streamId() &&
          state.status.slice[key].in_use &&
          state.status.slice[key].diversity_index === slice.diversity_index,
      );

      setState("status", "slice", groupedSlices, "RF_frequency", freq);
    } catch (err) {
      setFrequency((slice.RF_frequency * 1e6).toLocaleString()); // Reset display on error
    }
  };

  createEffect(() => {
    const freq = slice.RF_frequency * 1e6;
    setFrequency(freq.toLocaleString());
  });

  const makeActive = async () => {
    if (slice.active) return;
    await sendCommand(`slice s ${props.sliceIndex} active=1`);
    const ownedSlices = Object.keys(state.status.slice).filter(
      (key) =>
        state.status.slice[key].pan === streamId() &&
        state.status.slice[key].in_use,
    );
    setState("status", "slice", ownedSlices, "active", false);
    setSlice("active", !slice.active);
  };

  createEffect(() => {
    const detached =
      sentinelBounds.left! < 0 || sentinelBounds.right! > wrapperSize.width!;
    if (detached === slice.detached) return;
    setSlice("detached", detached);
  });

  return (
    <>
      <Show when={!slice.detached}>
        <div
          class="absolute h-full left-[var(--slice-offset)] translate-x-[var(--drag-offset)] cursor-ew-resize"
          classList={{
            "z-0": !slice.active,
            "z-10": slice.active,
          }}
          style={{
            "--slice-offset": `${offset()}px`,
          }}
          onMouseDown={(event) => {
            setDragState({
              dragging: true,
              originX: event.clientX,
              originFreq: slice.RF_frequency,
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
                !slice.diversity_child,
            }}
            style={{
              "--filter-width": `${filterWidth()}px`,
              "--filter-offset": `${filterOffset()}px`,
            }}
          />
          <div
            class="absolute h-full max-w-px w-px flex flex-col items-center m-auto top-0 -translate-x-1/2 transform-3d"
            classList={{
              "bg-yellow-300": slice.active,
              "bg-red-500": !slice.active,
            }}
          >
            <Show when={slice.active}>
              <Triangle
                class="relative top-0"
                classList={{
                  "bg-red-500": slice.diversity_child,
                  "bg-yellow-300": !slice.diversity_child,
                }}
              />
              <Show when={slice.diversity}>
                <Triangle
                  class="relative -translate-y-1/2"
                  classList={{
                    "bg-red-500 -translate-z-1": slice.diversity_parent,
                    "bg-yellow-300 translate-z-1": slice.diversity_child,
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
                  "drop-shadow-lg": slice.active,
                  "drop-shadow-md": !slice.active,
                }}
              >
                <div
                  class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-md"
                  classList={{
                    "backdrop-brightness-75 backdrop-grayscale-25":
                      !slice.active,
                  }}
                />
                <div class="flex justify-between items-center space-x-2">
                  <Select
                    value={slice.rxant}
                    options={slice.ant_list}
                    onChange={async (v) => {
                      if (!v || v === slice.rxant) return;
                      await sendCommand(
                        `slice s ${props.sliceIndex} rxant=${v}`,
                      );
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
                    value={slice.txant}
                    options={slice.tx_ant_list}
                    onChange={async (v) => {
                      if (!v) return;
                      await sendCommand(
                        `slice s ${props.sliceIndex} txant=${v}`,
                      );
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
                      "bg-red-500": slice.tx,
                      "opacity-50": !slice.tx,
                    }}
                    pressed={slice.tx}
                    onChange={async (pressed) => {
                      await sendCommand(
                        `slice s ${props.sliceIndex} tx=${pressed ? 1 : 0}`,
                      );
                      setSlice("tx", pressed);
                    }}
                  >
                    TX
                  </ToggleButton.Root>
                  <span class="text-center font-bold bg-blue-500 pl-1 pr-1 rounded-sm">
                    <Popover>
                      <PopoverTrigger>{slice.index_letter}</PopoverTrigger>
                      <PopoverContent class="flex flex-col overflow-hidden w-96 max-h-[var(--kb-popper-content-available-height)]">
                        <pre class="size-full overflow-auto text-sm">
                          {JSON.stringify(slice, null, 2)}
                        </pre>
                      </PopoverContent>
                    </Popover>
                  </span>
                </div>
                <Show when={!slice.diversity_child}>
                  <div class="flex justify-between items-center space-x-2">
                    <span>{slice.mode}</span>
                    <NumberField
                      class="text-lg font-mono"
                      value={frequency()}
                      onChange={setFrequency}
                      rawValue={rawFrequency()} // Convert MHz to Hz for input
                      onRawValueChange={setRawFrequency}
                      onFocusOut={tuneSlice}
                      changeOnWheel={false}
                      formatOptions={{ maximumFractionDigits: 7 }} // No decimal places for raw Hz input
                    >
                      <NumberField.Input
                        size={14}
                        onFocus={({ target }) => {
                          setFrequency(slice.RF_frequency.toFixed(6));
                          setRawFrequency(slice.RF_frequency);
                          requestAnimationFrame(() => target.select());
                        }}
                        onKeyDown={({ key, currentTarget }) => {
                          switch (key) {
                            case "K":
                            case "k": {
                              // convert raw frequency from khz to mhz
                              const freq = rawFrequency()! / 1e3;
                              setFrequency(freq.toFixed(6));
                              break;
                            }
                            case "G":
                            case "g": {
                              // convert raw frequency from ghz to mhz
                              const freq = rawFrequency()! * 1e3;
                              setFrequency(freq.toFixed(6));
                              break;
                            }
                            case "Escape":
                              setRawFrequency(slice.RF_frequency);
                              break;
                            case "M":
                            case "m":
                            case "Enter":
                              break;
                            default:
                              // Ignore other keys
                              return;
                          }

                          // trigger tuning
                          requestAnimationFrame(() => currentTarget.blur());
                        }}
                        class="text-right bg-transparent select-all"
                      />
                    </NumberField>
                  </div>
                </Show>
                <div>
                  <LevelMeter sliceIndex={props.sliceIndex} />
                </div>
                <div class="flex items-center text-xs font-bold justify-between *:basis-64 *:flex *:flex-col *:items-center">
                  <Popover>
                    <PopoverTrigger
                      onContextMenu={async (e) => {
                        e.preventDefault();
                        const audio_mute = !slice.audio_mute;
                        await sendCommand(
                          `slice s ${props.sliceIndex} audio_mute=${audio_mute ? 1 : 0}`,
                        );
                        setSlice("audio_mute", audio_mute);
                      }}
                    >
                      <Show
                        when={slice.audio_mute}
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
                        checked={slice.audio_mute}
                        onChange={async (isChecked) => {
                          await sendCommand(
                            `slice s ${props.sliceIndex} audio_mute=${isChecked ? 1 : 0}`,
                          );
                          setSlice("audio_mute", isChecked);
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
                        value={[slice.audio_level]}
                        onChange={async ([value]) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} audio_level=${value}`,
                          );
                          setSlice("audio_level", value);
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
                        value={[slice.audio_pan]}
                        onChange={async ([value]) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} audio_pan=${value}`,
                          );
                          setSlice("audio_pan", value);
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
                                slice.audio_pan > 50
                                  ? `${100 - slice.audio_pan}%`
                                  : "50%",
                              left:
                                slice.audio_pan <= 50
                                  ? `${slice.audio_pan}%`
                                  : "50%",
                            }}
                          />
                          <SliderThumb />
                        </SliderTrack>
                      </Slider>
                      <SegmentedControl
                        value={slice.agc_mode}
                        onChange={async (value) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} agc_mode=${value}`,
                          );
                          setSlice("agc_mode", value as string);
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
                        disabled={slice.agc_mode === "off"}
                        minValue={0}
                        maxValue={100}
                        value={[slice.agc_threshold]}
                        onChange={async ([value]) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} agc_threshold=${value}`,
                          );
                          setSlice("agc_threshold", value);
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
                        checked={slice.diversity}
                        disabled={slice.diversity_child}
                        onChange={(isChecked) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} diversity=${isChecked ? 1 : 0}`,
                          );
                        }}
                      >
                        <SwitchLabel>Diversity Reception</SwitchLabel>
                        <SwitchControl>
                          <SwitchThumb />
                        </SwitchControl>
                      </Switch>
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
                      <Slider
                        disabled={!slice.wnb}
                        minValue={0}
                        maxValue={100}
                        value={[slice.wnb_level]}
                        onChange={async ([value]) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} wnb_level=${value}`,
                          );
                          setSlice("wnb_level", value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        class="space-y-2"
                      >
                        <div class="flex w-full justify-between">
                          <SliderLabel>Wideband Noise Blanker</SliderLabel>
                          <SliderValueLabel />
                        </div>
                        <div class="flex w-full items-center justify-between">
                          <Switch
                            class="h-auto flex items-center origin-left scale-75"
                            checked={slice.wnb}
                            onChange={async (isChecked) => {
                              await sendCommand(
                                `slice s ${props.sliceIndex} wnb=${isChecked ? 1 : 0}`,
                              );
                              setSlice("wnb", isChecked);
                            }}
                          >
                            <SwitchControl>
                              <SwitchThumb />
                            </SwitchControl>
                          </Switch>
                          <SliderTrack>
                            <SliderFill />
                            <SliderThumb />
                          </SliderTrack>
                        </div>
                      </Slider>
                      <Slider
                        disabled={!slice.nb}
                        minValue={0}
                        maxValue={100}
                        value={[slice.nb_level]}
                        onChange={async ([value]) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} nb_level=${value}`,
                          );
                          setSlice("nb_level", value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        class="space-y-2"
                      >
                        <div class="flex w-full justify-between">
                          <SliderLabel>Noise Blanker</SliderLabel>
                          <SliderValueLabel />
                        </div>
                        <div class="flex w-full items-center space-x-2 justify-between">
                          <Switch
                            class="h-auto flex items-center origin-left scale-75"
                            checked={slice.nb}
                            onChange={async (isChecked) => {
                              await sendCommand(
                                `slice s ${props.sliceIndex} nb=${isChecked ? 1 : 0}`,
                              );
                              setSlice("nb", isChecked);
                            }}
                          >
                            <SwitchControl>
                              <SwitchThumb />
                            </SwitchControl>
                          </Switch>
                          <SliderTrack>
                            <SliderFill />
                            <SliderThumb />
                          </SliderTrack>
                        </div>
                      </Slider>
                      <Slider
                        disabled={!slice.nr}
                        minValue={0}
                        maxValue={100}
                        value={[slice.nr_level]}
                        onChange={async ([value]) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} nr_level=${value}`,
                          );
                          setSlice("nr_level", value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        class="space-y-2"
                      >
                        <div class="flex w-full justify-between">
                          <SliderLabel>Noise Reduction</SliderLabel>
                          <SliderValueLabel />
                        </div>
                        <div class="flex w-full items-center space-x-2 justify-between">
                          <Switch
                            class="h-auto flex items-center origin-left scale-75"
                            checked={slice.nr}
                            onChange={async (isChecked) => {
                              await sendCommand(
                                `slice s ${props.sliceIndex} nr=${isChecked ? 1 : 0}`,
                              );
                              setSlice("nr", isChecked);
                            }}
                          >
                            <SwitchControl>
                              <SwitchThumb />
                            </SwitchControl>
                          </Switch>
                          <SliderTrack>
                            <SliderFill />
                            <SliderThumb />
                          </SliderTrack>
                        </div>
                      </Slider>
                      <Slider
                        disabled={!slice.anf}
                        minValue={0}
                        maxValue={100}
                        value={[slice.anf_level]}
                        onChange={async ([value]) => {
                          sendCommand(
                            `slice s ${props.sliceIndex} anf_level=${value}`,
                          );
                          setSlice("anf_level", value);
                        }}
                        getValueLabel={(params) => `${params.values[0]}%`}
                        class="space-y-2"
                      >
                        <div class="flex w-full justify-between">
                          <SliderLabel>Automatic Notch Filter</SliderLabel>
                          <SliderValueLabel />
                        </div>
                        <div class="flex w-full items-center space-x-2 justify-between">
                          <Switch
                            class="h-auto flex items-center origin-left scale-75"
                            checked={slice.anf}
                            onChange={async (isChecked) => {
                              await sendCommand(
                                `slice s ${props.sliceIndex} anf=${isChecked ? 1 : 0}`,
                              );
                              setSlice("anf", isChecked);
                            }}
                          >
                            <SwitchControl>
                              <SwitchThumb />
                            </SwitchControl>
                          </Switch>
                          <SliderTrack>
                            <SliderFill />
                            <SliderThumb />
                          </SliderTrack>
                        </div>
                      </Slider>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger disabled={slice.diversity_child}>
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
                        onChange={async (mode) => {
                          if (!mode || mode === slice.mode) return;
                          await sendCommand(
                            `slice s ${props.sliceIndex} mode=${mode}`,
                          );
                          setSlice("mode", mode);
                        }}
                        class="grid grid-cols-4"
                      >
                        <For each={slice.mode_list}>
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
                  <StatusToggle active={slice.rit_on || slice.xit_on}>
                    RIT
                  </StatusToggle>
                  <StatusToggle active={!!slice.dax}>DAX</StatusToggle>
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
