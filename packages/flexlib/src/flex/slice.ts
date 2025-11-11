import type { FlexCommandOptions, FlexCommandResponse } from "./adapters.js";
import type { SliceSnapshot, SliceStateChange } from "./radio-state.js";
import { TypedEventEmitter, type Subscription } from "./events.js";
import { FlexStateUnavailableError } from "./errors.js";

export type SliceAgcMode = "off" | "slow" | "med" | "fast" | (string & {});
export type SliceToneMode = "off" | "ctcss_tx" | (string & {});
export type SliceRepeaterOffsetDirection =
  | "down"
  | "simplex"
  | "up"
  | (string & {});

export interface SliceControllerEvents extends Record<string, unknown> {
  readonly change: SliceStateChange;
}

export interface SliceUpdateRequest {
  frequencyMHz?: number;
  mode?: string;
  isActive?: boolean;
  isLocked?: boolean;
  isTransmitEnabled?: boolean;
  rxAntenna?: string;
  txAntenna?: string | null;
  daxChannel?: number;
  rfGain?: number;
  filterLowHz?: number;
  filterHighHz?: number;
  rttyMarkHz?: number;
  rttyShiftHz?: number;
  diglOffsetHz?: number;
  diguOffsetHz?: number;
  audioPan?: number;
  audioGain?: number;
  isMuted?: boolean;
  anfEnabled?: boolean;
  anfLevel?: number;
  apfEnabled?: boolean;
  apfLevel?: number;
  wnbEnabled?: boolean;
  wnbLevel?: number;
  nrlEnabled?: boolean;
  nrlLevel?: number;
  anflEnabled?: boolean;
  anflLevel?: number;
  nrsEnabled?: boolean;
  nrsLevel?: number;
  rnnEnabled?: boolean;
  anftEnabled?: boolean;
  nrfEnabled?: boolean;
  nrfLevel?: number;
  escEnabled?: boolean;
  escGain?: number;
  escPhaseShift?: number;
  nbEnabled?: boolean;
  nbLevel?: number;
  nrEnabled?: boolean;
  nrLevel?: number;
  agcMode?: SliceAgcMode;
  agcThreshold?: number;
  agcOffLevel?: number;
  loopAEnabled?: boolean;
  loopBEnabled?: boolean;
  ritEnabled?: boolean;
  ritOffsetHz?: number;
  xitEnabled?: boolean;
  xitOffsetHz?: number;
  tuneStepHz?: number;
  tuneStepListHz?: readonly number[];
  recordingEnabled?: boolean;
  playbackEnabled?: boolean;
  fmToneMode?: SliceToneMode;
  fmToneValue?: number | string;
  fmDeviation?: number;
  fmToneBurstEnabled?: boolean;
  fmPreDeEmphasisEnabled?: boolean;
  squelchEnabled?: boolean;
  squelchLevel?: number;
  txOffsetFrequencyMHz?: number;
  fmRepeaterOffsetFrequencyMHz?: number;
  repeaterOffsetDirection?: SliceRepeaterOffsetDirection;
  diversityEnabled?: boolean;
  diversityChild?: boolean;
  diversityIndex?: number;
}

