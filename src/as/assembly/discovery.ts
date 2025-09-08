class DiscoveryPayload {
  model: string = ""; // "FLEX-8600"
  serial: string = ""; // "1225-1213-8600-7918"
  version: string = ""; // "3.8.23.35640"
  nickname: string = ""; // "FlexRadio"
  callsign: string = ""; // "KF0SMY"
  ip: string = ""; // "10.16.83.234";
  port: u16 = 0; // 4992
  status: string = ""; // "Available"
  inuse_ip: string[] = new Array<string>(); // ""
  inuse_host: string[] = new Array<string>(); // ""
  max_licensed_version: string = ""; // "v3"
  radio_license_id: string = ""; // "00-1C-2D-05-33-BA"
  requires_additional_license: bool = false; //
  fpc_mac: string = ""; //""
  wan_connected: bool = false;
  licensed_clients: u8 = 0;
  available_clients: u8 = 0;
  max_panadapters: u8 = 0;
  available_panadapters: u8 = 0;
  max_slices: u8 = 0;
  available_slices: u8 = 0;
  gui_client_ips: string[] = new Array<string>(); //""
  gui_client_hosts: string[] = new Array<string>(); // ""
  gui_client_programs: string[] = new Array<string>(); // ""
  gui_client_stations: string[] = new Array<string>(); // ""
  gui_client_handles: string[] = new Array<string>(); // ""
  min_software_version: string = ""; // "3.8.0.0"
  discovery_protocol_version: string = ""; // "3.0.0.3"
  external_port_link: bool = false; // "1"
}

type Setter = (d: DiscoveryPayload, v: string) => void;

// trivial cleaners (Flex strings sometimes contain NUL/DEL)

function clean(v: string): string {
  return v.replace("\u0000", "").replace("\u007f", "");
}

function toBoolNum(v: string): bool {
  // fields are "0"/"1"
  return u8.parse(v) != 0;
}

function toCsv(v: string): string[] {
  return v.length ? v.split(",") : new Array<string>();
}

// setters (no captures/closures)
function set_port(d: DiscoveryPayload, v: string): void {
  d.port = u16.parse(v);
}
function set_licensed_clients(d: DiscoveryPayload, v: string): void {
  d.licensed_clients = u8.parse(v);
}
function set_available_clients(d: DiscoveryPayload, v: string): void {
  d.available_clients = u8.parse(v);
}
function set_max_pan(d: DiscoveryPayload, v: string): void {
  d.max_panadapters = u8.parse(v);
}
function set_avail_pan(d: DiscoveryPayload, v: string): void {
  d.available_panadapters = u8.parse(v);
}
function set_max_slices(d: DiscoveryPayload, v: string): void {
  d.max_slices = u8.parse(v);
}
function set_avail_slices(d: DiscoveryPayload, v: string): void {
  d.available_slices = u8.parse(v);
}

function set_req_addl(d: DiscoveryPayload, v: string): void {
  d.requires_additional_license = toBoolNum(v);
}
function set_ext_link(d: DiscoveryPayload, v: string): void {
  d.external_port_link = toBoolNum(v);
}
function set_wan(d: DiscoveryPayload, v: string): void {
  d.wan_connected = toBoolNum(v);
}

function set_model(d: DiscoveryPayload, v: string): void {
  d.model = clean(v);
}
function set_serial(d: DiscoveryPayload, v: string): void {
  d.serial = clean(v);
}
function set_version(d: DiscoveryPayload, v: string): void {
  d.version = clean(v);
}
function set_nickname(d: DiscoveryPayload, v: string): void {
  d.nickname = clean(v);
}
function set_callsign(d: DiscoveryPayload, v: string): void {
  d.callsign = clean(v);
}
function set_ip(d: DiscoveryPayload, v: string): void {
  d.ip = clean(v);
}
function set_status(d: DiscoveryPayload, v: string): void {
  d.status = clean(v);
}
function set_max_lic_ver(d: DiscoveryPayload, v: string): void {
  d.max_licensed_version = clean(v);
}
function set_radio_lic_id(d: DiscoveryPayload, v: string): void {
  d.radio_license_id = clean(v);
}
function set_fpc_mac(d: DiscoveryPayload, v: string): void {
  d.fpc_mac = clean(v);
}
function set_min_sw(d: DiscoveryPayload, v: string): void {
  d.min_software_version = clean(v);
}
function set_disc_proto(d: DiscoveryPayload, v: string): void {
  d.discovery_protocol_version = clean(v);
}

