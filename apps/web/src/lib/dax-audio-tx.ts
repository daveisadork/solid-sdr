import type { AudioStreamTxController } from "@repo/flexlib";
import type { DaxChannelMode } from "./dax-audio-sink/types";

const DAX_PACKET_SAMPLES = 128;

const daxAudioTxProcessorURL = URL.createObjectURL(
  new Blob(
    [
      `
class DaxAudioTxProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._channelMode = "mono";
    this.port.onmessage = (e) => {
      if (e.data.type === "channelMode") this._channelMode = e.data.mode;
    };
  }
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (output) {
      for (let c = 0; c < output.length; c += 1) {
        output[c].fill(0);
      }
    }

    if (!input || input.length === 0 || input[0].length === 0) {
      return true;
    }

    // Pick source channel based on mode
    let src;
    switch (this._channelMode) {
      case "right":
        src = input[1] ?? input[0];
        break;
      case "left":
      default:
        src = input[0];
        break;
    }

    const mono = new Float32Array(src.length);
    mono.set(src);
    this.port.postMessage({ mono }, [mono.buffer]);
    return true;
  }
}

registerProcessor("dax-audio-tx", DaxAudioTxProcessor);
      `,
    ],
    { type: "application/javascript" },
  ),
);

export class DaxAudioTx {
  private readonly context = new AudioContext({
    sampleRate: 24_000,
    latencyHint: "interactive",
  });
  private readonly source: MediaStreamAudioSourceNode;
  private readonly mute: GainNode;
  private readonly queue: number[] = [];
  private readonly leftBuf = new Float32Array(DAX_PACKET_SAMPLES);
  private readonly rightBuf = new Float32Array(DAX_PACKET_SAMPLES);
  private readonly int16Buf = new Int16Array(DAX_PACKET_SAMPLES);
  private worklet?: AudioWorkletNode;
  private analyser?: AnalyserNode;
  private analyserBuf?: Float32Array;
  private smoothedRms = 0;
  private _peak = -Infinity;
  private peakHoldFrames = 0;
  private static readonly PEAK_HOLD = 120;
  private static readonly PEAK_DECAY = 0.2;
  private started = false;
  private channelMode: DaxChannelMode;

  constructor(
    private readonly controller: AudioStreamTxController,
    private readonly reducedBw = false,
    stream: MediaStream,
    channelMode: DaxChannelMode = "both",
  ) {
    this.channelMode = channelMode;
    this.source = this.context.createMediaStreamSource(stream);
    this.mute = this.context.createGain();
    this.mute.gain.value = 0;
  }

  setChannelMode(mode: DaxChannelMode): void {
    this.channelMode = mode;
    this.worklet?.port.postMessage({ type: "channelMode", mode });
  }

  async start(): Promise<void> {
    if (!this.started) {
      await this.context.audioWorklet.addModule(daxAudioTxProcessorURL);
      const worklet = new AudioWorkletNode(this.context, "dax-audio-tx", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      worklet.port.postMessage({ type: "channelMode", mode: this.channelMode });

      worklet.port.onmessage = (
        event: MessageEvent<{ mono: Float32Array }>,
      ) => {
        const { mono } = event.data;
        for (let i = 0; i < mono.length; i += 1) {
          this.queue.push(mono[i]);
        }

        while (this.queue.length >= DAX_PACKET_SAMPLES) {
          if (this.reducedBw) {
            const s = this.int16Buf;
            for (let i = 0; i < DAX_PACKET_SAMPLES; i += 1) {
              s[i] = Math.round(clamp(this.queue[i]) * 32767);
            }
            this.controller.sendReducedBwAudio(s);
          } else {
            const l = this.leftBuf;
            const r = this.rightBuf;
            for (let i = 0; i < DAX_PACKET_SAMPLES; i += 1) {
              l[i] = clamp(this.queue[i]);
              r[i] = clamp(this.queue[i]);
            }
            this.controller.sendAudio(l, r);
          }

          this.queue.splice(0, DAX_PACKET_SAMPLES);
        }
      };

      this.source.connect(worklet);
      worklet.connect(this.mute);
      this.mute.connect(this.context.destination);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 256;
      this.source.connect(analyser);
      this.analyser = analyser;
      this.analyserBuf = new Float32Array(analyser.fftSize);
      this.worklet = worklet;
      this.started = true;
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }
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
      this.peakHoldFrames = DaxAudioTx.PEAK_HOLD;
    } else if (this.peakHoldFrames > 0) {
      this.peakHoldFrames--;
    } else {
      this._peak = Math.max(this._peak - DaxAudioTx.PEAK_DECAY, peakDb);
    }
    return 20 * Math.log10(Math.max(this.smoothedRms, 1e-7));
  }

  get peak(): number {
    return this._peak;
  }

  async close(): Promise<void> {
    console.log("Closing dax tx");
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.mute.disconnect();
    this.source.disconnect();
    await this.context.close();
  }
}

function clamp(sample: number): number {
  if (sample > 1) return 1;
  if (sample < -1) return -1;
  return sample;
}
