import type { SliceController } from "@repo/flexlib";
import { For, Show } from "solid-js";
import { LicenseGate } from "~/components/license-gate";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "~/components/ui/segmented-control";
import { SimpleSlider } from "~/components/ui/simple-slider";
import { SimpleSwitch } from "~/components/ui/simple-switch";
import { SliderToggle } from "~/components/ui/slider-toggle";
import type { SliceState } from "~/context/flexradio";
import { degToRad, radToDeg } from "~/lib/utils";
import MaterialSymbolsVolumeOff from "~icons/material-symbols/volume-off";
import MaterialSymbolsVolumeUp from "~icons/material-symbols/volume-up";
import { SlicePopoverContent } from "./slice-popover-content";
import {
  Slider,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from "~/components/ui/slider";
import { Switch, SwitchControl, SwitchThumb } from "~/components/ui/switch";

export const AudioControls = (props: {
  slice: SliceState;
  controller: SliceController;
}) => {
  return (
    <Popover>
      <PopoverTrigger
        onContextMenu={(e) => {
          e.preventDefault();
          props.controller.setMute(!props.slice.isMuted);
        }}
      >
        <Show when={props.slice.isMuted} fallback={<MaterialSymbolsVolumeUp />}>
          <MaterialSymbolsVolumeOff />
        </Show>
      </PopoverTrigger>
      <SlicePopoverContent>
        <SimpleSwitch
          checked={props.slice.isMuted}
          onChange={(isChecked) => {
            props.controller.setMute(isChecked);
          }}
          label="Audio Mute"
        />
        <SimpleSlider
          minValue={0}
          maxValue={100}
          value={[props.slice.audioGain]}
          onChange={([value]) => {
            props.controller.setAudioGain(value);
          }}
          getValueLabel={(params) => `${params.values[0]}%`}
          label="Audio Level"
        />
        <SimpleSlider
          label="Audio Pan"
          minValue={0}
          maxValue={100}
          value={[props.slice.audioPan]}
          onChange={([value]) => {
            props.controller.setAudioPan(value);
          }}
          getValueLabel={(params) => {
            const value = params.values[0] - 50;
            if (value === 0) return "Center";
            return value < 0 ? `L${-value}` : `R${value}`;
          }}
          fromCenter
        />
        <SegmentedControl
          value={props.slice.agcMode}
          onChange={(value) => {
            props.controller.setAgcMode(value);
          }}
        >
          <SegmentedControlLabel>AGC Mode</SegmentedControlLabel>
          <SegmentedControlGroup>
            <SegmentedControlIndicator />
            <SegmentedControlItemsList>
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
          class="space-y-0"
          disabled={props.slice.agcMode === "off"}
          minValue={0}
          maxValue={100}
          value={[props.slice.agcThreshold]}
          onChange={([threshold]) => {
            props.controller.setAgcSettings({
              threshold,
            });
          }}
          getValueLabel={(params) =>
            props.slice.agcThresholdMode === "auto"
              ? "Auto"
              : `${params.values[0]}%`
          }
        >
          <div class="flex w-full justify-between">
            <SliderLabel>AGC Threshold</SliderLabel>
            <SliderValueLabel />
          </div>
          <div class="flex w-full items-center justify-between space-x-2">
            <SliderTrack>
              <SliderFill />
              <SliderThumb />
            </SliderTrack>
            <LicenseGate feature="AUTO_AGC_T">
              <Switch
                class="h-auto flex items-center origin-right scale-75"
                checked={props.slice.agcThresholdMode === "auto"}
                onChange={(isChecked) => {
                  props.controller.setAgcThresholdMode(
                    isChecked ? "auto" : "manual",
                  );
                }}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
              </Switch>
            </LicenseGate>
          </div>
        </Slider>
        <Show
          when={
            !["DIGU", "DIGL", "CW", "RTTY", "FDVL", "FDVU"].includes(
              props.slice.mode,
            )
          }
        >
          <SliderToggle
            disabled={!props.slice.squelchEnabled}
            minValue={0}
            maxValue={100}
            value={[props.slice.squelchLevel]}
            onChange={([value]) => {
              props.controller.setSquelchLevel(value);
            }}
            getValueLabel={(params) => `${params.values[0]}%`}
            label="Squelch"
            switchChecked={props.slice.squelchEnabled}
            onSwitchChange={(isChecked) => {
              props.controller.setSquelchEnabled(isChecked);
            }}
          />
        </Show>
        <SimpleSwitch
          checked={props.slice.diversityEnabled}
          disabled={props.slice.diversityChild}
          onChange={(isChecked) => {
            props.controller.setDiversityEnabled(isChecked);
          }}
          label="Diversity Reception"
        />
        <Show when={props.slice.diversityParent}>
          <LicenseGate feature="DIV_ESC">
            <SimpleSwitch
              checked={props.slice.escEnabled}
              disabled={props.slice.diversityChild}
              onChange={(isChecked) => {
                props.controller.setEscEnabled(isChecked);
              }}
              label="Enhanced Signal Clarity (ESC)"
            />
          </LicenseGate>
          <LicenseGate feature="DIV_ESC">
            <SimpleSlider
              disabled={!props.slice.escEnabled}
              value={[props.slice.escGain]}
              minValue={0.01}
              maxValue={2.0}
              step={0.01}
              onChange={([value]) => {
                if (value === props.slice.escGain) return;
                props.controller.setEscGain(value).catch(console.log);
              }}
              getValueLabel={(params) => `${params.values[0]}`}
              label="ESC Gain"
            />
          </LicenseGate>
          <LicenseGate feature="DIV_ESC">
            <SimpleSlider
              disabled={!props.slice.escEnabled}
              minValue={0}
              maxValue={360}
              value={[Math.round(radToDeg(props.slice.escPhaseShift))]}
              onChange={([value]) => {
                const rad = degToRad(value);
                if (rad === props.slice.escPhaseShift) return;
                props.controller.setEscPhaseShift(rad).catch(console.log);
              }}
              getValueLabel={(params) => `${params.values[0]}°`}
              label="ESC Phase Shift"
            />
          </LicenseGate>
        </Show>
      </SlicePopoverContent>
    </Popover>
  );
};
