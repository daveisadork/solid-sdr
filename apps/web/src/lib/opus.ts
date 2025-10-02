type OpusPlayerOpts = {
  /** Always 2 for your stream */
  channels?: number; // default 2
  /** Your stream’s nominal rate */
  sampleRate?: number; // default 24000
  /** Samples per packet per channel (e.g., 240 = 10ms @ 24kHz) */
  frameCount?: number; // default 240
};

export class OpusPlayer {
  private ctx: AudioContext;
  private decoder: AudioDecoder;

  private channels: number;
  private sampleRate: number;
  private frameCount: number;

  // synthetic timeline (microseconds) when caller doesn't provide PTS
  private ptsUsec = 0;
  // scheduling cursor in AudioContext time
  private playheadTime = 0;

  constructor(opts: OpusPlayerOpts = {}) {
    if (!("AudioDecoder" in window)) {
      throw new Error(
        "WebCodecs AudioDecoder not supported — use a WASM Opus decoder fallback.",
      );
    }

    this.channels = opts.channels ?? 2;
    this.sampleRate = opts.sampleRate ?? 24000;
    this.frameCount = opts.frameCount ?? 240;

    this.ctx = new AudioContext(); // typically 44.1k or 48k; Web Audio will resample for us

    const config: AudioDecoderConfig = {
      codec: "opus",
      numberOfChannels: this.channels,
      sampleRate: this.sampleRate,
    };

    this.decoder = new AudioDecoder({
      output: (audioData) => this.onDecoded(audioData),
      error: (e) => console.error("AudioDecoder error:", e),
    });
    this.decoder.configure(config);

    this.playheadTime = this.ctx.currentTime;
  }

  /**
   * Push a single Opus packet.
   * If you have the packet timestamp in microseconds, pass it as ptsUsec; otherwise we synthesize it.
   */
  public push(packet: Uint8Array, ptsUsec?: number) {
    // 240 samples @ 24kHz = 10 ms
    const durationUsec = Math.round(
      (this.frameCount / this.sampleRate) * 1_000_000,
    );

    const timestamp = ptsUsec ?? this.ptsUsec;
    const chunk = new EncodedAudioChunk({
      type: "key",
      timestamp,
      duration: durationUsec,
      data: packet,
    });

    this.decoder.decode(chunk);

    if (ptsUsec == null) this.ptsUsec += durationUsec;
  }

  public async close() {
    try {
      await this.decoder.flush();
    } catch {}
    this.decoder.close();
    await this.ctx.close();
  }

  // -- internals --

  private onDecoded(audioData: AudioData) {
    // Copy planar float PCM from AudioData
    const frames = audioData.numberOfFrames; // should be ~240 or 480 based on decoder
    const ch = audioData.numberOfChannels; // expect 2
    const outRate = audioData.sampleRate; // may be 24000 (as configured)

    const planes: Float32Array[] = [];
    for (let i = 0; i < ch; i++) {
      const p = new Float32Array(frames * 2);
      audioData.copyTo(p, { planeIndex: i, format: "f32" });
      planes.push(p);
    }
    audioData.close();

    // Build a Web Audio buffer (Web Audio will resample to context rate if needed)
    const buffer = this.ctx.createBuffer(ch, frames, outRate);
    for (let i = 0; i < ch; i++) buffer.getChannelData(i).set(planes[i]);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);

    // Schedule slightly ahead to avoid glitches
    const when = Math.max(this.ctx.currentTime + 0.02, this.playheadTime);
    src.start(when);
    this.playheadTime = when + buffer.duration;
  }

  /** Minimal OpusHead blob for WebCodecs description. */
  private static makeOpusHead(
    channels: number,
    inputSampleRate: number,
  ): ArrayBuffer {
    // RFC 7845 §5.1 (mapping=0): 19 bytes
    const b = new Uint8Array(19);
    b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
    b[8] = 1; // version
    b[9] = channels & 0xff; // channel count
    // pre-skip (LE). If you know your encoder pre-skip, set it; 0 keeps latency simplest.
    b[10] = 0;
    b[11] = 0;
    // input sample rate (LE)
    b[12] = inputSampleRate & 0xff;
    b[13] = (inputSampleRate >> 8) & 0xff;
    b[14] = (inputSampleRate >> 16) & 0xff;
    b[15] = (inputSampleRate >> 24) & 0xff;
    // output gain (Q7.8, LE)
    b[16] = 0;
    b[17] = 0;
    // channel mapping (0 = single stream, RTP order)
    b[18] = 0;
    return b.buffer;
  }
}
