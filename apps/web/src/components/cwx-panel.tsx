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
import { TextField, TextFieldInput } from "./ui/text-field";
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

/**
 * Transmit progress for one block of text, whether it is still being edited in
 * the composer or already committed to the history.
 */
interface MessageBuffer {
  /** Text as submitted, one character per CWX buffer position. */
  text: string;
  /**
   * Radio buffer index of each character, filled in from the send replies.
   * Held per character rather than as a start offset because an erase moves
   * the radio's append point back, so later characters do not continue on
   * from where the earlier ones landed. Official keeps the same mapping in
   * `AMUViewModel._charIndex`.
   */
  indices: number[];
  /** Characters confirmed transmitted via `sent=` status. */
  sent: number;
  /** Offset from which characters were dropped via `erase=` status. */
  erasedFrom: number | null;
}

interface QueuedMessage extends MessageBuffer {
  id: number;
  /** Frequency and time frozen at the moment the message was committed. */
  stamp: MessageStamp;
}

const EMPTY_BUFFER: MessageBuffer = {
  text: "",
  indices: [],
  sent: 0,
  erasedFrom: null,
};

/** Radio buffer indices for `length` characters starting at `start`. */
const indexRange = (start: number, length: number) =>
  Array.from({ length }, (_, offset) => start + offset);

/** True while the radio still owes this buffer some characters. */
const isSending = (buffer: MessageBuffer) =>
  buffer.sent < (buffer.erasedFrom ?? buffer.text.length);

const applyCharSent = (buffer: MessageBuffer, radioIndex: number) => {
  const position = buffer.indices.indexOf(radioIndex);
  if (position < 0) return;
  buffer.sent = Math.max(buffer.sent, position + 1);
};

const applyErase = (buffer: MessageBuffer, start: number, stop: number) => {
  let earliest: number | null = null;
  buffer.indices.forEach((index, position) => {
    if (index < start || index > stop) return;
    if (earliest === null || position < earliest) earliest = position;
  });
  if (earliest === null) return;
  buffer.erasedFrom =
    buffer.erasedFrom === null
      ? earliest
      : Math.min(buffer.erasedFrom, earliest);
};

/** Hz with de-DE thousands separators, as the panadapter readouts do it. */
const formatHz = (frequencyMHz: number) =>
  Math.round(frequencyMHz * 1_000_000).toLocaleString("de-DE");

/** Shared bubble shape; the composer is the same box in input colours. */
const BUBBLE =
  "text-sm font-mono rounded-md border whitespace-pre-wrap break-words uppercase";

/**
 * The TextField focus ring, moved onto the composer bubble: the ring belongs on
 * the box with the border and radius, but focus lands on the editable inside
 * it. Scoped to the editable so the send button's own ring doesn't light it up.
 */
const COMPOSER_RING =
  "ring-offset-background has-[[contenteditable]:focus-visible]:ring-2 has-[[contenteditable]:focus-visible]:ring-ring has-[[contenteditable]:focus-visible]:ring-offset-2";

