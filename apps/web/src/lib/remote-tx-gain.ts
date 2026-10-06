/**
 * Map radio mic level 0–100 to a linear amplitude.
 * 0 is mute, 50 is unity, and 100 is +20 dB (gain 10).
 * The lower half is linear so the control can reach silence.
 * The upper half is logarithmic, 0.4 dB per step.
 */
export function micLevelToGain(level: number): number {
  if (level <= 0) return 0;
  if (level >= 100) return 10;
  if (level <= 50) return level / 50;
  return 10 ** ((level - 50) / 50);
}

/**
 * One GainNode in front of a stable output stream.
 * Swap the microphone with `setInput`. Callers publish `stream` once.
 */
export class RemoteTxGain {
  private readonly context = new AudioContext();
  private readonly gain: GainNode;
  private source?: MediaStreamAudioSourceNode;
  private input?: MediaStream;
  private closed = false;
  readonly stream: MediaStream;

  constructor(micLevel: number) {
    this.gain = this.context.createGain();
    this.gain.gain.value = micLevelToGain(micLevel);
    const destination = this.context.createMediaStreamDestination();
    this.gain.connect(destination);
    this.stream = destination.stream;
  }

  async setInput(input: MediaStream): Promise<void> {
    if (this.closed) {
      for (const track of input.getTracks()) track.stop();
      return;
    }
    this.source?.disconnect();
    for (const track of this.input?.getTracks() ?? []) track.stop();
    this.input = input;
    this.source = this.context.createMediaStreamSource(input);
    this.source.connect(this.gain);
    if (this.context.state !== "running") await this.context.resume();
  }

  setMicLevel(level: number): void {
    if (this.closed) return;
    this.gain.gain.value = micLevelToGain(level);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.source?.disconnect();
    this.gain.disconnect();
    for (const track of this.input?.getTracks() ?? []) track.stop();
    this.input = undefined;
    for (const track of this.stream.getTracks()) track.stop();
    if (this.context.state !== "closed") await this.context.close();
  }
}
