// main/udp-discovery.ts
import dgram, { RemoteInfo, Socket } from "node:dgram";
import { EventEmitter } from "node:events";

export interface DiscoveryOptions {
  port?: number; // default 4992
  dualStack?: boolean; // default true (ipv6 socket w/ ipv6Only=false)
  reuseAddr?: boolean; // default true
}

export interface PacketEvent {
  data: Buffer;
  rinfo: RemoteInfo;
}

export class UdpDiscovery extends EventEmitter {
  private sockets: Socket[] = [];
  private running = false;
  private opts: Required<DiscoveryOptions>;

  constructor(opts: DiscoveryOptions = {}) {
    super();
    this.opts = {
      port: opts.port ?? 4992,
      dualStack: opts.dualStack ?? true,
      reuseAddr: opts.reuseAddr ?? true,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const { port, dualStack, reuseAddr } = this.opts;

    const sockets: Socket[] = dualStack
      ? [dgram.createSocket({ type: "udp6", ipv6Only: false, reuseAddr })]
      : [
          dgram.createSocket({ type: "udp4", reuseAddr }),
          dgram.createSocket({ type: "udp6", ipv6Only: true, reuseAddr }),
        ];

    for (const sock of sockets) {
      sock.on("message", (msg: Buffer, rinfo: RemoteInfo) => {
        // Emit raw packet to whoever is listening (main or renderer)
        this.emit("packet", { data: msg, rinfo } as PacketEvent);
      });

      sock.on("error", (err) => {
        console.error("[udp] socket error:", err);
      });

      await new Promise<void>((resolve, reject) => {
        sock.once("listening", resolve);
        sock.once("error", reject);
        sock.bind(port);
      });
    }

    this.sockets = sockets;
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    await Promise.all(
      this.sockets.map(
        (s) =>
          new Promise<void>((resolve) => {
            try {
              s.close(() => resolve());
            } catch {
              resolve();
            }
          }),
      ),
    );

    this.sockets = [];
  }
}
