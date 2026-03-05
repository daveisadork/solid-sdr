import { createEffect, createMemo, For, Show } from "solid-js";
import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import * as MeterPrimitive from "@kobalte/core/meter";

import useFlexRadio from "~/context/flexradio";
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
import { dbmToWatts, roundToDecimals } from "~/lib/utils";

function TxSection() {
  const { state, radio } = useFlexRadio();
  const [txProfiles, setTxProfiles] = createStore<string[]>([]);

  const fwdPwrMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "FWDPWR"),
  );

  const refPwrMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "REFPWR"),
  );

  const fwdPwrWatts = createMemo(() =>
    dbmToWatts(fwdPwrMeter()?.value ?? 0, 1),
  );
  const refPwrWatts = createMemo(() =>
    dbmToWatts(refPwrMeter()?.value ?? 0, 1),
  );

  const swr = createMemo(() => {
    const fwdWatts = fwdPwrWatts();
    if (fwdWatts === 0) return 1;
    const x = Math.sqrt(refPwrWatts() / fwdWatts);
    return (1 + x) / (1 - x);
  });

  createEffect(() => setTxProfiles(state?.status?.radio?.profileTxList ?? []));

  return (
    <AccordionItem value="tx">
      <AccordionTrigger>Transmit</AccordionTrigger>
      <AccordionContent>
        <div class="flex flex-col gap-3">
          <Show when={fwdPwrMeter()}>
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
                  value={dbmToWatts(meter.value, 0)}
                  minValue={0}
                  maxValue={state.status.radio.maxInternalPaPowerWatts * 1.2}
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
                    <MeterPrimitive.Track class="relative w-full h-3">
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
                  getValueLabel={() => {
                    // We don't use the passed in value because it's clamped to the maxValue,
                    // and we want to show the actual SWR even if it exceeds the max.
                    return `${(Math.round(swr() * 10) / 10).toFixed(1)}:1`;
                  }}
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
                    <MeterPrimitive.Track class="relative w-full h-3">
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
                (values[0] / 100) * state.status.radio.maxInternalPaPowerWatts,
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
                (values[0] / 100) * state.status.radio.maxInternalPaPowerWatts,
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
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
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
            checked={state.status.radio.mox && !state.status.radio.txTune}
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
          <SimpleSwitch
            checked={state.status.radio.tuneMode === "two_tone"}
            onChange={(isChecked) => {
              radio()?.setTuneMode(isChecked ? "two_tone" : "single_tone");
            }}
            label="Two-Tone Tune"
          />
          <div class="flex flex-col">
            <SimpleSwitch
              checked={
                state.status.radio.atuTuneStatus.endsWith("_OK") ||
                state.status.radio.atuTuneStatus.endsWith("_SUCCESSFUL") ||
                state.status.radio.atuTuneStatus.endsWith("_IN_PROGRESS")
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
            label="ATU Memory"
          />
          <SimpleSwitch
            checked={state.status.apd.enabled}
            disabled={!state.status.apd.configurable}
            onChange={(isChecked) => {
              radio()?.apd().setEnabled(isChecked);
            }}
            label={`APD ${state.status.apd.enabled && !state.status.apd.equalizerActive ? "(Calibrating)" : ""}`}
            tooltip="Adaptive Pre-Distortion"
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function PcwSection() {
  const { state, radio } = useFlexRadio();
  const [micInputList, setMicInputList] = createStore<string[]>([]);
  createEffect(() => setMicInputList(state?.status?.radio?.micInputList ?? []));

  const micMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "MIC"),
  );

  const micPeakMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "MICPEAK"),
  );

  const compPeakMeter = createMemo(() =>
    Object.values(state.status.meter).find(
      (meter) => meter.name === "COMPPEAK",
    ),
  );

  return (
    <AccordionItem value="p-cw">
      <AccordionTrigger>P/CW</AccordionTrigger>
      <AccordionContent>
        <div class="flex flex-col gap-3">
          <Show when={micMeter()}>
            {(acc) => {
              const meter = acc();
              const STOPS = [-35, -30, -25, -20, -15, -10, -5, 0];
              return (
                <MeterPrimitive.Root
                  value={meter.value}
                  minValue={-40}
                  maxValue={0}
                  getValueLabel={() =>
                    `${roundToDecimals(meter.value, 1).toFixed(1)} dB`
                  }
                  class="flex flex-col gap-0.5 w-full items-center"
                >
                  <div class="relative flex flex-col w-full gap-0.5">
                    <div class="flex font-mono text-xs w-full">
                      <MeterPrimitive.Label>Level</MeterPrimitive.Label>
                      <div class="grow" />
                      <MeterPrimitive.ValueLabel />
                    </div>
                    <MeterPrimitive.Track class="relative w-full h-3">
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
                      <For each={STOPS}>
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
          <Show when={compPeakMeter()}>
            {(acc) => {
              const meter = acc();
              const STOPS = [-20, -15, -10, -5, 0];
              return (
                <MeterPrimitive.Root
                  value={meter.value}
                  minValue={-25}
                  maxValue={0}
                  getValueLabel={() =>
                    `${roundToDecimals(meter.value ?? 0, 1).toFixed(1)} dB`
                  }
                  class="flex flex-col gap-0.5 w-full items-center"
                >
                  <div class="relative flex flex-col w-full gap-0.5">
                    <div class="flex font-mono text-xs w-full">
                      <MeterPrimitive.Label>Compression</MeterPrimitive.Label>
                      <div class="grow" />
                      <MeterPrimitive.ValueLabel />
                    </div>
                    <MeterPrimitive.Track class="relative w-full h-3">
                      <div
                        class="absolute inset-0 border border-transparent rounded-xl bg-linear-to-r/increasing from-red-500 via-yellow-300 via-25% to-blue-500 bg-origin-border"
                        style={{
                          mask: "linear-gradient(black 0 0) padding-box, linear-gradient(black 0 0)",
                          "mask-composite": "exclude",
                        }}
                      />
                      <MeterPrimitive.Fill
                        class="absolute inset-0 rounded-xl bg-linear-to-r/increasing from-red-500 via-yellow-300 via-25% to-blue-500"
                        style={{
                          "will-change": "clip-path",
                          "clip-path":
                            "inset(0 0 0 var(--kb-meter-fill-width))",
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
                      <For each={STOPS}>
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
          <Select
            class="flex flex-col gap-2 select-none"
            value={state.status.radio.micSelection}
            onChange={(value: string) => {
              radio()?.setMicSelection(value);
            }}
            options={micInputList}
            itemComponent={(props) => {
              return (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              );
            }}
          >
            <SelectLabel>TX Input</SelectLabel>
            <SelectTrigger>
              <SelectValue<string>>
                {(state) => state.selectedOption()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function RightSidebar() {
  const { state, radio } = useFlexRadio();

  return (
    <Sidebar
      gap={true}
      side="right"
      variant="floating"
      class="absolute h-full bg-transparent pointer-events-none"
    >
      <Show when={state.selectedPanadapter}>
        <SidebarContent class="size-full gap-0 py-4 overflow-y-auto overflow-x-visible pointer-events-auto">
          <Accordion
            multiple
            collapsible
            defaultValue={[
              "tx",
              "p-cw",
              // "phone",
              // "rx",
              // "eq",
            ]}
            class="w-full select-none"
          >
            <TxSection />
            <PcwSection />
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