export interface SliceController {
  readonly id: string;
  readonly state: SliceSnapshot;
  /**
   * Slice center frequency in MHz (matches radio status reports).
   */
  readonly frequencyMHz: number;
  /**
   * Demodulation mode for the slice, e.g. "USB", "DIGU", "LSB", "DIGL", "CW", "DSB", "AM", "SAM", "FM".
   */
  readonly mode: string;
  readonly sampleRateHz: number;
  readonly indexLetter: string;
  /**
   * When true, the receive preselector filters in the radio are bypassed.
   */
  readonly isWide: boolean;
  readonly isQskEnabled: boolean;
  /**
   * A list of the available RX antenna ports on the radio, e.g. "ANT1", "ANT2", "RX_A", "RX_B", "XVTR".
   */
  readonly availableRxAntennas: readonly string[];
  /**
   * A list of the available TX antenna ports on the radio, e.g. "ANT1", "ANT2", "XVTR".
   */
  readonly availableTxAntennas: readonly string[];
  readonly owner: string;
  readonly clientHandle: number;
  /**
   * Available demodulation modes for this slice.
   */
  readonly modeList: readonly string[];
  /**
   * Whether the slice is the active slice.
   */
  readonly isActive: boolean;
  /**
   * When true, the slice frequency is locked and cannot be changed.
   */
  readonly isLocked: boolean;
  readonly isTransmitEnabled: boolean;
  /**
   * The receive antenna port for the slice, e.g. "ANT1", "ANT2", "RX_A", "RX_B", "XVTR".
   */
  readonly rxAntenna: string;
  /**
   * The transmit antenna port for the slice, e.g. "ANT1", "ANT2", "XVTR".
   */
  readonly txAntenna: string;
  /**
   * Stream ID of the panadapter associated with this slice.
   */
  readonly panadapterStreamId?: string;
  /**
   * DAX channel assigned to the slice (0–8).
   */
  readonly daxChannel: number;
  readonly rfGain: number;
  /**
   * Slice receive filter low cut in Hz.
   */
  readonly filterLowHz: number;
  /**
   * Slice receive filter high cut in Hz.
   */
  readonly filterHighHz: number;
  /**
   * Slice RTTY mark offset in Hz.
   */
  readonly rttyMarkHz: number;
  /**
   * Slice RTTY shift offset in Hz.
   */
  readonly rttyShiftHz: number;
  /**
   * Slice DIGL offset in Hz.
   */
  readonly diglOffsetHz: number;
  /**
   * Slice DIGU offset in Hz.
   */
  readonly diguOffsetHz: number;
  /**
   * Left-right audio pan from 0 to 100 (50 centers the audio).
   */
  readonly audioPan: number;
  /**
   * Slice audio level from 0 to 100.
   */
  readonly audioGain: number;
  /**
   * Whether slice audio is muted.
   */
  readonly isMuted: boolean;
  /**
   * Whether the auto-notch filter (ANF) is enabled.
   */
  readonly anfEnabled: boolean;
  /**
   * Auto-notch filter (ANF) level from 0 to 100.
   */
  readonly anfLevel: number;
  /**
   * Whether the auto-peaking filter (APF) is enabled.
   */
  readonly apfEnabled: boolean;
  /**
   * Auto-peaking filter (APF) level from 0 to 100.
   */
  readonly apfLevel: number;
  /**
   * Whether the Wideband Noise Blanker (WNB) is enabled.
   */
  readonly wnbEnabled: boolean;
  /**
   * Wideband Noise Blanker (WNB) level from 0 to 100.
   */
  readonly wnbLevel: number;
  /**
   * Whether the Noise Blanker (NB) is enabled.
   */
  readonly nbEnabled: boolean;
  /**
   * Noise Blanker (NB) level from 0 to 100.
   */
  readonly nbLevel: number;
  /**
   * Whether the Noise Reduction (NR) is enabled.
   */
  readonly nrEnabled: boolean;
  /**
   * Noise Reduction (NR) level from 0 to 100.
   */
  readonly nrLevel: number;
  readonly nrlEnabled: boolean;
  readonly nrlLevel: number;
  readonly anflEnabled: boolean;
  readonly anflLevel: number;
  readonly nrsEnabled: boolean;
  readonly nrsLevel: number;
  readonly rnnEnabled: boolean;
  readonly anftEnabled: boolean;
  readonly nrfEnabled: boolean;
  readonly nrfLevel: number;
  readonly escEnabled: boolean;
  readonly escGain: number;
  readonly escPhaseShift: number;
  /**
   * Current AGC mode for the slice.
   */
  readonly agcMode: string;
  readonly agcThreshold: number;
  readonly agcOffLevel: number;
  readonly loopAEnabled: boolean;
  readonly loopBEnabled: boolean;
  readonly ritEnabled: boolean;
  readonly ritOffsetHz: number;
  readonly xitEnabled: boolean;
  readonly xitOffsetHz: number;
  readonly tuneStepHz: number;
  readonly tuneStepListHz: readonly number[];
  /**
   * Whether audio recording is enabled for the slice.
   */
  readonly recordingEnabled: boolean;
  /**
   * Whether the play button is enabled for the slice.
   */
  readonly playbackAvailable: boolean;
  /**
   * Whether audio recording playback is enabled for the slice.
   */
  readonly playbackEnabled: boolean;
  readonly fmToneMode: string;
  /**
   * FM tone value; in most cases this is the repeater tone.
   */
  readonly fmToneValue: string;
  /**
   * Controls the FM deviation for the slice (also updates the transmitter when applicable).
   */
  readonly fmDeviation: number;
  /**
   * Whether the FM 1750 Hz tone burst (PL tone) is enabled.
   */
  readonly fmToneBurstEnabled: boolean;
  /**
   * Whether FM de-emphasis is enabled on receive (and pre-emphasis on transmit when this slice is the transmitter).
   */
  readonly fmPreDeEmphasisEnabled: boolean;
  /**
   * Whether the squelch algorithm is enabled for the slice.
   */
  readonly squelchEnabled: boolean;
  /**
   * Squelch level for modes with squelch (0–100).
   */
  readonly squelchLevel: number;
  /**
   * Transmit offset frequency in MHz.
   */
  readonly txOffsetFrequencyMHz: number;
  /**
   * FM repeater offset frequency used for wide splits in MHz.
   */
  readonly fmRepeaterOffsetMHz: number;
  /**
   * Direction that the transmit offset is applied in.
   */
  readonly repeaterOffsetDirection: string;
  /**
   * Whether the slice is treated as the diversity parent during diversity reception.
   */
  readonly diversityParent: boolean;
  /**
   * Whether simple diversity reception is enabled for the slice (FLEX-6700/FLEX-6700R only).
   */
  readonly diversityEnabled: boolean;
  /**
   * Whether the slice is the diversity child (FLEX-6700/FLEX-6700R only).
   */
  readonly diversityChild: boolean;
  /**
   * Index of the paired diversity slice.
   */
  readonly diversityIndex: number;
  snapshot(): SliceSnapshot;
  on<TKey extends keyof SliceControllerEvents>(
    event: TKey,
    listener: (payload: SliceControllerEvents[TKey]) => void,
  ): Subscription;
  setFrequency(frequencyMHz: number): Promise<void>;
  nudge(deltaHz: number): Promise<void>;
  cwAutoTune(options?: { intermittent?: boolean }): Promise<void>;
  /**
   * Sets the demodulation mode for the slice, e.g. "USB", "DIGU", "LSB", "DIGL", "CW", "DSB", "AM", "SAM", "FM".
   */
  setMode(mode: string): Promise<void>;
  /**
   * Sets whether the slice is the active slice.
   */
  setActive(active: boolean): Promise<void>;
  /**
   * Locks or unlocks the slice so its frequency cannot be changed.
   */
  setLocked(locked: boolean): Promise<void>;
  enableTransmit(enabled: boolean): Promise<void>;
  /**
   * Sets the receive antenna port for the slice (e.g. "ANT1", "ANT2", "RX_A", "RX_B", "XVTR").
   */
  setRxAntenna(port: string): Promise<void>;
  /**
   * Sets the transmit antenna for the slice as a string:
   * "ANT1", "ANT2", "XVTR"
   */
  setTxAntenna(port: string | null): Promise<void>;
  /**
   * Sets the DAX channel for the slice (0–8).
   */
  assignDaxChannel(channel: number): Promise<void>;
  setRfGain(hundredthsDb: number): Promise<void>;
  /**
   * Sets the slice receive filter low cut in Hz.
   */
  setFilterLow(lowHz: number): Promise<void>;
  /**
   * Sets the slice receive filter high cut in Hz.
   */
  setFilterHigh(highHz: number): Promise<void>;
  /**
   * Updates the slice receive filter bandwidth.
   */
  setFilter(lowHz: number, highHz: number): Promise<void>;
  /**
   * Sets the slice RTTY mark offset in Hz.
   */
  setRttyMark(markHz: number): Promise<void>;
  /**
   * Sets the slice RTTY shift offset in Hz.
   */
  setRttyShift(shiftHz: number): Promise<void>;
  /**
   * Sets the slice DIGL offset in Hz.
   */
  setDigLOffset(offsetHz: number): Promise<void>;
  /**
   * Sets the slice DIGU offset in Hz.
   */
  setDigUOffset(offsetHz: number): Promise<void>;
  /**
   * Sets the slice audio level from 0 to 100.
   */
  setAudioGain(gain: number): Promise<void>;
  /**
   * Sets the left-right audio pan from 0 to 100 (50 centers the audio).
   */
  setAudioPan(pan: number): Promise<void>;
  /**
   * Enables or disables slice audio mute.
   */
  setMute(muted: boolean): Promise<void>;
  /**
   * Enables or disables the auto-notch filter (ANF).
   */
  setAnfEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the auto-notch filter (ANF) level from 0 to 100.
   */
  setAnfLevel(level: number): Promise<void>;
  /**
   * Enables or disables the auto-peaking filter (APF).
   */
  setApfEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the auto-peaking filter (APF) level from 0 to 100.
   */
  setApfLevel(level: number): Promise<void>;
  /**
   * Enables or disables the Wideband Noise Blanker (WNB).
   */
  setWnbEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the Wideband Noise Blanker (WNB) level from 0 to 100.
   */
  setWnbLevel(level: number): Promise<void>;
  setNrlEnabled(enabled: boolean): Promise<void>;
  setNrlLevel(level: number): Promise<void>;
  setAnflEnabled(enabled: boolean): Promise<void>;
  setAnflLevel(level: number): Promise<void>;
  setNrsEnabled(enabled: boolean): Promise<void>;
  setNrsLevel(level: number): Promise<void>;
  setRnnEnabled(enabled: boolean): Promise<void>;
  setAnftEnabled(enabled: boolean): Promise<void>;
  setNrfEnabled(enabled: boolean): Promise<void>;
  setNrfLevel(level: number): Promise<void>;
  setEscEnabled(enabled: boolean): Promise<void>;
  setEscGain(gain: number): Promise<void>;
  setEscPhaseShift(phase: number): Promise<void>;
  /**
   * Enables or disables the Noise Blanker (NB).
   */
  setNbEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the Noise Blanker (NB) level from 0 to 100.
   */
  setNbLevel(level: number): Promise<void>;
  /**
   * Enables or disables the Noise Reduction (NR).
   */
  setNrEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the Noise Reduction (NR) level from 0 to 100.
   */
  setNrLevel(level: number): Promise<void>;
  /**
   * Sets the current AGC mode for the slice.
   */
  setAgcMode(mode: SliceAgcMode): Promise<void>;
  setAgcSettings(settings: {
    threshold?: number;
    offLevel?: number;
  }): Promise<void>;
  setLoopAEnabled(enabled: boolean): Promise<void>;
  setLoopBEnabled(enabled: boolean): Promise<void>;
  setRitEnabled(enabled: boolean): Promise<void>;
  setRitOffset(offsetHz: number): Promise<void>;
  setXitEnabled(enabled: boolean): Promise<void>;
  setXitOffset(offsetHz: number): Promise<void>;
  setTuneStep(stepHz: number): Promise<void>;
  setTuneStepList(stepsHz: readonly number[]): Promise<void>;
  /**
   * Enables or disables audio recording for the slice.
   */
  setRecordingEnabled(enabled: boolean): Promise<void>;
  /**
   * Enables or disables audio recording playback for the slice.
   */
  setPlaybackEnabled(enabled: boolean): Promise<void>;
  setFmToneMode(mode: SliceToneMode): Promise<void>;
  /**
   * Sets the FM tone value; in most cases this is the repeater tone.
   */
  setFmToneValue(value: number | string): Promise<void>;
  /**
   * Controls the FM deviation for the slice (and transmitter when applicable).
   */
  setFmDeviation(deviation: number): Promise<void>;
  /**
   * Enables or disables the FM 1750 Hz tone burst (PL tone).
   */
  setFmToneBurstEnabled(enabled: boolean): Promise<void>;
  /**
   * Enables or disables FM de-emphasis on receive (and pre-emphasis on transmit when applicable).
   */
  setFmPreDeEmphasisEnabled(enabled: boolean): Promise<void>;
  /**
   * Enables or disables the squelch algorithm for the slice.
   */
  setSquelchEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the squelch level for modes with squelch (0–100).
   */
  setSquelchLevel(level: number): Promise<void>;
  /**
   * Sets the transmit offset frequency for the slice in MHz.
   */
  setTxOffsetFrequency(offsetMHz: number): Promise<void>;
  /**
   * Sets the FM repeater offset frequency for wide splits in MHz.
   */
  setFmRepeaterOffsetFrequency(offsetMHz: number): Promise<void>;
  /**
   * Sets the direction that the transmit offset is applied in.
   */
  setRepeaterOffsetDirection(
    direction: SliceRepeaterOffsetDirection,
  ): Promise<void>;
  /**
   * Enables or disables simple diversity reception for the slice (FLEX-6700/FLEX-6700R only).
   */
  setDiversityEnabled(enabled: boolean): Promise<void>;
  /**
   * Marks the slice as the diversity child (FLEX-6700/FLEX-6700R only).
   */
  setDiversityChildEnabled(enabled: boolean): Promise<void>;
  /**
   * Sets the index of the paired diversity slice.
   */
  setDiversityIndex(index: number): Promise<void>;
  update(request: SliceUpdateRequest): Promise<void>;
}

