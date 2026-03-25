import {
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
} from "@repo/flexlib/vita";

const DAX_PACKET_SAMPLES = 128;

const daxAudioTxProcessorURL = URL.createObjectURL(
  new Blob(
    [
      `
class DaxAudioTxProcessor extends AudioWorkletProcessor {
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

    const leftIn = input[0];
    const rightIn = input[1] ?? input[0];
    const left = new Float32Array(leftIn.length);
    const right = new Float32Array(rightIn.length);
    left.set(leftIn);
    right.set(rightIn);
    this.port.postMessage({ left, right }, [left.buffer, right.buffer]);
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
  private readonly streamId: number;
  private readonly leftQueue: number[] = [];
  private readonly rightQueue: number[] = [];
  private readonly audioPkt: VitaDaxAudioPacket;
  private readonly reducedBwPkt: VitaDaxReducedBwPacket;
  private worklet?: AudioWorkletNode;
  private analyser?: AnalyserNode;
  private analyserBuf?: Float32Array;
  private smoothedRms = 0;
  private _peak = -Infinity;
  private peakHoldFrames = 0;
  private static readonly PEAK_HOLD = 120;
  private static readonly PEAK_DECAY = 0.2;
  private packetCount = 0;
  private started = false;

  constructor(
    private readonly data: RTCDataChannel,
    streamId: string,
    private readonly reducedBw = false,
    stream: MediaStream,
  ) {
    this.streamId = parseStreamId(streamId);
    this.source = this.context.createMediaStreamSource(stream);
    this.mute = this.context.createGain();
    this.mute.gain.value = 0;

    this.audioPkt = new VitaDaxAudioPacket();
    this.audioPkt.streamId = this.streamId;
    this.audioPkt.left = new Float32Array(DAX_PACKET_SAMPLES);
    this.audioPkt.right = new Float32Array(DAX_PACKET_SAMPLES);

    this.reducedBwPkt = new VitaDaxReducedBwPacket();
    this.reducedBwPkt.streamId = this.streamId;
    this.reducedBwPkt.samples = new Int16Array(DAX_PACKET_SAMPLES);
  }

  async start(): Promise<void> {
    if (!this.started) {
      await this.context.audioWorklet.addModule(daxAudioTxProcessorURL);
      const worklet = new AudioWorkletNode(this.context, "dax-audio-tx", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      worklet.port.onmessage = (event: MessageEvent<{ left: Float32Array; right: Float32Array }>) => {
        const { left, right } = event.data;
        for (let i = 0; i < left.length; i += 1) {
          this.leftQueue.push(left[i]);
          this.rightQueue.push(right[i]);
        }

        while (this.leftQueue.length >= DAX_PACKET_SAMPLES) {
          let packet: Uint8Array;
          if (this.reducedBw) {
            this.reducedBwPkt.header.packetCount = this.packetCount;
            const s = this.reducedBwPkt.samples;
            for (let i = 0; i < DAX_PACKET_SAMPLES; i += 1) {
              s[i] = Math.round(clamp(this.leftQueue[i]) * 32767);
            }
            packet = this.reducedBwPkt.toBytes();
          } else {
            this.audioPkt.header.packetCount = this.packetCount;
            const l = this.audioPkt.left;
            const r = this.audioPkt.right;
            for (let i = 0; i < DAX_PACKET_SAMPLES; i += 1) {
              l[i] = clamp(this.leftQueue[i]);
              r[i] = clamp(this.rightQueue[i]);
            }
            packet = this.audioPkt.toBytes();
          }

          this.leftQueue.splice(0, DAX_PACKET_SAMPLES);
          this.rightQueue.splice(0, DAX_PACKET_SAMPLES);
          this.packetCount = (this.packetCount + 1) % 16;

          if (this.data.readyState === "open") {
            this.data.send(packet.buffer as ArrayBuffer);
          }
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
    this.analyser.getFloatTimeDomainData(this.analyserBuf as Float32Array<ArrayBuffer>);
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

  get peak(): number { return this._peak; }

  async close(): Promise<void> {
    this.worklet?.disconnect();
    this.mute.disconnect();
    this.source.disconnect();
    await this.context.close();
  }
}

function parseStreamId(streamId: string): number {
  const trimmed = streamId.trim();
  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    return Number.parseInt(trimmed.slice(2), 16);
  }
  return Number.parseInt(trimmed, 10);
}

function clamp(sample: number): number {
  if (sample > 1) return 1;
  if (sample < -1) return -1;
  return sample;
}
