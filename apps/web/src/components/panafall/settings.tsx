import useFlexRadio, {
  PanadapterState,
  WaterfallState,
} from "~/context/flexradio";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "../ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import * as SelectPrimitive from "@kobalte/core/select";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "../ui/segmented-control";

import { SliderToggle } from "../ui/slider-toggle";
import { SimpleSwitch } from "../ui/simple-switch";
import { SimpleSlider } from "../ui/simple-slider";
import { Button } from "../ui/button";

import {
  ColorField,
  ColorFieldInput,
  ColorFieldLabel,
} from "../ui/color-field";
import { ColorSwatch } from "@kobalte/core/color-swatch";
import { parseColor } from "@kobalte/core/colors";
import { PanadapterController, WaterfallController } from "@repo/flexlib";
import {
  FillStyle,
  GradientStyle,
  PeakStyle,
  usePreferences,
} from "~/context/preferences";
import { Sidebar, SidebarContent, SidebarRail } from "../ui/sidebar";
import { usePanafall } from "~/context/panafall";
import BaselineDisplaySettings from "~icons/ic/baseline-display-settings";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { ToggleButton } from "@kobalte/core/toggle-button";
import { showToast } from "../ui/toast";
import { ConfirmButton } from "../ui/confirm-button";
import { DismissableLayer } from "@kobalte/core/src/dismissable-layer/index.js";