export interface SliceSessionApi {
  command(
    command: string,
    options?: FlexCommandOptions,
  ): Promise<FlexCommandResponse>;
  getSlice(id: string): SliceSnapshot | undefined;
  patchSlice(id: string, attributes: Record<string, string>): void;
}

export class SliceControllerImpl implements SliceController {
  private readonly events = new TypedEventEmitter<SliceControllerEvents>();

  constructor(
    private readonly session: SliceSessionApi,
    readonly id: string,
  ) {}

  private current(): SliceSnapshot {
    const snapshot = this.session.getSlice(this.id);
    if (!snapshot)
      throw new FlexStateUnavailableError(
        `Slice ${this.id} is no longer available`,
      );
    return snapshot;
  }

  get state(): SliceSnapshot {
    return this.current();
  }

  get frequencyMHz(): number {
    return this.current().frequencyMHz;
  }

  get mode(): string {
    return this.current().mode;
  }

  get sampleRateHz(): number {
    return this.current().sampleRateHz;
  }

  get indexLetter(): string {
    return this.current().indexLetter;
  }

  get isWide(): boolean {
    return this.current().isWide;
  }

  get isQskEnabled(): boolean {
    return this.current().isQskEnabled;
  }

  get modeList(): readonly string[] {
    return this.current().modeList;
  }