export function CwxPanel() {
  const { state, radio } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();

  const [setupOpen, setSetupOpen] = createSignal(false);
  const [history, setHistory] = createStore<QueuedMessage[]>([]);
  /** The message being edited — conceptually the newest, unstamped entry. */
  const [composerBuffer, setComposerBuffer] = createStore<MessageBuffer>({
    ...EMPTY_BUFFER,
  });
  let nextId = 1;
  let nextBlock = 1;
  let transcript: HTMLDivElement | undefined;
  let composer: HTMLDivElement | undefined;
  /** Composer text already handed to the radio in live mode. */
  let liveSent = "";

  const cwx = () => radio()?.cwx();
  const macros = () => state.status.cwx.macros ?? EMPTY_MACROS;
  const live = () => preferences.cwx.live;

  /**
   * The queued message the radio is actually working through — the oldest one
   * still owed characters. Only that entry carries the stop button.
   */
  const sendingId = createMemo(() => history.find(isSending)?.id);

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
            for (const message of items) applyCharSent(message, radioIndex);
          }),
        );
        setComposerBuffer(
          produce((buffer) => applyCharSent(buffer, radioIndex)),
        );
      }),
      controller.on("eraseSent", ({ start, stop }) => {
        setHistory(
          produce((items) => {
            for (const message of items) applyErase(message, start, stop);
          }),
        );
        setComposerBuffer(produce((buffer) => applyErase(buffer, start, stop)));
      }),
    ];
    onCleanup(() => {
      for (const subscription of subscriptions) subscription.unsubscribe();
    });
  });

  const pushHistory = (message: Omit<QueuedMessage, "id">) => {
    const id = nextId++;
    setHistory(
      produce((items) => {
        items.push({ ...message, id });
        if (items.length > MAX_HISTORY)
          items.splice(0, items.length - MAX_HISTORY);
      }),
    );
    scrollToLatest();
    return id;
  };

  /**
   * Queues a whole message. The entry lands in the history immediately so a
   * second one can be typed and queued while the radio is still keying the
   * first; the radio's reply only fills in where the text sits in its buffer.
   */
  const sendMessage = async (text: string) => {
    const controller = cwx();
    if (!controller || !text) return;
    const id = pushHistory({ ...EMPTY_BUFFER, text, stamp: stampNow() });
    const block = nextBlock++ & 0xffff;
    try {
      const queued = await controller.send(text, block);
      setHistory(
        (message) => message.id === id,
        "indices",
        indexRange(queued.radioIndex, text.length),
      );
    } catch (error) {
      console.error("CWX send failed", error);
    }
  };

  const sendMacro = async (index: number) => {
    const controller = cwx();
    const text = macros()[index];
    if (!controller || !text) return;
    const id = pushHistory({ ...EMPTY_BUFFER, text, stamp: stampNow() });
    const block = nextBlock++ & 0xffff;
    try {
      const queued = await controller.sendMacro(index, block);
      setHistory(
        (message) => message.id === id,
        "indices",
        indexRange(queued.radioIndex, text.length),
      );
    } catch (error) {
      console.error("CWX macro send failed", error);
    }
  };

  const readComposer = () => composer?.textContent ?? "";

  const clearComposer = () => {
    if (composer) composer.replaceChildren();
    setComposerBuffer({ ...EMPTY_BUFFER });
    liveSent = "";
  };

  /**
   * Repaints the composer with per-character progress colouring. Only live mode
   * ever reaches this — standard mode has nothing sent to colour — and a live
   * line is append-only, so collapsing the caret to the end is safe. Text is
   * read back out of the DOM so a keystroke racing a `sent=` cannot be lost.
   */
  const paintComposer = () => {
    if (!composer) return;
    const text = composer.textContent ?? "";
    const sent = Math.min(composerBuffer.sent, text.length);
    const erasedFrom = composerBuffer.erasedFrom;
    const parts: HTMLElement[] = [];
    const push = (className: string, part: string) => {
      if (!part) return;
      const span = document.createElement("span");
      span.className = className;
      span.textContent = part;
      parts.push(span);
    };
    // Sent characters are plain foreground and pending ones are muted. The
    // history bubble gets its contrast the other way round, from a blue base
    // against text-primary — but --primary equals --foreground, so that pair
    // would be invisible here.
    push("text-foreground", text.slice(0, sent));
    push("text-muted-foreground", text.slice(sent, erasedFrom ?? undefined));
    if (erasedFrom !== null)
      push("text-muted-foreground/50 line-through", text.slice(erasedFrom));
    composer.replaceChildren(...parts);
    if (document.activeElement !== composer) return;
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  createEffect(() => {
    const sent = composerBuffer.sent;
    const erasedFrom = composerBuffer.erasedFrom;
    if (sent === 0 && erasedFrom === null) return;
    paintComposer();
  });

  /** Moves the composer into the history, progress and all, and stamps it. */
  const commit = () => {
    // Not trimmed: these characters are already in the radio's buffer, and
    // dropping a leading space would shift every progress offset.
    const text = readComposer();
    if (!text.trim()) return;
    pushHistory({
      text,
      indices: [...composerBuffer.indices],
      sent: Math.min(composerBuffer.sent, text.length),
      erasedFrom: composerBuffer.erasedFrom,
      stamp: stampNow(),
    });
    clearComposer();
  };

  /**
   * Enter/Send. In live mode the characters are already on their way, so this
   * only commits the line; in standard mode it queues the text.
   */
  const submit = () => {
    if (live()) {
      commit();
      return;
    }
    const text = readComposer().trim();
    if (!text) return;
    clearComposer();
    void sendMessage(text);
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
    const markErased = (buffer: MessageBuffer) => {
      if (buffer.sent >= buffer.text.length) return;
      buffer.erasedFrom =
        buffer.erasedFrom === null
          ? buffer.sent
          : Math.min(buffer.erasedFrom, buffer.sent);
    };
    setHistory(
      produce((items) => {
        for (const message of items) markErased(message);
      }),
    );
    setComposerBuffer(produce(markErased));
  };

  const handleInput = () => {
    const text = readComposer();
    setComposerBuffer("text", text);
    if (!live()) return;
    // Only text added since the last dispatch is new. Editing behind the
    // caret cannot be unsent, so resync silently rather than re-keying.
    if (!text.startsWith(liveSent)) {
      liveSent = text;
      return;
    }
    const delta = text.slice(liveSent.length);
    if (!delta) return;
    liveSent = text;
    void sendLive(delta);
  };

  const sendLive = async (delta: string) => {
    const controller = cwx();
    if (!controller) return;
    const block = nextBlock++ & 0xffff;
    try {
      const queued = await controller.send(delta, block);
      setComposerBuffer("indices", (indices) => [
        ...indices,
        ...indexRange(queued.radioIndex, delta.length),
      ]);
    } catch (error) {
      console.error("CWX live send failed", error);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void abort();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }
    // Mirrors AMUViewModel.RemoveLastCharacter: a character the radio has
    // already keyed cannot be taken back, so the edit is refused outright.
    // Otherwise it is dropped locally and the radio is told to unqueue it.
    if (event.key === "Backspace" && live()) {
      const text = readComposer();
      if (!text || composerBuffer.sent >= text.length) {
        event.preventDefault();
        return;
      }
      // Drop our index for it up front so the erase= status that comes back
      // finds nothing to strike through — the character is already gone here.
      setComposerBuffer("indices", (indices) => indices.slice(0, -1));
      void cwx()
        ?.erase(1)
        .catch((error) => console.error("CWX erase failed", error));
    }
  };

  const handlePaste = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData("text/plain");
    if (text === undefined) return;
    event.preventDefault();
    // Insert as plain text; the radio keys characters, not formatting.
    document.execCommand("insertText", false, text.replace(/\s+/g, " "));
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
    <div class="flex h-full min-h-0 flex-col gap-3">
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
                <ContextMenuTrigger class="block animate-in fade-in  duration-200">
                  <div class="px-1 mb-1 flex items-baseline justify-between gap-2 text-xs leading-none text-muted-foreground tabular-nums">
                    <span>{formatHz(message.stamp.freqMHz)}</span>
                    <span>{message.stamp.time}</span>
                  </div>
                  <div
                    class={`${BUBBLE} p-2 border-info-foreground bg-info text-info-foreground`}
                  >
                    {/* Floated so the message text wraps around it rather than
                        reserving a gutter on every line. */}
                    <Show when={message.id === sendingId()}>
                      <Tooltip>
                        <TooltipTrigger
                          as={Button<"button">}
                          size="icon"
                          variant="destructive"
                          class="float-right ml-2 -mt-1 -mr-1 size-7"
                          onClick={() => void abort()}
                          aria-label="Stop"
                        >
                          <IconStop />
                        </TooltipTrigger>
                        <TooltipContent>
                          Stop sending and clear the buffer
                        </TooltipContent>
                      </Tooltip>
                    </Show>
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
                    onSelect={() => void sendMessage(message.text)}
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

      {/* The composer is the newest entry in the same stack — same bubble, in
          input colours, and with no timestamp because it isn't committed. */}
      <div>
        <div class="px-1 mb-1 flex items-baseline gap-2 text-xs leading-none text-muted-foreground font-mono">
          <span>{formatHz(txSlice()?.frequencyMHz ?? 0)}</span>
        </div>
        {/* The editable carries the padding rather than this wrapper, so the
            whole bubble is the click target and focusing needs no handler.
            contenteditable is focusable and maps to a textbox role on its own,
            so no tabindex or explicit role either. */}
        <div class={`${BUBBLE} ${COMPOSER_RING} border-border`}>
          <Button
            size="icon"
            class="float-right mx-1 mt-1 mb-2 size-7"
            onClick={submit}
            disabled={!composerBuffer.text.trim()}
            aria-label="Send"
          >
            <IconSend />
          </Button>
          {/* biome-ignore lint/a11y/useSemanticElements: an input or textarea
              can neither colour individual characters as the radio keys them
              nor let the text wrap around the floated send button. */}
          <div
            ref={composer}
            contenteditable="plaintext-only"
            role="textbox"
            tabIndex={0}
            aria-label="CWX message"
            class="min-h-7 cursor-text p-2 outline-none"
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
        </div>
      </div>

      <div class="flex items-center gap-2 w-full min-w-0">
        <Toggle
          size="lg"
          variant="outline"
          pressed={live()}
          onChange={(pressed) => setPreferences("cwx", "live", pressed)}
          class="data-pressed:border-destructive data-pressed:bg-destructive data-pressed:text-destructive-foreground min-w-0 flex-auto overflow-hidden px-2"
        >
          Live
        </Toggle>
        <Button
          variant="outline"
          class="min-w-0 flex-auto overflow-hidden px-2"
          onClick={() => setSetupOpen(true)}
        >
          Setup
        </Button>
        <Popover>
          <PopoverTrigger
            as={Button<"button">}
            variant="outline"
            class="min-w-0 flex-auto overflow-hidden px-2 tabular-nums"
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
                  onCapture={() => readComposer().trim()}
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
