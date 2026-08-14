import { validateDvkWavFile } from "@repo/flexlib";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import IconTransmit from "~icons/mdi/access-point";
import IconDelete from "~icons/mdi/delete-outline";
import IconDotsVertical from "~icons/mdi/dots-vertical";
import IconDownload from "~icons/mdi/download";
import IconEraser from "~icons/mdi/eraser";
import IconHeadphones from "~icons/mdi/headphones";
import IconPlus from "~icons/mdi/plus";
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
import { showToast, showToastPromise } from "./ui/toast";
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

const formatDuration = (ms: number) => `${(ms / 1_000).toFixed(1)}s`;

export function DvkPanel() {
  const { state, radio } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();

  const dvk = () => radio()?.dvk();
  const status = () => state.status.dvk.status;
  const activeId = () => state.status.dvk.statusRecordingId;
  const licensed = () => status() !== "disabled";
  const busy = () =>
    status() === "recording" ||
    status() === "preview" ||
    status() === "playback";
  const txAllowed = () => state.status.radio.txAllowed === true;

  /** Slots in stable display order; position = index + 1 (hotkey/MIDI number). */
  const slots = createMemo(() =>
    [...(state.status.dvk.recordings ?? [])].sort(
      (a, b) => Number(a.id) - Number(b.id),
    ),
  );

  /** A freshly created slot goes straight into rename, SmartSDR-style. */
  const [renamingId, setRenamingId] = createSignal<string>();

  const create = async () => {
    const controller = dvk();
    if (!controller) return;
    try {
      const id = await controller.create();
      setRenamingId(id);
    } catch (error) {
      showToast({
        title: "DVK slot creation failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
    }
  };

  const startPlayback = (id: string) => {
    void dvk()
      ?.startPlayback(id)
      .catch((error) => console.error("DVK playback start failed", error));
  };

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

  const download = (id: string, name: string) => {
    const controller = dvk();
    if (!controller) return;
    showToastPromise(
      (async () => {
        const data = await controller.download(id);
        const url = URL.createObjectURL(
          new Blob([data as BlobPart], { type: "audio/wav" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name || `DVK ${id}`}.wav`;
        a.click();
        URL.revokeObjectURL(url);
      })(),
      {
        loading: "Downloading recording…",
        success: () => "Recording downloaded",
        error: (error) =>
          `Download failed: ${error instanceof Error ? error.message : String(error)}`,
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
      const slot = slots()[index];
      if (!slot || slot.durationMs === 0) return;
      if (!licensed() || busy() || !txAllowed()) return;
      startPlayback(slot.id);
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div class="flex min-h-0 flex-col gap-3">
      <Show when={!licensed()}>
        <div class="rounded-md border border-border p-2 text-sm text-muted-foreground">
          The Digital Voice Keyer requires a SmartSDR+ feature license.
        </div>
      </Show>

      <div class="flex flex-col gap-2">
        <For each={slots()}>
          {(slot, index) => (
            <SlotRow
              id={slot.id}
              name={slot.name}
              durationMs={slot.durationMs}
              hotkey={SLOT_HOTKEYS[index()]?.label}
              status={status()}
              active={activeId() === slot.id && busy()}
              busy={busy()}
              licensed={licensed()}
              txAllowed={txAllowed()}
              renaming={renamingId() === slot.id}
              onRenameStart={() => setRenamingId(slot.id)}
              onRenameEnd={() => setRenamingId(undefined)}
              onRename={(name) => {
                void dvk()
                  ?.setName(slot.id, name)
                  .catch((error) =>
                    showToast({
                      title: "Rename failed",
                      description:
                        error instanceof Error ? error.message : String(error),
                      variant: "error",
                    }),
                  );
              }}
              onRecord={() =>
                void dvk()
                  ?.startRecording(slot.id)
                  .catch((error) => console.error("DVK record failed", error))
              }
              onPreview={() =>
                void dvk()
                  ?.startPreview(slot.id)
                  .catch((error) => console.error("DVK preview failed", error))
              }
              onPlayback={() => startPlayback(slot.id)}
              onStop={stopActive}
              onUpload={() => pickUpload(slot.id)}
              onDownload={() => download(slot.id, slot.name)}
              onClear={() =>
                void dvk()
                  ?.clear(slot.id)
                  .catch((error) => console.error("DVK clear failed", error))
              }
              onRemove={() =>
                void dvk()
                  ?.remove(slot.id)
                  .catch((error) => console.error("DVK remove failed", error))
              }
            />
          )}
        </For>
      </div>

      <Show when={slots().length === 0 && licensed()}>
        <div class="text-sm text-muted-foreground">No recordings yet.</div>
      </Show>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          class="flex-auto"
          disabled={!licensed() || busy()}
          onClick={() => void create()}
        >
          <IconPlus /> New Slot
        </Button>
      </div>

      <SimpleSwitch
        checked={preferences.dvk.playbackHotkeys}
        onChange={(isChecked) =>
          setPreferences("dvk", "playbackHotkeys", isChecked)
        }
        label="Playback Hotkeys"
        description="Alt + 1-9, 0, -, = transmits a recording while the DVK panel is open. Escape stops."
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
  id: string;
  name: string;
  durationMs: number;
  hotkey?: string;
  status?: string;
  active: boolean;
  busy: boolean;
  licensed: boolean;
  txAllowed: boolean;
  renaming: boolean;
  onRenameStart: () => void;
  onRenameEnd: () => void;
  onRename: (name: string) => void;
  onRecord: () => void;
  onPreview: () => void;
  onPlayback: () => void;
  onStop: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onClear: () => void;
  onRemove: () => void;
}) {
  let nameInput: HTMLInputElement | undefined;

  const empty = () => props.durationMs === 0;
  /** This row's activity, or undefined when the radio is busy elsewhere. */
  const activity = () => (props.active ? props.status : undefined);
  /** Everything but this row's own stop control locks while the radio is busy. */
  const locked = () => !props.licensed || props.busy;

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
      current === "recording" ? MAX_RECORD_MS : props.durationMs;
    return {
      width: "100%",
      transition: `width ${expectedMs}ms linear`,
    };
  };

  createEffect(() => {
    if (!props.renaming) return;
    nameInput?.focus();
    nameInput?.select();
  });

  const commitRename = () => {
    const value = nameInput?.value.trim();
    props.onRenameEnd();
    if (!value || value === props.name) return;
    // The ASCII double quote is unrepresentable on the wire (the radio
    // silently ignores it), but UTF-8 curly quotes round-trip intact —
    // convert typographically: opening after start/whitespace, else closing.
    props.onRename(
      value.replace(/"/g, (_match, offset: number, whole: string) =>
        offset === 0 || /\s/.test(whole[offset - 1]) ? "“" : "”",
      ),
    );
  };

  return (
    <div class="relative overflow-hidden rounded-md border border-border">
      <div
        class="absolute inset-y-0 left-0 bg-primary/15"
        style={progressStyle()}
      />
      <div class="relative flex flex-col gap-1 p-2">
        <div class="flex items-baseline gap-2 min-w-0">
          <span class="shrink-0 w-4 text-center font-mono text-xs text-muted-foreground">
            {props.hotkey ?? ""}
          </span>
          <Show
            when={props.renaming}
            fallback={
              <button
                type="button"
                class="min-w-0 flex-auto truncate text-left text-sm"
                title={props.name}
                onDblClick={props.onRenameStart}
              >
                {props.name}
              </button>
            }
          >
            <input
              ref={nameInput}
              class="min-w-0 flex-auto bg-transparent text-sm outline-none border-b border-border"
              value={props.name}
              spellcheck={false}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.stopPropagation();
                  event.currentTarget.value = props.name;
                  event.currentTarget.blur();
                }
              }}
            />
          </Show>
          <span class="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {formatDuration(props.durationMs)}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              as={Button<"button">}
              size="icon"
              variant={activity() === "recording" ? "destructive" : "outline"}
              class="size-7 flex-auto"
              disabled={activity() !== "recording" && locked()}
              onClick={
                activity() === "recording" ? props.onStop : props.onRecord
              }
              aria-label={
                activity() === "recording" ? "Stop recording" : "Record"
              }
            >
              <Show when={activity() === "recording"} fallback={<IconRecord />}>
                <IconStop />
              </Show>
            </TooltipTrigger>
            <TooltipContent>
              {activity() === "recording"
                ? "Stop recording"
                : "Record over this slot (max 10 s)"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              as={Button<"button">}
              size="icon"
              variant={activity() === "preview" ? "destructive" : "outline"}
              class="size-7 flex-auto"
              disabled={activity() !== "preview" && (locked() || empty())}
              onClick={
                activity() === "preview" ? props.onStop : props.onPreview
              }
              aria-label={activity() === "preview" ? "Stop preview" : "Preview"}
            >
              <Show
                when={activity() === "preview"}
                fallback={<IconHeadphones />}
              >
                <IconStop />
              </Show>
            </TooltipTrigger>
            <TooltipContent>
              {activity() === "preview"
                ? "Stop preview"
                : "Play locally without transmitting"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              as={Button<"button">}
              size="icon"
              variant={activity() === "playback" ? "destructive" : "outline"}
              class="size-7 flex-auto"
              disabled={
                activity() !== "playback" &&
                (locked() || empty() || !props.txAllowed)
              }
              onClick={
                activity() === "playback" ? props.onStop : props.onPlayback
              }
              aria-label={
                activity() === "playback" ? "Stop playback" : "Transmit"
              }
            >
              <Show
                when={activity() === "playback"}
                fallback={<IconTransmit />}
              >
                <IconStop />
              </Show>
            </TooltipTrigger>
            <TooltipContent>
              {activity() === "playback"
                ? "Stop playback"
                : "Play and transmit — keys the radio"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger
              as={Button<"button">}
              size="icon"
              variant="ghost"
              class="size-7 shrink-0"
              disabled={locked()}
              aria-label="Slot actions"
            >
              <IconDotsVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={props.onRenameStart}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={props.onUpload}>
                <IconUpload /> Upload WAV…
              </DropdownMenuItem>
              <DropdownMenuItem disabled={empty()} onSelect={props.onDownload}>
                <IconDownload /> Download WAV
              </DropdownMenuItem>
              <DropdownMenuItem disabled={empty()} onSelect={props.onClear}>
                <IconEraser /> Clear Audio
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={props.onRemove}>
                <IconDelete /> Delete Slot
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