  get availableRxAntennas(): readonly string[] {
    return this.current().availableRxAntennas;
  }

  get availableTxAntennas(): readonly string[] {
    return this.current().availableTxAntennas;
  }

  get owner(): string {
    return this.current().owner;
  }

  get clientHandle(): number {
    return this.current().clientHandle;
  }

  get isActive(): boolean {
    return this.current().isActive;
  }

  get isLocked(): boolean {
    return this.current().isLocked;
  }

  get isTransmitEnabled(): boolean {
    return this.current().isTransmitEnabled;
  }

  get rxAntenna(): string {
    return this.current().rxAntenna;
  }

  get txAntenna(): string {
    return this.current().txAntenna;
  }

  get panadapterStream(): string | undefined {
    return this.current().panadapterStreamId;
  }

  get panadapterStreamId(): string | undefined {
    return this.current().panadapterStreamId;
  }

  get daxChannel(): number {
    return this.current().daxChannel;
  }

  get rfGain(): number {
    return this.current().rfGain;
  }

  get filterLowHz(): number {
    return this.current().filterLowHz;
  }

  get filterHighHz(): number {
    return this.current().filterHighHz;
  }

  get rttyMarkHz(): number {
    return this.current().rttyMarkHz;
  }

  get rttyShiftHz(): number {
    return this.current().rttyShiftHz;
  }

  get diglOffsetHz(): number {
    return this.current().diglOffsetHz;
  }

  get diguOffsetHz(): number {
    return this.current().diguOffsetHz;
  }

  get audioPan(): number {
    return this.current().audioPan;
  }

  get audioGain(): number {
    return this.current().audioGain;
  }

  get isMuted(): boolean {
    return this.current().isMuted;
  }

  get anfEnabled(): boolean {
    return this.current().anfEnabled;
  }

  get anfLevel(): number {
    return this.current().anfLevel;
  }

  get apfEnabled(): boolean {
    return this.current().apfEnabled;
  }

  get apfLevel(): number {
    return this.current().apfLevel;
  }

  get wnbEnabled(): boolean {
    return this.current().wnbEnabled;
  }

  get wnbLevel(): number {
    return this.current().wnbLevel;
  }

  get nbEnabled(): boolean {
    return this.current().nbEnabled;
  }

  get nbLevel(): number {
    return this.current().nbLevel;
  }

  get nrEnabled(): boolean {
    return this.current().nrEnabled;
  }

  get nrLevel(): number {
    return this.current().nrLevel;
  }

  get nrlEnabled(): boolean {
    return this.current().nrlEnabled;
  }

  get nrlLevel(): number {
    return this.current().nrlLevel;
  }

