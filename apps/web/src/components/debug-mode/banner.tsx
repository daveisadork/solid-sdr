import { Show, createSignal } from "solid-js";
import { unwrap } from "solid-js/store";
import { useDebugMode } from "~/context/debug-mode";
import useFlexRadio from "~/context/flexradio";
import { Button } from "~/components/ui/button";
import { DebugPreviewModal } from "./preview-modal";

export function DebugBanner() {
  const debug = useDebugMode();
  if (!debug.enabled) return null;

  const flex = useFlexRadio();
  const [reportJson, setReportJson] = createSignal<string | null>(null);

  const generate = async () => {
    const snapshot = JSON.parse(JSON.stringify(unwrap(flex.state)));
    const firmwareVersion: string | null =
      snapshot.status?.radio?.version ?? null;
    const model: string | null = snapshot.status?.radio?.model ?? null;

    flex.disconnect();
    await Promise.resolve();

    const json = debug.generateReport({
      state: snapshot,
      firmwareVersion,
      model,
    });
    setReportJson(json);
  };

  return (
    <>
      <div class="w-full bg-red-700 text-white px-3 py-2 flex items-center justify-between gap-3 z-50">
        <div>
          <strong>DEBUG MODE</strong> — TCP traffic, console output, and app
          state are being recorded for this session. Do not share casually.
        </div>
        <div class="flex items-center gap-3 text-sm">
          <span>{debug.messageCount()} msgs</span>
          <span>{debug.logCount()} logs</span>
          <Button onClick={generate} class="bg-white text-red-700">
            Generate Debug Report
          </Button>
        </div>
      </div>
      <Show when={reportJson()}>
        {(json) => (
          <DebugPreviewModal
            json={json()}
            onClose={() => setReportJson(null)}
          />
        )}
      </Show>
    </>
  );
}