export const BANDS: { id: string; label: string }[] = [
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

function createGradientStyle(
  stops: { color: string; offset: number }[],
  to: string = "top",
) {
  return `linear-gradient(to ${to}, ${stops
    .map(({ color, offset }) => `${color} ${offset * 100}%`)
    .join(", ")})`;
}

export function PanafallSettings(props: {
  panadapter: PanadapterState;
  waterfall: WaterfallState;
  panadapterController: PanadapterController;
  waterfallController: WaterfallController;
}) {
  return (
    <Accordion
      multiple
      collapsible
      defaultValue={["display", "band", "antenna"]}
      // value={preferences.sidebarPanels}
      // onChange={(value) => setPreferences("sidebarPanels", value)}
      class="select-none h-full flex flex-col"
    >
      <AccordionItem value="display">
        <AccordionTrigger>Display</AccordionTrigger>
        <AccordionContent>
          <DisplaySettings
            panadapter={props.panadapter}
            panadapterController={props.panadapterController}
            waterfall={props.waterfall}
            waterfallController={props.waterfallController}
          />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="band">
        <AccordionTrigger>Band</AccordionTrigger>
        <AccordionContent>
          <BandSettings
            panadapter={props.panadapter}
            panadapterController={props.panadapterController}
          />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="antenna">
        <AccordionTrigger>Antenna</AccordionTrigger>
        <AccordionContent>
          <AntennaSettings
            panadapter={props.panadapter}
            panadapterController={props.panadapterController}
          />
        </AccordionContent>
      </AccordionItem>
      <div class="grow" />
      <div class="p-4">
        <Button
          size="sm"
          variant="destructive"
          class="w-full"
          onClick={() => {
            if (
              confirm(
                `Are you sure you want to remove Panadapter ${props.panadapter.id}?`,
              )
            ) {
              props.panadapterController.close();
            }
          }}
        >
          Remove Panadapter
        </Button>
      </div>
    </Accordion>
  );
}

export function PanafallSettingsSidebar() {
  const { waterfall, panadapter, waterfallController, panadapterController } =
    usePanafall();
  return (
    <Sidebar
      gap={true}
      side="left"
      variant="floating"
      class="absolute h-full z-50 pr-0"
    >
      <SidebarRail />
      <SidebarContent
        class="gap-0 overflow-y-auto overflow-x-hidden pointer-events-auto"
        style={{
          "scrollbar-gutter": "stable both-edges",
          "scrollbar-width": "thin",
        }}
      >
        <PanafallSettings
          waterfall={waterfall()}
          panadapter={panadapter()}
          waterfallController={waterfallController()}
          panadapterController={panadapterController()}
        />
      </SidebarContent>
    </Sidebar>
  );
}

function DisplaySettings(props: {
  panadapter: PanadapterState;
  panadapterController: PanadapterController;
  waterfall: WaterfallState;
  waterfallController: WaterfallController;
}) {
  const { preferences, setPreferences } = usePreferences();
  const [rawPanBackgroundColor, setRawPanBackgroundColor] = createSignal(
    preferences.panBackgroundColor,
  );

  createEffect(() => setRawPanBackgroundColor(preferences.panBackgroundColor));

  createEffect(() => {
    const rawColor = rawPanBackgroundColor();
    if (rawColor === preferences.panBackgroundColor) return;
    try {
      const color = parseColor(rawColor);
      console.log(color.toString("css"));
      setPreferences("panBackgroundColor", rawColor);
    } catch (_e) {
      // Invalid color, ignore
    }
  });

  return (
    <div class="text-sm flex flex-col gap-3">
      <SegmentedControl
        value={preferences.peakStyle}
        onChange={(value: PeakStyle) => {
          if (!value) return;
          setPreferences("peakStyle", value);
        }}
      >
        <SegmentedControlLabel>Peak Style</SegmentedControlLabel>
        <SegmentedControlGroup>
          <SegmentedControlIndicator />
          <SegmentedControlItemsList>
            <For each={["none", "points", "line"]}>
              {(style) => (
                <SegmentedControlItem value={style}>
                  <SegmentedControlItemLabel class="capitalize">
                    {style}
                  </SegmentedControlItemLabel>
                </SegmentedControlItem>
              )}
            </For>
          </SegmentedControlItemsList>
        </SegmentedControlGroup>
      </SegmentedControl>
      <SegmentedControl
        value={preferences.fillStyle}
        onChange={(value: FillStyle) => {
          if (!value) return;
          setPreferences("fillStyle", value);
        }}
      >
        <SegmentedControlLabel>Fill Style</SegmentedControlLabel>
        <SegmentedControlGroup>
          <SegmentedControlIndicator />
          <SegmentedControlItemsList>
            <For each={["none", "solid", "gradient"]}>
              {(style) => (
                <SegmentedControlItem value={style}>
                  <SegmentedControlItemLabel class="capitalize">
                    {style}
                  </SegmentedControlItemLabel>
                </SegmentedControlItem>
              )}
            </For>
          </SegmentedControlItemsList>
        </SegmentedControlGroup>
      </SegmentedControl>
      <SegmentedControl
        value={preferences.gradientStyle}
        onChange={(value: GradientStyle) => {
          if (!value) return;
          setPreferences("gradientStyle", value);
        }}
      >
        <SegmentedControlLabel>Gradient Style</SegmentedControlLabel>
        <SegmentedControlGroup>
          <SegmentedControlIndicator />
          <SegmentedControlItemsList>
            <For each={["color", "classic"]}>
              {(style) => (
                <SegmentedControlItem value={style}>
                  <SegmentedControlItemLabel class="capitalize">
                    {style}
                  </SegmentedControlItemLabel>
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
        options={preferences.palette.gradients.map((_, index) => index)}
        itemComponent={(props) => {
          const gradient = preferences.palette.gradients.at(
            props.item.rawValue,
          );
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
            {(state) => (
              <Show
                when={preferences.palette.gradients.at(state.selectedOption())}
                fallback="Unknown"
              >
                {(gradient) => (
                  <div class="flex items-center gap-2">
                    <div
                      class="h-6 w-6 rounded-sm"
                      style={{
                        "background-image": createGradientStyle(
                          gradient().stops,
                        ),
                      }}
                    />
                    <div>{gradient().name}</div>
                  </div>
                )}
              </Show>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
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
      <SliderToggle
        switchChecked={props.waterfall.autoBlackLevelEnabled}
        onSwitchChange={(isChecked) => {
          props.waterfallController.setAutoBlackLevelEnabled(isChecked);
        }}
        minValue={0}
        maxValue={100}
        disabled={props.waterfall.autoBlackLevelEnabled}
        value={[props.waterfall.blackLevel]}
        onChange={([value]) => {
          if (value === props.waterfall.blackLevel) return;
          props.waterfallController.setBlackLevel(Math.floor(value));
        }}
        getValueLabel={(params) =>
          props.waterfall.autoBlackLevelEnabled
            ? "Auto"
            : params.values[0]?.toString()
        }
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
            value={parseColor(preferences.panBackgroundColor)}
          />
        </div>
      </ColorField>
    </div>
  );
}

function AntennaSettings(props: {
  panadapter: PanadapterState;
  panadapterController: PanadapterController;
}) {
  const [rawFrequency, setRawFrequency] = createSignal(0);
  const [rawBandwidth, setRawBandwidth] = createSignal(0);
  const [rawHighDbm, setRawHighDbm] = createSignal(0);
  const [rawLowDbm, setRawLowDbm] = createSignal(0);

  createEffect(() => props.panadapterController.refreshRfGainInfo());

  createEffect(() => setRawFrequency(props.panadapter.centerFrequencyMHz));
  createEffect(() => setRawBandwidth(props.panadapter.bandwidthMHz));
  createEffect(() => setRawHighDbm(props.panadapter.highDbm));
  createEffect(() => setRawLowDbm(props.panadapter.lowDbm));

  return (
    <div class="text-sm flex flex-col gap-3">
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
          <SelectItem item={props.item}>
            {props.item.rawValue.replaceAll("_", " ")}
          </SelectItem>
        )}
      >
        <SelectLabel>RX Antenna</SelectLabel>
        <SelectTrigger>
          <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <SimpleSlider
        minValue={props.panadapter.rfGainLow}
        maxValue={props.panadapter.rfGainHigh}
        step={props.panadapter.rfGainStep}
        value={[props.panadapter.rfGain]}
        onChange={([value]) => {
          if (value === props.panadapter.rfGain) return;
          props.panadapterController.setRfGain(value);
        }}
        getValueLabel={(params) => {
          const value = params.values[0];
          return `${value > 0 ? "+" : ""}${value} dB`;
        }}
        label="RF Gain"
      />
      <SliderToggle
        disabled={!props.panadapter.wnbEnabled}
        minValue={0}
        maxValue={100}
        value={[props.panadapter.wnbLevel]}
        onChange={([value]) => {
          props.panadapterController.setWnbLevel(value);
        }}
        getValueLabel={(params) => `${params.values[0]}%`}
        label="WNB"
        switchChecked={props.panadapter.wnbEnabled}
        onSwitchChange={(isChecked) => {
          props.panadapterController.setWnbEnabled(isChecked);
        }}
      />

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
        format={false}
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
        format={false}
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
            props.panadapterController.setDbmRange({
              high,
              low: rawLowDbm(),
            });
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
            props.panadapterController.setDbmRange({
              high: rawHighDbm(),
              low,
            });
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
    </div>
  );
}

function BandSettings(props: {
  panadapter: PanadapterState;
  panadapterController: PanadapterController;
}) {
  const { bands, state } = useFlexRadio();

  const plainBands = createMemo(() =>
    bands
      .entries()
      .filter(([key, _]) => !key.startsWith("x"))
      .toArray(),
  );

  const xvrtBands = createMemo(() =>
    bands
      .entries()
      .filter(([key, _]) => key.startsWith("x"))
      .toArray(),
  );

  return (
    <ToggleGroup
      class="grid grid-cols-3 gap-1"
      value={
        props.panadapter.xvtr
          ? `x${
              Object.values(state.status.xvtr).find(
                (xvtr) => xvtr.name === props.panadapter.xvtr,
              ).id
            }`
          : props.panadapter.band
      }
      onChange={(value: string) => {
        if (!value) return;
        props.panadapterController.setBand(value);
      }}
    >
      <For each={plainBands()}>
        {([value, label]) => (
          <ToggleGroupItem variant="outline" value={value}>
            {label}
          </ToggleGroupItem>
        )}
      </For>
      <Show when={xvrtBands().length}>
        <Separator class="col-span-3 my-2" />
        <For each={xvrtBands()}>
          {([value, label]) => (
            <ToggleGroupItem variant="outline" value={value}>
              {label}
            </ToggleGroupItem>
          )}
        </For>
      </Show>
    </ToggleGroup>
  );
}

export function PanSettings() {
  const [open, setOpen] = createSignal(false);
  const [openSection, setOpenSection] = createSignal<string | null>();
  const { panadapter, panadapterController, waterfall, waterfallController } =
    usePanafall();

  const [menuRef, setMenuRef] = createSignal<HTMLElement>();

  const { radio, state } = useFlexRadio();

  return (
    <div class="absolute max-h-full p-2 flex z-50 pointer-events-none">
      <div ref={setMenuRef}>
        <ToggleGroup
          class="grid grid-cols-1 gap-1 pointer-events-auto rounded-lg fancy-bg-card border shadow-black overflow-auto max-h-full"
          classList={{
            "p-2": open(),
            "rounded-r-none border-r-0": Boolean(openSection()) && open(),
          }}
          style={{
            "scrollbar-width": "thin",
          }}
          value={openSection()}
          onChange={setOpenSection}
        >
          <ToggleButton
            as={Button}
            size="xs"
            variant="ghost"
            class="hover:bg-accent not-data-pressed:size-10 not-data-pressed:not-pointer-coarse:size-5 not-data-pressed:aspect-square"
            pressed={open()}
            onChange={setOpen}
          >
            <BaselineDisplaySettings />
          </ToggleButton>
          <Show when={open()}>
            <Button
              disabled={state.status.radio.availableSlices === 0}
              size="xs"
              variant="ghost"
              class="hover:bg-accent"
              onClick={() =>
                radio()
                  .requestSlice({
                    panadapterStreamId: panadapter().streamId,
                  })
                  .catch((e) => {
                    showToast({
                      variant: "error",
                      description: e.codeDescription,
                    });
                  })
              }
            >
              +RX
            </Button>
            <Button
              size="xs"
              variant="ghost"
              class="hover:bg-accent"
              onClick={() => radio().createTnf(panadapter().centerFrequencyMHz)}
            >
              +TNF
            </Button>
            <ToggleGroupItem value="display" class="h-6 px-2 text-xs">
              Display
            </ToggleGroupItem>
            <ToggleGroupItem value="band" class="h-6 px-2 text-xs">
              Band
            </ToggleGroupItem>
            <ToggleGroupItem value="antenna" class="h-6 px-2 text-xs">
              Antenna
            </ToggleGroupItem>
            <Select
              value={panadapter().daxIqChannel}
              options={Array.from(
                { length: radio()?.modelInfo.maxDaxIqChannels + 1 },
                (_, i) => i,
              )}
              onChange={(v: number) => {
                if (v === panadapter().daxIqChannel) return;
                panadapterController().setDaxIqChannel(v);
              }}
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {props.item.rawValue || "None"}
                </SelectItem>
              )}
            >
              <SelectPrimitive.Trigger
                as={Button}
                size="xs"
                variant="ghost"
                class="w-full hover:bg-accent"
                aria-label="DAX IQ Channel"
              >
                DAX IQ
              </SelectPrimitive.Trigger>
              <SelectContent />
            </Select>
            <ConfirmButton
              size="xs"
              variant="ghost"
              class="hover:bg-destructive hover:text-destructive-foreground"
              message={`Are you sure you want to remove Panadapter ${panadapter().id}?`}
              onConfirm={() => panadapterController().close()}
            >
              Remove
            </ConfirmButton>
          </Show>
        </ToggleGroup>
      </div>
      <div>
        <DismissableLayer
          class="flex flex-col max-h-full"
          onFocusOutside={(e) => e.preventDefault()}
          onDismiss={() => setOpen(false)}
          excludedElements={[
            menuRef,
            // this is a hack so interacting with a select box doesn't close the whole menu
            () => document.querySelector("[data-popper-positioner]"),
          ]}
          bypassTopMostLayerCheck
        >
          <Show when={open() && openSection()}>
            <Card
              class="rounded-tl-none w-64 fancy-bg-card! pointer-events-auto overflow-auto shadow-black"
              style={{
                "scrollbar-gutter": "stable both-edges",
                "scrollbar-width": "thin",
              }}
            >
              <CardContent class="p-4">
                <Switch>
                  <Match when={openSection() === "display"}>
                    <DisplaySettings
                      panadapter={panadapter()}
                      panadapterController={panadapterController()}
                      waterfall={waterfall()}
                      waterfallController={waterfallController()}
                    />
                  </Match>
                  <Match when={openSection() === "band"}>
                    <BandSettings
                      panadapter={panadapter()}
                      panadapterController={panadapterController()}
                    />
                  </Match>
                  <Match when={openSection() === "antenna"}>
                    <AntennaSettings
                      panadapter={panadapter()}
                      panadapterController={panadapterController()}
                    />
                  </Match>
                </Switch>
              </CardContent>
            </Card>
          </Show>
        </DismissableLayer>
      </div>
    </div>
  );
}
