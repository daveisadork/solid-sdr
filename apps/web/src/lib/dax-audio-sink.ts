import type { AudioStreamDataEvent } from "@repo/flexlib";

export class DaxAudioSink {
  private readonly context = new AudioContext({
    sampleRate: 24_000,
    latencyHint: "interactive",
  });
  private readonly destination = new MediaStreamAudioDestinationNode(
    this.context,
    {
      channelCount: 2,
    },
  );
  private readonly audio = new Audio();
  private playhead = 0;

  constructor() {
    this.audio.autoplay = true;
    this.audio.setAttribute("playsinline", "");
    this.audio.srcObject = this.destination.stream;
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const target = this.audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!target.setSinkId) return;
    await target.setSinkId(deviceId);
  }

  play(event: AudioStreamDataEvent): void {
    const packet = event.packet;
    if (!packet.byteLength) return;

    void this.context.resume().catch(console.error);

    const view = new DataView(
      packet.buffer,
      packet.byteOffset,
      packet.byteLength,
    );
    let buffer: AudioBuffer;

    if (event.kind === "daxAudio") {
      if (packet.byteLength % 8 !== 0) return;

      const sampleCount = packet.byteLength / 8;
      buffer = this.context.createBuffer(2, sampleCount, 24_000);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      for (let i = 0, offset = 0; i < sampleCount; i += 1) {
        left[i] = view.getFloat32(offset);
        offset += 4;
        right[i] = view.getFloat32(offset);
        offset += 4;
      }
    } else if (event.kind === "daxReducedBw") {
      if (packet.byteLength % 2 !== 0) return;

      const sampleCount = packet.byteLength / 2;
      buffer = this.context.createBuffer(2, sampleCount, 24_000);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      for (let i = 0, offset = 0; i < sampleCount; i += 1) {
        const sample = view.getInt16(offset) / 32767;
        offset += 2;
        left[i] = sample;
        right[i] = sample;
      }
    } else {
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.destination);

    const startTime = Math.max(this.playhead, this.context.currentTime);
    source.start(startTime);
    this.playhead = startTime + buffer.duration;
    source.onended = () => source.disconnect();
  }

  async close(): Promise<void> {
    this.audio.srcObject = null;
    await this.context.close();
  }
}
