import type { CapturedLog, CapturedMessage } from "./buffers";
import { extractValueSet, sanitize, type ValueSetEntry } from "./sanitize";

export interface ReportMetaInput {
  generatedAt: string;
  solidSdrVersion: string;
  firmwareVersion: string | null;
  model: string | null;
  captureDurationMs: number;
}

export interface ReportInput {
  meta: ReportMetaInput;
  state: unknown;
  messages: readonly CapturedMessage[];
  logs: readonly CapturedLog[];
}

/**
 * Sanitize object keys and string values using the value set.
 * Numbers that match PII values are converted to their token strings
 * so the resulting JSON remains valid.
 */
function sanitizeValue(v: unknown, valueSet: ValueSetEntry[]): unknown {
  if (typeof v === "string") {
    return sanitize(v, valueSet);
  }
  if (typeof v === "number") {
    const s = String(v);
    const sanitized = sanitize(s, valueSet);
    // If the numeric value was replaced, return a string token.
    return sanitized === s ? v : sanitized;
  }
  if (Array.isArray(v)) {
    return v.map((item) => sanitizeValue(item, valueSet));
  }
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const sanitizedKey = sanitize(key, valueSet);
      result[sanitizedKey] = sanitizeValue(obj[key], valueSet);
    }
    return result;
  }
  return v;
}

export function assembleReport(input: ReportInput): string {
  const valueSet = extractValueSet(input.state);

  const meta = {
    ...input.meta,
    messageCount: input.messages.length,
    logCount: input.logs.length,
  };

  const raw = {
    meta,
    state: sanitizeValue(input.state, valueSet),
    messages: sanitizeValue(input.messages, valueSet),
    logs: sanitizeValue(input.logs, valueSet),
  };

  return JSON.stringify(raw, null, 2);
}
