import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import IconSend from "~icons/mdi/send";
import IconStop from "~icons/mdi/stop-circle-outline";
import { Button } from "./ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { SimpleSlider } from "./ui/simple-slider";
import { SimpleSwitch } from "./ui/simple-switch";
import { TextField, TextFieldInput, TextFieldTextArea } from "./ui/text-field";
import { Toggle } from "./ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** SmartSDR maps macros to F1–F12; browsers reserve those, so Alt+<key>. */
const MACRO_HOTKEYS = [
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

const PROSIGNS: [string, string][] = [
  ["=", "BT"],
  ["+", "AR"],
  ["(", "KN"],
  ["&", "BK"],
  ["$", "SK"],
];

const EMPTY_MACROS: readonly string[] = Array.from({ length: 12 }, () => "");

/** Keeps the transcript bounded; official caps the stack at MAX_NUM_AMUS. */
const MAX_HISTORY = 100;

interface MessageStamp {
  /** UTC time of day the message was committed, as `HH:mm:ssZ`. */
  time: string;
  /** TX frequency in MHz at commit time; 0 when there was no TX slice. */
  freqMHz: number;
}

interface QueuedMessage {
  id: number;
  /** Text as submitted, one character per CWX buffer position. */
  text: string;
  /** Frozen frequency/time header, or null while a live line is uncommitted. */
  stamp: MessageStamp | null;
  /** Buffer position of the first character, or -1 if the radio didn't say. */
  radioIndex: number;
  /** Characters confirmed transmitted via `sent=` status. */
  sent: number;
  /** Offset from which characters were dropped via `erase=` status. */
  erasedFrom: number | null;
  /** Live-mode entries absorb subsequent contiguous keystrokes. */
  live: boolean;
}

export function CwxPanel() {
  const { state, radio } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();

  const [draft, setDraft] = createSignal("");
  const [setupOpen, setSetupOpen] = createSignal(false);
  const [history, setHistory] = createStore<QueuedMessage[]>([]);
  let nextId = 1;
  let nextBlock = 1;
  let transcript: HTMLDivElement | undefined;
  let composer: HTMLTextAreaElement | undefined;
  /** Composer text already dispatched in live mode; normally "". */
  let liveSent = "";

  const cwx = () => radio()?.cwx();
  const macros = () => state.status.cwx.macros ?? EMPTY_MACROS;
  const live = () => preferences.cwx.live;

  /** True while the radio still has queued characters left to key. */
  const pending = createMemo(() =>
    history.some(
      (message) => message.sent < (message.erasedFrom ?? message.text.length),
    ),
  );

  const txSlice = createMemo(() =>
    Object.values(state.status.slice).find(
      (slice) =>
        slice.isTransmitEnabled && slice.clientHandle === state.clientHandleInt,
    ),
  );

  /** Official stamps commits with `DateTime.UtcNow.ToString("HH:mm:ssZ")`. */
  const utcStamp = () => `${new Date().toISOString().slice(11, 19)}Z`;

  /** Mirrors CWX.getTXFrequency: this client's TX slice, 0 when there is none. */
  const stampNow = (): MessageStamp => ({
    time: utcStamp(),
    freqMHz: txSlice()?.frequencyMHz ?? 0,
  });

  const scrollToLatest = () =>
    queueMicrotask(() => {
      if (transcript) transcript.scrollTop = transcript.scrollHeight;
    });

  createEffect(() => {
    const controller = cwx();
    if (!controller) return;
    const subscriptions = [
      controller.on("charSent", ({ radioIndex }) => {
        setHistory(
          produce((items) => {
            for (const message of items) {
              if (message.radioIndex < 0) continue;
              const offset = radioIndex - message.radioIndex;
              if (offset < 0 || offset >= message.text.length) continue;
              message.sent = Math.max(message.sent, offset + 1);
            }
          }),
        );
      }),
      controller.on("eraseSent", ({ start, stop }) => {
        setHistory(
          produce((items) => {
            for (const message of items) {
              if (message.radioIndex < 0) continue;
              const end = message.radioIndex + message.text.length;
              if (stop < message.radioIndex || start >= end) continue;
              const offset = Math.max(0, start - message.radioIndex);
              message.erasedFrom =
                message.erasedFrom === null
                  ? offset
                  : Math.min(message.erasedFrom, offset);
            }
          }),
        );
      }),
    ];
    onCleanup(() => {
      for (const subscription of subscriptions) subscription.unsubscribe();
    });
  });

  const record = (
    text: string,
    radioIndex: number,
    isLive: boolean,
    stamp: MessageStamp | null,
  ) => {
    setHistory(
      produce((items) => {
        const last = items.at(-1);
        // Live keystrokes land in consecutive buffer slots, so fold them into
        // one transcript line instead of one line per character.
        if (
          isLive &&
          last?.live &&
          last.radioIndex >= 0 &&
          radioIndex === last.radioIndex + last.text.length
        ) {
          last.text += text;
          return;
        }
        items.push({
          id: nextId++,
          text,
          stamp,
          radioIndex,
          sent: 0,
          erasedFrom: null,
          live: isLive,
        });
        if (items.length > MAX_HISTORY)
          items.splice(0, items.length - MAX_HISTORY);
      }),
    );
    scrollToLatest();
  };

  const sendText = async (text: string, isLive: boolean) => {
    const controller = cwx();
    if (!controller || !text) return;
    const block = nextBlock++ & 0xffff;
    // Stamped before the round trip so the header reads when the operator hit
    // send, not when the radio got round to answering. A live line carries no
    // stamp until Enter commits it, as in the official AMU.
    const stamp = isLive ? null : stampNow();
    try {
      const queued = await controller.send(text, block);
      record(text, queued.radioIndex, isLive, stamp);
    } catch (error) {
      console.error("CWX send failed", error);
    }
  };

  const sendMacro = async (index: number) => {
    const controller = cwx();
    const text = macros()[index];
    if (!controller || !text) return;
    const block = nextBlock++ & 0xffff;
    const stamp = stampNow();
    try {
      const queued = await controller.sendMacro(index, block);
      record(text, queued.radioIndex, false, stamp);
    } catch (error) {
      console.error("CWX macro send failed", error);
    }
  };

  /**
   * Clears the textarea itself, not just the signal: a live keystroke leaves
   * the signal at "" both before and after, so the controlled binding has no
   * change to push and the character would otherwise stay on screen — and be
   * re-sent with the next one.
   */
  const clearComposer = () => {
    setDraft("");
    if (composer) composer.value = "";
    liveSent = "";
  };

  const submit = () => {
    const text = draft().trim();
    if (!text) return;
    clearComposer();
    void sendText(text, false);
  };

  const abort = async () => {
    const controller = cwx();
    if (!controller) return;
    try {
      await controller.clearBuffer();
    } catch (error) {
      console.error("CWX abort failed", error);
      return;
    }
    // The radio answers with erase= status, but mark the untransmitted tails
    // immediately so the transcript can't sit showing pending text forever.
    setHistory(
      produce((items) => {
        for (const message of items) {
          if (message.sent >= message.text.length) continue;
          message.erasedFrom =
            message.erasedFrom === null
              ? message.sent
              : Math.min(message.erasedFrom, message.sent);
        }
      }),
    );
  };

  const handleInput = (value: string) => {
    if (!live()) {
      setDraft(value);
      return;
    }
    // Live mode hands each keystroke straight to the radio; the transcript,
    // not the composer, is where the operator watches it go out. Only text
    // added since the last dispatch is new, so a composer that failed to clear
    // costs a stale glyph rather than a re-keyed character.
    if (!value.startsWith(liveSent)) {
      liveSent = value;
      return;
    }
    const delta = value.slice(liveSent.length);
    clearComposer();
    liveSent = composer?.value ?? "";
    if (delta) void sendText(delta, true);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void abort();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (live()) {
        // End the live line without transmitting anything. Committing is what
        // stamps a live line, so its header shows when the operator finished
        // it rather than when the first character went out.
        setHistory(
          produce((items) => {
            const last = items.at(-1);
            if (!last?.live) return;
            last.live = false;
            last.stamp = stampNow();
          }),
        );
        return;
      }
      submit();
      return;
    }
    if (event.key === "Backspace" && live() && !composer?.value) {
      event.preventDefault();
      void cwx()
        ?.erase(1)
        .catch((error) => console.error("CWX erase failed", error));
    }
  };

  createEffect(() => {
    if (!preferences.cwx.macroHotkeys) return;
    if (!preferences.toolsPanelOpen || preferences.toolsPanel !== "cwx") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const index = MACRO_HOTKEYS.findIndex((key) => key.code === event.code);
      if (index === -1) return;
      event.preventDefault();
      void sendMacro(index);
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div class="flex h-full min-h-0 flex-col gap-2">
      <div
        ref={transcript}
        class="min-h-0 flex-1 overflow-y-auto rounded-md font-mono "
        style={{ "scrollbar-width": "thin" }}
      >
        {/* min-h-full + justify-end stacks messages up from the bottom, so the
            newest sits above the composer and older ones ride up. */}
        <div class="flex min-h-full flex-col justify-end gap-3">
          <For each={history}>
            {(message) => (
              <ContextMenu>
                <ContextMenuTrigger class="block">
                  <Show when={message.stamp}>
                    {(stamp) => (
                      <div class="px-1 mb-1 flex items-baseline justify-between gap-2 text-xs leading-none text-muted-foreground tabular-nums">
                        <span>{stamp().freqMHz.toFixed(6)}</span>
                        <span>{stamp().time}</span>
                      </div>
                    )}
                  </Show>
                  <div class="text-sm rounded-md border p-2 border-info-foreground bg-info text-info-foreground whitespace-pre-wrap break-all uppercase">
                    <span class="text-primary">
                      {message.text.slice(0, message.sent)}
                    </span>
                    <span class="text-muted-foreground">
                      {message.text.slice(
                        message.sent,
                        message.erasedFrom ?? undefined,
                      )}
                    </span>
                    <Show when={message.erasedFrom !== null}>
                      <span class="text-muted-foreground/50 line-through">
                        {message.text.slice(message.erasedFrom ?? 0)}
                      </span>
                    </Show>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onSelect={() => void sendText(message.text, false)}
                  >
                    Resend
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => setHistory([])}>
                    Clear history
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )}
          </For>
        </div>
      </div>

      <div class="relative">
        <TextField value={draft()} onChange={handleInput}>
          <TextFieldTextArea
            ref={composer}
            autoResize
            rows="1"
            class="border-border resize-none pr-11 font-mono text-sm uppercase min-h-0"
            placeholder={
              live() ? "Live — every keystroke is sent" : "Type, Enter to send"
            }
            onKeyDown={handleKeyDown}
          />
        </TextField>
        {/* The send affordance doubles as the abort: while the radio still has
            characters queued, stopping matters more than queueing more, and on
            a touch device there is no Escape key. Enter still sends. */}
        <Show
          when={pending()}
          fallback={
            <Button
              size="icon"
              class="absolute bottom-1.5 right-1.5 size-7"
              onClick={submit}
              disabled={live() || !draft()}
              aria-label="Send"
            >
              <IconSend />
            </Button>
          }
        >
          <Tooltip>
            <TooltipTrigger
              as={Button<"button">}
              size="icon"
              variant="destructive"
              class="absolute bottom-1.5 right-1.5 size-7"
              onClick={() => void abort()}
              aria-label="Stop"
            >
              <IconStop />
            </TooltipTrigger>
            <TooltipContent>Stop sending and clear the buffer</TooltipContent>
          </Tooltip>
        </Show>
      </div>

      <div class="flex items-center gap-2">
        <Toggle
          size="lg"
          variant="outline"
          pressed={live()}
          onChange={(pressed) => setPreferences("cwx", "live", pressed)}
          class="data-pressed:border-destructive data-pressed:bg-destructive data-pressed:text-destructive-foreground"
        >
          Live
        </Toggle>
        <Button variant="outline" onClick={() => setSetupOpen(true)}>
          Setup
        </Button>
        <Popover>
          <PopoverTrigger
            as={Button<"button">}
            variant="outline"
            class="tabular-nums"
          >
            {state.status.cwx.speed ?? 25} WPM
          </PopoverTrigger>
          <PopoverContent class="w-56">
            <SimpleSlider
              minValue={5}
              maxValue={100}
              value={[state.status.cwx.speed ?? 25]}
              onChange={([value]) => {
                if (value === state.status.cwx.speed) return;
                void cwx()?.setSpeed(value);
              }}
              getValueLabel={(params) => `${params.values[0]} WPM`}
              label="Speed"
            />
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={setupOpen()} onOpenChange={setSetupOpen}>
        <DialogContent class="max-h-[85svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>CWX Setup</DialogTitle>
          </DialogHeader>

          <SimpleSlider
            minValue={0}
            maxValue={2000}
            step={10}
            value={[state.status.cwx.delay ?? 0]}
            onChange={([value]) => {
              if (value === state.status.cwx.delay) return;
              void cwx()?.setDelay(value);
            }}
            getValueLabel={(params) => `${params.values[0]} ms`}
            label="Break-in Delay"
            description="Time the transmitter stays keyed after the last character."
          />
          <SimpleSwitch
            checked={state.status.cwx.qskEnabled ?? false}
            onChange={(isChecked) => void cwx()?.setQskEnabled(isChecked)}
            label="QSK"
          />
          <SimpleSwitch
            checked={preferences.cwx.macroHotkeys}
            onChange={(isChecked) =>
              setPreferences("cwx", "macroHotkeys", isChecked)
            }
            label="Macro hotkeys"
            description="Alt + 1…9, 0, -, = sends a macro while the CWX panel is open."
          />

          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium">Macros</span>
            <For each={MACRO_HOTKEYS}>
              {(hotkey, index) => (
                <MacroEditor
                  text={macros()[index()] ?? ""}
                  hotkey={hotkey.label}
                  onSave={(text) => {
                    void cwx()
                      ?.setMacro(index(), text)
                      .catch((error) =>
                        console.error("CWX macro save failed", error),
                      );
                  }}
                  onCapture={() => draft().trim()}
                  onSend={() => void sendMacro(index())}
                />
              )}
            </For>
          </div>

          <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Prosigns:</span>
            <For each={PROSIGNS}>
              {([char, name]) => (
                <span>
                  <span class="font-mono text-foreground">{char}</span> {name}
                </span>
              )}
            </For>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MacroEditor(props: {
  text: string;
  hotkey: string;
  onSave: (text: string) => void;
  onCapture: () => string;
  onSend: () => void;
}) {
  const [value, setValue] = createSignal(props.text);
  createEffect(() => setValue(props.text));

  const commit = () => {
    if (value() !== props.text) props.onSave(value());
  };

  return (
    <TextField
      value={value()}
      onChange={setValue}
      class="flex flex-row items-center gap-1.5"
    >
      <span class="w-3 shrink-0 text-center text-[0.625rem] text-muted-foreground">
        {props.hotkey}
      </span>
      <TextFieldInput
        class="h-8 min-w-0 px-2 font-mono text-xs"
        placeholder="empty"
        title="Enter to save · double-click to capture the composer text"
        onBlur={commit}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setValue(props.text);
          }
        }}
        onDblClick={() => {
          const captured = props.onCapture();
          if (captured) setValue(captured);
        }}
      />
      <Button
        size="icon"
        variant="ghost"
        class="size-8 shrink-0"
        disabled={!props.text}
        onClick={props.onSend}
        aria-label={`Send macro ${props.hotkey}`}
      >
        <IconSend />
      </Button>
    </TextField>
  );
}