  get anflEnabled(): boolean {
    return this.current().anflEnabled;
  }

  get anflLevel(): number {
    return this.current().anflLevel;
  }

  get nrsEnabled(): boolean {
    return this.current().nrsEnabled;
  }

  get nrsLevel(): number {
    return this.current().nrsLevel;
  }

  get rnnEnabled(): boolean {
    return this.current().rnnEnabled;
  }

  get anftEnabled(): boolean {
    return this.current().anftEnabled;
  }

  get nrfEnabled(): boolean {
    return this.current().nrfEnabled;
  }

  get nrfLevel(): number {
    return this.current().nrfLevel;
  }

  get escEnabled(): boolean {
    return this.current().escEnabled;
  }

  get escGain(): number {
    return this.current().escGain;
  }

  get escPhaseShift(): number {
    return this.current().escPhaseShift;
  }

  get agcMode(): string {
    return this.current().agcMode;
  }

  get agcThreshold(): number {
    return this.current().agcThreshold;
  }

  get agcOffLevel(): number {
    return this.current().agcOffLevel;
  }

  get loopAEnabled(): boolean {
    return this.current().loopAEnabled;
  }

  get loopBEnabled(): boolean {
    return this.current().loopBEnabled;
  }

  get ritEnabled(): boolean {
    return this.current().ritEnabled;
  }

  get ritOffsetHz(): number {
    return this.current().ritOffsetHz;
  }

  get xitEnabled(): boolean {
    return this.current().xitEnabled;
  }

  get xitOffsetHz(): number {
    return this.current().xitOffsetHz;
  }

  get tuneStepHz(): number {
    return this.current().tuneStepHz;
  }

  get tuneStepListHz(): readonly number[] {
    return this.current().tuneStepListHz;
  }

  get recordingEnabled(): boolean {
    return this.current().recordingEnabled;
  }

  get playbackAvailable(): boolean {
    return this.current().playbackAvailable;
  }

  get playbackEnabled(): boolean {
    return this.current().playbackEnabled;
  }

  get fmToneMode(): string {
    return this.current().fmToneMode;
  }

  get fmToneValue(): string {
    return this.current().fmToneValue;
  }

  get fmDeviation(): number {
    return this.current().fmDeviation;
  }

  get fmToneBurstEnabled(): boolean {
    return this.current().fmToneBurstEnabled;
  }

  get fmPreDeEmphasisEnabled(): boolean {
    return this.current().fmPreDeEmphasisEnabled;
  }

  get squelchEnabled(): boolean {
    return this.current().squelchEnabled;
  }

  get squelchLevel(): number {
    return this.current().squelchLevel;
  }

  get txOffsetFrequencyMHz(): number {
    return this.current().txOffsetFrequencyMHz;
  }

  get fmRepeaterOffsetMHz(): number {
    return this.current().fmRepeaterOffsetMHz;
  }

  get repeaterOffsetDirection(): string {
    return this.current().repeaterOffsetDirection;
  }

  get diversityEnabled(): boolean {
    return this.current().diversityEnabled;
  }

  get diversityChild(): boolean {
    return this.current().diversityChild;
  }

  get diversityParent(): boolean {
    return this.current().diversityParent;
  }

  get diversityIndex(): number {
    return this.current().diversityIndex;
  }

  snapshot(): SliceSnapshot {
    return this.current();
  }

  on<TKey extends keyof SliceControllerEvents>(
    event: TKey,
    listener: (payload: SliceControllerEvents[TKey]) => void,
  ): Subscription {
    return this.events.on(event, listener);
  }

  async setFrequency(frequencyMHz: number): Promise<void> {
    const formattedFrequency = formatMegahertz(frequencyMHz);
    await this.session.command(
      `slice tune ${this.id} ${formattedFrequency}`,
    );
    this.session.patchSlice(this.id, {
      freq: formattedFrequency,
    });
  }

  async nudge(deltaHz: number): Promise<void> {
    const nextFrequency =
      this.current().frequencyMHz + deltaHz / 1_000_000;
    return this.setFrequency(nextFrequency);
  }

  async cwAutoTune(options?: { intermittent?: boolean }): Promise<void> {
    const parts = [`slice auto_tune ${this.id}`];
    if (options?.intermittent !== undefined) {
      parts.push(`int=${options.intermittent ? "1" : "0"}`);
    }
    await this.session.command(parts.join(" "));
  }

  async setMode(mode: string): Promise<void> {
    await this.sendSet({ mode });
  }

  async setActive(active: boolean): Promise<void> {
    await this.sendSet({ active: this.toFlag(active) });
  }

  async setLocked(locked: boolean): Promise<void> {
    const command = locked
      ? `slice lock ${this.id}`
      : `slice unlock ${this.id}`;
    await this.session.command(command);
    this.session.patchSlice(this.id, {
      lock: this.toFlag(locked),
    });
  }

  async enableTransmit(enabled: boolean): Promise<void> {
    await this.sendSet({ tx: this.toFlag(enabled) });
  }

  async setRxAntenna(port: string): Promise<void> {
    await this.sendSet({ rxant: port });
  }

  async setTxAntenna(port: string | null): Promise<void> {
    await this.sendSet({ txant: port ?? "" });
  }

  async assignDaxChannel(channel: number): Promise<void> {
    await this.sendSet({ dax: this.toIntString(channel) });
  }

  async setRfGain(hundredthsDb: number): Promise<void> {
    await this.sendSet({ rfgain: this.toIntString(hundredthsDb) });
  }

