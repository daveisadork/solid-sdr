import type {
  FileDownloadReceiver,
  FlexConnection,
  FlexConnectionEvents,
  FlexTransport,
  FlexTransportEvents,
  RadioEndpoint,
} from "../../../src/flex/transport.js";
import type { Subscription } from "../../../src/util/events.js";

/** One captured TCP payload. `t` is ms since the recording started. */
export interface WireRecord {
  readonly dir: "tx" | "rx";
  readonly t: number;
  readonly data: string;
}

const decoder = new TextDecoder();

/**
 * FlexConnection decorator that records every TCP payload in both directions.
 * Used to capture real handshakes and wire traffic as test fixtures.
 */
export class RecordingConnection implements FlexConnection {
  readonly records: WireRecord[] = [];
  private readonly startedAt = Date.now();

  constructor(private readonly inner: FlexConnection) {}

  private record(dir: "tx" | "rx", data: string | Uint8Array): void {
    this.records.push({
      dir,
      t: Date.now() - this.startedAt,
      data: typeof data === "string" ? data : decoder.decode(data),
    });
  }

  on<K extends keyof FlexConnectionEvents>(
    event: K,
    handler: (payload: FlexConnectionEvents[K]) => void,
  ): Subscription {
    if (event === "tcpData") {
      return this.inner.on("tcpData", (data) => {
        this.record("rx", data);
        (handler as (payload: FlexConnectionEvents["tcpData"]) => void)(data);
      });
    }
    return this.inner.on(event, handler);
  }

  once<K extends keyof FlexConnectionEvents>(
    event: K,
    handler: (payload: FlexConnectionEvents[K]) => void,
  ): Subscription {
    return this.inner.once(event, handler);
  }

  connectTcp(endpoint: RadioEndpoint): Promise<void> {
    return this.inner.connectTcp(endpoint);
  }

  connectUdp(endpoint: RadioEndpoint): Promise<void> {
    return this.inner.connectUdp(endpoint);
  }

  sendTcp(data: string): Promise<void> {
    this.record("tx", data);
    return this.inner.sendTcp(data);
  }

  sendUdp(data: Uint8Array): Promise<void> {
    return this.inner.sendUdp(data);
  }

  openUpload(
    endpoint: RadioEndpoint,
    data: AsyncIterable<Uint8Array>,
  ): Promise<void> {
    return this.inner.openUpload(endpoint, data);
  }

  prepareDownload(endpoint: RadioEndpoint): Promise<FileDownloadReceiver> {
    return this.inner.prepareDownload(endpoint);
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

/**
 * FlexTransport decorator that wraps every created connection in a
 * {@link RecordingConnection} and keeps raw discovery packets.
 */
export class RecordingTransport implements FlexTransport {
  readonly connections: RecordingConnection[] = [];
  /** Raw VITA discovery packets seen while discovery was running. */
  readonly discoveryPackets: Uint8Array[] = [];

  constructor(private readonly inner: FlexTransport) {
    this.inner.on("discoveryData", (packet) => {
      // Keep a bounded set; dedupe is done at artifact-write time.
      if (this.discoveryPackets.length < 64) {
        this.discoveryPackets.push(packet.slice());
      }
    });
  }

  on<K extends keyof FlexTransportEvents>(
    event: K,
    handler: (payload: FlexTransportEvents[K]) => void,
  ): Subscription {
    return this.inner.on(event, handler);
  }

  startDiscovery(): Promise<void> {
    return this.inner.startDiscovery();
  }

  stopDiscovery(): Promise<void> {
    return this.inner.stopDiscovery();
  }

  createConnection(): FlexConnection {
    const conn = new RecordingConnection(this.inner.createConnection());
    this.connections.push(conn);
    return conn;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}
