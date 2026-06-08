import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";

interface DebugPreviewModalProps {
  json: string;
  onClose: () => void;
}

export function DebugPreviewModal(props: DebugPreviewModalProps) {
  const [acknowledged, setAcknowledged] = createSignal(false);

  const download = () => {
    const blob = new Blob([props.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solidsdr-debug-${Math.floor(Date.now() / 1000)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
      <div class="bg-zinc-900 text-zinc-100 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div class="p-4 border-b border-zinc-800">
          <div class="font-bold">Debug Report Preview</div>
          <div class="text-sm text-zinc-400 mt-1">
            Your callsign, IP addresses, GPS data, etc. have been removed from
            the report automatically, but you should review the information
            below and ensure it doesn't contain any information you don't want
            to share publicly.
          </div>
        </div>
        <pre class="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre">
          {props.json}
        </pre>
        <div class="p-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged()}
              onChange={(e) => setAcknowledged(e.currentTarget.checked)}
            />
            I've reviewed this and I'm OK sharing it.
          </label>
          <div class="flex gap-2">
            <Button onClick={props.onClose} variant="ghost">
              Cancel
            </Button>
            <Button onClick={download} disabled={!acknowledged()}>
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
