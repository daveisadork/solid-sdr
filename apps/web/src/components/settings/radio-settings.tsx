import { usePreferences } from "../../context/preferences";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import {
  Card,
  CardContent,
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
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import useFlexRadio, { FilterPresetState } from "~/context/flexradio";
import type {
  FilterPresetEntry,
  FlexCommandRejectedError,
  Radio,
} from "@repo/flexlib";
import {
  TextField,
  TextFieldErrorMessage,
  TextFieldInput,
  TextFieldLabel,
} from "../ui/text-field";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Checkbox } from "../ui/checkbox";
import * as NumberFieldPrimitive from "@kobalte/core/number-field";
import * as TextFieldPrimitive from "@kobalte/core/text-field";
import Spinner from "~icons/svg-spinners/180-ring";
import { RadioOscillatorSetting } from "@repo/flexlib";
import { SliderToggle } from "../ui/slider-toggle";
import { Badge } from "../ui/badge";
import { InfoItem } from "./common";
import { ConfirmButton } from "../ui/confirm-button";
import { Mutable } from "@repo/flexlib/flex/state/common";
import { showToastPromise } from "../ui/toast";

const ipv4Regex =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/;

const isValidIPv4 = (ip: string) => ipv4Regex.test(ip);

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

        <div class="flex flex-col gap-4 flex-1 min-h-0">
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

