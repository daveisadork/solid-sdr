const ESCAPED_QUOTE = /\\(["\\])/g;

type KeyValuePair = {
  key: string;
  value: string;
};

function splitKeyValuePairs(input: string): KeyValuePair[] {
  const pairs: KeyValuePair[] = [];
  if (!input) return pairs;

  let current = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const prev = index > 0 ? input[index - 1] : undefined;
    if (char === '"' && prev !== "\\") {
      quoted = !quoted;
    }
    if (char === "," && !quoted) {
      pushPair(current, pairs);
      current = "";
      continue;
    }
    current += char;
  }
  pushPair(current, pairs);
  return pairs;
}

function pushPair(segment: string, pairs: KeyValuePair[]): void {
  const trimmed = segment.trim();
  if (!trimmed) return;
  const equals = trimmed.indexOf("=");
  if (equals === -1) return;
  const key = trimmed.slice(0, equals).trim();
  if (!key) return;
  let value = trimmed.slice(equals + 1).trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }
  value = value.replace(ESCAPED_QUOTE, "$1");
  pairs.push({ key, value });
}

function normalizeCommaSeparatedValues(input: string): string {
  if (!input) return "";
  return input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .join(",");
}

export function parseRadioInfoReply(
  message: string,
): Record<string, string> {
  const attributes = Object.create(null) as Record<string, string>;
  for (const { key, value } of splitKeyValuePairs(message)) {
    attributes[key] = value;
    switch (key) {
      case "name":
        attributes.nickname = value;
        break;
      case "software_ver":
        attributes.version = value;
        break;
      case "gps": {
        const normalized = value.trim().toLowerCase();
        attributes.gps_installed = normalized === "not present" ? "0" : "1";
        if (normalized) attributes.gps_status = value;
        break;
      }
    }
  }
  return attributes;
}

export function parseRadioVersionReply(
  message: string,
): Record<string, string> {
  const attributes = Object.create(null) as Record<string, string>;
  if (!message) return attributes;
  const sections = message.split("#");
  for (const part of sections) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals);
    const value = trimmed.slice(equals + 1);
    if (!key) continue;
    attributes[key] = value;
    if (key === "SmartSDR-MB") {
      attributes.version = value;
    }
  }
  if (message) {
    attributes.versions_raw = message;
  }
  return attributes;
}

export function buildRadioListAttributes(
  attribute: "rx_ant_list" | "mic_list",
  message: string | undefined,
): Record<string, string> {
  const attributes = Object.create(null) as Record<string, string>;
  attributes[attribute] = normalizeCommaSeparatedValues(message ?? "");
  return attributes;
}

