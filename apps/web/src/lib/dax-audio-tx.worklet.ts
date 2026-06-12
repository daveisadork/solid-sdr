declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

const TX_SLOT_WORKLET_FRAMES_CAPTURED = 0;

class DaxAudioTxProcessor extends AudioWorkletProcessor {
  private channelMode = "mono";
  private telemetry: Int32Array | null = null;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data as {
        type?: string;
        mode?: string;
        telemetrySAB?: SharedArrayBuffer;
      };
      if (m?.type === "channelMode" && m.mode) this.channelMode = m.mode;
      if (m?.type === "init" && m.telemetrySAB) {
        this.telemetry = new Int32Array(m.telemetrySAB);
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
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

    let src: Float32Array;
    switch (this.channelMode) {
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
    if (this.telemetry) {
      Atomics.add(this.telemetry, TX_SLOT_WORKLET_FRAMES_CAPTURED, src.length);
    }
    this.port.postMessage({ mono }, [mono.buffer]);
    return true;
  }
}

registerProcessor("dax-audio-tx", DaxAudioTxProcessor);

export {};
