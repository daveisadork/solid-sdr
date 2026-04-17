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
import sabWorkletURL from "./dax-audio-sink.worklet.ts?worker&url";
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

  private workletNode?: AudioWorkletNode;
  private worker?: Worker;
  private resumePending = false;
  private analyser?: AnalyserNode;
  private analyserBuf?: Float32Array;
  private smoothedRms = 0;
  private _peak = -Infinity;
  private peakHoldFrames = 0;
  private static readonly PEAK_HOLD = 120; // ~2s at 60fps
  private static readonly PEAK_DECAY = 0.2; // dB per frame

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
  }

  async init(): Promise<void> {
    await this.ctx.audioWorklet.addModule(sabWorkletURL);
    const node = new AudioWorkletNode(this.ctx, "dax-sab-sink", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [this.channels],
    });
    node.connect(this.msDest);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256;
    node.connect(analyser);
    this.analyser = analyser;
    this.analyserBuf = new Float32Array(analyser.fftSize);
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

  getLevel(): number {
    if (!this.analyser || !this.analyserBuf) return -Infinity;
    this.analyser.getFloatTimeDomainData(
      this.analyserBuf as Float32Array<ArrayBuffer>,
    );
    let sum = 0;
    let maxAbs = 0;
    for (const s of this.analyserBuf) {
      sum += s * s;
      const abs = Math.abs(s);
      if (abs > maxAbs) maxAbs = abs;
    }
    const rms = Math.sqrt(sum / this.analyserBuf.length);
    const alpha = rms > this.smoothedRms ? 0.3 : 0.05;
    this.smoothedRms = alpha * rms + (1 - alpha) * this.smoothedRms;
    const peakDb = 20 * Math.log10(Math.max(maxAbs, 1e-7));
    if (peakDb >= this._peak) {
      this._peak = peakDb;
      this.peakHoldFrames = DaxAudioSink.PEAK_HOLD;
    } else if (this.peakHoldFrames > 0) {
      this.peakHoldFrames--;
    } else {
      this._peak = Math.max(this._peak - DaxAudioSink.PEAK_DECAY, peakDb);
    }
    return 20 * Math.log10(Math.max(this.smoothedRms, 1e-7));
  }

  get peak(): number {
    return this._peak;
  }

  async close(): Promise<void> {
    try {
      this.worker?.terminate();
      this.worker = undefined;
      this.workletNode?.disconnect();
      this.analyser?.disconnect();
      this.audio.srcObject = null;
    } finally {
      await this.ctx.close();
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
