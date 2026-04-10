import {
  Component,
  JSX,
  createEffect,
  createSignal,
  splitProps,
} from "solid-js";

type FrequencyInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "value" | "type" | "onInput"
> & {
  valueHz: number;
  onCommit?: (hz: number) => void | Promise<void>;
  onAbort?: () => void;
};

const digitPattern = /\d/;

const sanitizeDigits = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  return digits.length ? digits : "0";
};

const canonicalDigitsFromHz = (hz: number | undefined): string => {
  const safe = Number.isFinite(hz) ? Math.max(0, Math.round(hz!)) : 0;
  return sanitizeDigits(String(safe));
};

const formatDigits = (rawDigits: string): string => {
  const cleaned = sanitizeDigits(rawDigits);
  const trimmed = cleaned.replace(/^0+(?=\d)/, "");
  const digits = trimmed.length ? trimmed : "0";
  const parts: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    const start = Math.max(i - 3, 0);
    parts.unshift(digits.slice(start, i));
  }
  return parts.join(".");
};

const displayIndexToDigitIndex = (
  display: string,
  displayIndex: number,
): number => {
  let digitsSeen = 0;
  const limit = Math.min(displayIndex, display.length);
  for (let i = 0; i < limit; i++) {
    if (digitPattern.test(display[i]!)) {
      digitsSeen++;
    }
  }
  return digitsSeen;
};

const buildDigitPositions = (display: string): number[] => {
  const positions: number[] = [];
  for (let i = 0; i < display.length; i++) {
    if (digitPattern.test(display[i]!)) {
      positions.push(i);
    }
  }
  return positions;
};

const digitIndexToCaretPosition = (
  display: string,
  digitIndex: number,
): number => {
  if (digitIndex <= 0) return 0;
  const positions = buildDigitPositions(display);
  if (positions.length === 0) return 0;
  if (digitIndex >= positions.length) {
    return display.length;
  }
  let caret = positions[digitIndex - 1] + 1;
  while (caret < display.length && !digitPattern.test(display[caret]!)) {
    caret++;
  }
  return caret;
};

