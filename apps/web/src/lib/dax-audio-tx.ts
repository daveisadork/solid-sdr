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
      this.worklet = worklet;
      this.started = true;
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }
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
