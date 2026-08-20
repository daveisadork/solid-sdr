import { type DvkRecording, validateDvkWavFile } from "@repo/flexlib";
import { Key } from "@solid-primitives/keyed";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import IconTransmit from "~icons/mdi/access-point";
import IconDotsVertical from "~icons/mdi/dots-vertical";
import IconDownload from "~icons/mdi/download";
import IconEraser from "~icons/mdi/eraser";
import IconHeadphones from "~icons/mdi/headphones";
import IconRecord from "~icons/mdi/record";
import IconStop from "~icons/mdi/stop";
import IconUpload from "~icons/mdi/upload";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { SimpleSwitch } from "./ui/simple-switch";
import {
  TextField,
  TextFieldDescription,
  TextFieldInput,
} from "./ui/text-field";
import { showToast, showToastPromise } from "./ui/toast";
import { Toggle } from "./ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** Same layer as CWX macros: browsers reserve F1–F12, so Alt+<key>. */
const SLOT_HOTKEYS = [
  { code: "Digit1", label: "1" },
  { code: "Digit2", label: "2" },
  { code: "Digit3", label: "3" },
  { code: "Digit4", label: "4" },
  { code: "Digit5", label: "5" },
  { code: "Digit6", label: "6" },
  { code: "Digit7", label: "7" },
  { code: "Digit8", label: "8" },
  { code: "Digit9", label: "9" },
  { code: "Digit0", label: "0" },
  { code: "Minus", label: "-" },
  { code: "Equal", label: "=" },
];

/**
 * The radio stops a recording on its own at 10 s (firmware-enforced; probed on
 * a FLEX-8600). Only the progress bar uses this — no client-side rec_stop.
 */
const MAX_RECORD_MS = 10_000;

const formatDuration = (ms: number) =>
  ms ? `${(ms / 1_000).toFixed(1)}s` : "Empty";
const BUSY_STATUSES = new Set(["recording", "preview", "playback"]);

/** Panel and rows both read the radio directly rather than drilling props. */
function useDvk() {
  const { state, radio } = useFlexRadio();

  const dvk = () => radio()?.dvk();
  const status = () => state.status.dvk.status;
  const activeId = () => state.status.dvk.statusRecordingId;
  const recordings = () => state.status.dvk.recordings;
  const busy = () => BUSY_STATUSES.has(state.status.dvk.status);
  const txAllowed = () => state.status.radio.txAllowed;

  const startPlayback = (id: string) => {
    void dvk()
      ?.startPlayback(id)
      .catch((error) => console.error("DVK playback start failed", error));
  };

  /** Only one activity runs at a time, so the stop verb follows the status. */
  const stopActive = () => {
    const controller = dvk();
    const id = activeId();
    if (!controller || id === undefined) return;
    const stop =
      status() === "recording"
        ? controller.stopRecording(id)
        : status() === "preview"
          ? controller.stopPreview(id)
          : status() === "playback"
            ? controller.stopPlayback(id)
            : undefined;
    void stop?.catch((error) => console.error("DVK stop failed", error));
  };

  return {
    dvk,
    status,
    activeId,
    recordings,
    busy,
    txAllowed,
    startPlayback,
    stopActive,
  };
}

