import type { AudioStreamTxController } from "@repo/flexlib";
import type { DaxChannelMode } from "./dax-audio-sink/types";
import daxAudioTxProcessorURL from "./dax-audio-tx.worklet.ts?worker&url";
import {
  allocTelemetrySAB,
  incr as telemetryIncr,
  set as telemetrySet,
  setMax as telemetrySetMax,
  snapshotTx,
  TX_SLOT_COUNT,
  TxSlot,
  viewTelemetry,
  type TxTelemetrySnapshot,
} from "./dax-audio/telemetry";

const DAX_PACKET_SAMPLES = 128;

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
  private closed = false;
  private channelMode: DaxChannelMode;
  private readonly telemetrySAB = allocTelemetrySAB(TX_SLOT_COUNT);
  private readonly telemetryView = viewTelemetry(this.telemetrySAB);
  private lastSendTimeUs = 0;
  private burstCountThisTick = 0;
  private burstTickScheduled = false;

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
    telemetrySet(
      this.telemetryView,
      TxSlot.CtxSampleRateHz,
      this.context.sampleRate | 0,
    );
  }

  setChannelMode(mode: DaxChannelMode): void {
    this.channelMode = mode;
    this.worklet?.port.postMessage({ type: "channelMode", mode });
  }

  async start(): Promise<void> {
    if (!this.started) {
      if (this.closed) return;
      await this.context.audioWorklet.addModule(daxAudioTxProcessorURL);
      if (this.closed) return;
      const worklet = new AudioWorkletNode(this.context, "dax-audio-tx", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      worklet.port.postMessage({
        type: "init",
        telemetrySAB: this.telemetrySAB,
      });
      worklet.port.postMessage({ type: "channelMode", mode: this.channelMode });

      worklet.port.onmessage = (
        event: MessageEvent<{ mono: Float32Array }>,
      ) => {
        const { mono } = event.data;
        for (let i = 0; i < mono.length; i += 1) {
          this.queue.push(mono[i]);
        }

        const sendOne = () => {
          const nowUs = performance.now() * 1000;
          if (this.lastSendTimeUs > 0) {
            const stallUs = (nowUs - this.lastSendTimeUs) | 0;
            telemetrySetMax(
              this.telemetryView,
              TxSlot.MainSendStallMaxUs,
              stallUs,
            );
            if (stallUs > 10_000) {
              telemetryIncr(
                this.telemetryView,
                TxSlot.MainSendStallOver10msCount,
              );
            }
            if (stallUs > 25_000) {
              telemetryIncr(
                this.telemetryView,
                TxSlot.MainSendStallOver25msCount,
              );
            }
            if (stallUs > 50_000) {
              telemetryIncr(
                this.telemetryView,
                TxSlot.MainSendStallOver50msCount,
              );
            }
            if (stallUs > 100_000) {
              telemetryIncr(
                this.telemetryView,
                TxSlot.MainSendStallOver100msCount,
              );
            }
          }
          this.lastSendTimeUs = nowUs;
          telemetryIncr(this.telemetryView, TxSlot.MainPacketsSent);
          this.burstCountThisTick += 1;
          if (!this.burstTickScheduled) {
            // Collapse bursts within one task into a single high-water-mark update.
            this.burstTickScheduled = true;
            queueMicrotask(() => {
              telemetrySetMax(
                this.telemetryView,
                TxSlot.MainBurstMaxPackets,
                this.burstCountThisTick,
              );
              this.burstCountThisTick = 0;
              this.burstTickScheduled = false;
            });
          }
        };

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
          sendOne();
          this.queue.splice(0, DAX_PACKET_SAMPLES);
        }
      };

      this.source.connect(worklet);
      worklet.connect(this.mute);
      this.mute.connect(this.context.destination);
      this.worklet = worklet;
      this.started = true;
    }

    if (this.closed) return;
    if (this.context.state !== "running") {
      await this.context.resume();
    }
  }

  telemetry(): TxTelemetrySnapshot {
    return snapshotTx(this.telemetryView);
  }

  async close(): Promise<void> {
    this.closed = true;
    console.log("Closing dax tx");
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.mute.disconnect();
    this.source.disconnect();
    if (this.context.state !== "closed") await this.context.close();
  }
}

function clamp(sample: number): number {
  if (sample > 1) return 1;
  if (sample < -1) return -1;
  return sample;
}