function set_inuse_ip(d: DiscoveryPayload, v: string): void {
  d.inuse_ip = toCsv(clean(v));
}
function set_inuse_host(d: DiscoveryPayload, v: string): void {
  d.inuse_host = toCsv(clean(v));
}
function set_gui_ips(d: DiscoveryPayload, v: string): void {
  d.gui_client_ips = toCsv(clean(v));
}
function set_gui_hosts(d: DiscoveryPayload, v: string): void {
  d.gui_client_hosts = toCsv(clean(v));
}
function set_gui_programs(d: DiscoveryPayload, v: string): void {
  d.gui_client_programs = toCsv(clean(v));
}
function set_gui_stations(d: DiscoveryPayload, v: string): void {
  d.gui_client_stations = toCsv(clean(v));
}
function set_gui_handles(d: DiscoveryPayload, v: string): void {
  d.gui_client_handles = toCsv(clean(v));
}

// one-time static dispatch table
let _setters: Map<string, Setter> | null = null;
function setters(): Map<string, Setter> {
  let m = _setters;
  if (m !== null) return m as Map<string, Setter>;

  m = new Map<string, Setter>();
  // numeric
  m.set("port", set_port);
  m.set("licensed_clients", set_licensed_clients);
  m.set("available_clients", set_available_clients);
  m.set("max_panadapters", set_max_pan);
  m.set("available_panadapters", set_avail_pan);
  m.set("max_slices", set_max_slices);
  m.set("available_slices", set_avail_slices);
  // booleans
  m.set("requires_additional_license", set_req_addl);
  m.set("external_port_link", set_ext_link);
  m.set("wan_connected", set_wan);
  // strings
  m.set("model", set_model);
  m.set("serial", set_serial);
  m.set("version", set_version);
  m.set("nickname", set_nickname);
  m.set("callsign", set_callsign);
  m.set("ip", set_ip);
  m.set("status", set_status);
  m.set("max_licensed_version", set_max_lic_ver);
  m.set("radio_license_id", set_radio_lic_id);
  m.set("fpc_mac", set_fpc_mac);
  m.set("min_software_version", set_min_sw);
  m.set("discovery_protocol_version", set_disc_proto);
  // csv arrays
  m.set("inuse_ip", set_inuse_ip);
  m.set("inuse_host", set_inuse_host);
  m.set("gui_client_ips", set_gui_ips);
  m.set("gui_client_hosts", set_gui_hosts);
  m.set("gui_client_programs", set_gui_programs);
  m.set("gui_client_stations", set_gui_stations);
  m.set("gui_client_handles", set_gui_handles);

  _setters = m;
  return m;
}

// ---------- parser ----------
export function parseDiscoveryPayload(data: Uint8Array): DiscoveryPayload {
  const d = new DiscoveryPayload();

  // decode only the slice:
  const str = String.UTF8.decode(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
  if (str.length == 0) return d;

  const m = setters();
  const parts = str.split(" ");
  for (let i = 0; i < parts.length; i++) {
    const kv = parts[i];
    if (!kv.length) continue;
    const eq = kv.indexOf("=");
    if (eq < 0) continue;
    const key = kv.substring(0, eq);
    const value = kv.substring(eq + 1);

    const f = m.get(key);
    if (f) {
      f(d, value);
    } else {
      console.warn(`Unknown discovery item: ${key}=${value}`);
    }
  }
  return d;
}
