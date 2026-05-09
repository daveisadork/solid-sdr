import { Show } from "solid-js";

import useFlexRadio from "~/context/flexradio";
import { useRuntime } from "~/context/runtime";
import { networkQualityLabel } from "~/lib/network-telemetry";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { InfoItem } from "./common";
import { formatKbps } from "~/lib/utils";

function formatMs(value: number | null | undefined) {
  return value == null ? "--" : `${Math.round(value)} ms`;
}

function formatPacketStatement(
  dropped: number,
  total: number,
  lossPercent: number,
) {
  return `Dropped ${dropped} out of ${total} packets (${lossPercent.toFixed(2)}%)`;
}

function qualityVariant(
  quality: string,
): "success" | "secondary" | "warning" | "error" | "outline" {
  switch (quality) {
    case "excellent":
    case "veryGood":
      return "success";
    case "good":
    case "fair":
      return "warning";
    case "poor":
      return "error";
    default:
      return "outline";
  }
}

function NetworkStatsInner() {
  const { runtime } = useRuntime();
  const network = () => runtime.network;

  return (
    <div class="flex flex-col gap-4 overflow-y-auto pr-1">
      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle class="flex items-center justify-between">
            <span>Overall Status</span>
            <Badge variant={qualityVariant(network().overall.quality)}>
              {networkQualityLabel(network().overall.quality)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <InfoItem
            label="Latency (RTT)"
            value={formatMs(network().endToEnd.currentMs)}
          />
          <InfoItem
            label="Max RTT"
            value={formatMs(network().endToEnd.maxMs)}
          />
          <div class="text-sm">
            {formatPacketStatement(
              network().overall.lostPackets,
              network().overall.totalPackets,
              network().overall.lossPercent,
            )}
          </div>
          <div class="text-xs text-muted-foreground">
            Last 5s:{" "}
            {formatPacketStatement(
              network().overall.recent.lostPackets,
              network().overall.recent.totalPackets,
              network().overall.recent.lossPercent,
            )}
          </div>
        </CardContent>
      </Card>

      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Browser ↔ Server</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <InfoItem
            label="Latency (RTT)"
            value={formatMs(network().browserToServer.currentMs)}
          />
          <InfoItem
            label="Max RTT"
            value={formatMs(network().browserToServer.maxMs)}
          />
          <InfoItem
            label="Remote RX Rate"
            value={formatKbps(network().browserToServer.rxKbps)}
          />
          <InfoItem
            label="Remote TX Rate"
            value={formatKbps(network().browserToServer.txKbps)}
          />
        </CardContent>
      </Card>

      <Card class="bg-transparent">
        <CardHeader>
          <CardTitle>Server ↔ Radio</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <InfoItem
            label="Latency (RTT)"
            value={formatMs(network().serverToRadio.currentMs)}
          />
          <InfoItem
            label="Max RTT"
            value={formatMs(network().serverToRadio.maxMs)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function NetworkStats() {
  const { state } = useFlexRadio();
  return (
    <DialogContent class="translate-y-0 top-1/12 flex max-h-10/12 flex-col overflow-hidden text-sm">
      <DialogHeader>
        <DialogTitle>Network Diagnostics</DialogTitle>
      </DialogHeader>
      <Show
        when={state.clientHandle}
        fallback={<div class="text-sm">Not Connected</div>}
      >
        <NetworkStatsInner />
      </Show>
    </DialogContent>
  );
}
