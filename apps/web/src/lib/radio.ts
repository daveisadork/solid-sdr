// main/radio-connection.ts
import net from "node:net";
import dgram, { Socket as UdpSocket } from "node:dgram";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import dns from "node:dns/promises";

export enum Status {
  Disconnected,
  Connecting,
  Connected,
  Disconnecting,
}

export interface ConnectTarget {
  host: string; // e.g. "192.168.1.23"
  port: number; // TCP port (UDP will use port+1)
}

export interface TcpConnectedPayload {
  handle: string;
  version: string;
}

export interface UdpPacketPayload {
  data: Buffer; // raw bytes (renderer will parse VRT)
  from: { address: string; port: number; family: "IPv4" | "IPv6" };
  bytes: number;
}

export type TcpMessagePayload = string;

export class RadioConnection extends EventEmitter {
  private status: Status = Status.Disconnected;
  private tcp?: net.Socket;
  private udp?: UdpSocket;
  private cmdCount = 1;
  private handle = "";
  private version = "";

  getStatus() {
    return this.status;
  }
  getHandle() {
    return this.handle;
  }
  getVersion() {
    return this.version;
  }
  getCmdCount() {
    return this.cmdCount;
  }

  /**
   * Connect TCP and UDP (UDP bound to ephemeral local port, connected to tcp.port+1).
   * Emits:
   *  - "status" (Status)
   *  - "tcp-connected" (TcpConnectedPayload)
   *  - "tcp-message" (TcpMessagePayload)
   *  - "udp-packet" (UdpPacketPayload)
   *  - "unknown-packet" (Buffer)  // you can remove if not needed
   */
  async connect({ host, port }: ConnectTarget): Promise<void> {
    console.log(`Connecting to ${host}:${port}...`);
    if (this.status !== Status.Disconnected) {
      return;
    }
    this.setStatus(Status.Connecting);

    // ----- TCP -----
    const tcp = new net.Socket();
    // Set a longer connect/read timeout similar to your Rust (9s)
    tcp.setTimeout(9000);

    await new Promise<void>((resolve, reject) => {
      tcp.once("error", reject);
      tcp.connect(port, host, () => resolve());
    });

    // Clear the one-shot connect error handler
    tcp.removeAllListeners("error");
    this.tcp = tcp;

    // We want read timeouts like Rust's 5–10ms loops. Node doesn't expose a recv timeout,
    // but we can keep the socket flowing; if nothing is received, 'line' simply doesn't fire.

    // Consume line-by-line
    const rl = createInterface({ input: tcp });

    // Stream subsequent TCP lines to renderer
    rl.on("line", (line) => {
      // In Rust you also emitted every server line
      this.emit("tcp-message", line satisfies TcpMessagePayload);
    });

    tcp.on("error", (err) => {
      console.error("[tcp] error:", err);
      this.emit("error", err);
      this.teardown(Status.Disconnected);
    });
    tcp.on("close", () => {
      this.teardown(Status.Disconnected);
    });
    tcp.on("end", () => {
      this.teardown(Status.Disconnected);
    });

    this.cmdCount = 1;
    this.setStatus(Status.Connected);

    // ----- UDP -----
    // Resolve host & family (4 or 6)
    const resolved = net.isIP(host)
      ? { address: host, family: net.isIP(host) as 4 | 6 }
      : await dns.lookup(host, { family: 0 }); // prefer system choice

    const udpServerPort = port + 1;
    const udpType = resolved.family === 6 ? "udp6" : "udp4";

    // Create UDP socket for the correct family
    const udp = dgram.createSocket({ type: udpType, reuseAddr: true });

    // Bind to the same local interface the TCP connection used (optional but mirrors your Rust)
    const localIface = this.tcp!.localAddress; // e.g. "10.16.83.45" or "fe80::..."
    await new Promise<void>((resolve, reject) => {
      udp.once("error", reject);
      udp.bind(0, localIface, () => {
        udp.removeListener("error", reject);
        resolve();
      });
    });

    // Now connect to the server’s UDP endpoint
    await new Promise<void>((resolve, reject) => {
      // Node’s dgram.connect doesn’t take a cb error param; listen for immediate 'error'
      const onErr = (e: unknown) => {
        udp.off("connect", onOk);
        reject(e);
      };
      const onOk = () => {
        udp.off("error", onErr);
        resolve();
      };
      udp.once("error", onErr);
      udp.once("connect", onOk);
      udp.connect(udpServerPort, resolved.address);
    });

    // Optional: log local port & send the "client udpport X" over TCP like your Rust
    const addr = udp.address();
    if (typeof addr !== "string") {
      const clientPort = addr.port;
      const msg = `C0|client udpport ${clientPort}\n`;
      this.tcp!.write(msg);
    }

    // Receive datagrams
    udp.on("message", (msg, rinfo) => {
      this.emit("udp-packet", {
        data: msg,
        from: {
          address: rinfo.address,
          port: rinfo.port,
          family: rinfo.family === "IPv6" ? "IPv6" : "IPv4",
        },
        bytes: msg.length,
      });
    });
    udp.on("error", (err) => {
      console.error("[udp] socket error:", err);
      this.emit("error", err);
      this.teardown(Status.Disconnected);
    });

    this.udp = udp;

    this.emit("tcp-connected", {
      handle: this.handle,
      version: this.version,
    } satisfies TcpConnectedPayload);
  }

  async disconnect(): Promise<void> {
    if (this.status !== Status.Connected && this.status !== Status.Connecting) {
      return;
    }
    this.setStatus(Status.Disconnecting);
    this.teardown(Status.Disconnected);
  }

  /**
   * Send "C{n}|{command}\n" and return the response prefix "R{n}" (like your Rust).
   */
  sendCommand(command: string) {
    if (!this.tcp || this.status !== Status.Connected) {
      console.warn("No TCP connection established.");
      return null;
    }
    try {
      this.tcp.write(command);
    } catch (e) {
      console.error("[tcp] Failed to send command:", command, e);
    }
  }

  // --- internals ---
  private setStatus(s: Status) {
    this.status = s;
    this.emit("status", s);
  }

  private teardown(finalStatus: Status) {
    console.log("Tearing down connections...");
    try {
      this.tcp!.destroy();
      console.log("TCP connection closed.");
    } catch {}
    try {
      this.udp!.close();
      console.log("UDP connection closed.");
    } catch {}
    this.tcp = undefined;
    this.udp = undefined;
    this.setStatus(finalStatus);
  }
}
