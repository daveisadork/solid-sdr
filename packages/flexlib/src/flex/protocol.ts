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

export interface FlexReplyMessage {
  readonly kind: "reply";
  readonly raw: string;
  readonly timestamp: number;
  readonly sequence: number;
  readonly code: number;
  readonly message?: string;
}

export type FlexNoticeSeverity = "info" | "warning" | "error" | "fatal";

export interface FlexNoticeMessage {
  readonly kind: "notice";
  readonly raw: string;
  readonly timestamp: number;
  readonly sequence?: number;
  readonly severity: FlexNoticeSeverity;
  readonly text: string;
  readonly metadata?: Readonly<Record<string, string>>;
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

  return {
    kind: "reply",
    raw: line,
    timestamp,
    sequence,
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

  const parts = body.split("|");
  const sequence = safeParseInt(header);
  const severityToken = parts[0]?.trim().toLowerCase();
  const text = parts[1]?.trim() ?? "";
  const metadataSegment = parts[2];

  if (!severityToken) {
    return {
      kind: "unknown",
      raw: line,
      timestamp,
    };
  }

  const severity = normalizeSeverity(severityToken);
  const metadata = metadataSegment ? parseMetadata(metadataSegment) : undefined;

  return {
    kind: "notice",
    raw: line,
    timestamp,
    sequence: sequence ?? undefined,
    severity,
    text,
    metadata,
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
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^0[xX]/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed.slice(2), 16);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (trimmed.length >= 8) {
    const parsed = Number.parseInt(trimmed, 16);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSeverity(token: string): FlexNoticeSeverity {
  if (token === "warn" || token === "warning") return "warning";
  if (token === "err" || token === "error") return "error";
  if (token === "fatal") return "fatal";
  return "info";
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
          const value = chunk.slice(equals + 1);
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
    if (!segment && positionalTokens.includes("removed")) {
      attributes["removed"] = "1";
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
        const value = chunk.slice(equals + 1);
        attributes[key] = value;
      }
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
    while (end < length && segment[end] !== " ") end += 1;
    const value = segment.slice(index, end);
    attributes[key] = value;
    index = end + 1;
  }
}

function parseMetadata(segment: string): Record<string, string> {
  const attributes = Object.create(null) as Record<string, string>;
  for (const item of segment.split(",")) {
    const equals = item.indexOf("=");
    if (equals === -1) continue;
    const key = item.slice(0, equals).trim();
    const value = item.slice(equals + 1).trim();
    if (key) attributes[key] = value;
  }
  return attributes;
}
