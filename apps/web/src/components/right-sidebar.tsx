import { createEffect, For, Show } from "solid-js";
import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import * as MeterPrimitive from "@kobalte/core/meter";

import useFlexRadio, { Meter } from "~/context/flexradio";
import { SimpleSlider } from "./ui/simple-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { createStore } from "solid-js/store";
import { SimpleSwitch } from "./ui/simple-switch";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "./ui/segmented-control";

function dbmToWatts(dbm: number) {
  return Math.round(Math.pow(10, (dbm - 30) / 10) * 10) / 10;
}

export function RightSidebar() {
  const { state, radio } = useFlexRadio();
  const [txProfiles, setTxProfiles] = createStore<string[]>([]);

  const fwdPwrMeter = () =>
    Object.values(state.status.meter).find((meter) => meter.name === "FWDPWR");

  const refPwrMeter = () =>
    Object.values(state.status.meter).find((meter) => meter.name === "REFPWR");

  const swr = () => {
    const fwdPwr = dbmToWatts(fwdPwrMeter()?.value ?? 0);
    if (!fwdPwr) return 1;
    const v = Math.sqrt(dbmToWatts(refPwrMeter()?.value ?? 0) / fwdPwr);
    return (1 + v) / (1 - v);
  };

  createEffect(() => setTxProfiles(state?.status?.radio?.profileTxList ?? []));

  return (
    <Sidebar
      gap={true}
      side="right"
      variant="floating"
      class="absolute h-full bg-transparent pointer-events-none"
    >
      <Show when={state.selectedPanadapter}>
        <SidebarContent class="h-full py-4 overflow-clip pointer-events-auto">
          <Accordion
            multiple
            collapsible
            defaultValue={[
              "tx",
              // "p-cw",
              // "phone",
              // "rx",
              // "eq",
            ]}
            class="w-full select-none"
          >
            <AccordionItem value="tx">
              <AccordionTrigger>Transmit</AccordionTrigger>
              <AccordionContent>
                <div class="flex flex-col gap-3">
                  <Show
                    when={Object.values(state.status.meter).find(
                      (meter) => meter.name === "FWDPWR",
                    )}
                  >
                    {(acc) => {
                      const meter = acc();
                      const STOPS = [
                        10,
                        20,
                        30,
                        40,
                        50,
                        60,
                        70,
                        80,
                        90,
                        100,
                        110,
                        null,
                      ];
                      return (
                        <MeterPrimitive.Root
                          value={Math.round(
                            Math.pow(10, ((meter.value ?? 0) - 30) / 10),
                          )}
                          minValue={0}
                          maxValue={
                            state.status.radio.maxInternalPaPowerWatts * 1.2
                          }
                          getValueLabel={({ value }) => `${value} W`}
                          class="flex flex-col gap-0.5 w-full items-center"
                        >
                          <div class="relative flex flex-col w-full gap-0.5">
                            <div class="flex font-mono text-xs w-full">
                              <MeterPrimitive.Label>
                                {meter.description}
                              </MeterPrimitive.Label>
                              <div class="grow" />
                              <MeterPrimitive.ValueLabel />
                            </div>
                            <MeterPrimitive.Track class="relative w-full h-2.5">
                              <div
                                class="absolute inset-0 border border-transparent rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-75% to-red-500 bg-origin-border"
                                style={{
                                  mask: "linear-gradient(black 0 0) padding-box, linear-gradient(black 0 0)",
                                  "mask-composite": "exclude",
                                }}
                              />
                              <MeterPrimitive.Fill
                                class="absolute inset-0 rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-75% to-red-500"
                                style={{
                                  "will-change": "clip-path",
                                  "clip-path":
                                    "inset(0 calc(100% - var(--kb-meter-fill-width)) 0 0)",
                                  transition: `clip-path ${1 / (meter.fps || 4)}s linear`,
                                }}
                              />
                              <div class="absolute inset-px flex">
                                <For each={STOPS}>
                                  {(value) => (
                                    <div class="size-full translate-x-1/2 flex flex-col items-center">
                                      <Show when={value}>
                                        <hr class="h-full w-px bg-foreground/50 border-none" />
                                      </Show>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </MeterPrimitive.Track>
                            <div class="w-full border-x border-transparent text-[0.5rem] flex font-sans">
                              <For each={STOPS.filter((_, i) => i % 2)}>
                                {(value) => (
                                  <div class="min-w-0 grow shrink basis-0 h-1.5 translate-x-1/2 flex flex-col items-center justify-center">
                                    <Show when={value}>
                                      <span class="textbox-edge-cap-alphabetic textbox-trim-both select-none">
                                        {value}
                                      </span>
                                    </Show>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </MeterPrimitive.Root>
                      );
                    }}
                  </Show>
                  <Show
                    when={Object.values(state.status.meter).find(
                      (meter) => meter.name === "SWR",
                    )}
                  >
                    {(acc) => {
                      const meter = acc();
                      const STOPS = [1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, null];
                      return (
                        <MeterPrimitive.Root
                          value={swr()}
                          minValue={1}
                          maxValue={3}
                          getValueLabel={({ value }) =>
                            `${(Math.round(value * 10) / 10).toFixed(1)}:1`
                          }
                          class="flex flex-col gap-0.5 w-full items-center"
                        >
                          <div class="relative flex flex-col w-full gap-0.5">
                            <div class="flex font-mono text-xs w-full">
                              <MeterPrimitive.Label>
                                {meter.description}
                              </MeterPrimitive.Label>
                              <div class="grow" />
                              <MeterPrimitive.ValueLabel />
                            </div>
                            <MeterPrimitive.Track class="relative w-full h-2.5">
                              <div
                                class="absolute inset-0 border border-transparent rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-75% to-red-500 bg-origin-border"
                                style={{
                                  mask: "linear-gradient(black 0 0) padding-box, linear-gradient(black 0 0)",
                                  "mask-composite": "exclude",
                                }}
                              />
                              <MeterPrimitive.Fill
                                class="absolute inset-0 rounded-xl bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-75% to-red-500"
                                style={{
                                  "will-change": "clip-path",
                                  "clip-path":
                                    "inset(0 calc(100% - var(--kb-meter-fill-width)) 0 0)",
                                  transition: `clip-path ${1 / (meter.fps || 4)}s linear`,
                                }}
                              />
                              <div class="absolute inset-px flex">
                                <For each={STOPS}>
                                  {(value) => (
                                    <div class="size-full translate-x-1/2 flex flex-col items-center">
                                      <Show when={value}>
                                        <hr class="h-full w-px bg-foreground/50 border-none" />
                                      </Show>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </MeterPrimitive.Track>
                            <div class="w-full border-x border-transparent text-[0.5rem] flex font-sans">
                              <For each={STOPS.filter((_, i) => i % 2)}>
                                {(value) => (
                                  <div class="min-w-0 grow shrink basis-0 h-1.5 translate-x-1/2 flex flex-col items-center justify-center">
                                    <Show when={value}>
                                      <span class="textbox-edge-cap-alphabetic textbox-trim-both select-none">
                                        {value}
                                      </span>
                                    </Show>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </MeterPrimitive.Root>
                      );
                    }}
                  </Show>

                  <SimpleSlider
                    minValue={0}
                    maxValue={100}
                    value={[state.status.radio.rfPower]}
                    disabled={!state.status.radio.txRfPowerChangesAllowed}
                    onChange={([value]) => {
                      if (value === state.status.radio.rfPower) return;
                      radio()?.setRfPower(value);
                    }}
                    getValueLabel={({ values }) => {
                      const watts = Math.round(
                        (values[0] / 100) *
                          state.status.radio.maxInternalPaPowerWatts,
                      );
                      return `${watts} W`;
                    }}
                    label="TX Power"
                  />
                  <SimpleSlider
                    minValue={0}
                    maxValue={100}
                    value={[state.status.radio.tunePower]}
                    disabled={!state.status.radio.txRfPowerChangesAllowed}
                    onChange={([value]) => {
                      if (value === state.status.radio.rfPower) return;
                      radio()?.setTunePower(value);
                    }}
                    getValueLabel={({ values }) => {
                      const watts = Math.round(
                        (values[0] / 100) *
                          state.status.radio.maxInternalPaPowerWatts,
                      );
                      return `${watts} W`;
                    }}
                    label="Tune Power"
                  />
                  <Select
                    class="flex flex-col gap-2 select-none"
                    value={state.status.radio.profileTxSelection}
                    onChange={(value: string) => {
                      radio()?.loadTxProfile(value);
                    }}
                    options={txProfiles}
                    itemComponent={(props) => {
                      return (
                        <SelectItem item={props.item}>
                          {props.item.rawValue}
                        </SelectItem>
                      );
                    }}
                  >
                    <SelectLabel>TX Profile</SelectLabel>
                    <SelectTrigger>
                      <SelectValue<string>>
                        {(state) => state.selectedOption()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  <SimpleSwitch
                    checked={
                      state.status.radio.mox && !state.status.radio.txTune
                    }
                    disabled={!state.status.radio.txAllowed}
                    onChange={(isChecked) => {
                      radio()?.setMox(isChecked);
                    }}
                    label="MOX"
                    tooltip="Manually Operated Transmit"
                  />
                  <SimpleSwitch
                    checked={state.status.radio.txTune}
                    disabled={!state.status.radio.txAllowed}
                    onChange={(isChecked) => {
                      radio()?.setTxTune(isChecked);
                    }}
                    label="Tune"
                  />

                  <SegmentedControl
                    value={state.status.radio.tuneMode}
                    onChange={(value: "single_tone" | "two_tone") => {
                      console.log(value);
                      if (!value) return;
                      radio()?.setTuneMode(value);
                    }}
                  >
                    <SegmentedControlLabel>Tune Mode</SegmentedControlLabel>
                    <SegmentedControlGroup>
                      <SegmentedControlIndicator />
                      <SegmentedControlItemsList>
                        <For each={["single_tone", "two_tone"]}>
                          {(mode) => (
                            <SegmentedControlItem value={mode}>
                              <SegmentedControlItemLabel class="capitalize">
                                {mode.replaceAll("_", " ")}
                              </SegmentedControlItemLabel>
                            </SegmentedControlItem>
                          )}
                        </For>
                      </SegmentedControlItemsList>
                    </SegmentedControlGroup>
                  </SegmentedControl>
                  <div class="flex flex-col">
                    <SimpleSwitch
                      checked={
                        state.status.radio.atuTuneStatus.endsWith("_OK") ||
                        state.status.radio.atuTuneStatus.endsWith(
                          "_SUCCESSFUL",
                        ) ||
                        state.status.radio.atuTuneStatus.endsWith(
                          "_IN_PROGRESS",
                        )
                      }
                      disabled={!state.status.radio.atuEnabled}
                      onChange={(isChecked) => {
                        if (isChecked) {
                          radio()?.startAtuTune();
                        } else {
                          radio()?.bypassAtu();
                        }
                      }}
                      label="ATU"
                    />
                    <span class="text-muted-foreground text-xs capitalize">
                      {state.status.radio.atuTuneStatus
                        .replaceAll("_", " ")
                        .toLowerCase()}
                    </span>
                  </div>
                  <SimpleSwitch
                    checked={state.status.radio.atuMemoriesEnabled}
                    onChange={(isChecked) => {
                      radio()?.setAtuMemoriesEnabled(isChecked);
                    }}
                    label={`ATU Memory ${state.status.radio.atuUsingMemory ? "(In-Use)" : ""}`}
                  />
                  <SimpleSwitch
                    checked={state.status.apd.enabled}
                    disabled={!state.status.apd.configurable}
                    onChange={(isChecked) => {
                      radio()?.apd().setEnabled(isChecked);
                    }}
                    label={`APD (${state.status.apd.equalizerActive ? "Active" : state.status.apd.equalizerCalibrating ? "Calibrating" : state.status.apd.configurable ? "Available" : "Unavailable"})`}
                    tooltip="Adaptive Pre-Distortion"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="p-cw">
              <AccordionTrigger>P/CW</AccordionTrigger>
              <AccordionContent>
                Yes. It comes with default styles that matches the other
                components' aesthetic.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="phone">
              <AccordionTrigger>Phone</AccordionTrigger>
              <AccordionContent>
                Yes. It's animated by default, but you can disable it if you
                prefer.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rx">
              <AccordionTrigger>Receive</AccordionTrigger>
              <AccordionContent>
                <SimpleSwitch
                  checked={state.status.radio.fullDuplexEnabled}
                  onChange={(isChecked) => {
                    radio()?.setFullDuplexEnabled(isChecked);
                  }}
                  label="Full Duplex"
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="eq">
              <AccordionTrigger>Equalizer</AccordionTrigger>
              <AccordionContent>
                Yes. It's animated by default, but you can disable it if you
                prefer.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SidebarContent>
      </Show>
    </Sidebar>
  );
}