  async setFilterLow(lowHz: number): Promise<void> {
    await this.sendSet({ filter_lo: this.toIntString(lowHz) });
  }

  async setFilterHigh(highHz: number): Promise<void> {
    await this.sendSet({ filter_hi: this.toIntString(highHz) });
  }

  async setFilter(lowHz: number, highHz: number): Promise<void> {
    await this.sendSet({
      filter_lo: this.toIntString(lowHz),
      filter_hi: this.toIntString(highHz),
    });
  }

  async setRttyMark(markHz: number): Promise<void> {
    await this.sendSet({ rtty_mark: this.toIntString(markHz) });
  }

  async setRttyShift(shiftHz: number): Promise<void> {
    await this.sendSet({ rtty_shift: this.toIntString(shiftHz) });
  }

  async setDigLOffset(offsetHz: number): Promise<void> {
    await this.sendSet({ digl_offset: this.toIntString(offsetHz) });
  }

  async setDigUOffset(offsetHz: number): Promise<void> {
    await this.sendSet({ digu_offset: this.toIntString(offsetHz) });
  }

  async setAudioGain(gain: number): Promise<void> {
    await this.sendSet({ audio_level: this.toIntString(gain) });
  }

  async setAudioPan(pan: number): Promise<void> {
    await this.sendSet({ audio_pan: this.toIntString(pan) });
  }

  async setMute(muted: boolean): Promise<void> {
    await this.sendSet({ audio_mute: this.toFlag(muted) });
  }

