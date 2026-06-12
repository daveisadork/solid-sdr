import type {
  AudioStreamDataEvent,
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
} from "@repo/flexlib";
import {
  DAX_AUDIO_RING_FRAMES as RING_FRAMES,
  DAX_AUDIO_SAMPLE_RATE as SAMPLE_RATE,
  type DaxChannelMode,
  type SinkMessage,
} from "./types";
import {
  allocTelemetrySAB,
  RX_SLOT_COUNT,
  RxSlot,
  set as telemetrySet,
  snapshotRx,
  viewTelemetry,
  type RxTelemetrySnapshot,
} from "../dax-audio/telemetry";
import sabWorkletURL from "../sab-ring-sink.worklet.ts?worker&url";
import sinkWorkerURL from "./dax-audio-sink.worker.ts?worker&url";

// const sinkWorkerURL = new URL("./dax-audio-sink.worker.ts", import.meta.url);

export interface DaxAudioSinkOptions {
  channels?: number;
  bufferMs?: number;
  channelMode?: DaxChannelMode;
}

export class DaxAudioSink {
  private readonly ctx: AudioContext;
  private readonly msDest: MediaStreamAudioDestinationNode;
  private readonly audio: HTMLAudioElement;
  private readonly channels: number;
  private readonly telemetrySAB = allocTelemetrySAB(RX_SLOT_COUNT);
  private readonly telemetryView = viewTelemetry(this.telemetrySAB);

  private workletNode?: AudioWorkletNode;
  private worker?: Worker;
  private resumePending = false;
  private closed = false;

  private bufferMs: number;
  private channelMode: DaxChannelMode;

  constructor({
    channels = 2,
    bufferMs = 50,
    channelMode = "both",
  }: DaxAudioSinkOptions = {}) {
    this.channels = channels;
    this.bufferMs = bufferMs;
    this.channelMode = channelMode;

    this.ctx = new AudioContext({
      sampleRate: SAMPLE_RATE,
      latencyHint: "interactive",
    });
    this.msDest = new MediaStreamAudioDestinationNode(this.ctx, {
      channelCount: channels,
    });
    this.audio = new Audio();
    this.audio.autoplay = true;
    this.audio.setAttribute("playsinline", "");
    this.audio.srcObject = this.msDest.stream;
    telemetrySet(this.telemetryView, RxSlot.CtxSampleRateHz, this.ctx.sampleRate | 0);
  }

  async init(): Promise<void> {
    if (this.closed) return;
    await this.ctx.audioWorklet.addModule(sabWorkletURL);
    if (this.closed) return;
    const node = new AudioWorkletNode(this.ctx, "sab-ring-sink", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [this.channels],
    });
    node.connect(this.msDest);
    this.workletNode = node;

    const audioSAB = new SharedArrayBuffer(
      this.channels * RING_FRAMES * Float32Array.BYTES_PER_ELEMENT,
    );
    const indexSAB = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);

    node.port.postMessage({
      type: "init",
      channels: this.channels,
      framesPerChannel: RING_FRAMES,
      audioSAB,
      indexSAB,
      telemetrySAB: this.telemetrySAB,
    });

    const worker = new Worker(sinkWorkerURL, { type: "module" });
    worker.postMessage({
      type: "init",
      channels: this.channels,
      framesPerChannel: RING_FRAMES,
      audioSAB,
      indexSAB,
      telemetrySAB: this.telemetrySAB,
      bufferMs: this.bufferMs,
      channelMode: this.channelMode,
    } satisfies SinkMessage);
    this.worker = worker;

    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audio.play().catch(() => {});
  }

  play(event: AudioStreamDataEvent): void {
    if (!this.worker) return;

    const { kind, header } = event;
    this.maybeResume();

    const seq = header.packetCount;

    if (kind === "daxAudio") {
      const pkt = event.packet as VitaDaxAudioPacket;
      if (!pkt.numFrames) return;
      this.worker.postMessage({
        type: "packet",
        kind,
        seq,
        left: pkt.left,
        right: pkt.right,
      } satisfies SinkMessage);
    } else if (kind === "daxReducedBw") {
      const pkt = event.packet as VitaDaxReducedBwPacket;
      if (!pkt.numFrames) return;
      this.worker.postMessage({
        type: "packet",
        kind,
        seq,
        samples: pkt.samples,
      } satisfies SinkMessage);
    } else {
      return;
    }
  }

  setBufferMs(ms: number): void {
    this.bufferMs = ms;
    this.worker?.postMessage({ type: "bufferMs", ms } satisfies SinkMessage);
  }

  setChannelMode(mode: DaxChannelMode): void {
    this.channelMode = mode;
    this.worker?.postMessage({
      type: "channelMode",
      mode,
    } satisfies SinkMessage);
  }

  get stream(): MediaStream {
    return this.msDest.stream;
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const target = this.audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!target.setSinkId) {
      console.warn("setSinkId not supported in this browser");
      return;
    }
    await target.setSinkId(deviceId);
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audio.play().catch(() => {});
  }

  async close(): Promise<void> {
    this.closed = true;
    try {
      this.worker?.terminate();
      this.worker = undefined;
      this.workletNode?.disconnect();
      this.audio.srcObject = null;
    } finally {
      if (this.ctx.state !== "closed") await this.ctx.close();
    }
  }

  /** Returns a fresh snapshot of the telemetry counters. Allocation-free read of atomics. */
  telemetry(): RxTelemetrySnapshot {
    return snapshotRx(this.telemetryView);
  }

  private maybeResume(): void {
    if (this.resumePending || this.ctx.state === "running") return;
    this.resumePending = true;
    void this.ctx
      .resume()
      .then(() => this.audio.play().catch(() => {}))
      .finally(() => {
        this.resumePending = false;
      });
  }
}
