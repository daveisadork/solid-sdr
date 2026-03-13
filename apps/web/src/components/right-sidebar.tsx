import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

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
import { dbmToWatts, roundToDecimals } from "~/lib/utils";
import { debounce } from "@solid-primitives/scheduled";
import { SimpleMeter } from "./ui/simple-meter";
import { SliderToggle } from "./ui/slider-toggle";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
} from "./ui/segmented-control";
import { usePreferences } from "~/context/preferences";

const PROCESSOR_LEVELS = ["Norm", "DX", "DX+"];

function TxSection() {
  const { state, radio } = useFlexRadio();
  const [txProfiles, setTxProfiles] = createStore<string[]>([]);
  const [rawRfPower, setRawRfPower] = createSignal(0);

  const setRfPower = (value: number) => {
    if (value !== state.status.radio.rfPower) {
      radio()?.setRfPower(value);
    }
  };

  const debouncedSetRfPower = debounce(setRfPower, 200);

  createEffect(() => setRawRfPower(state.status.radio.rfPower));

  createEffect(() => {
    if (rawRfPower() === state.status.radio.rfPower) return;
    const updateFunc =
      state.status.radio.interlockState === "TRANSMITTING"
        ? setRfPower
        : debouncedSetRfPower;
    updateFunc(rawRfPower());
  });

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
        <div class="text-sm flex flex-col gap-3 overflow-visible">
          <Show when={fwdPwrMeter()}>
            {(acc) => {
              const meter = acc();
              return (
                <SimpleMeter
                  meter={meter}
                  maxValue={state.status.radio.maxInternalPaPowerWatts * 1.2}
                  value={
                    state.status.radio.interlockTxClientHandle ===
                    state.clientHandleInt
                      ? dbmToWatts(meter.value, 0)
                      : 0
                  }
                  getValueLabel={({ value }) => `${value} W`}
                  label="RF Power"
                  showTicks
                  showTickLabels
                  containTickLabels
                  tickLabelFilter={({ index }) => index % 2 === 0}
                />
              );
            }}
          </Show>
          <Show when={refPwrMeter()}>
            {(acc) => {
              const meter = acc();
              return (
                <SimpleMeter
                  meter={meter}
                  minValue={1}
                  maxValue={3}
                  value={
                    state.status.radio.interlockTxClientHandle ===
                    state.clientHandleInt
                      ? swr()
                      : 1
                  }
                  getValueLabel={() => {
                    // We don't use the passed in value because it's clamped to the maxValue,
                    // and we want to show the actual SWR even if it exceeds the max.
                    return `${(Math.round(swr() * 10) / 10).toFixed(1)}:1`;
                  }}
                  label="RF SWR"
                  showTicks
                  showTickLabels
                  containTickLabels
                  tickLabelFilter={({ index }) => index % 2 === 0}
                />
              );
            }}
          </Show>
          <SimpleSlider
            minValue={0}
            maxValue={100}
            step={1}
            value={[rawRfPower()]}
            disabled={!state.status.radio.txRfPowerChangesAllowed}
            onChange={([value]) => setRawRfPower(value)}
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
            step={1}
            value={[state.status.radio.tunePower]}
            disabled={!state.status.radio.txRfPowerChangesAllowed}
            onChange={([value]) => {
              if (value !== state.status.radio.tunePower) {
                radio()?.setTunePower(value);
              }
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
              if (!value) return;
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
            checked={state.status.radio.mox}
            disabled={!state.status.radio.txAllowed}
            onChange={(isChecked) => {
              radio()?.setMox(isChecked);
            }}
            label="MOX"
            tooltip="Key and unkey the transmitter (Manually Operated Transmit)"
          />
          <SimpleSwitch
            checked={state.status.radio.txTune}
            disabled={!state.status.radio.txAllowed}
            onChange={(isChecked) => {
              radio()?.setTxTune(isChecked);
            }}
            label="Tune"
            tooltip="Transmit a carrier for tuning"
          />
          {/* <SimpleSwitch */}
          {/*   checked={state.status.radio.tuneMode === "two_tone"} */}
          {/*   onChange={(isChecked) => { */}
          {/*     radio()?.setTuneMode(isChecked ? "two_tone" : "single_tone"); */}
          {/*   }} */}
          {/*   label="Two-Tone Tune" */}
          {/* /> */}
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
              tooltip="Bypass or engage the Automatic Tuning Unit (ATU)"
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
            tooltip="Enable memories for the ATU."
          />
          <SimpleSwitch
            checked={state.status.apd.enabled}
            disabled={!state.status.apd.configurable}
            onChange={(isChecked) => {
              radio()?.apd().setEnabled(isChecked);
            }}
            label={`APD ${state.status.apd.enabled && !state.status.apd.equalizerActive ? "(Calibrating)" : ""}`}
            tooltip="Toggle SmartSignal (Adaptive Pre-Distortion)"
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function PcwSection() {
  const { state, radio } = useFlexRadio();
  const [micInputList, setMicInputList] = createStore<string[]>([]);
  const [micProfileList, setMicProfileList] = createStore<string[]>([]);

  createEffect(() => setMicInputList(state?.status?.radio?.micInputList ?? []));
  createEffect(() =>
    setMicProfileList(state?.status?.radio?.profileMicList ?? []),
  );

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
              return (
                <SimpleMeter
                  meter={meter}
                  minValue={-40}
                  maxValue={0}
                  getValueLabel={() =>
                    `${roundToDecimals(meter.value, 1).toFixed(1)} dB`
                  }
                  label="Level"
                  showTicks
                  showTickLabels
                  containTickLabels
                  tickLabelFilter={({ index }) => index % 2 === 0}
                />
              );
            }}
          </Show>
          <Show when={compPeakMeter()}>
            {(acc) => {
              const meter = acc();
              return (
                <SimpleMeter
                  meter={meter}
                  // this meter is a little different in that it shows the amount of gain reduction
                  // being applied by the compressor, with the meter filling from the right instead of the left.
                  // the radio won't send a null value, instead doing something like value ?? meter.low, when
                  // in this case we'd rather have meter.high. so we do a small hack.
                  value={meter.value > meter.low ? meter.value : 0}
                  minValue={-25}
                  maxValue={0}
                  getValueLabel={({ value }) =>
                    `${roundToDecimals(value, 1).toFixed(1)} dB`
                  }
                  label="Compression"
                  class="bg-linear-to-l/decreasing"
                  style={{
                    "clip-path": "inset(0 0 0 var(--kb-meter-fill-width))",
                  }}
                  showTicks
                  showTickLabels
                  minStops={5}
                  containTickLabels
                />
              );
            }}
          </Show>
          <Select
            class="flex flex-col gap-2 select-none"
            value={state.status.radio.profileMicSelection}
            onChange={(value: string) => {
              if (!value) return;
              radio()?.loadMicProfile(value);
            }}
            options={micProfileList}
            itemComponent={(props) => {
              return (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              );
            }}
          >
            <SelectLabel>Mic Profile</SelectLabel>
            <SelectTrigger>
              <SelectValue<string>>
                {(state) => state.selectedOption()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <Select
            class="flex flex-col gap-2 select-none"
            value={state.status.radio.micSelection}
            onChange={(value: string) => {
              if (!value) return;
              radio()?.setMicSelection(value);
            }}
            options={micInputList}
            itemComponent={(props) => {
              return (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              );
            }}
          >
            <SelectLabel>AF Input Source</SelectLabel>
            <SelectTrigger>
              <SelectValue<string>>
                {(state) => state.selectedOption()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <SimpleSwitch
            checked={state.status.radio.micAccessoryEnabled}
            onChange={(isChecked) => {
              radio()?.setMicAccessoryEnabled(isChecked);
            }}
            label="Mic Accessory"
            // tooltip="Enable audio input on Accessory Connector"
          />
          <SimpleSwitch
            checked={state.status.radio.daxEnabled}
            onChange={(isChecked) => {
              radio()?.setDaxEnabled(isChecked);
            }}
            label="DAX"
            // tooltip="Use DAX as primary transmit audio source"
          />
          <SimpleSlider
            minValue={0}
            maxValue={100}
            value={[state.status.radio.micLevel]}
            onChange={([value]) => {
              if (value === state.status.radio.micLevel) return;
              radio()?.setMicLevel(value);
            }}
            getValueLabel={(params) => `${params.values[0]}%`}
            label="Mic Level"
          />
          <div class="flex flex-col gap-1 pb-2">
            <SimpleSwitch
              label="Speech Processor"
              checked={state.status.radio.speechProcessorEnabled}
              onChange={(isChecked) => {
                radio()?.setSpeechProcessorEnabled(isChecked);
              }}
              // tooltip="Enable processing for TX output in phone modes"
            />
            <SegmentedControl
              disabled={!state.status.radio.speechProcessorEnabled}
              value={PROCESSOR_LEVELS[state.status.radio.speechProcessorLevel]}
              onChange={(value) => {
                if (!value) return;
                radio()?.setSpeechProcessorLevel(
                  PROCESSOR_LEVELS.indexOf(value),
                );
              }}
            >
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={PROCESSOR_LEVELS}>
                    {(level) => (
                      <SegmentedControlItem value={level}>
                        <SegmentedControlItemLabel>
                          {level}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
          </div>
          <SliderToggle
            label="TX Monitor"
            switchDisabled={!state.status.radio.txMonitorAvailable}
            switchChecked={state.status.radio.txMonitorEnabled}
            onSwitchChange={(isChecked) => {
              radio()?.setTxMonitorEnabled(isChecked);
            }}
            minValue={0}
            maxValue={100}
            value={[state.status.radio.txSbMonitorGain]}
            onChange={([value]) => {
              if (value === state.status.radio.txSbMonitorGain) return;
              radio()?.setTxSbMonitorGain(value);
            }}
            getValueLabel={(params) => `${params.values[0]}%`}
            // tooltip="Monitor transmitted signal (PC mic input cannot be monitored)"
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function RightSidebar() {
  const { state, radio } = useFlexRadio();
  const { preferences } = usePreferences();

  return (
    <Sidebar
      gap
      side="right"
      variant={preferences.enableTransparencyEffects ? "floating" : "sidebar"}
      class="absolute h-full bg-transparent pointer-events-none z-50"
    >
      <SidebarContent
        class="gap-0 my-4 overflow-y-auto overflow-x-hidden pointer-events-auto"
        style={{
          "scrollbar-gutter": "stable",
          "scrollbar-width": "thin",
        }}
      >
        <Accordion
          multiple
          collapsible
          defaultValue={[
            "tx",
            "p-cw",
            // "phone",
            "rx",
            // "eq"
          ]}
          class="select-none"
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
    </Sidebar>
  );
}