export const FrequencyInput: Component<FrequencyInputProps> = (props) => {
  const [local, others] = splitProps(props, [
    "valueHz",
    "onCommit",
    "onAbort",
    "class",
    "classList",
  ]);

  const [editing, setEditing] = createSignal(false);
  const [digitString, setDigitString] = createSignal(
    canonicalDigitsFromHz(local.valueHz),
  );

  let baselineHz = Number.parseInt(digitString(), 10) || 0;
  let cancelCommit = false;

  const formattedValue = () => formatDigits(digitString());
  const digitsValue = () => Number.parseInt(digitString(), 10) || 0;

  const updateDigits = (
    nextDigits: string,
    caretDigit?: number,
    input?: HTMLInputElement,
  ) => {
    const normalized = sanitizeDigits(nextDigits);
    setDigitString(normalized);
    if (caretDigit === undefined || !input) {
      return;
    }
    const limitedCaret = Math.max(0, Math.min(caretDigit, normalized.length));
    const caretIndex = digitIndexToCaretPosition(
      formatDigits(normalized),
      limitedCaret,
    );
    queueMicrotask(() => input.setSelectionRange(caretIndex, caretIndex));
  };

  const getSelection = (input: HTMLInputElement) => {
    const value = input.value;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    return {
      start: displayIndexToDigitIndex(value, start),
      end: displayIndexToDigitIndex(value, end),
    };
  };

  const commitDigits = async () => {
    const targetHz = Math.max(0, Math.round(digitsValue()));
    if (targetHz === baselineHz) {
      return;
    }
    try {
      await local.onCommit?.(targetHz);
      baselineHz = targetHz;
      setDigitString(canonicalDigitsFromHz(targetHz));
    } catch {
      setDigitString(canonicalDigitsFromHz(baselineHz));
    }
  };

  const handleDigit = (digit: string, input: HTMLInputElement) => {
    const digits = digitString();
    const { start, end } = getSelection(input);
    const selectionLength = Math.max(end - start, 0);

    if (selectionLength === digits.length && digits.length > 0) {
      updateDigits(digit, 1, input);
      return;
    }

    if (selectionLength > 0) {
      const chars = digits.split("");
      const limit = Math.min(selectionLength, chars.length - start);
      for (let i = 0; i < limit; i++) {
        chars[start + i] = i === 0 ? digit : "0";
      }
      const next = chars.join("");
      updateDigits(next, Math.min(start + 1, next.length), input);
      return;
    }

    let next = digits;
    if (start < next.length) {
      next = next.slice(0, start) + digit + next.slice(start + 1);
    } else {
      next = next.slice(0, start) + digit + next.slice(start);
    }
    updateDigits(next, start + 1, input);
  };

  const handleBackspace = (input: HTMLInputElement) => {
    const digits = digitString();
    const { start, end } = getSelection(input);
    if (start === end) {
      if (start === 0) {
        return;
      }
      const chars = digits.split("");
      chars[start - 1] = "0";
      const next = chars.join("");
      updateDigits(next, Math.max(start - 1, 0), input);
    } else {
      const chars = digits.split("");
      for (let i = start; i < Math.min(end, chars.length); i++) {
        chars[i] = "0";
      }
      const next = chars.join("");
      updateDigits(next, start, input);
    }
  };

  const handleDelete = (input: HTMLInputElement) => {
    const digits = digitString();
    const { start, end } = getSelection(input);
    if (start === end) {
      if (start >= digits.length) {
        return;
      }
      const next = digits.slice(0, start) + digits.slice(start + 1);
      updateDigits(next.length ? next : "0", start, input);
    } else {
      const next = digits.slice(0, start) + digits.slice(end);
      updateDigits(next.length ? next : "0", start, input);
    }
  };

  const moveCaret = (delta: number, input: HTMLInputElement) => {
    const digits = digitString();
    const { start, end } = getSelection(input);
    const anchor = start === end ? start : delta < 0 ? start : end;
    const target = Math.max(0, Math.min(digits.length, anchor + delta));
    updateDigits(digits, target, input);
  };

  const handlePaste: JSX.EventHandler<HTMLInputElement, ClipboardEvent> = (
    event,
  ) => {
    event.preventDefault();
    const input = event.currentTarget;
    const pasted = sanitizeDigits(event.clipboardData?.getData("text") ?? "");
    if (!pasted) {
      return;
    }
    const digits = digitString();
    const { start, end } = getSelection(input);
    let next = digits;
    if (start !== end) {
      next = next.slice(0, start) + next.slice(end);
    }
    next = next.slice(0, start) + pasted + next.slice(start);
    updateDigits(next, start + pasted.length, input);
  };

  const handleFocus: JSX.EventHandler<HTMLInputElement, FocusEvent> = () => {
    setEditing(true);
    baselineHz = digitsValue();
    cancelCommit = false;
  };

  const handleEscape = (input: HTMLInputElement) => {
    cancelCommit = true;
    updateDigits(String(baselineHz), digitString().length, input);
    queueMicrotask(() => input.blur());
    local.onAbort?.();
  };

  const handleDot = (input: HTMLInputElement) => {
    const value = digitsValue();
    if (value === 0) {
      updateDigits("0", 1, input);
      return;
    }
    const multiplier = value < 1000 ? "000000" : "000";
    const multiplied = `${value}${multiplier}`;
    updateDigits(
      multiplied,
      Math.max(multiplied.length - multiplier.length, 0),
      input,
    );
  };

  const commitWithScale = async (
    scale: number,
    input: HTMLInputElement,
  ): Promise<void> => {
    updateDigits(String(digitsValue() * scale));
    await commitDigits();
    queueMicrotask(() => input.blur());
  };

  const handleEnter = async (input: HTMLInputElement) => {
    await commitDigits();
    queueMicrotask(() => input.blur());
  };

  const onKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = async (
    event,
  ) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey) {
      return;
    }
    const input = event.currentTarget;
    const { key, altKey } = event;
    if (!altKey && /^[0-9]$/.test(key)) {
      event.preventDefault();
      handleDigit(key, input);
      return;
    }
    switch (key) {
      case "Backspace":
        event.preventDefault();
        handleBackspace(input);
        break;
      case "Delete":
        event.preventDefault();
        handleDelete(input);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveCaret(-1, input);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveCaret(1, input);
        break;
      case "Home":
        event.preventDefault();
        updateDigits(digitString(), 0, input);
        break;
      case "End":
        event.preventDefault();
        updateDigits(digitString(), digitString().length, input);
        break;
      case "Enter":
        event.preventDefault();
        await handleEnter(input);
        break;
      case "Escape":
        event.preventDefault();
        handleEscape(input);
        break;
      case ".":
        event.preventDefault();
        handleDot(input);
        break;
      case "k":
      case "K":
        if (!altKey) {
          event.preventDefault();
          await commitWithScale(1e3, input);
        }
        break;
      case "m":
      case "M":
        if (!altKey) {
          event.preventDefault();
          await commitWithScale(1e6, input);
        }
        break;
      case "g":
      case "G":
        if (!altKey) {
          event.preventDefault();
          await commitWithScale(1e9, input);
        }
        break;
      default:
        break;
    }
  };

  const handleBlur: JSX.EventHandler<HTMLInputElement, FocusEvent> = async (
    event,
  ) => {
    const { currentTarget } = event;
    setEditing(false);
    if (cancelCommit) {
      cancelCommit = false;
      setDigitString(canonicalDigitsFromHz(baselineHz));
      return;
    }
    await commitDigits();
    currentTarget.setSelectionRange(0, 0);
  };

  const valueHzEffect = () => {
    const hz = Math.max(0, Math.round(local.valueHz ?? 0));
    if (editing()) {
      return;
    }
    const canonical = canonicalDigitsFromHz(hz);
    setDigitString(canonical);
    baselineHz = hz;
  };

  createEffect(valueHzEffect);

  return (
    <input
      {...others}
      value={formattedValue()}
      type="text"
      inputMode="numeric"
      autocomplete="off"
      spellcheck={false}
      class={local.class}
      classList={local.classList}
      onKeyDown={onKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPaste={handlePaste}
    />
  );
};
