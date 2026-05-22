export type FlexWireMessage =
  | FlexStatusMessage
  | FlexReplyMessage
  | FlexNoticeMessage
  | FlexUnknownMessage;

export interface FlexStatusMessage {
  readonly kind: "status";
  readonly raw: string;
  readonly timestamp: number;
  readonly sequence?: number;
  readonly source: string;
  readonly identifier?: string;
  readonly positional: readonly string[];
  readonly attributes: Readonly<Record<string, string>>;
}

export type FlexReplyCodeLevel =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "fatal";

enum _FlexReplyCodeLevel {
  Success = 0,
  Info = 0x10000000,
  Warning = 0x31000000,
  ErrorBase = 0x50000000,
  Error = 0xe2000000,
  Fatal = 0xf3000000,
}

export interface FlexReplyMessage {
  readonly kind: "reply";
  readonly raw: string;
  readonly timestamp: number;
  readonly sequence: number;
  readonly code: number;
  readonly level?: FlexReplyCodeLevel;
  readonly message?: string;
}

export type FlexNoticeSeverity = "info" | "warning" | "error" | "fatal";

export interface FlexNoticeMessage {
  readonly kind: "notice";
  readonly raw: string;
  readonly timestamp: number;
  readonly code: number;
  readonly severity: FlexNoticeSeverity;
  readonly text: string;
}

export interface FlexUnknownMessage {
  readonly kind: "unknown";
  readonly raw: string;
  readonly timestamp: number;
}

export function parseFlexMessage(
  raw: string,
  timestamp: number,
): FlexWireMessage | undefined {
  const line = raw.trim();
  if (!line) return undefined;

  const prefix = line[0];
  if (prefix === "S") return parseStatus(line, timestamp);
  if (prefix === "R") return parseReply(line, timestamp);
  if (prefix === "M") return parseNotice(line, timestamp);

  return {
    kind: "unknown",
    raw: line,
    timestamp,
  };
}

function parseStatus(
  line: string,
  timestamp: number,
): FlexStatusMessage | undefined {
  const { header, body } = splitHeader(line);
  if (body === undefined) return undefined;

  const sequence = safeParseInt(header);
  const normalized = body.trim();
  if (!normalized) return undefined;

  let source: string;
  let remainder: string;
  const firstWhitespace = normalized.indexOf(" ");
  if (firstWhitespace === -1) {
    source = normalized.toLowerCase();
    remainder = "";
  } else {
    source = normalized.slice(0, firstWhitespace).toLowerCase();
    remainder = normalized.slice(firstWhitespace + 1).trimStart();
  }

  const positionalTokens: string[] = [];
  let attributeSegment = "";
  if (remainder) {
    let index = 0;
    const length = remainder.length;
    while (index < length) {
      while (index < length && remainder[index] === " ") index += 1;
      if (index >= length) break;
      const tokenStart = index;
      let nextSpace = remainder.indexOf(" ", index);
      if (nextSpace === -1) nextSpace = length;
      const token = remainder.slice(tokenStart, nextSpace);
      index = nextSpace + 1;
      if (token.includes("=")) {
        attributeSegment = remainder.slice(tokenStart).trim();
        break;
      }
      positionalTokens.push(token);
    }
    if (!attributeSegment && index <= length) {
      attributeSegment = remainder.slice(index).trim();
    }
  }

  let identifier: string | undefined;
  if (positionalTokens.length > 0) {
    identifier = positionalTokens.shift();
  }

  const { attributes, identifier: derivedIdentifier } = parseAttributes(
    source,
    attributeSegment,
    positionalTokens,
    identifier,
  );
  if (!identifier && derivedIdentifier) {
    identifier = derivedIdentifier;
  }

  if (
    !attributes["stream_id"] &&
    positionalTokens.length > 0 &&
    positionalTokens[0].toLowerCase().startsWith("0x")
  ) {
    attributes["stream_id"] = positionalTokens[0];
  }

  return {
    kind: "status",
    raw: line,
    timestamp,
    sequence: sequence ?? undefined,
    source,
    identifier,
    positional: Object.freeze(positionalTokens),
    attributes,
  };
}

function parseReply(
  line: string,
  timestamp: number,
): FlexReplyMessage | undefined {
  const { header, body } = splitHeader(line);
  if (body === undefined) return undefined;

  const payload = body.split("|");
  const sequence = safeParseInt(header);
  const code = parseReplyCode(payload[0]);
  const message = payload[1]?.trim();

  if (sequence === undefined || code === undefined) return undefined;
  let level: FlexReplyCodeLevel | undefined = undefined;
  if (code === _FlexReplyCodeLevel.Success) {
    level = "success";
  } else if ((code & _FlexReplyCodeLevel.Fatal) === _FlexReplyCodeLevel.Fatal) {
    level = "fatal";
  } else if ((code & _FlexReplyCodeLevel.Error) === _FlexReplyCodeLevel.Error) {
    level = "error";
  } else if (
    (code & _FlexReplyCodeLevel.ErrorBase) ===
    _FlexReplyCodeLevel.ErrorBase
  ) {
    level = "error";
  } else if (
    (code & _FlexReplyCodeLevel.Warning) ===
    _FlexReplyCodeLevel.Warning
  ) {
    level = "warning";
  } else if ((code & _FlexReplyCodeLevel.Info) === _FlexReplyCodeLevel.Info) {
    level = "info";
  }

  return {
    kind: "reply",
    raw: line,
    timestamp,
    sequence,
    level,
    code,
    message: message || undefined,
  };
}

