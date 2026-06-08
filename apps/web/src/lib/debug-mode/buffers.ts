export type Direction = "in" | "out";

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface CapturedMessage {
  ts: number;
  dir: Direction;
  line: string;
}

export interface CapturedLog {
  ts: number;
  level: LogLevel;
  message: string;
  stack?: string;
}

export class CaptureBuffers {
  readonly messages: CapturedMessage[] = [];
  readonly logs: CapturedLog[] = [];
  readonly startedAt: number = Date.now();

  recordMessage(dir: Direction, line: string): void {
    this.messages.push({ ts: this.now(), dir, line });
  }

  recordLog(level: LogLevel, message: string, stack?: string): void {
    const entry: CapturedLog = { ts: this.now(), level, message };
    if (stack !== undefined) entry.stack = stack;
    this.logs.push(entry);
  }

  get messageCount(): number {
    return this.messages.length;
  }

  get logCount(): number {
    return this.logs.length;
  }

  get captureDurationMs(): number {
    return this.now();
  }

  private now(): number {
    return Date.now() - this.startedAt;
  }
}
