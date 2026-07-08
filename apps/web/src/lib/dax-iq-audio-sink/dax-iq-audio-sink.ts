import { type AudioStreamDataEvent, VitaDaxIqPacket } from "@repo/flexlib";
import sabWorkletURL from "../sab-ring-sink.worklet.ts?worker&url";
import sinkWorkerURL from "./dax-iq-audio-sink.worker.ts?worker&url";
import { DAX_IQ_RING_FRAMES as RING_FRAMES, type SinkMessage } from "./types";

export interface DaxIqAudioSinkOptions {
  sampleRate: number;
  bufferMs?: number;
}

export class DaxIqAudioSink {
  private readonly ctx: AudioContext;
  private readonly msDest: MediaStreamAudioDestinationNode;
  private readonly audio: HTMLAudioElement;
  private readonly channels = 2;

  private workletNode?: AudioWorkletNode;
  private worker?: Worker;
  private resumePending = false;
  private closed = false;

  private bufferMs: number;
  readonly sampleRate: number;

  constructor({ sampleRate, bufferMs = 50 }: DaxIqAudioSinkOptions) {
    this.sampleRate = sampleRate;
    this.bufferMs = bufferMs;

    this.ctx = new AudioContext({
      sampleRate,
      latencyHint: "interactive",
    });
    this.msDest = new MediaStreamAudioDestinationNode(this.ctx, {
      channelCount: 2,
    });
    this.audio = new Audio();
    this.audio.autoplay = true;
    this.audio.setAttribute("playsinline", "");
    this.audio.srcObject = this.msDest.stream;
  }

  async init(): Promise<void> {
    if (this.closed) return;
    try {
      await this.ctx.audioWorklet.addModule(sabWorkletURL);
    } catch (err) {
      // close() can race the in-flight addModule (e.g. the sink is torn
      // down during a reconnect before the worklet finishes loading),
      // closing the AudioContext and rejecting with AbortError. Benign.
      if (this.closed) return;
      throw err;
    }
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
    });

    const worker = new Worker(sinkWorkerURL, { type: "module" });
    worker.postMessage({
      type: "init",
      channels: this.channels,
      framesPerChannel: RING_FRAMES,
      audioSAB,
      indexSAB,
      bufferMs: this.bufferMs,
      sampleRate: this.sampleRate,
    } satisfies SinkMessage);
    this.worker = worker;

    if (this.ctx.state !== "running") await this.ctx.resume();
    await this.audio.play().catch(() => {});
  }

  play(packet: AudioStreamDataEvent): void {
    if (!this.worker) return;
    if (!(packet instanceof VitaDaxIqPacket)) return;
    this.maybeResume();
    if (!packet.numFrames) return;
    this.worker.postMessage({
      type: "packet",
      kind: "daxIq",
      seq: packet.header.packetCount,
      left: packet.left,
      right: packet.right,
    } satisfies SinkMessage);
  }

  setBufferMs(ms: number): void {
    this.bufferMs = ms;
    this.worker?.postMessage({ type: "bufferMs", ms } satisfies SinkMessage);
  }

  get stream(): MediaStream {
    return this.msDest.stream;
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const target = this.audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!target.setSinkId) return;
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
