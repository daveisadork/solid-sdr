import type { SliceController } from "@repo/flexlib";
import { createEffect, createSignal, For, Show } from "solid-js";
import { LicenseGate } from "~/components/license-gate";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "~/components/ui/number-field";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "~/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SimpleSwitch } from "~/components/ui/simple-switch";
import { SliderToggle } from "~/components/ui/slider-toggle";
import useFlexRadio, { type SliceState } from "~/context/flexradio";
import { toneValues } from "~/lib/fm-tones";

export const OptDspControls = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  const { radio } = useFlexRadio();
  const [rawRepeaterOffset, setRawRepeaterOffset] = createSignal(0);
  const [tuneToOffset, setTuneToOffset] = createSignal(false);

  createEffect(() => setRawRepeaterOffset(props.slice.fmRepeaterOffsetMHz));

  return (
    <>
      <Show when={props.slice.mode.endsWith("FM")}>
        <Popover>
          <PopoverTrigger>
            <span class="textbox-trim-both textbox-edge-cap-alphabetic">
              OPT
            </span>
          </PopoverTrigger>
          <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
            <PopoverArrow />
            <div class="elative p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
              <SegmentedControl
                value={props.slice.fmToneMode}
                onChange={(value) => {
                  props.controller.setFmToneMode(value);
                }}
              >
                <SegmentedControlLabel>Tone Mode</SegmentedControlLabel>
                <SegmentedControlGroup>
                  <SegmentedControlIndicator />
                  <SegmentedControlItemsList>
                    <For
                      each={[
                        { label: "Off", value: "OFF" },
                        {
                          label: "CTCSS TX",
                          value: "CTCSS_TX",
                        },
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
              <Select
                class="flex flex-col gap-2 select-none"
                value={props.slice.fmToneValue}
                options={toneValues.map((v) => v.hz)}
                onChange={(v) => {
                  if (!v || v === props.slice.fmToneValue) return;
                  props.controller.setFmToneValue(v);
                }}
                itemComponent={(props) => (
                  <SelectItem item={props.item} class="font-mono">
                    {toneValues
                      .find((v) => v.hz === props.item.rawValue)
                      ?.name.replaceAll(" ", "\xA0") || "None"}
                  </SelectItem>
                )}
              >
                <SelectLabel>Tone Value</SelectLabel>
                <SelectTrigger aria-label="FM Tone Value">
                  <SelectValue<string> class="font-mono">
                    {(state) =>
                      toneValues.find((v) => v.hz === state.selectedOption())
                        ?.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
              <SegmentedControl
                value={props.slice.repeaterOffsetDirection}
                onChange={(value) => {
                  props.controller.setRepeaterOffsetDirection(value);
                }}
              >
                <SegmentedControlLabel>Offset Direction</SegmentedControlLabel>
                <SegmentedControlGroup>
                  <SegmentedControlIndicator />
                  <SegmentedControlItemsList>
                    <For each={["DOWN", "SIMPLEX", "UP"]}>
                      {(value) => (
                        <SegmentedControlItem value={value}>
                          <SegmentedControlItemLabel class="capitalize">
                            {value.toLowerCase()}
                          </SegmentedControlItemLabel>
                        </SegmentedControlItem>
                      )}
                    </For>
                  </SegmentedControlItemsList>
                </SegmentedControlGroup>
              </SegmentedControl>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={rawRepeaterOffset()}
                format={false}
                onRawValueChange={setRawRepeaterOffset}
                onFocusOut={() => {
                  if (rawRepeaterOffset() === props.slice.fmRepeaterOffsetMHz)
                    return;
                  props.controller.setFmRepeaterOffsetFrequency(
                    rawRepeaterOffset(),
                  );
                }}
              >
                <NumberFieldLabel class="select-none">
                  Offset MHz
                </NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <SimpleSwitch
                checked={tuneToOffset()}
                onChange={(checked) => {
                  const offset =
                    props.slice.repeaterOffsetDirection === "UP"
                      ? props.slice.fmRepeaterOffsetMHz
                      : props.slice.repeaterOffsetDirection === "DOWN"
                        ? -props.slice.fmRepeaterOffsetMHz
                        : 0;
                  const freq = checked
                    ? props.slice.frequencyMHz + offset
                    : props.slice.frequencyMHz - offset;
                  props.controller.setFrequency(freq);
                  setTuneToOffset(checked);
                }}
                label="Reverse (Tune to Offset Freq)"
              />
            </div>
          </PopoverContent>
        </Popover>
      </Show>
      <Show when={!props.slice.mode.endsWith("FM")}>
        <Popover>
          <PopoverTrigger>
            <span class="textbox-trim-both textbox-edge-cap-alphabetic">
              DSP
            </span>
          </PopoverTrigger>
          <PopoverContent class="overflow-x-visible shadow-black/75 shadow-lg p-0 fancy-bg-popover">
            <PopoverArrow />
            <div class="elative p-4 flex flex-col gap-4 max-h-(--kb-popper-content-available-height) overflow-x-auto">
              <SliderToggle
                disabled={!props.slice.wnbEnabled}
                minValue={0}
                maxValue={100}
                value={[props.slice.wnbLevel]}
                onChange={([value]) => {
                  props.controller.setWnbLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Wideband Noise Blanker (WNB)"
                switchChecked={props.slice.wnbEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setWnbEnabled(isChecked);
                }}
              />
              <SliderToggle
                disabled={!props.slice.nbEnabled}
                minValue={0}
                maxValue={100}
                value={[props.slice.nbLevel]}
                onChange={([value]) => {
                  props.controller.setNbLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Noise Blanker (NB)"
                switchChecked={props.slice.nbEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setNbEnabled(isChecked);
                }}
              />
              <SliderToggle
                disabled={!props.slice.nrEnabled}
                minValue={0}
                maxValue={99}
                value={[props.slice.nrLevel]}
                onChange={([value]) => {
                  props.controller.setNrLevel(value);
                }}
                getValueLabel={(params) => `${params.values[0]}%`}
                label="Noise Reduction (NR)"
                switchChecked={props.slice.nrEnabled}
                onSwitchChange={(isChecked) => {
                  props.controller.setNrEnabled(isChecked);
                }}
              />
              <Show when={radio()?.modelInfo?.platform === "big-bend"}>
                <LicenseGate feature="NOISE_REDUCTION">
                  <SliderToggle
                    disabled={!props.slice.nrsEnabled}
                    minValue={0}
                    maxValue={50}
                    value={[props.slice.nrsLevel]}
                    onChange={([value]) => {
                      props.controller.setNrsLevel(value);
                    }}
                    getValueLabel={(params) => `${params.values[0]}%`}
                    label="Spectral Subtraction (NRS)"
                    switchChecked={props.slice.nrsEnabled}
                    onSwitchChange={(isChecked) => {
                      props.controller.setNrsEnabled(isChecked);
                    }}
                  />
                </LicenseGate>
                <LicenseGate feature="NOISE_REDUCTION">
                  <SimpleSwitch
                    checked={props.slice.nrfEnabled}
                    onChange={(isChecked) => {
                      props.controller.setNrfEnabled(isChecked);
                    }}
                    label="Noise Reduction Filter (NRF)"
                  />
                </LicenseGate>
              </Show>
              <Show when={props.slice.mode !== "CW"}>
                <Show when={radio()?.modelInfo?.platform === "big-bend"}>
                  <LicenseGate feature="NOISE_REDUCTION">
                    <SimpleSwitch
                      checked={props.slice.rnnEnabled}
                      onChange={(isChecked) => {
                        props.controller.setRnnEnabled(isChecked);
                      }}
                      label="AI Noise Reduction (RNN)"
                    />
                  </LicenseGate>
                </Show>
                <SliderToggle
                  disabled={!props.slice.anfEnabled}
                  minValue={0}
                  maxValue={99}
                  value={[props.slice.anfLevel]}
                  onChange={([value]) => {
                    props.controller.setAnfLevel(value);
                  }}
                  getValueLabel={(params) => `${params.values[0]}%`}
                  label="Automatic Notch Filter (ANF)"
                  switchChecked={props.slice.anfEnabled}
                  onSwitchChange={(isChecked) => {
                    props.controller.setAnfEnabled(isChecked);
                  }}
                />
                <LicenseGate feature="NOISE_REDUCTION">
                  <SimpleSwitch
                    checked={props.slice.anftEnabled}
                    onChange={(isChecked) => {
                      props.controller.setAnftEnabled(isChecked);
                    }}
                    label=" FFT Auto Notch Filter (ANFT)"
                  />
                </LicenseGate>
              </Show>
              <Show when={props.slice.mode === "CW"}>
                <SliderToggle
                  disabled={!props.slice.apfEnabled}
                  minValue={0}
                  maxValue={100}
                  value={[props.slice.apfLevel]}
                  onChange={([value]) => {
                    props.controller.setApfLevel(value);
                  }}
                  getValueLabel={(params) => `${params.values[0]}%`}
                  label="Automatic Peaking Filter (APF)"
                  switchChecked={props.slice.apfEnabled}
                  onSwitchChange={(isChecked) => {
                    props.controller.setApfEnabled(isChecked);
                  }}
                />
              </Show>
              <LicenseGate feature="NOISE_REDUCTION">
                <SliderToggle
                  disabled={!props.slice.nrlEnabled}
                  minValue={0}
                  maxValue={100}
                  value={[props.slice.nrlLevel]}
                  onChange={([value]) => {
                    props.controller.setNrlLevel(value);
                  }}
                  getValueLabel={(params) => `${params.values[0]}%`}
                  label="Legacy Noise Reduction (NRL)"
                  switchChecked={props.slice.nrlEnabled}
                  onSwitchChange={(isChecked) => {
                    props.controller.setNrlEnabled(isChecked);
                  }}
                />
              </LicenseGate>
              <Show when={props.slice.mode !== "CW"}>
                <LicenseGate feature="NOISE_REDUCTION">
                  <SliderToggle
                    disabled={!props.slice.anflEnabled}
                    minValue={0}
                    maxValue={100}
                    value={[props.slice.anflLevel]}
                    onChange={([value]) => {
                      props.controller.setAnflLevel(value);
                    }}
                    getValueLabel={(params) => `${params.values[0]}%`}
                    label="Legacy Auto Notch Filter (ANFL)"
                    switchChecked={props.slice.anflEnabled}
                    onSwitchChange={(isChecked) => {
                      props.controller.setAnflEnabled(isChecked);
                    }}
                  />
                </LicenseGate>
              </Show>
            </div>
          </PopoverContent>
        </Popover>
      </Show>
    </>
  );
};
