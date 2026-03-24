const DAX_PACKET_SAMPLES = 128;
const VITA_FLEX_OUI = 0x001c2d;
const VITA_FLEX_INFO_CLASS = 0x534c;
const VITA_FLEX_DAX_REDUCED_BW_CLASS = 0x0123;
const VITA_FLEX_DAX_AUDIO_CLASS = 0x03e3;
const VITA_HEADER_BYTES = 28;
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
          const frameLeft = this.leftQueue.splice(0, DAX_PACKET_SAMPLES);
          const frameRight = this.rightQueue.splice(0, DAX_PACKET_SAMPLES);
          const packet = this.reducedBw
            ? buildReducedBwPacket(this.streamId, this.packetCount, frameLeft)
            : buildStereoPacket(
                this.streamId,
                this.packetCount,
                frameLeft,
                frameRight,
              );
          this.packetCount = (this.packetCount + 1) % 16;

          if (this.data.readyState === "open") {
            const payload = packet.slice().buffer as ArrayBuffer;
            this.data.send(payload);
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

function buildStereoPacket(
  streamId: number,
  packetCount: number,
  left: number[],
  right: number[],
): Uint8Array {
  const payloadBytes = DAX_PACKET_SAMPLES * 8;
  const packet = createPacket(
    streamId,
    packetCount,
    VITA_FLEX_DAX_AUDIO_CLASS,
    payloadBytes / 4 + 7,
    payloadBytes,
  );
  const view = new DataView(packet.buffer);
  let offset = VITA_HEADER_BYTES;

  for (let i = 0; i < DAX_PACKET_SAMPLES; i += 1) {
    view.setFloat32(offset, clamp(left[i] ?? 0));
    offset += 4;
    view.setFloat32(offset, clamp(right[i] ?? 0));
    offset += 4;
  }

  return packet;
}

function buildReducedBwPacket(
  streamId: number,
  packetCount: number,
  mono: number[],
): Uint8Array {
  const payloadBytes = DAX_PACKET_SAMPLES * 2;
  const packet = createPacket(
    streamId,
    packetCount,
    VITA_FLEX_DAX_REDUCED_BW_CLASS,
    payloadBytes / 4 + 7,
    payloadBytes,
  );
  const view = new DataView(packet.buffer);
  let offset = VITA_HEADER_BYTES;

  for (let i = 0; i < DAX_PACKET_SAMPLES; i += 1) {
    view.setInt16(offset, Math.round(clamp(mono[i] ?? 0) * 32767));
    offset += 2;
  }

  return packet;
}

function createPacket(
  streamId: number,
  packetCount: number,
  packetClass: number,
  packetSizeWords: number,
  payloadBytes: number,
): Uint8Array {
  const packet = new Uint8Array(VITA_HEADER_BYTES + payloadBytes);
  const view = new DataView(packet.buffer);

  view.setUint8(0, (1 << 4) | (1 << 3));
  view.setUint8(1, (3 << 6) | (1 << 4) | (packetCount & 0x0f));
  view.setUint16(2, packetSizeWords);
  view.setUint32(4, streamId);
  view.setUint32(8, VITA_FLEX_OUI);
  view.setUint16(12, VITA_FLEX_INFO_CLASS);
  view.setUint16(14, packetClass);
  view.setUint32(16, 0);
  view.setUint32(20, 0);
  view.setUint32(24, 0);

  return packet;
}

function clamp(sample: number): number {
  if (sample > 1) return 1;
  if (sample < -1) return -1;
  return sample;
}
