import type { CaptureBuffers, LogLevel } from "./buffers";

const LEVELS: readonly LogLevel[] = ["log", "info", "warn", "error", "debug"];

export function installConsoleCapture(buffers: CaptureBuffers): () => void {
  const originals = new Map<LogLevel, (...args: unknown[]) => void>();
  for (const level of LEVELS) {
    const original = console[level] as (...args: unknown[]) => void;
    originals.set(level, original);
    console[level] = ((...args: unknown[]) => {
      try {
        buffers.recordLog(level, formatArgs(args));
      } catch {
        // never let capture failures break the host page
      }
      original.apply(console, args);
    }) as typeof console.log;
  }

  const onError = (event: ErrorEvent) => {
    const stack = event.error instanceof Error ? event.error.stack : undefined;
    buffers.recordLog("error", event.message || String(event.error), stack);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : safeStringify(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    buffers.recordLog("error", `Unhandled rejection: ${message}`, stack);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    for (const [level, original] of originals) {
      console[level] = original as typeof console.log;
    }
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

function formatArgs(args: readonly unknown[]): string {
  return args.map(formatOne).join(" ");
}

function formatOne(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  return safeStringify(value);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
