import { usePreferences } from "../../context/preferences";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogTrigger,
} from "../ui/dialog";
import MdiSettings from "~icons/mdi/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  SegmentedControl,
  SegmentedControlGroup,
  SegmentedControlIndicator,
  SegmentedControlItem,
  SegmentedControlItemLabel,
  SegmentedControlItemsList,
  SegmentedControlLabel,
} from "../ui/segmented-control";
import { createEffect, createSignal, For, Show } from "solid-js";
import useFlexRadio from "~/context/flexradio";
import type { Radio } from "@repo/flexlib";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/text-field";
import { SimpleSlider } from "../ui/simple-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { createStore } from "solid-js/store";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "../ui/number-field";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Checkbox } from "../ui/checkbox";
import * as NumberFieldPrimitive from "@kobalte/core/number-field";
import { ProgressCircle } from "../ui/progress-circle";
import MaterialSymbolsProgressActivity from "~icons/material-symbols/progress-activity";
import { RadioOscillatorSetting } from "@repo/flexlib";
import { SliderToggle } from "../ui/slider-toggle";

function InfoItem(props: { label: string; value: string }) {
  return (
    <div class="flex">
      <div class="grow">{props.label}:</div>
      <span>{props.value}</span>
    </div>
  );
}

function TxBandSettings(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const [txProfiles, setTxProfiles] = createStore<string[]>([]);
  createEffect(() => setTxProfiles(state?.status?.radio?.profileTxList ?? []));

  return (
    <Dialog>
      <DialogTrigger as={Button}>TX Band Settings</DialogTrigger>
      <DialogContent class="max-w-screen sm:max-w-screen w-auto overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>TX Band Settings</DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 overflow-hidden shrink">
          <Select
            class="flex flex-col gap-2 select-none"
            value={state.status.radio.profileTxSelection}
            onChange={(value: string) => {
              if (!value) return;
              props.radio.loadTxProfile(value);
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
          <Table class="overflow-auto shrink">
            <TableHeader>
              <TableRow>
                <TableHead>Band</TableHead>
                <TableHead>RF PWR(%)</TableHead>
                <TableHead>Tune PWR(%)</TableHead>
                <TableHead>PTT Inhibit</TableHead>
                <TableHead>ACC TX</TableHead>
                <TableHead>RCA TX Req</TableHead>
                <TableHead>ACC TX Req</TableHead>
                <TableHead>RCA TX1</TableHead>
                <TableHead>RCA TX2</TableHead>
                <TableHead>RCA TX3</TableHead>
                <TableHead>HW ALC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={Object.values(state.status.txBandSetting)}>
                {(bandSettings) => {
                  const ctrl = props.radio.txBandSetting(bandSettings.id);
                  return (
                    <TableRow>
                      <TableCell class="font-bold">
                        {bandSettings.bandName}
                      </TableCell>
                      <TableCell>
                        <NumberFieldPrimitive.Root
                          rawValue={bandSettings.rfPower}
                          onRawValueChange={(value) => ctrl.setRfPower(value)}
                          minValue={0}
                          maxValue={100}
                          changeOnWheel={false}
                        >
                          <NumberFieldPrimitive.Input size={4} />
                        </NumberFieldPrimitive.Root>
                      </TableCell>
                      <TableCell>
                        <NumberFieldPrimitive.Root
                          rawValue={bandSettings.tunePower}
                          onRawValueChange={(value) => ctrl.setTunePower(value)}
                          minValue={0}
                          maxValue={100}
                          changeOnWheel={false}
                        >
                          <NumberFieldPrimitive.Input size={4} />
                        </NumberFieldPrimitive.Root>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.pttInhibit}
                          onChange={(checked) => ctrl.setPttInhibit(checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.accTxEnabled}
                          onChange={(checked) => ctrl.setAccTxEnabled(checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.rcaTxReqEnabled}
                          onChange={(checked) =>
                            ctrl.setRcaTxReqEnabled(checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.accTxReqEnabled}
                          onChange={(checked) =>
                            ctrl.setAccTxReqEnabled(checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.rcaTx1Enabled}
                          onChange={(checked) => ctrl.setRcaTx1Enabled(checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.rcaTx2Enabled}
                          onChange={(checked) => ctrl.setRcaTx2Enabled(checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.rcaTx3Enabled}
                          onChange={(checked) => ctrl.setRcaTx3Enabled(checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={bandSettings.hwAlcEnabled}
                          onChange={(checked) => ctrl.setHwAlcEnabled(checked)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }}
              </For>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RadioSettingsInner(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const [nickname, setNickname] = createSignal(state.status.radio.nickname);
  const [callsign, setCallsign] = createSignal(state.status.radio.callsign);
  const [txProfiles, setTxProfiles] = createStore<string[]>([]);

  createEffect(() => setNickname(state.status.radio.nickname));
  createEffect(() => setCallsign(state.status.radio.callsign));
  createEffect(() => setTxProfiles(state?.status?.radio?.profileTxList ?? []));

  return (
    <div class="flex flex-col gap-4">
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>Radio Information</CardTitle>
          </CardHeader>
          <div class="flex flex-col gap-4">
            <InfoItem label="Model" value={state.status.radio.model} />
            <InfoItem label="Serial Number" value={state.status.radio.serial} />
            <InfoItem
              label="Hardware Version"
              value={state.status.radio.version}
            />
            <InfoItem label="Options" value={state.status.radio.radioOptions} />
            <InfoItem label="Region" value={state.status.radio.region} />
            <SimpleSwitch
              checked={state.status.radio.remoteOnEnabled}
              onChange={(isChecked) =>
                props.radio.setRemoteOnEnabled(isChecked)
              }
              label="Remote On"
            />
            <SimpleSwitch
              checked={state.status.radio.mfEnabled}
              onChange={(isChecked) => props.radio.setMfEnabled(isChecked)}
              label="multiFLEX"
            />
            <TextField
              value={nickname()}
              onChange={setNickname}
              class="flex flex-col gap-2"
            >
              <TextFieldLabel>Nickname</TextFieldLabel>
              <TextFieldInput
                onBlur={() => props.radio.setNickname(nickname())}
              />
            </TextField>
            <TextField
              value={callsign()}
              onChange={setCallsign}
              class="flex flex-col gap-2"
            >
              <TextFieldLabel>Callsign</TextFieldLabel>
              <TextFieldInput
                onBlur={() => props.radio.setCallsign(callsign())}
              />
            </TextField>
            <SimpleSlider
              minValue={0}
              maxValue={100}
              value={[state.status.radio.backlightLevel]}
              onChange={([value]) => props.radio.setBacklightLevel(value)}
              getValueLabel={({ values }) => {
                return `${values[0]}%`;
              }}
              label="Backlight Brightness"
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>License Information</CardTitle>
          </CardHeader>
          <div class="flex flex-col gap-4">
            <For
              each={Object.values(state.status.featureLicense.subscriptions)}
            >
              {({ name, expiration }) => {
                return (
                  <>
                    <InfoItem label="Subscription" value={name} />
                    <InfoItem
                      label="Expiration"
                      value={expiration.toLocaleDateString()}
                    />
                  </>
                );
              }}
            </For>
            <InfoItem
              label="Radio ID"
              value={state.status.featureLicense.radioId}
            />
            <InfoItem
              label="Licensed Version"
              value={`v${state.status.featureLicense.highestMajorVersion}.x`}
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>Network</CardTitle>
          </CardHeader>
          <div class="flex flex-col gap-4">
            <InfoItem label="IP Address" value={state.status.radio.ipAddress} />
            <InfoItem label="Subnet Mask" value={state.status.radio.netmask} />
            <InfoItem
              label="MAC Address"
              value={state.status.radio.macAddress}
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>GPS</CardTitle>
          </CardHeader>
          <Show when={state.status.radio.gpsInstalled} fallback="Not Installed">
            <div class="flex flex-col gap-4">
              <InfoItem
                label="Latitude"
                value={state.status.radio.gpsLatitude.toString()}
              />
              <InfoItem
                label="Longitude"
                value={state.status.radio.gpsLongitude.toString()}
              />
              <InfoItem
                label="Grid Square"
                value={state.status.radio.gpsGrid}
              />
              <InfoItem
                label="Altitude"
                value={state.status.radio.gpsAltitude}
              />
              <InfoItem
                label="Satellites Tracked"
                value={state.status.radio.gpsSatellitesTracked.toString()}
              />
              <InfoItem
                label="Satellites Visible"
                value={state.status.radio.gpsSatellitesVisible.toString()}
              />
              <InfoItem label="Speed" value={state.status.radio.gpsSpeed} />
              <InfoItem
                label="Frequency Error"
                value={state.status.radio.gpsFreqError}
              />
              <InfoItem label="Status" value={state.status.radio.gpsStatus} />
              <InfoItem
                label="UTC Time"
                value={state.status.radio.gpsUtcTime}
              />
            </div>
          </Show>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>TX Timings</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <Select
              class="flex flex-col gap-2 select-none"
              value={state.status.radio.profileTxSelection}
              onChange={(value: string) => {
                if (!value) return;
                props.radio.loadTxProfile(value);
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
            <div class="grid grid-cols-2 gap-4">
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={state.status.radio.interlockAccTxDelayMs}
                format={false}
                minValue={0}
                maxValue={2000}
                onRawValueChange={(value) => {
                  if (value === state.status.radio.interlockAccTxDelayMs)
                    return;
                  props.radio.setAccTxDelayMs(value);
                }}
              >
                <NumberFieldLabel class="select-none">ACC TX</NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={state.status.radio.interlockTx1DelayMs}
                format={false}
                minValue={0}
                maxValue={2000}
                onRawValueChange={(value) => {
                  if (value === state.status.radio.interlockTx1DelayMs) return;
                  props.radio.setTx1DelayMs(value);
                }}
              >
                <NumberFieldLabel class="select-none">RCA TX1</NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={state.status.radio.interlockTx2DelayMs}
                format={false}
                minValue={0}
                maxValue={2000}
                onRawValueChange={(value) => {
                  if (value === state.status.radio.interlockTx2DelayMs) return;
                  props.radio.setTx2DelayMs(value);
                }}
              >
                <NumberFieldLabel class="select-none">RCA TX2</NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={state.status.radio.interlockTx3DelayMs}
                format={false}
                minValue={0}
                maxValue={2000}
                onRawValueChange={(value) => {
                  if (value === state.status.radio.interlockTx3DelayMs) return;
                  props.radio.setTx3DelayMs(value);
                }}
              >
                <NumberFieldLabel class="select-none">RCA TX3</NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={state.status.radio.interlockTxDelayMs}
                format={false}
                minValue={0}
                maxValue={2000}
                onRawValueChange={(value) => {
                  if (value === state.status.radio.interlockTxDelayMs) return;
                  props.radio.setTxDelayMs(value);
                }}
              >
                <NumberFieldLabel class="select-none">
                  TX Delay
                </NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <NumberField
                class="flex flex-col gap-2 select-none"
                rawValue={state.status.radio.interlockTimeoutMs / 60_000}
                format={false}
                minValue={0}
                maxValue={2000}
                onRawValueChange={(valueMin) => {
                  const valueMs = valueMin * 60_000;
                  if (valueMs === state.status.radio.interlockTimeoutMs) return;
                  props.radio.setInterlockTimeoutMs(valueMs);
                }}
              >
                <NumberFieldLabel class="select-none">
                  Timeout (minutes)
                </NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
            </div>
            <TxBandSettings radio={props.radio} />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>Interlocks</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <SegmentedControl
              value={
                state.status.radio.interlockRcaTxReqPolarityHigh
                  ? "high"
                  : "low"
              }
              onChange={(value) => {
                if (!value) return;
                props.radio.setTxReqRcaPolarityHigh(value === "high");
              }}
            >
              <SegmentedControlLabel>RCA TX Req</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["low", "high"]}>
                    {(polarity) => (
                      <SegmentedControlItem value={polarity}>
                        <SegmentedControlItemLabel class="capitalize">
                          Active {polarity}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SegmentedControl
              value={
                state.status.radio.interlockAccTxReqPolarityHigh
                  ? "high"
                  : "low"
              }
              onChange={(value) => {
                if (!value) return;
                props.radio.setTxReqAccPolarityHigh(value === "high");
              }}
            >
              <SegmentedControlLabel>Accessory TX Req</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["low", "high"]}>
                    {(polarity) => (
                      <SegmentedControlItem value={polarity}>
                        <SegmentedControlItemLabel class="capitalize">
                          Active {polarity}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>TX Misc</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <SimpleSlider
              minValue={0}
              maxValue={100}
              value={[state.status.radio.maxPowerLevel]}
              onChange={([value]) => {
                if (value === state.status.radio.maxPowerLevel) return;
                props.radio.setMaxPowerLevel(value);
              }}
              getValueLabel={(params) => `${params.values[0]}%`}
              label="Max Power"
            />
            <SegmentedControl
              value={state.status.radio.tuneMode}
              onChange={(value: "single_tone" | "two_tone") => {
                if (!value) return;
                props.radio.setTuneMode(value);
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
                          {mode.replace("_", " ")}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SimpleSwitch
              checked={state.status.radio.showTxInWaterfall}
              onChange={(isChecked) => {
                props.radio.setShowTxInWaterfall(isChecked);
              }}
              label="Show TX in Waterfall"
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>Microphone</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <SimpleSwitch
              checked={state.status.radio.micBias}
              onChange={(isChecked) => {
                props.radio.setMicBias(isChecked);
              }}
              label="Enable Mic Bias Voltage"
            />
            <SimpleSwitch
              checked={state.status.radio.micBoost}
              onChange={(isChecked) => {
                props.radio.setMicBoost(isChecked);
              }}
              label="Enable +20dB Mic Preamp Boost"
            />
            <SimpleSwitch
              checked={state.status.radio.meterInRx}
              onChange={(isChecked) => {
                props.radio.setMeterInRxEnabled(isChecked);
              }}
              label="Enable Level Meter During Receive"
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>CW</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <SimpleSwitch
              checked={state.status.radio.cwIambic}
              onChange={(isChecked) => {
                props.radio.setCwIambic(isChecked);
              }}
              label="Iambic"
            />

            <SegmentedControl
              value={state.status.radio.cwIambicMode}
              onChange={(value: "a" | "b") => {
                if (!value) return;
                props.radio.setCwIambicMode(value);
              }}
            >
              <SegmentedControlLabel>Iambic Mode</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["a", "b"]}>
                    {(mode) => (
                      <SegmentedControlItem value={mode}>
                        <SegmentedControlItemLabel class="capitalize">
                          Mode {mode.replace("_", " ")}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SegmentedControl
              value={state.status.radio.cwLeftEnabled ? "cwl" : "cwu"}
              onChange={(value) => {
                if (!value) return;
                props.radio.setCwLeftEnabled(value === "cwl");
              }}
            >
              <SegmentedControlLabel>Sideband</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["cwu", "cwl"]}>
                    {(sideband) => (
                      <SegmentedControlItem value={sideband}>
                        <SegmentedControlItemLabel class="uppercase">
                          {sideband}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <SimpleSwitch
              checked={state.status.radio.cwSwapPaddles}
              onChange={(isChecked) => {
                props.radio.setCwSwapPaddles(isChecked);
              }}
              label="Swap Dot/Dash"
            />
            <SimpleSwitch
              checked={state.status.radio.syncCwx}
              onChange={(isChecked) => {
                props.radio.setSyncCwx(isChecked);
              }}
              label="CWX Sync"
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>Digital</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <NumberField
              class="flex flex-col gap-2 select-none"
              rawValue={state.status.radio.rttyMarkDefaultHz}
              format={false}
              minValue={0}
              maxValue={4000}
              onRawValueChange={(value) => {
                if (value === state.status.radio.rttyMarkDefaultHz) return;
                props.radio.setRttyMarkDefaultHz(value);
              }}
            >
              <NumberFieldLabel class="select-none">
                RTTY Mark Default Hz
              </NumberFieldLabel>
              <NumberFieldGroup class="select-none">
                <NumberFieldInput />
                <NumberFieldIncrementTrigger class="select-none" />
                <NumberFieldDecrementTrigger class="select-none" />
              </NumberFieldGroup>
            </NumberField>
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>Frequency Offset</CardTitle>
          </CardHeader>

          <Show
            when={state.status.radio.oscillatorState !== "gpsdo"}
            fallback="Disabled when using GPSDO"
          >
            <div class="flex flex-col gap-4">
              <NumberField
                class="flex flex-col gap-2 select-none"
                disabled={!state.status.radio.pllDone}
                rawValue={state.status.radio.calibrationFrequencyMhz}
                format={false}
                minValue={0}
                maxValue={55}
                onRawValueChange={(value) => {
                  if (value === state.status.radio.calibrationFrequencyMhz)
                    return;
                  props.radio.setCalibrationFrequencyMhz(value);
                }}
              >
                <NumberFieldLabel class="select-none">
                  Calibration Frequency MHz
                </NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <NumberField
                class="flex flex-col gap-2 select-none"
                disabled={!state.status.radio.pllDone}
                rawValue={state.status.radio.frequencyErrorPpb}
                format={false}
                onRawValueChange={(value) => {
                  if (value === state.status.radio.frequencyErrorPpb) return;
                  props.radio.setFrequencyErrorPpb(value);
                }}
              >
                <NumberFieldLabel class="select-none">
                  Offset PPB
                </NumberFieldLabel>
                <NumberFieldGroup class="select-none">
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger class="select-none" />
                  <NumberFieldDecrementTrigger class="select-none" />
                </NumberFieldGroup>
              </NumberField>
              <Button
                onClick={() => props.radio.startOffsetCalibration()}
                disabled={!state.status.radio.pllDone}
              >
                <Show
                  when={!state.status.radio.pllDone}
                  fallback="Start Calibration"
                >
                  <MaterialSymbolsProgressActivity class="animate-spin" />
                  Calibrating
                </Show>
              </Button>
            </div>
          </Show>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>10 MHz Reference</CardTitle>
          </CardHeader>
          <div class="flex flex-col gap-4">
            <SegmentedControl
              value={state.status.radio.oscillatorSetting}
              onChange={(value: RadioOscillatorSetting) => {
                if (!value) return;
                props.radio.setOscillatorSetting(value);
              }}
            >
              <SegmentedControlLabel>Source</SegmentedControlLabel>
              <SegmentedControlGroup>
                <SegmentedControlIndicator />
                <SegmentedControlItemsList>
                  <For each={["Auto", "External", "GPSDO", "TCXO"]}>
                    {(source) => (
                      <SegmentedControlItem value={source.toLowerCase()}>
                        <SegmentedControlItemLabel>
                          {source}
                        </SegmentedControlItemLabel>
                      </SegmentedControlItem>
                    )}
                  </For>
                </SegmentedControlItemsList>
              </SegmentedControlGroup>
            </SegmentedControl>
            <InfoItem
              label="State"
              value={`${{ external: "External", gpsdo: "GPSDO", tcxo: "TCXO" }[state.status.radio.oscillatorState]} ${state.status.radio.oscillatorLocked ? "Locked" : "Searching..."}`}
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>RX Misc</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <SimpleSwitch
              checked={state.status.radio.muteLocalAudioWhenRemote}
              onChange={(isChecked) => {
                props.radio.setMuteLocalAudioWhenRemote(isChecked);
              }}
              label="Mute Local Audio When Remote"
            />
            <SimpleSwitch
              checked={state.status.radio.binauralRx}
              onChange={(isChecked) => {
                props.radio.setBinauralRx(isChecked);
              }}
              label="Binaural Audio"
            />
          </div>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardContent class="text-sm select-none">
          <CardHeader class="px-0">
            <CardTitle>Filter Options</CardTitle>
          </CardHeader>

          <div class="flex flex-col gap-4">
            <SliderToggle
              label="Voice Sharpness"
              switchChecked={state.status.radio.filterSharpnessVoiceAuto}
              disabled={state.status.radio.filterSharpnessVoiceAuto}
              onSwitchChange={(isChecked) => {
                props.radio.setFilterSharpnessAutoLevel("voice", isChecked);
              }}
              minValue={0}
              maxValue={3}
              value={[state.status.radio.filterSharpnessVoice]}
              onChange={([value]) => {
                if (value === state.status.radio.filterSharpnessVoice) return;
                props.radio.setFilterSharpnessLevel("voice", value);
              }}
              getValueLabel={(params) =>
                state.status.radio.filterSharpnessVoiceAuto
                  ? "Auto"
                  : ["Lowest Latency", "Lower Latency", "Sharper", "Sharpest"][
                      params.values[0]
                    ]
              }
            />
            <SliderToggle
              label="CW Sharpness"
              switchChecked={state.status.radio.filterSharpnessCwAuto}
              disabled={state.status.radio.filterSharpnessCwAuto}
              onSwitchChange={(isChecked) => {
                props.radio.setFilterSharpnessAutoLevel("cw", isChecked);
              }}
              minValue={0}
              maxValue={3}
              value={[state.status.radio.filterSharpnessCw]}
              onChange={([value]) => {
                if (value === state.status.radio.filterSharpnessCw) return;
                props.radio.setFilterSharpnessLevel("cw", value);
              }}
              getValueLabel={(params) =>
                state.status.radio.filterSharpnessCwAuto
                  ? "Auto"
                  : ["Lowest Latency", "Lower Latency", "Sharper", "Sharpest"][
                      params.values[0]
                    ]
              }
            />
            <SliderToggle
              label="Digital Sharpness"
              switchChecked={state.status.radio.filterSharpnessDigitalAuto}
              disabled={state.status.radio.filterSharpnessDigitalAuto}
              onSwitchChange={(isChecked) => {
                props.radio.setFilterSharpnessAutoLevel("digital", isChecked);
              }}
              minValue={0}
              maxValue={3}
              value={[state.status.radio.filterSharpnessDigital]}
              onChange={([value]) => {
                if (value === state.status.radio.filterSharpnessDigital) return;
                props.radio.setFilterSharpnessLevel("digital", value);
              }}
              getValueLabel={(params) =>
                state.status.radio.filterSharpnessDigitalAuto
                  ? "Auto"
                  : ["Lowest Latency", "Lower Latency", "Sharper", "Sharpest"][
                      params.values[0]
                    ]
              }
            />
            <SimpleSwitch
              checked={state.status.radio.lowLatencyDigitalModes}
              onChange={(isChecked) => {
                props.radio.setLowLatencyDigitalModes(isChecked);
              }}
              label="Use Low-Latency Filters for Digital Modes"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RadioSettings() {
  const { state, radio } = useFlexRadio();
  return (
    <Show
      when={state.clientHandle}
      fallback={
        <Card class="bg-transparent">
          <CardContent>
            <CardHeader>
              <CardTitle>Not Connected</CardTitle>
            </CardHeader>
          </CardContent>
        </Card>
      }
    >
      <RadioSettingsInner radio={radio()} />
    </Show>
  );
}
