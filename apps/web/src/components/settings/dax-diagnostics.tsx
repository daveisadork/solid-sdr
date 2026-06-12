import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useAudio } from "~/context/audio";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type {
  RxTelemetrySnapshot,
  TxTelemetrySnapshot,
} from "~/lib/dax-audio/telemetry";

const POLL_INTERVAL_MS = 1000;

interface RxRow {
  channel: number;
  snap: RxTelemetrySnapshot;
  prev?: RxTelemetrySnapshot;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function ratePerSec(curr: number, prev: number, dtMs: number): number {
  if (dtMs <= 0) return 0;
  return Math.round(((curr - prev) * 1000) / dtMs);
}

interface DaxDiagnosticsProps {
  rxChannels: number[];
  showTx: boolean;
}

export function DaxDiagnostics(props: DaxDiagnosticsProps) {
  const audio = useAudio();
  const [rxRows, setRxRows] = createSignal<RxRow[]>([]);
  const [txSnap, setTxSnap] = createSignal<TxTelemetrySnapshot | undefined>();
  const [txPrev, setTxPrev] = createSignal<TxTelemetrySnapshot | undefined>();

  onMount(() => {
    const tick = () => {
      const newRows: RxRow[] = [];
      const prevRows = new Map(rxRows().map((r) => [r.channel, r.snap]));
      for (const ch of props.rxChannels) {
        const snap = audio.daxRxTelemetry(ch);
        if (snap) {
          newRows.push({ channel: ch, snap, prev: prevRows.get(ch) });
        }
      }
      setRxRows(newRows);

      if (props.showTx) {
        setTxPrev(txSnap());
        setTxSnap(audio.daxTxTelemetry());
      } else {
        setTxSnap(undefined);
        setTxPrev(undefined);
      }
    };
    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    onCleanup(() => window.clearInterval(id));
  });

  const exportJson = () => {
    const blob = {
      timestamp: new Date().toISOString(),
      rx: rxRows().map((r) => ({ channel: r.channel, ...r.snap })),
      tx: txSnap(),
      userAgent: navigator.userAgent,
    };
    void navigator.clipboard.writeText(JSON.stringify(blob, null, 2));
  };

  return (
    <div class="flex flex-col gap-4 text-sm">
      <Show when={rxRows().length > 0}>
        <div>
          <h4 class="text-sm font-semibold mb-2">RX</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ch</TableHead>
                <TableHead class="text-right">pkts/s</TableHead>
                <TableHead class="text-right">gaps</TableHead>
                <TableHead class="text-right">reord</TableHead>
                <TableHead class="text-right">underrun/s</TableHead>
                <TableHead class="text-right">fill</TableHead>
                <TableHead class="text-right">drops</TableHead>
                <TableHead class="text-right">ctx Hz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={rxRows()}>
                {(row) => {
                  const pktRate = ratePerSec(
                    row.snap.pktReceived,
                    row.prev?.pktReceived ?? row.snap.pktReceived,
                    POLL_INTERVAL_MS,
                  );
                  const urRate = ratePerSec(
                    row.snap.workletUnderruns,
                    row.prev?.workletUnderruns ?? row.snap.workletUnderruns,
                    POLL_INTERVAL_MS,
                  );
                  return (
                    <TableRow>
                      <TableCell>{row.channel}</TableCell>
                      <TableCell class="text-right">{fmt(pktRate)}</TableCell>
                      <TableCell class="text-right">
                        {fmt(row.snap.pktSeqGaps)}
                      </TableCell>
                      <TableCell class="text-right">
                        {fmt(row.snap.pktReordered)}
                      </TableCell>
                      <TableCell
                        class="text-right"
                        classList={{ "text-red-500": urRate > 0 }}
                      >
                        {fmt(urRate)}
                      </TableCell>
                      <TableCell class="text-right">
                        {fmt(row.snap.bufFillFrames)}
                      </TableCell>
                      <TableCell
                        class="text-right"
                        classList={{
                          "text-red-500": row.snap.bufForcedDrops > 0,
                        }}
                      >
                        {fmt(row.snap.bufForcedDrops)}
                      </TableCell>
                      <TableCell class="text-right">
                        {fmt(row.snap.ctxSampleRateHz)}
                      </TableCell>
                    </TableRow>
                  );
                }}
              </For>
            </TableBody>
          </Table>
        </div>
      </Show>

      <Show when={txSnap()}>
        {(snap) => {
          const prev = () => txPrev();
          const rate = (curr: number, p: number | undefined): number =>
            ratePerSec(curr, p ?? curr, POLL_INTERVAL_MS);
          const rate10 = () =>
            rate(
              snap().mainSendStallOver10msCount,
              prev()?.mainSendStallOver10msCount,
            );
          const rate25 = () =>
            rate(
              snap().mainSendStallOver25msCount,
              prev()?.mainSendStallOver25msCount,
            );
          const rate50 = () =>
            rate(
              snap().mainSendStallOver50msCount,
              prev()?.mainSendStallOver50msCount,
            );
          const rate100 = () =>
            rate(
              snap().mainSendStallOver100msCount,
              prev()?.mainSendStallOver100msCount,
            );
          return (
            <div>
              <h4 class="text-sm font-semibold mb-2">TX</h4>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>Frames captured</TableCell>
                    <TableCell class="text-right">
                      {fmt(snap().workletFramesCaptured)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Packets sent</TableCell>
                    <TableCell class="text-right">
                      {fmt(snap().mainPacketsSent)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Send-stall max (µs)</TableCell>
                    <TableCell
                      class="text-right"
                      classList={{
                        "text-red-500": snap().mainSendStallMaxUs > 15_000,
                      }}
                    >
                      {fmt(snap().mainSendStallMaxUs)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Stalls &gt;10ms /s</TableCell>
                    <TableCell
                      class="text-right"
                      classList={{ "text-red-500": rate10() > 5 }}
                    >
                      {fmt(rate10())}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Stalls &gt;25ms /s</TableCell>
                    <TableCell
                      class="text-right"
                      classList={{ "text-red-500": rate25() > 1 }}
                    >
                      {fmt(rate25())}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Stalls &gt;50ms /s</TableCell>
                    <TableCell
                      class="text-right"
                      classList={{ "text-red-500": rate50() > 0 }}
                    >
                      {fmt(rate50())}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Stalls &gt;100ms /s</TableCell>
                    <TableCell
                      class="text-right"
                      classList={{ "text-red-500": rate100() > 0 }}
                    >
                      {fmt(rate100())}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Capture ctx Hz</TableCell>
                    <TableCell class="text-right">
                      {fmt(snap().ctxSampleRateHz)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          );
        }}
      </Show>
      <div class="flex justify-end">
        <Button variant="outline" onClick={exportJson}>
          Copy JSON
        </Button>
      </div>
    </div>
  );
}