function parseNotice(
  line: string,
  timestamp: number,
): FlexNoticeMessage | FlexUnknownMessage | undefined {
  const { header, body } = splitHeader(line);
  if (body === undefined) return undefined;

  const code = parseReplyCode(header);
  if (code === undefined) return { kind: "unknown", raw: line, timestamp };

  const severityBits = (code >>> 24) & 0x3;
  let severity: FlexNoticeSeverity;
  if (severityBits === 1) severity = "warning";
  else if (severityBits === 2) severity = "error";
  else if (severityBits === 3) severity = "fatal";
  else severity = "info";

  return {
    kind: "notice",
    raw: line,
    timestamp,
    code,
    severity,
    text: body,
  };
}

function splitHeader(line: string): { header: string; body?: string } {
  const separatorIndex = line.indexOf("|");
  if (separatorIndex === -1) {
    return { header: line.slice(1), body: undefined };
  }

  return {
    header: line.slice(1, separatorIndex),
    body: line.slice(separatorIndex + 1),
  };
}

function safeParseInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseReplyCode(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 16);
  return Number.isFinite(parsed) ? parsed : undefined;
}


function parseAttributes(
  source: string,
  segment: string,
  positionalTokens: readonly string[],
  identifier?: string,
): { attributes: Record<string, string>; identifier?: string } {
  const attributes = Object.create(null) as Record<string, string>;

  if (source === "meter") {
    let meterId = identifier;
    if (segment) {
      if (segment.includes("#")) {
        for (const piece of segment.split("#")) {
          const chunk = piece.trim();
          if (!chunk) continue;
          const equals = chunk.indexOf("=");
          if (equals === -1) continue;
          const keyPart = chunk.slice(0, equals);
          const value = normalizeStatusAttributeValue(chunk.slice(equals + 1));
          const dot = keyPart.indexOf(".");
          if (dot !== -1) {
            const prefix = keyPart.slice(0, dot);
            if (!meterId) meterId = prefix;
            const key = keyPart.slice(dot + 1);
            attributes[key] = value;
          } else {
            attributes[keyPart] = value;
          }
        }
      } else {
        parseSpaceSeparatedAttributes(segment, attributes);
      }
    }
    if (!meterId && positionalTokens.length > 0) {
      meterId = positionalTokens[0];
    }
    return { attributes, identifier: meterId };
  }

  if (source === "gps") {
    if (segment) {
      for (const piece of segment.split("#")) {
        const chunk = piece.trim();
        if (!chunk) continue;
        const equals = chunk.indexOf("=");
        if (equals === -1) continue;
        const key = chunk.slice(0, equals);
        const value = normalizeStatusAttributeValue(chunk.slice(equals + 1));
        attributes[key] = value;
      }
    }
    return { attributes, identifier: identifier ?? "gps" };
  }

  if (source === "profile") {
    if (!segment) return { attributes, identifier };
    const equals = segment.indexOf("=");
    if (equals === -1) {
      const key = segment.trim();
      if (key) attributes[key] = "";
    } else {
      const key = segment.slice(0, equals).trim();
      const value = normalizeStatusAttributeValue(segment.slice(equals + 1));
      if (key) attributes[key] = value;
    }
    return { attributes, identifier };
  }

  if (!segment) return { attributes, identifier };

  parseSpaceSeparatedAttributes(segment, attributes);

  return { attributes, identifier };
}

function parseSpaceSeparatedAttributes(
  segment: string,
  attributes: Record<string, string>,
): void {
  let index = 0;
  const length = segment.length;
  while (index < length) {
    while (index < length && segment[index] === " ") index += 1;
    if (index >= length) break;
    const equals = segment.indexOf("=", index);
    if (equals === -1) {
      const token = segment.slice(index).trim();
      if (token) attributes[token] = "";
      break;
    }
    const key = segment.slice(index, equals);
    index = equals + 1;
    let end = index;
    let quoted = false;
    while (end < length) {
      const char = segment[end];
      const prev = end > index ? segment[end - 1] : undefined;
      if (char === '"' && prev !== "\\") {
        quoted = !quoted;
      } else if (char === " " && !quoted) {
        break;
      }
      end += 1;
    }
    const value = normalizeStatusAttributeValue(segment.slice(index, end));
    attributes[key] = value;
    index = end + 1;
  }
}

const ESCAPED_STATUS_QUOTE = /\\(["\\])/g;

function normalizeStatusAttributeValue(value: string): string {
  let v = value;
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    v = v.slice(1, -1).replace(ESCAPED_STATUS_QUOTE, "$1");
  }
  return v.replace(/\u007f/g, " ").trim();
}

