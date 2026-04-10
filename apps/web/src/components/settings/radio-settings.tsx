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

function InfoItem(props: { label: string; value: string }) {
  return (
    <div class="flex">
      <div class="grow">{props.label}:</div>
      <span>{props.value}</span>
    </div>
  );
}

function RadioSettingsInner(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const [nickname, setNickname] = createSignal(state.status.radio.nickname);
  const [callsign, setCallsign] = createSignal(state.status.radio.callsign);

  createEffect(() => setNickname(state.status.radio.nickname));
  createEffect(() => setCallsign(state.status.radio.callsign));

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