  async setAnfEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ anf: this.toFlag(enabled) });
  }

  async setAnfLevel(level: number): Promise<void> {
    await this.sendSet({ anf_level: this.toIntString(level) });
  }

  async setApfEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ apf: this.toFlag(enabled) });
  }

  async setApfLevel(level: number): Promise<void> {
    await this.sendSet({ apf_level: this.toIntString(level) });
  }

  async setWnbEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ wnb: this.toFlag(enabled) });
  }

  async setWnbLevel(level: number): Promise<void> {
    await this.sendSet({ wnb_level: this.toIntString(level) });
  }

  async setNrlEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ lms_nr: this.toFlag(enabled) });
  }

  async setNrlLevel(level: number): Promise<void> {
    await this.sendSet({ lms_nr_level: this.toIntString(level) });
  }

  async setAnflEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ lms_anf: this.toFlag(enabled) });
  }

  async setAnflLevel(level: number): Promise<void> {
    await this.sendSet({ lms_anf_level: this.toIntString(level) });
  }

  async setNrsEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ speex_nr: this.toFlag(enabled) });
  }

  async setNrsLevel(level: number): Promise<void> {
    await this.sendSet({ speex_nr_level: this.toIntString(level) });
  }

  async setRnnEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ rnnoise: this.toFlag(enabled) });
  }

  async setAnftEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ anft: this.toFlag(enabled) });
  }

  async setNrfEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ nrf: this.toFlag(enabled) });
  }

  async setNrfLevel(level: number): Promise<void> {
    await this.sendSet({ nrf_level: this.toIntString(level) });
  }

  async setEscEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ esc: enabled ? "on" : "off" });
  }

  async setEscGain(gain: number): Promise<void> {
    await this.sendSet({ esc_gain: String(gain) });
  }

  async setEscPhaseShift(phase: number): Promise<void> {
    await this.sendSet({ esc_phase_shift: String(phase) });
  }

  async setNbEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ nb: this.toFlag(enabled) });
  }

  async setNbLevel(level: number): Promise<void> {
    await this.sendSet({ nb_level: this.toIntString(level) });
  }

  async setNrEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ nr: this.toFlag(enabled) });
  }

  async setNrLevel(level: number): Promise<void> {
    await this.sendSet({ nr_level: this.toIntString(level) });
  }

  async setAgcMode(mode: SliceAgcMode): Promise<void> {
    await this.sendSet({ agc_mode: mode });
  }

  async setAgcSettings(settings: {
    threshold?: number;
    offLevel?: number;
  }): Promise<void> {
    const entries = Object.create(null) as Record<string, string>;
    if (settings.threshold !== undefined)
      entries.agc_threshold = this.toIntString(settings.threshold);
    if (settings.offLevel !== undefined)
      entries.agc_off_level = this.toIntString(settings.offLevel);
    if (Object.keys(entries).length > 0) {
      await this.sendSet(entries);
    }
  }

  async setLoopAEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ loopa: this.toFlag(enabled) });
  }

  async setLoopBEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ loopb: this.toFlag(enabled) });
  }

  async setRitEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ rit_on: this.toFlag(enabled) });
  }

  async setRitOffset(offsetHz: number): Promise<void> {
    await this.sendSet({ rit_freq: this.toIntString(offsetHz) });
  }

  async setXitEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ xit_on: this.toFlag(enabled) });
  }

  async setXitOffset(offsetHz: number): Promise<void> {
    await this.sendSet({ xit_freq: this.toIntString(offsetHz) });
  }

  async setTuneStep(stepHz: number): Promise<void> {
    await this.sendSet({ step: this.toIntString(stepHz) });
  }

  async setTuneStepList(stepsHz: readonly number[]): Promise<void> {
    const encoded = Array.from(stepsHz, (value) =>
      this.toIntString(value),
    ).join(",");
    await this.sendSet({ step_list: encoded });
  }

  async setRecordingEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ record: this.toFlag(enabled) });
  }

  async setPlaybackEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ play: this.toFlag(enabled) });
  }

  async setFmToneMode(mode: SliceToneMode): Promise<void> {
    await this.sendSet({ fm_tone_mode: mode });
  }

  async setFmToneValue(value: number | string): Promise<void> {
    await this.sendSet({ fm_tone_value: this.formatToneValue(value) });
  }

  async setFmDeviation(deviation: number): Promise<void> {
    await this.sendSet({ fm_deviation: this.toIntString(deviation) });
  }

  async setFmToneBurstEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ fm_tone_burst: this.toFlag(enabled) });
  }

  async setFmPreDeEmphasisEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ dfm_pre_de_emphasis: this.toFlag(enabled) });
  }

  async setSquelchEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ squelch: this.toFlag(enabled) });
  }

  async setSquelchLevel(level: number): Promise<void> {
    await this.sendSet({ squelch_level: this.toIntString(level) });
  }

  async setTxOffsetFrequency(offsetMHz: number): Promise<void> {
    await this.sendSet({ tx_offset_freq: formatMegahertz(offsetMHz) });
  }

  async setFmRepeaterOffsetFrequency(
    offsetMHz: number,
  ): Promise<void> {
    await this.sendSet({
      fm_repeater_offset_freq: formatMegahertz(offsetMHz),
    });
  }

  async setRepeaterOffsetDirection(
    direction: SliceRepeaterOffsetDirection,
  ): Promise<void> {
    await this.sendSet({ repeater_offset_dir: direction });
  }

  async setDiversityEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ diversity: this.toFlag(enabled) });
  }

  async setDiversityChildEnabled(enabled: boolean): Promise<void> {
    await this.sendSet({ diversity_child: this.toFlag(enabled) });
  }

  async setDiversityIndex(index: number): Promise<void> {
    await this.sendSet({ diversity_index: this.toIntString(index) });
  }

  async update(request: SliceUpdateRequest): Promise<void> {
    const { frequencyMHz, isLocked, ...setRequest } = request;
    const entries = this.buildSetEntries(setRequest);
    if (Object.keys(entries).length > 0) {
      await this.sendSet(entries);
    }
    if (isLocked !== undefined) {
      await this.setLocked(isLocked);
    }
    if (frequencyMHz !== undefined) {
      await this.setFrequency(frequencyMHz);
    }
  }

  onStateChange(change: SliceStateChange): void {
    this.events.emit("change", change);
  }

  private async sendSet(entries: Record<string, string>): Promise<void> {
    const parts = Object.entries(entries).map(
      ([key, value]) => `${key}=${value}`,
    );
    const command = `slice set ${this.id} ${parts.join(" ")}`;
    await this.session.command(command);
    this.session.patchSlice(this.id, { index: this.id, ...entries });
  }

  private buildSetEntries(
    request: Omit<SliceUpdateRequest, "frequencyMHz" | "isLocked">,
  ): Record<string, string> {
    const entries = Object.create(null) as Record<string, string>;
    if (request.mode !== undefined) entries.mode = request.mode;
    if (request.isActive !== undefined)
      entries.active = this.toFlag(request.isActive);
    if (request.isTransmitEnabled !== undefined)
      entries.tx = this.toFlag(request.isTransmitEnabled);
    if (request.rxAntenna !== undefined) entries.rxant = request.rxAntenna;
    if (request.txAntenna !== undefined)
      entries.txant = request.txAntenna ?? "";
    if (request.daxChannel !== undefined)
      entries.dax = this.toIntString(request.daxChannel);
    if (request.rfGain !== undefined)
      entries.rfgain = this.toIntString(request.rfGain);
    if (request.filterLowHz !== undefined)
      entries.filter_lo = this.toIntString(request.filterLowHz);
    if (request.filterHighHz !== undefined)
      entries.filter_hi = this.toIntString(request.filterHighHz);
    if (request.rttyMarkHz !== undefined)
      entries.rtty_mark = this.toIntString(request.rttyMarkHz);
    if (request.rttyShiftHz !== undefined)
      entries.rtty_shift = this.toIntString(request.rttyShiftHz);
    if (request.diglOffsetHz !== undefined)
      entries.digl_offset = this.toIntString(request.diglOffsetHz);
    if (request.diguOffsetHz !== undefined)
      entries.digu_offset = this.toIntString(request.diguOffsetHz);
    if (request.audioPan !== undefined)
      entries.audio_pan = this.toIntString(request.audioPan);
    if (request.audioGain !== undefined)
      entries.audio_level = this.toIntString(request.audioGain);
    if (request.isMuted !== undefined)
      entries.audio_mute = this.toFlag(request.isMuted);
    if (request.anfEnabled !== undefined)
      entries.anf = this.toFlag(request.anfEnabled);
    if (request.anfLevel !== undefined)
      entries.anf_level = this.toIntString(request.anfLevel);
    if (request.apfEnabled !== undefined)
      entries.apf = this.toFlag(request.apfEnabled);
    if (request.apfLevel !== undefined)
      entries.apf_level = this.toIntString(request.apfLevel);
    if (request.wnbEnabled !== undefined)
      entries.wnb = this.toFlag(request.wnbEnabled);
    if (request.wnbLevel !== undefined)
      entries.wnb_level = this.toIntString(request.wnbLevel);
    if (request.nrlEnabled !== undefined)
      entries.lms_nr = this.toFlag(request.nrlEnabled);
    if (request.nrlLevel !== undefined)
      entries.lms_nr_level = this.toIntString(request.nrlLevel);
    if (request.anflEnabled !== undefined)
      entries.lms_anf = this.toFlag(request.anflEnabled);
    if (request.anflLevel !== undefined)
      entries.lms_anf_level = this.toIntString(request.anflLevel);
    if (request.nrsEnabled !== undefined)
      entries.speex_nr = this.toFlag(request.nrsEnabled);
    if (request.nrsLevel !== undefined)
      entries.speex_nr_level = this.toIntString(request.nrsLevel);
    if (request.rnnEnabled !== undefined)
      entries.rnnoise = this.toFlag(request.rnnEnabled);
    if (request.anftEnabled !== undefined)
      entries.anft = this.toFlag(request.anftEnabled);
    if (request.nrfEnabled !== undefined)
      entries.nrf = this.toFlag(request.nrfEnabled);
    if (request.nrfLevel !== undefined)
      entries.nrf_level = this.toIntString(request.nrfLevel);
    if (request.escEnabled !== undefined)
      entries.esc = request.escEnabled ? "on" : "off";
    if (request.escGain !== undefined)
      entries.esc_gain = String(request.escGain);
    if (request.escPhaseShift !== undefined)
      entries.esc_phase_shift = String(request.escPhaseShift);
    if (request.nbEnabled !== undefined)
      entries.nb = this.toFlag(request.nbEnabled);
    if (request.nbLevel !== undefined)
      entries.nb_level = this.toIntString(request.nbLevel);
    if (request.nrEnabled !== undefined)
      entries.nr = this.toFlag(request.nrEnabled);
    if (request.nrLevel !== undefined)
      entries.nr_level = this.toIntString(request.nrLevel);
    if (request.agcMode !== undefined) entries.agc_mode = request.agcMode;
    if (request.agcThreshold !== undefined)
      entries.agc_threshold = this.toIntString(request.agcThreshold);
    if (request.agcOffLevel !== undefined)
      entries.agc_off_level = this.toIntString(request.agcOffLevel);
    if (request.loopAEnabled !== undefined)
      entries.loopa = this.toFlag(request.loopAEnabled);
    if (request.loopBEnabled !== undefined)
      entries.loopb = this.toFlag(request.loopBEnabled);
    if (request.ritEnabled !== undefined)
      entries.rit_on = this.toFlag(request.ritEnabled);
    if (request.ritOffsetHz !== undefined)
      entries.rit_freq = this.toIntString(request.ritOffsetHz);
    if (request.xitEnabled !== undefined)
      entries.xit_on = this.toFlag(request.xitEnabled);
    if (request.xitOffsetHz !== undefined)
      entries.xit_freq = this.toIntString(request.xitOffsetHz);
    if (request.tuneStepHz !== undefined)
      entries.step = this.toIntString(request.tuneStepHz);
    if (request.tuneStepListHz !== undefined)
      entries.step_list = Array.from(request.tuneStepListHz, (value) =>
        this.toIntString(value),
      ).join(",");
    if (request.recordingEnabled !== undefined)
      entries.record = this.toFlag(request.recordingEnabled);
    if (request.playbackEnabled !== undefined)
      entries.play = this.toFlag(request.playbackEnabled);
    if (request.fmToneMode !== undefined)
      entries.fm_tone_mode = request.fmToneMode;
    if (request.fmToneValue !== undefined)
      entries.fm_tone_value = this.formatToneValue(request.fmToneValue);
    if (request.fmDeviation !== undefined)
      entries.fm_deviation = this.toIntString(request.fmDeviation);
    if (request.fmToneBurstEnabled !== undefined)
      entries.fm_tone_burst = this.toFlag(request.fmToneBurstEnabled);
    if (request.fmPreDeEmphasisEnabled !== undefined)
      entries.dfm_pre_de_emphasis = this.toFlag(request.fmPreDeEmphasisEnabled);
    if (request.squelchEnabled !== undefined)
      entries.squelch = this.toFlag(request.squelchEnabled);
    if (request.squelchLevel !== undefined)
      entries.squelch_level = this.toIntString(request.squelchLevel);
    if (request.txOffsetFrequencyMHz !== undefined)
      entries.tx_offset_freq = formatMegahertz(request.txOffsetFrequencyMHz);
    if (request.fmRepeaterOffsetFrequencyMHz !== undefined)
      entries.fm_repeater_offset_freq = formatMegahertz(
        request.fmRepeaterOffsetFrequencyMHz,
      );
    if (request.repeaterOffsetDirection !== undefined)
      entries.repeater_offset_dir = request.repeaterOffsetDirection;
    if (request.diversityEnabled !== undefined)
      entries.diversity = this.toFlag(request.diversityEnabled);
    if (request.diversityChild !== undefined)
      entries.diversity_child = this.toFlag(request.diversityChild);
    if (request.diversityIndex !== undefined)
      entries.diversity_index = this.toIntString(request.diversityIndex);
    return entries;
  }

  private toFlag(value: boolean): string {
    return value ? "1" : "0";
  }

  private toIntString(value: number): string {
    return Math.round(value).toString(10);
  }

  private formatToneValue(value: number | string): string {
    if (typeof value === "number") {
      return value.toFixed(1);
    }
    return value;
  }
}
function formatMegahertz(frequencyMHz: number): string {
  return frequencyMHz.toFixed(6);
}