function NetworkSettings(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();
  const [rawNetworkMtu, setRawNetworkMtu] = createSignal(
    preferences.networkMtu,
  );
  const [staticNetwork, setStaticNetwork] = createStore({
    ip: state.status.radio.staticIp,
    gateway: state.status.radio.staticGateway,
    netmask: state.status.radio.staticNetmask,
    ipTouched: false,
    gatewayTouched: false,
    netmaskTouched: false,
  });

  const networkMode = createMemo(() =>
    state.status.radio.staticIp &&
    state.status.radio.staticNetmask &&
    state.status.radio.staticGateway
      ? "static"
      : "dhcp",
  );

  const [rawNetworkMode, setRawNetworkMode] = createSignal<"static" | "dhcp">(
    networkMode(),
  );

  createEffect(() => setRawNetworkMode(networkMode()));
  createEffect(() => setRawNetworkMtu(preferences.networkMtu));

  createEffect(() => {
    const desiredMtu = rawNetworkMtu();
    if (desiredMtu === preferences.networkMtu) return;
    props.radio
      .setNetworkMtu(desiredMtu)
      .then(() => setPreferences("networkMtu", desiredMtu));
  });

  const applyDisabled = createMemo(() =>
    rawNetworkMode() === "dhcp"
      ? networkMode() === "dhcp"
      : (staticNetwork.ip === state.status.radio.staticIp &&
          staticNetwork.netmask === state.status.radio.staticNetmask &&
          staticNetwork.gateway === state.status.radio.staticGateway) ||
        !(
          isValidIPv4(staticNetwork.ip) &&
          isValidIPv4(staticNetwork.netmask) &&
          isValidIPv4(staticNetwork.gateway)
        ),
  );

  const apply = () => {
    showToastPromise(
      rawNetworkMode() === "dhcp"
        ? props.radio.resetStaticNetworkParams()
        : props.radio.setStaticNetworkParams({
            ip: staticNetwork.ip,
            netmask: staticNetwork.netmask,
            gateway: staticNetwork.gateway,
          }),
      {
        success() {
          return "Network settings applied successfully";
        },
        error(error: FlexCommandRejectedError) {
          console.error(error);
          return error.codeDescription ?? "Error applying network settings";
        },
      },
    );
  };

  return (
    <Dialog>
      <DialogTrigger as={Button}>Advanced</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Advanced Network Settings</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-4 text-sm">
          <NumberField
            class="flex flex-col gap-2 select-none"
            rawValue={rawNetworkMtu()}
            format={false}
            minValue={576}
            maxValue={9000}
            onRawValueChange={setRawNetworkMtu}
          >
            <NumberFieldLabel class="select-none">Network MTU</NumberFieldLabel>
            <NumberFieldGroup class="select-none">
              <NumberFieldInput />
              <NumberFieldIncrementTrigger class="select-none" />
              <NumberFieldDecrementTrigger class="select-none" />
            </NumberFieldGroup>
          </NumberField>
          <SimpleSwitch
            label="Enforce Private IP Connections"
            checked={state.status.radio.enforcePrivateIpConnections}
            onChange={(checked) =>
              props.radio.setEnforcePrivateIpConnections(checked)
            }
          />

          <SegmentedControl
            value={rawNetworkMode()}
            onChange={setRawNetworkMode}
          >
            <SegmentedControlLabel>Network Mode</SegmentedControlLabel>
            <SegmentedControlGroup>
              <SegmentedControlIndicator />
              <SegmentedControlItemsList>
                <For each={["DHCP", "Static"]}>
                  {(mode) => (
                    <SegmentedControlItem value={mode.toLowerCase()}>
                      <SegmentedControlItemLabel>
                        {mode}
                      </SegmentedControlItemLabel>
                    </SegmentedControlItem>
                  )}
                </For>
              </SegmentedControlItemsList>
            </SegmentedControlGroup>
          </SegmentedControl>
          <Show when={rawNetworkMode() === "static"}>
            <Card>
              <CardHeader>
                <CardTitle>Static Network Settings</CardTitle>
              </CardHeader>
              <CardContent class="flex flex-col gap-4">
                <TextField
                  value={staticNetwork.ip}
                  onChange={(value) => setStaticNetwork("ip", value)}
                  validationState={
                    !staticNetwork.ipTouched || isValidIPv4(staticNetwork.ip)
                      ? "valid"
                      : "invalid"
                  }
                  class="flex flex-col gap-2"
                >
                  <TextFieldLabel>Static IP</TextFieldLabel>
                  <TextFieldInput
                    onBlur={() => setStaticNetwork("ipTouched", true)}
                  />
                  <TextFieldErrorMessage>
                    Valid IPv4 address required
                  </TextFieldErrorMessage>
                </TextField>
                <TextField
                  value={staticNetwork.netmask}
                  validationState={
                    !staticNetwork.netmaskTouched ||
                    isValidIPv4(staticNetwork.netmask)
                      ? "valid"
                      : "invalid"
                  }
                  onChange={(value) => setStaticNetwork("netmask", value)}
                  class="flex flex-col gap-2"
                >
                  <TextFieldLabel>Static Netmask</TextFieldLabel>
                  <TextFieldInput
                    onBlur={() => setStaticNetwork("netmaskTouched", true)}
                  />
                  <TextFieldErrorMessage>
                    Valid IPv4 address required
                  </TextFieldErrorMessage>
                </TextField>
                <TextField
                  value={staticNetwork.gateway}
                  validationState={
                    !staticNetwork.gatewayTouched ||
                    isValidIPv4(staticNetwork.gateway)
                      ? "valid"
                      : "invalid"
                  }
                  onChange={(value) => setStaticNetwork("gateway", value)}
                  class="flex flex-col gap-2"
                >
                  <TextFieldLabel>Static Gateway</TextFieldLabel>
                  <TextFieldInput
                    onBlur={() => setStaticNetwork("gatewayTouched", true)}
                  />
                  <TextFieldErrorMessage>
                    Valid IPv4 address required
                  </TextFieldErrorMessage>
                </TextField>
              </CardContent>
            </Card>
          </Show>
        </div>
        <DialogFooter>
          <Button disabled={applyDisabled()} onClick={apply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioSettingsInner(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const [nickname, setNickname] = createSignal(state.status.radio.nickname);
  const [callsign, setCallsign] = createSignal(state.status.radio.callsign);
  const { preferences, setPreferences } = usePreferences();
  const [txProfiles, setTxProfiles] = createStore<string[]>([]);
  const [filterModeGroup, setFilterModeGroup] =
    createSignal<keyof FilterPresetState>("ssb");
  const [filterPresets, setFilterPresets] = createStore<
    Mutable<FilterPresetEntry>[]
  >([]);

  const [calibrationEnabled, setCalibrationEnabled] = createSignal(true);

  createEffect(() => {
    setFilterPresets(
      state.status.filterPreset[filterModeGroup()].map((p) => ({ ...p })),
    );
  });

  createEffect(() => setNickname(state.status.radio.nickname));
  createEffect(() => setCallsign(state.status.radio.callsign));
  createEffect(() => setTxProfiles(state?.status?.radio?.profileTxList ?? []));
  createEffect(() => {
    if (state.status.radio.pllDone) setCalibrationEnabled(true);
  });

  const oscillatorSources = createMemo<Record<RadioOscillatorSetting, string>>(
    () => ({
      auto: "Auto",
      external: "External",
      gpsdo:
        state.status.radio.oscillatorGnssPresent &&
        !state.status.radio.oscillatorGpsdoPresent
          ? "GNSS"
          : "GPSDO",
      tcxo: "TCXO",
    }),
  );

  return (
    <div class="flex flex-col gap-4 text-sm">
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Radio Information</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
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
            onChange={(isChecked) => props.radio.setRemoteOnEnabled(isChecked)}
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
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>License Information</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <For each={Object.values(state.status.featureLicense.subscriptions)}>
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
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Network</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <InfoItem label="IP Address" value={state.status.radio.ipAddress} />
          <InfoItem label="Subnet Mask" value={state.status.radio.netmask} />
          <InfoItem label="MAC Address" value={state.status.radio.macAddress} />
        </CardContent>
        <CardFooter class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 items-stretch">
          <NetworkSettings radio={props.radio} />
        </CardFooter>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>GPS</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Show when={state.status.radio.gpsInstalled} fallback="Not Installed">
            <InfoItem
              label="Latitude"
              value={state.status.radio.gpsLatitude.toString()}
            />
            <InfoItem
              label="Longitude"
              value={state.status.radio.gpsLongitude.toString()}
            />
            <InfoItem label="Grid Square" value={state.status.radio.gpsGrid} />
            <InfoItem label="Altitude" value={state.status.radio.gpsAltitude} />
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
            <InfoItem label="UTC Time" value={state.status.radio.gpsUtcTime} />
          </Show>
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>TX Timings</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
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
          <div class="grid grid-cols-2 gap-4">
            <NumberField
              class="flex flex-col gap-2 select-none"
              rawValue={state.status.radio.interlockAccTxDelayMs}
              format={false}
              minValue={0}
              maxValue={2000}
              onRawValueChange={(value) => {
                if (value === state.status.radio.interlockAccTxDelayMs) return;
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
              <NumberFieldLabel class="select-none">TX Delay</NumberFieldLabel>
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
        </CardContent>
        <CardFooter class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 items-stretch">
          <TxBandSettings radio={props.radio} />
        </CardFooter>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Interlocks</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <SegmentedControl
            value={
              state.status.radio.interlockRcaTxReqPolarityHigh ? "high" : "low"
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
              state.status.radio.interlockAccTxReqPolarityHigh ? "high" : "low"
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
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>TX Misc</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
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
                        {mode.replaceAll("_", " ")}
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
          <SimpleSwitch
            checked={preferences.showTxFilterInPan}
            onChange={(isChecked) =>
              setPreferences("showTxFilterInPan", isChecked)
            }
            label="Show TX Filter in Pan"
          />
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Microphone</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
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
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>CW</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
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
                        Mode {mode.replaceAll("_", " ")}
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
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Digital</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
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
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Frequency Offset</CardTitle>
        </CardHeader>
        <Show
          when={state.status.radio.oscillatorState !== "gpsdo"}
          fallback={
            <CardContent>
              Disabled when using {oscillatorSources().gpsdo}
            </CardContent>
          }
        >
          <CardContent class="flex flex-col gap-4">
            <NumberField
              class="flex flex-col gap-2 select-none"
              disabled={!calibrationEnabled()}
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
              disabled={!calibrationEnabled()}
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
          </CardContent>
          <CardFooter class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 items-stretch">
            <Button
              onClick={() => {
                setCalibrationEnabled(false);
                props.radio.startOffsetCalibration();
              }}
              disabled={!calibrationEnabled()}
            >
              <Show when={!calibrationEnabled()} fallback="Start Calibration">
                <Spinner />
                Calibrating
              </Show>
            </Button>
          </CardFooter>
        </Show>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>10 MHz Reference</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
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
              <SegmentedControlItemsList class="grid grid-cols-4">
                <For each={Object.entries(oscillatorSources())}>
                  {([id, label]) => (
                    <SegmentedControlItem value={id}>
                      <SegmentedControlItemLabel class="px-0">
                        {label}
                      </SegmentedControlItemLabel>
                    </SegmentedControlItem>
                  )}
                </For>
              </SegmentedControlItemsList>
            </SegmentedControlGroup>
          </SegmentedControl>
          <InfoItem
            label="Active Source"
            value={oscillatorSources()[state.status.radio.oscillatorState]}
          />
          <InfoItem
            label="State"
            value={
              <Badge
                variant={
                  state.status.radio.oscillatorLocked ? "success" : "outline"
                }
              >
                {state.status.radio.oscillatorLocked ? "Locked" : "Searching"}
              </Badge>
            }
          />
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>RX Misc</CardTitle>
        </CardHeader>
        <CardContent class="select-none flex flex-col gap-4">
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
        </CardContent>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Filter Options</CardTitle>
        </CardHeader>
        <CardContent class="select-none flex flex-col gap-4">
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
            label="Use Low-Latency Filters for PACTOR"
          />
        </CardContent>
      </Card>

      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Filter Presets</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-4 flex-1 min-w-0">
            <Select
              class="flex flex-col gap-2 select-none"
              value={filterModeGroup()}
              onChange={setFilterModeGroup}
              options={Object.keys(state.status.filterPreset)}
              itemComponent={(props) => {
                return (
                  <SelectItem item={props.item} class="uppercase">
                    {props.item.rawValue.toString()}
                  </SelectItem>
                );
              }}
            >
              <SelectLabel>Mode Group</SelectLabel>
              <SelectTrigger class="uppercase">
                <SelectValue<string>>
                  {(state) => state.selectedOption()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
            <Table class="overflow-auto shrink">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Low Hz</TableHead>
                  <TableHead>High Hz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={filterPresets}>
                  {(preset) => {
                    return (
                      <TableRow>
                        <TableCell>
                          <TextFieldPrimitive.Root
                            value={preset.name}
                            onChange={(name) => {
                              if (name.length > 4) return;
                              setFilterPresets(preset.index, "name", name);
                            }}
                          >
                            <TextFieldPrimitive.Input size={4} class="px-1" />
                          </TextFieldPrimitive.Root>
                        </TableCell>
                        <TableCell>
                          <NumberFieldPrimitive.Root
                            rawValue={preset.filterLowHz}
                            onRawValueChange={(filterLowHz) =>
                              setFilterPresets(
                                preset.index,
                                "filterLowHz",
                                filterLowHz,
                              )
                            }
                            minValue={0}
                            maxValue={preset.filterHighHz}
                            format={false}
                          >
                            <NumberFieldPrimitive.Input size={5} class="px-1" />
                          </NumberFieldPrimitive.Root>
                        </TableCell>
                        <TableCell>
                          <NumberFieldPrimitive.Root
                            rawValue={preset.filterHighHz}
                            onRawValueChange={(filterHighHz) =>
                              setFilterPresets(
                                preset.index,
                                "filterHighHz",
                                filterHighHz,
                              )
                            }
                            minValue={preset.filterLowHz}
                            maxValue={12_000}
                            format={false}
                          >
                            <NumberFieldPrimitive.Input size={5} class="px-1" />
                          </NumberFieldPrimitive.Root>
                        </TableCell>
                      </TableRow>
                    );
                  }}
                </For>
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 items-stretch">
          <Button
            onClick={() =>
              props.radio
                .filterPresets()
                .reset(filterModeGroup())
                .then(() =>
                  setFilterPresets(
                    state.status.filterPreset[filterModeGroup()].map((p) => ({
                      ...p,
                    })),
                  ),
                )
            }
          >
            Reset
          </Button>
          <Button
            onClick={() => {
              const ctrl = props.radio.filterPresets();
              filterPresets
                .map((p) => ({ ...p }))
                .forEach((preset) =>
                  ctrl.save(filterModeGroup(), preset.index, preset),
                );
            }}
          >
            Save
          </Button>
        </CardFooter>
      </Card>
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>XVTR</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <For each={Object.values(state.status.xvtr)}>
            {(xvtr) => {
              const ctrl = props.radio.xvtr(xvtr.id);
              return (
                <Card class="bg-transparent">
                  <CardHeader>
                    <div class="flex items-center">
                      <CardTitle class="grow">{xvtr.name || "????"}</CardTitle>
                      <Badge variant={xvtr.valid ? "success" : "warning"}>
                        {xvtr.valid ? "Valid" : "Invalid"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent class="select-none flex flex-col gap-4">
                    <TextField
                      class="flex flex-col gap-2"
                      value={xvtr.name}
                      onChange={(value) => ctrl.setName(value)}
                    >
                      <TextFieldLabel>Name</TextFieldLabel>
                      <TextFieldInput placeholder="Name" />
                    </TextField>
                    <div class="grid grid-cols-2 gap-4">
                      <NumberField
                        class="flex flex-col gap-2 select-none"
                        rawValue={xvtr.rfFreqMHz}
                        format={false}
                        minValue={0}
                        onRawValueChange={(value) => {
                          if (value === xvtr.rfFreqMHz) return;
                          ctrl.setRfFreqMHz(value);
                        }}
                      >
                        <NumberFieldLabel class="select-none">
                          RF Freq MHz
                        </NumberFieldLabel>
                        <NumberFieldGroup class="select-none">
                          <NumberFieldInput />
                        </NumberFieldGroup>
                      </NumberField>
                      <NumberField
                        class="flex flex-col gap-2 select-none"
                        rawValue={xvtr.ifFreqMHz}
                        format={false}
                        minValue={0}
                        onRawValueChange={(value) => {
                          if (value === xvtr.ifFreqMHz) return;
                          ctrl.setIfFreqMHz(value);
                        }}
                      >
                        <NumberFieldLabel class="select-none">
                          IF Freq MHz
                        </NumberFieldLabel>
                        <NumberFieldGroup class="select-none">
                          <NumberFieldInput />
                        </NumberFieldGroup>
                      </NumberField>
                      <NumberField
                        class="flex flex-col gap-2 select-none"
                        rawValue={xvtr.rfFreqMHz - xvtr.ifFreqMHz}
                        minValue={0}
                        format={false}
                        readOnly
                      >
                        <NumberFieldLabel class="select-none">
                          LO Freq MHz
                        </NumberFieldLabel>
                        <NumberFieldGroup class="select-none">
                          <NumberFieldInput />
                        </NumberFieldGroup>
                      </NumberField>
                      <NumberField
                        class="flex flex-col gap-2 select-none"
                        rawValue={xvtr.loErrorMHz}
                        format={false}
                        minValue={0}
                        onRawValueChange={(value) => {
                          if (value === xvtr.loErrorMHz) return;
                          ctrl.setLoErrorMHz(value);
                        }}
                      >
                        <NumberFieldLabel class="select-none">
                          LO Error MHz
                        </NumberFieldLabel>
                        <NumberFieldGroup class="select-none">
                          <NumberFieldInput />
                        </NumberFieldGroup>
                      </NumberField>
                    </div>
                    <SimpleSwitch
                      checked={xvtr.rxOnly}
                      onChange={(isChecked) => {
                        ctrl.setRxOnly(isChecked);
                      }}
                      label="RX Only"
                    />
                    <NumberField
                      class="flex flex-col gap-2 select-none"
                      rawValue={xvtr.maxPowerDbm}
                      format={false}
                      minValue={0}
                      onRawValueChange={(value) => {
                        if (value === xvtr.maxPowerDbm) return;
                        ctrl.setMaxPowerDbm(value);
                      }}
                    >
                      <NumberFieldLabel class="select-none">
                        Max Power dBm
                      </NumberFieldLabel>
                      <NumberFieldGroup class="select-none">
                        <NumberFieldInput />
                      </NumberFieldGroup>
                    </NumberField>
                    <NumberField
                      class="flex flex-col gap-2 select-none"
                      rawValue={xvtr.rxGainDb}
                      format={false}
                      minValue={0}
                      onRawValueChange={(value) => {
                        if (value === xvtr.rxGainDb) return;
                        ctrl.setRxGainDb(value);
                      }}
                    >
                      <NumberFieldLabel class="select-none">
                        RX Gain dB
                      </NumberFieldLabel>
                      <NumberFieldGroup class="select-none">
                        <NumberFieldInput />
                      </NumberFieldGroup>
                    </NumberField>
                  </CardContent>
                  <CardFooter class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 items-stretch">
                    <ConfirmButton
                      variant="destructive"
                      message={`Are you sure you want to remove XVTR ${xvtr.name}?`}
                      onConfirm={() => ctrl.remove()}
                    >
                      Remove {xvtr.name}
                    </ConfirmButton>
                  </CardFooter>
                </Card>
              );
            }}
          </For>
        </CardContent>
        <CardFooter class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 items-stretch">
          <Button onClick={() => props.radio.createXvtr()}>
            Add Transverter Band
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function RadioSettings() {
  const { state, radio } = useFlexRadio();
  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden sm:max-w-10/12 sm:w-auto">
      <DialogHeader>
        <DialogTitle>Radio Settings</DialogTitle>
      </DialogHeader>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <Show
          when={state.clientHandle}
          fallback={
            <Card class="bg-transparent">
              <CardHeader>
                <CardTitle>Not Connected</CardTitle>
              </CardHeader>
            </Card>
          }
        >
          <RadioSettingsInner radio={radio()} />
        </Show>
      </div>
    </DialogContent>
  );
}