export function DvkPanel() {
  const { preferences, setPreferences } = usePreferences();
  const { dvk, recordings, busy, txAllowed, startPlayback, stopActive } =
    useDvk();

  // Upload goes through one hidden file input; the target slot is latched
  // when the picker opens because the change event arrives much later.
  let fileInput: HTMLInputElement | undefined;
  let uploadTargetId: string | undefined;

  const pickUpload = (id: string) => {
    uploadTargetId = id;
    fileInput?.click();
  };

  const handleUploadFile = async (file: File) => {
    const controller = dvk();
    const id = uploadTargetId;
    if (!controller || id === undefined) return;
    const data = new Uint8Array(await file.arrayBuffer());
    try {
      validateDvkWavFile(data);
    } catch (error) {
      showToast({
        title: "Invalid WAV file",
        description: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
      return;
    }
    showToastPromise(
      (async () => {
        const upload = await controller.upload(id, data, file.name);
        await new Promise<void>((resolve, reject) => {
          upload.on("done", () => resolve());
          upload.on("failed", ({ reason }) =>
            reject(new Error(reason ?? "upload failed")),
          );
        });
      })(),
      {
        loading: "Uploading recording…",
        success: () => "Recording uploaded",
        error: (error) =>
          `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    );
  };

  createEffect(() => {
    if (!preferences.dvk.playbackHotkeys) return;
    if (!preferences.toolsPanelOpen || preferences.toolsPanel !== "dvk") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        if (!busy()) return;
        event.preventDefault();
        stopActive();
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const index = SLOT_HOTKEYS.findIndex((key) => key.code === event.code);
      if (index === -1) return;
      event.preventDefault();
      const slot = recordings()[index];
      if (!slot || slot.durationMs === 0) return;
      if (busy() || !txAllowed()) return;
      startPlayback(slot.id);
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-3 text-sm">
      <div class="flex flex-col gap-2">
        <Key each={recordings()} by="id" fallback="No recordings">
          {(slot, index) => (
            <SlotRow
              slot={slot()}
              compact={preferences.dvk.compactLayout}
              hotkey={SLOT_HOTKEYS[index()]?.label}
              onUpload={() => pickUpload(slot().id)}
            />
          )}
        </Key>
      </div>

      <SimpleSwitch
        class="mt-auto"
        checked={preferences.dvk.playbackHotkeys}
        onChange={(isChecked) =>
          setPreferences("dvk", "playbackHotkeys", isChecked)
        }
        label="Enable Hotkeys"
        description="Alt + 1-9, 0, -, = to TX, Esc to stop."
      />
      <SimpleSwitch
        checked={preferences.dvk.compactLayout}
        onChange={(isChecked) => {
          console.log(isChecked);
          setPreferences("dvk", "compactLayout", isChecked);
        }}
        label="Compact Layout"
        description="Hide editing controls"
      />
      <input
        ref={fileInput}
        type="file"
        accept=".wav,audio/wav,audio/x-wav"
        class="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void handleUploadFile(file);
        }}
      />
    </div>
  );
}

function SlotRow(props: {
  slot: DvkRecording;
  hotkey?: string;
  compact?: boolean;
  /** Upload is the panel's job — one hidden file input is shared by all rows. */
  onUpload: () => void;
}) {
  const { dvk, status, activeId, busy, txAllowed, startPlayback, stopActive } =
    useDvk();

  const [rawName, setRawName] = createSignal(props.slot.name);

  createEffect(() => setRawName(props.slot.name));

  const changeName = () => {
    let opening = true;
    const name = rawName()
      .replace(/["“”]/g, () => {
        const quote = opening ? "“" : "”";
        opening = !opening;
        return quote;
      })
      .trim();
    if (name === props.slot.name) return setRawName(name);
    dvk()?.setName(props.slot.id, name);
  };

  const empty = () => props.slot.durationMs === 0;
  /** This row's activity, or undefined when the radio is busy elsewhere. */
  const activity = () =>
    activeId() === props.slot.id && busy() ? status() : null;
  const record = () =>
    void dvk()
      ?.startRecording(props.slot.id)
      .catch((error) => console.error("DVK record failed", error));

  const preview = () =>
    void dvk()
      ?.startPreview(props.slot.id)
      .catch((error) => console.error("DVK preview failed", error));

  const playback = () => startPlayback(props.slot.id);

  const clear = () =>
    void dvk()
      ?.clear(props.slot.id)
      .catch((error) => console.error("DVK clear failed", error));

  const download = () => {
    const controller = dvk();
    if (!controller) return;
    showToastPromise(
      (async () => {
        const data = await controller.download(props.slot.id);
        const url = URL.createObjectURL(
          new Blob([data as BlobPart], { type: "audio/wav" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${props.slot.name || `DVK ${props.slot.id}`}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        return true;
      })(),
      {
        loading: "Downloading recording…",
        success: () => "Recording downloaded",
        error: (error) =>
          `Download failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    );
  };

  /**
   * The bar is pure CSS: on activation its width transitions 0→100% over the
   * expected duration (the radio sends no progress messages), and the status
   * flip back to idle snaps it away. Recording runs against the firmware's
   * 10 s cap.
   */
  const progressStyle = () => {
    const current = activity();
    if (!current) return { width: "0%", transition: "none" };
    const expectedMs =
      current === "recording" ? MAX_RECORD_MS : props.slot.durationMs;
    return {
      width: "100%",
      transition: `width ${expectedMs}ms linear`,
    };
  };

  return (
    <Show
      when={!props.compact}
      fallback={
        <Tooltip>
          <TooltipTrigger
            as={Toggle<"button">}
            variant="outline"
            class="group relative flex hover:bg-accent justify-start data-pressed:border-primary p-0 h-10"
            pressed={activity() === "preview"}
            disabled={activity() !== "preview" && (busy() || empty())}
            onChange={(pressed) => (pressed ? preview() : stopActive())}
            aria-label={activity() === "preview" ? "Stop" : "Transmit"}
          >
            <div class="flex items-center justify-center h-full border-r border-r-input font-mono px-2 group-data-pressed:bg-primary group-data-pressed:text-primary-foreground">
              {props.hotkey ?? props.slot.id}
            </div>
            <div class="relative flex flex-col flex-1 items-stretch px-2 overflow-hidden text-left">
              <div
                class="absolute inset-y-0 left-0 bg-input"
                style={progressStyle()}
              />
              <div class="text-nowrap text-ellipsis overflow-hidden">
                {props.slot.name}
              </div>
              <span class="text-xs text-muted-foreground">
                {formatDuration(props.slot.durationMs)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {activity() === "preview" ? "Stop" : "Transmit"}
          </TooltipContent>
        </Tooltip>
      }
    >
      <div class="relative flex flex-col gap-2 border rounded-md p-2">
        <div
          class="absolute inset-y-0 left-0 bg-primary/15 pointer-events-none"
          style={progressStyle()}
        />
        <form
          class="flex items-center gap-2 min-w-0 w-full"
          onSubmit={(event) => {
            event.preventDefault();
            changeName();
          }}
        >
          <TextField
            value={rawName()}
            onChange={setRawName}
            class="flex flex-col gap-2 w-full"
          >
            <TextFieldInput onBlur={changeName} />
            <TextFieldDescription class="flex">
              <Show when={props.hotkey}>Alt + {props.hotkey}</Show>
              <div class="ms-auto">{formatDuration(props.slot.durationMs)}</div>
            </TextFieldDescription>
          </TextField>
        </form>
        <Show when={true}>
          <div class="flex items-center gap-1">
            <ToggleGroup
              value={activity()}
              onChange={(value) => {
                stopActive();
                switch (value) {
                  case "playback":
                    playback();
                    break;
                  case "recording":
                    record();
                    break;
                  case "preview":
                    preview();
                    break;
                }
              }}
            >
              <Tooltip>
                <TooltipTrigger
                  as={ToggleGroupItem}
                  size="icon"
                  value="recording"
                  variant={
                    activity() === "recording" ? "destructive" : "outline"
                  }
                  disabled={activity() !== "recording" && busy()}
                  aria-label={activity() === "recording" ? "Stop" : "Record"}
                >
                  {(state) => (
                    <Dynamic
                      component={state.pressed() ? IconStop : IconRecord}
                    />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {activity() === "recording" ? "Stop" : "Record"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  as={ToggleGroupItem}
                  size="icon"
                  value="preview"
                  variant="outline"
                  disabled={empty()}
                  aria-label={activity() === "preview" ? "Stop" : "Preview"}
                >
                  {(state) => (
                    <Dynamic
                      component={state.pressed() ? IconStop : IconHeadphones}
                    />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {activity() === "preview" ? "Stop" : "Preview"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  as={ToggleGroupItem}
                  size="icon"
                  variant="outline"
                  value="playback"
                  disabled={empty()}
                  aria-label={
                    activity() === "playback" ? "Stop playback" : "Transmit"
                  }
                >
                  {(state) => (
                    <Dynamic
                      component={state.pressed() ? IconStop : IconTransmit}
                    />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {activity() === "playback" ? "Stop" : "Transmit"}
                </TooltipContent>
              </Tooltip>
            </ToggleGroup>
            <DropdownMenu>
              <DropdownMenuTrigger
                as={Button<"button">}
                size="icon"
                variant="outline"
                class="shrink-0 ms-auto data-expanded:bg-input "
                disabled={busy()}
                aria-label="Slot actions"
              >
                <IconDotsVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={props.onUpload}>
                  <IconUpload /> Upload WAV…
                </DropdownMenuItem>
                <DropdownMenuItem disabled={empty()} onSelect={download}>
                  <IconDownload /> Download WAV
                </DropdownMenuItem>
                <DropdownMenuItem disabled={empty()} onSelect={clear}>
                  <IconEraser /> Clear Audio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Show>
      </div>
    </Show>
  );
}
