export type Category =
  | "MAC"
  | "SERIAL"
  | "IP_RADIO"
  | "IP_CLIENT"
  | "HOST"
  | "STATION"
  | "NICKNAME"
  | "CALLSIGN"
  | "GRID"
  | "LAT"
  | "LON";

export interface ValueSetEntry {
  value: string;
  token: string;
}

const MIN_VALUE_LENGTH = 4;
const VALUE_DENYLIST = new Set([
  "0.0.0.0",
  "255.255.255.0",
  "255.255.255.255",
]);

interface RawCollection {
  category: Category;
  values: string[];
}

export function extractValueSet(state: unknown): ValueSetEntry[] {
  const collections: RawCollection[] = [
    { category: "MAC", values: collectMacs(state) },
    { category: "SERIAL", values: collectSerials(state) },
    { category: "IP_RADIO", values: collectRadioIps(state) },
    { category: "IP_CLIENT", values: collectClientIps(state) },
    { category: "HOST", values: collectHosts(state) },
    { category: "STATION", values: collectStations(state) },
    { category: "NICKNAME", values: collectNicknames(state) },
    { category: "CALLSIGN", values: collectCallsigns(state) },
    { category: "GRID", values: collectGrids(state) },
    { category: "LAT", values: collectLatitudes(state) },
    { category: "LON", values: collectLongitudes(state) },
  ];

  const entries: ValueSetEntry[] = [];
  const seen = new Set<string>();

  for (const { category, values } of collections) {
    let n = 1;
    for (const value of values) {
      if (!isKeepable(value)) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      entries.push({ value, token: `<${category}_${n}>` });
      n++;
    }
  }

  entries.sort((a, b) => b.value.length - a.value.length);
  return entries;
}

function isKeepable(value: string): boolean {
  if (value.length < MIN_VALUE_LENGTH) return false;
  if (VALUE_DENYLIST.has(value)) return false;
  return true;
}

export function sanitize(text: string, valueSet: ValueSetEntry[]): string {
  let out = text;
  for (const { value, token } of valueSet) {
    out = replaceAllCaseInsensitive(out, value, token);
  }
  return out;
}

function replaceAllCaseInsensitive(
  haystack: string,
  needle: string,
  replacement: string,
): string {
  if (!needle) return haystack;
  const lowerNeedle = needle.toLowerCase();
  let result = "";
  let i = 0;
  while (i < haystack.length) {
    const slice = haystack.slice(i, i + needle.length);
    if (slice.toLowerCase() === lowerNeedle) {
      result += replacement;
      i += needle.length;
    } else {
      result += haystack[i];
      i++;
    }
  }
  return result;
}

// --- per-category collectors ---

type AnyRecord = Record<string, unknown>;

function asObject(v: unknown): AnyRecord | undefined {
  return typeof v === "object" && v !== null ? (v as AnyRecord) : undefined;
}

function getPath(root: unknown, path: readonly string[]): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    const obj = asObject(cur);
    if (!obj) return undefined;
    cur = obj[seg];
  }
  return cur;
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s !== undefined) out.push(s);
  }
  return out;
}

function eachRecordValue(v: unknown): AnyRecord[] {
  const obj = asObject(v);
  if (!obj) return [];
  const out: AnyRecord[] = [];
  for (const k of Object.keys(obj)) {
    const child = asObject(obj[k]);
    if (child) out.push(child);
  }
  return out;
}

function collectMacs(state: unknown): string[] {
  const out: string[] = [];
  const radio = asString(getPath(state, ["status", "radio", "macAddress"]));
  if (radio) out.push(radio);
  const license = asString(getPath(state, ["status", "featureLicense", "radioId"]));
  if (license) out.push(license);
  for (const r of eachRecordValue(getPath(state, ["discoveredRadios"]))) {
    const v = asString(r.radioLicenseId);
    if (v) out.push(v);
  }
  return out;
}

function collectSerials(state: unknown): string[] {
  const out: string[] = [];
  const radio = asString(getPath(state, ["status", "radio", "serial"]));
  if (radio) out.push(radio);
  for (const r of eachRecordValue(getPath(state, ["discoveredRadios"]))) {
    const v = asString(r.serial);
    if (v) out.push(v);
  }
  return out;
}

