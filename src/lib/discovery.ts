import dgram, { RemoteInfo, Socket } from "node:dgram";
import { EventEmitter } from "node:events";
import { networkInterfaces } from "node:os";

export interface DiscoveryOptions {
  port?: number; // default 4992
  dualStack?: boolean; // default true (ipv6 socket w/ ipv6Only=false)
  reuseAddr?: boolean; // default true

  /** Restart if no packets arrive for this long (ms). 0 to disable. Default 30000. */
  idleRestartMs?: number;
  /** Health check poll interval (ms). Default 5000. */
  healthIntervalMs?: number;
  /** Max backoff when a bind fails (ms). Default 5000. */
  maxBackoffMs?: number;
}

export interface PacketEvent {
  data: Buffer;
  rinfo: RemoteInfo;
}

export class UdpDiscovery extends EventEmitter {
  private sockets: Socket[] = [];
  private running = false;
  private restarting = false;
  private opts: Required<DiscoveryOptions>;
  private lastPacketAt = 0;
  private healthTimer: NodeJS.Timeout | null = null;
  private backoffMs = 0;

  constructor(opts: DiscoveryOptions = {}) {
    super();
    this.opts = {
      port: opts.port ?? 4992,
      dualStack: opts.dualStack ?? true,
      reuseAddr: opts.reuseAddr ?? true,
      idleRestartMs: opts.idleRestartMs ?? 30_000,
      healthIntervalMs: opts.healthIntervalMs ?? 5_000,
      maxBackoffMs: opts.maxBackoffMs ?? 5_000,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.lastPacketAt = Date.now();
    await this.bindAll();
    this.startHealthCheck();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.stopHealthCheck();
    await this.closeAll();
    this.backoffMs = 0;
  }

  /** Optional: call this on system resume/dock events to force a quick rebind. */
  async notifyResume(): Promise<void> {
    if (!this.running) return;
    await this.restart("resume");
  }

  private async bindAll(): Promise<void> {
    const { port, dualStack, reuseAddr } = this.opts;

    const desired: Socket[] = dualStack
      ? [dgram.createSocket({ type: "udp6", ipv6Only: false, reuseAddr })]
      : [
          dgram.createSocket({ type: "udp4", reuseAddr }),
          dgram.createSocket({ type: "udp6", ipv6Only: true, reuseAddr }),
        ];

    // Attach handlers before bind
    for (const sock of desired) {
      sock.on("message", (msg: Buffer, rinfo: RemoteInfo) => {
        this.lastPacketAt = Date.now();
        this.emit("packet", { data: msg, rinfo } as PacketEvent);
      });

      sock.on("error", (err) => {
        // Most socket errors mean we should recreate sockets.
        console.error("[udp] socket error:", err);
        void this.restart("socket-error");
      });

      sock.on("close", () => {
        // If we didn't intentionally stop, try to come back.
        if (this.running) void this.restart("socket-close");
      });
    }

    try {
      await Promise.all(
        desired.map(
          (sock) =>
            new Promise<void>((resolve, reject) => {
              sock.once("listening", resolve);
              sock.once("error", reject);
              sock.bind(port);
            }),
        ),
      );

      // Success: replace sockets, reset backoff
      await this.closeAll(); // close any previous ones safely
      this.sockets = desired;
      this.backoffMs = 0;

      // Small log for debugging
      const ifaces = networkInterfaces();
      const upIfaces = Object.values(ifaces)
        .flat()
        .filter(Boolean)
        .filter((n) => !n!.internal)
        .map((n) => `${n!.address}/${n!.family}`)
        .join(", ");
      console.log(
        `[udp] listening on ${port} (ifaces: ${upIfaces || "unknown"})`,
      );
    } catch (err) {
      // Bind failed: cleanup desired sockets
      for (const s of desired) {
        try {
          s.close();
        } catch {}
      }
      throw err;
    }
  }

  private async closeAll(): Promise<void> {
    if (!this.sockets.length) return;
    const toClose = this.sockets.splice(0, this.sockets.length);
    await Promise.all(
      toClose.map(
        (s) =>
          new Promise<void>((resolve) => {
            try {
              s.removeAllListeners();
              s.close(() => resolve());
            } catch {
              resolve();
            }
          }),
      ),
    );
  }

  private startHealthCheck(): void {
    if (this.healthTimer) return;
    const { healthIntervalMs, idleRestartMs } = this.opts;
    this.healthTimer = setInterval(() => {
      if (!this.running) return;

      // If we've gone a long time without any packets, assume sleep/NIC change
      if (idleRestartMs > 0 && Date.now() - this.lastPacketAt > idleRestartMs) {
        void this.restart("idle");
        return;
      }

      // If all sockets are somehow gone while running, recreate
      if (this.sockets.length === 0) {
        void this.restart("no-sockets");
      }
    }, healthIntervalMs).unref?.();
  }

  private stopHealthCheck(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private async restart(
    reason: "idle" | "socket-error" | "socket-close" | "no-sockets" | "resume",
  ): Promise<void> {
    if (!this.running || this.restarting) return;
    this.restarting = true;

    try {
      await this.closeAll();

      // Jittered exponential backoff on repeated failures
      let attempt = 0;
      while (this.running) {
        try {
          await this.bindAll();
          this.lastPacketAt = Date.now();
          if (attempt > 0)
            console.warn(
              `[udp] recovered after ${attempt} attempt(s), reason=${reason}`,
            );
          break;
        } catch (err) {
          attempt++;
          // Compute next backoff
          this.backoffMs = Math.min(
            this.backoffMs ? this.backoffMs * 2 : 250,
            this.opts.maxBackoffMs,
          );
          const jitter = Math.floor(
            Math.random() * Math.max(50, this.backoffMs / 4),
          );
          const delay = this.backoffMs + jitter;
          console.warn(
            `[udp] restart failed (reason=${reason}). retrying in ${delay}ms…`,
            err,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    } finally {
      this.restarting = false;
    }
  }
}
