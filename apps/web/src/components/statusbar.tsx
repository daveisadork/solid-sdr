import useFlexRadio from "~/context/flexradio";
import {
  createEffect,
  createMemo,
  createSignal,
  JSXElement,
  onCleanup,
  Show,
  ValidComponent,
} from "solid-js";
import Connect from "./connect";
import { GpsStatus } from "./gps-status";
import { usePreferences } from "~/context/preferences";
import { FullscreenButton } from "./fullscreen-button";
import { Settings } from "./settings";
import MaterialSymbolsAddChartOutline from "~icons/material-symbols/add-chart-outline";
import { Button } from "@kobalte/core/button";
import { ToggleButton } from "@kobalte/core/toggle-button";
import MaterialSymbolsVolumeUp from "~icons/material-symbols/volume-up";
import MaterialSymbolsVolumeOff from "~icons/material-symbols/volume-off";
import MaterialSymbolsElectricBolt from "~icons/material-symbols/electric-bolt";
import MaterialSymbolsDeviceThermostat from "~icons/material-symbols/device-thermostat";
import MaterialSymbolsSignalWifi0Bar from "~icons/material-symbols/signal-wifi-0-bar";
import MaterialSymbolsSignalWifi1Bar from "~icons/material-symbols/network-wifi-1-bar";
import MaterialSymbolsSignalWifi2Bar from "~icons/material-symbols/network-wifi-2-bar";
import MaterialSymbolsSignalWifi3Bar from "~icons/material-symbols/network-wifi-3-bar";
import MaterialSymbolsSignalWifi4Bar from "~icons/material-symbols/signal-wifi-4-bar";
import MaterialSymbolsSignalWifiBadOutline from "~icons/material-symbols/signal-wifi-bad-outline";
import { Dynamic } from "solid-js/web";
import { createPermission } from "~/lib/permission";
import { NetworkQuality, useRuntime } from "~/context/runtime";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { formatKbps } from "~/lib/utils";

function RemoteAudioToggle() {
  const { preferences, setPreferences } = usePreferences();
  const audioPermission = createPermission("microphone");

  return (
    <ToggleButton
      class="size-10 not-pointer-coarse:size-5 aspect-square"
      classList={{
        "text-error-foreground": audioPermission() === "denied",
        "text-warning-foreground": audioPermission() === "prompt",
      }}
      pressed={
        preferences.remoteAudio.rx.enabled && audioPermission() === "granted"
      }
      onChange={(pressed) =>
        setPreferences("remoteAudio", "rx", "enabled", pressed)
      }
    >
      <Dynamic
        component={
          audioPermission() === "granted" && preferences.remoteAudio.rx.enabled
            ? MaterialSymbolsVolumeUp
            : MaterialSymbolsVolumeOff
        }
        class="size-full pointer-events-none"
      />
    </ToggleButton>
  );
}

const qualityIcons: Record<NetworkQuality, ValidComponent> = {
  excellent: MaterialSymbolsSignalWifi4Bar,
  veryGood: MaterialSymbolsSignalWifi3Bar,
  good: MaterialSymbolsSignalWifi2Bar,
  fair: MaterialSymbolsSignalWifi1Bar,
  poor: MaterialSymbolsSignalWifi0Bar,
  off: MaterialSymbolsSignalWifiBadOutline,
};

const InfoItem = (props: { label: JSXElement; value: JSXElement }) => (
  <>
    <span class="font-medium">{props.label}:</span>
    <span class="text-right">{props.value}</span>
  </>
);

function NetworkStatus() {
  const { runtime } = useRuntime();
  return (
    <HoverCard>
      <HoverCardTrigger as={"div"} class="flex gap-1 items-center font-mono">
        <Dynamic
          component={qualityIcons[runtime.network.overall.quality]}
          class="size-10 not-pointer-coarse:size-5"
          classList={{
            "text-yellow-500": runtime.network.overall.quality === "good",
            "text-orange-500": runtime.network.overall.quality === "fair",
            "text-red-500": runtime.network.overall.quality === "poor",
          }}
        />
      </HoverCardTrigger>
      <HoverCardContent class="w-auto fancy-bg-background text-sm">
        <div class="grid grid-cols-2 gap-1 font-mono">
          <InfoItem
            label="Latency (RTT)"
            value={`${Math.round(runtime.network.endToEnd.currentMs)} ms`}
          />
          <InfoItem
            label="Packets Total"
            value={runtime.network.overall.totalPackets.toLocaleString()}
          />
          <InfoItem
            label="Packets Lost"
            value={runtime.network.overall.lostPackets.toLocaleString()}
          />
          <InfoItem
            label="RX Rate"
            value={formatKbps(runtime.network.browserToServer.rxKbps)}
          />
          <InfoItem
            label="TX Rate"
            value={formatKbps(runtime.network.browserToServer.txKbps)}
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function StatusBar() {
  const { state, radio } = useFlexRadio();
  const { preferences } = usePreferences();
  const [voltage, setVoltage] = createSignal<number>();
  const [temp, setTemp] = createSignal<number>();

  const voltageMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "+13.8A"),
  );
  const tempMeter = createMemo(() =>
    Object.values(state.status.meter).find((meter) => meter.name === "PATEMP"),
  );

  createEffect(() => {
    const sub = radio()
      ?.meter(voltageMeter()?.id)
      ?.on("data", ({ value }) => setVoltage(value));
    onCleanup(() => {
      sub?.unsubscribe();
      setVoltage();
    });
  });

  createEffect(() => {
    const sub = radio()
      ?.meter(tempMeter()?.id)
      ?.on("data", ({ value }) => setTemp(value));
    onCleanup(() => {
      sub?.unsubscribe();
      setTemp();
    });
  });

  return (
    <div
      class="flex shrink-0 items-center w-full gap-4 py-2 px-3 not-sm:justify-around text-sm font-mono select-none z-0 fancy-bg-background"
      classList={{
        "border-t": !preferences.enableTransparencyEffects,
      }}
    >
      <Connect />
      <Show when={radio()}>
        {(radio) => {
          return (
            <Button
              disabled={!state.status.radio?.availablePanadapters}
              onClick={() =>
                radio().createPanadapter({ x: 200 }).catch(console.log)
              }
              class="size-10 not-pointer-coarse:size-5 aspect-square"
            >
              <MaterialSymbolsAddChartOutline class="size-full" />
            </Button>
          );
        }}
      </Show>
      <div class="flex items-center justify-around h-full not-pointer-coarse:gap-4 not-sm:hidden pointer-coarse:flex-col shrink-0">
        <Show when={voltage() !== undefined}>
          <span class="textbox-trim-both textbox-edge-cap-alphabetic flex gap-1 items-center">
            <MaterialSymbolsElectricBolt />
            {voltage()?.toFixed(2)}V
          </span>
        </Show>
        <Show when={tempMeter() && temp() !== undefined}>
          <span class="textbox-trim-both textbox-edge-cap-alphabetic flex gap-1 items-center">
            <MaterialSymbolsDeviceThermostat />
            {`${temp()?.toFixed(1)}${tempMeter().units?.replace("deg", "°")}`}
          </span>
        </Show>
      </div>
      <div class="grow not-sm:hidden" />
      <RemoteAudioToggle />
      <Settings />
      <FullscreenButton />
      <NetworkStatus />
      <GpsStatus class="not-sm:hidden" />
    </div>
  );
}
