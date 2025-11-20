import type { Subscription } from "./events.js";
import type { FlexWireMessage } from "./protocol.js";
import type { DiscoveredGuiClient } from "./gui-client.js";
import type { RadioSnapshot } from "./radio-state/radio.js";

export interface Clock {
  now(): number;
}

export interface Logger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

type DescriptorKeys =
  | "serial"
  | "model"
  | "nickname"
  | "callsign"
  | "availableSlices"
  | "availablePanadapters"
  | "version";

export type FlexRadioDescriptor = Pick<RadioSnapshot, DescriptorKeys> & {
  readonly host: string;
  readonly port: number;
  readonly protocol: "tcp" | "tls";
  readonly discoveryMeta?: Record<string, string | number | boolean>;
  readonly guiClients?: readonly DiscoveredGuiClient[];
};

export interface DiscoveryCallbacks {
  onOnline(radio: FlexRadioDescriptor): void;
  onOffline?(serial: string): void;
  onError?(error: unknown): void;
}

export interface DiscoverySession {
  stop(): Promise<void>;
}

export interface DiscoveryAdapter {
  start(callbacks: DiscoveryCallbacks): Promise<DiscoverySession>;
}

export interface FlexCommandOptions {
  readonly timeoutMs?: number;
  readonly sequenceHint?: number;
}

export interface FlexCommandResponse {
  readonly sequence: number;
  readonly accepted: boolean;
  readonly code?: number;
  readonly message?: string;
  readonly raw: string;
}

export interface FlexControlChannel {
  send(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  onMessage(listener: (message: FlexWireMessage) => void): Subscription;
  onRawLine(listener: (line: string) => void): Subscription;
  close(): Promise<void>;
}

export interface FlexControlFactory {
  connect(
    radio: FlexRadioDescriptor,
    options?: Record<string, unknown>,
  ): Promise<FlexControlChannel>;
}

export type FlexWireChunk =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | Uint8Array;

export interface FlexWireTransportHandlers {
  onData(chunk: FlexWireChunk): void;
  onClose?(cause?: unknown): void;
  onError?(error: unknown): void;
}

export interface FlexWireTransport {
  send(payload: string | Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface FlexWireTransportFactory {
  connect(
    radio: FlexRadioDescriptor,
    handlers: FlexWireTransportHandlers,
    options?: Record<string, unknown>,
  ): Promise<FlexWireTransport>;
}

export interface AudioStreamAdapter {
  openPCMStream(params: {
    streamId: number;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
  }): Promise<WritableAudioStream>;
}

export interface WritableAudioStream {
  write(chunk: ArrayBufferView): Promise<void>;
  close(): Promise<void>;
}

export interface FlexClientAdapters {
  readonly discovery?: DiscoveryAdapter;
  readonly control: FlexControlFactory;
  readonly audio?: AudioStreamAdapter;
  readonly clock?: Clock;
  readonly logger?: Logger;
}