function collectRadioIps(state: unknown): string[] {
  const out: string[] = [];
  const paths: readonly (readonly string[])[] = [
    ["status", "radio", "ipAddress"],
    ["status", "radio", "gateway"],
    ["status", "radio", "netmask"],
    ["status", "radio", "wfpIpAddress"],
    ["connectModal", "selectedRadio"],
  ];
  for (const p of paths) {
    const v = asString(getPath(state, p));
    if (v) out.push(v);
  }
  const discovered = asObject(getPath(state, ["discoveredRadios"]));
  if (discovered) {
    for (const key of Object.keys(discovered)) out.push(key);
    for (const r of eachRecordValue(discovered)) {
      const host = asString(r.host);
      if (host) out.push(host);
    }
  }
  return out;
}

function collectClientIps(state: unknown): string[] {
  const out: string[] = [];
  for (const r of eachRecordValue(getPath(state, ["discoveredRadios"]))) {
    out.push(...asStringArray(r.inUseIps));
    out.push(...asStringArray(r.guiClientIps));
    if (Array.isArray(r.guiClients)) {
      for (const gc of r.guiClients) {
        const obj = asObject(gc);
        if (!obj) continue;
        const ip = asString(obj.ip);
        if (ip) out.push(ip);
      }
    }
  }
  for (const r of eachRecordValue(getPath(state, ["status", "audioStream"]))) {
    const v = asString(r.ip);
    if (v) out.push(v);
  }
  return out;
}

function collectHosts(state: unknown): string[] {
  const out: string[] = [];
  for (const r of eachRecordValue(getPath(state, ["discoveredRadios"]))) {
    out.push(...asStringArray(r.inUseHosts));
    out.push(...asStringArray(r.guiClientHosts));
    if (Array.isArray(r.guiClients)) {
      for (const gc of r.guiClients) {
        const obj = asObject(gc);
        if (!obj) continue;
        const host = asString(obj.host);
        if (host) out.push(host);
      }
    }
  }
  return out;
}

function collectStations(state: unknown): string[] {
  const out: string[] = [];
  for (const r of eachRecordValue(getPath(state, ["discoveredRadios"]))) {
    out.push(...asStringArray(r.guiClientStations));
  }
  for (const r of eachRecordValue(getPath(state, ["status", "guiClient"]))) {
    const v = asString(r.station);
    if (v) out.push(v);
  }
  return out;
}

function collectNicknames(state: unknown): string[] {
  const out: string[] = [];
  const radio = asString(getPath(state, ["status", "radio", "nickname"]));
  if (radio) out.push(radio);
  for (const r of eachRecordValue(getPath(state, ["discoveredRadios"]))) {
    const v = asString(r.nickname);
    if (v) out.push(v);
  }
  return out;
}

function collectCallsigns(state: unknown): string[] {
  const out: string[] = [];
  const radio = asString(getPath(state, ["status", "radio", "callsign"]));
  if (radio) out.push(radio);
  for (const r of eachRecordValue(getPath(state, ["discoveredRadios"]))) {
    const v = asString(r.callsign);
    if (v) out.push(v);
  }
  for (const r of eachRecordValue(getPath(state, ["status", "memory"]))) {
    const owner = asString(r.owner);
    if (owner) out.push(owner);
    const name = asString(r.name);
    if (name) out.push(name);
  }
  return out;
}

function collectGrids(state: unknown): string[] {
  const out: string[] = [];
  const v = asString(getPath(state, ["status", "radio", "gpsGrid"]));
  if (v) out.push(v);
  return out;
}

function collectLatitudes(state: unknown): string[] {
  const out: string[] = [];
  const v = asString(getPath(state, ["status", "radio", "gpsLatitude"]));
  if (v) out.push(v);
  return out;
}

function collectLongitudes(state: unknown): string[] {
  const out: string[] = [];
  const v = asString(getPath(state, ["status", "radio", "gpsLongitude"]));
  if (v) out.push(v);
  return out;
}
