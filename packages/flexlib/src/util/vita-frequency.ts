// VITA-49 64-bit fixed point frequency (Figure 7.1.5.6-1)
// Raw representation uses Q20 (20 fractional bits): raw = Hz * 2^20

const Q = 20n;
const SCALE = 1n << Q; // 2^20

/**
 * VITA fixed-point frequency wrapper.
 * - Stores raw 64-bit value as bigint.
 * - Hz = raw >> 20
 * - MHz (as number) = (raw >> 20) / 1e6
 *
 * NOTE: Conversions to `number` are safe for typical RF ranges (kHz–GHz).
 * If you need exact integer hertz beyond Number.MAX_SAFE_INTEGER, use the bigint APIs.
 */
export class VitaFrequency {
  private _raw: bigint;

  private constructor(raw: bigint) {
    this._raw = BigInt(raw);
  }

  /** Create from raw Q20 fixed-point (64-bit) value. */
  static fromRaw(raw: bigint | number): VitaFrequency {
    return new VitaFrequency(
      typeof raw === "number" ? BigInt(Math.trunc(raw)) : raw,
    );
  }

  /** Create from integer hertz. */
  static fromHz(hz: bigint | number): VitaFrequency {
    const hzInt = typeof hz === "number" ? Math.trunc(hz) : hz;
    return new VitaFrequency(
      (typeof hzInt === "number" ? BigInt(hzInt) : hzInt) * SCALE,
    );
  }

  /**
   * Create from MHz (floating point).
   * Mirrors the C# cast: (long)(freqMhz * 1048576E6) -> truncation toward zero.
   */
  static fromMHz(mhz: number): VitaFrequency {
    // raw = trunc(mhz * 1e6 * 2^20) = trunc(mhz * 1.048576e12)
    const scaled = Math.trunc(mhz * 1.048576e12);
    return new VitaFrequency(BigInt(scaled));
  }

  /** Raw Q20 value (64-bit). */
  get raw(): bigint {
    return this._raw;
  }

  /** Integer hertz as bigint (Hz = raw >> 20). */
  get freqHzBig(): bigint {
    return this._raw >> Q;
  }

  /** Frequency in Hz as a floating point number (includes fractional part). */
  get freqHz(): number {
    const whole = Number(this._raw >> Q);
    const fraction = Number(this._raw & (SCALE - 1n)) / Number(SCALE);
    return whole + fraction;
  }

  /** Frequency in MHz as a JS number: MHz = Hz / 1e6. */
  get freqMhz(): number {
    return this.freqHz / 1_000_000;
  }

  /** Replace underlying raw value. */
  setRaw(raw: bigint | number): this {
    this._raw = typeof raw === "number" ? BigInt(Math.trunc(raw)) : raw;
    return this;
  }

  /** Set from integer hertz. */
  setHz(hz: bigint | number): this {
    const hzInt = typeof hz === "number" ? Math.trunc(hz) : hz;
    this._raw = (typeof hzInt === "number" ? BigInt(hzInt) : hzInt) * SCALE;
    return this;
  }

  /** Set from MHz (float), truncating like the C# cast. */
  setMhz(mhz: number): this {
    this._raw = BigInt(Math.trunc(mhz * 1.048576e12));
    return this;
  }

  /** String helper similar to the C# ToString pattern (MHz with 6 decimals). */
  toString(): string {
    return `${this.freqMhz.toFixed(6)} MHz`;
  }

  /** JSON representation (Hz integer + raw) for debugging/serialization. */
  toJSON(): { hz: string; raw: string } {
    return { hz: this.freqHz.toString(), raw: this._raw.toString() };
  }

  /** Equality check by raw value. */
  equals(other: VitaFrequency): boolean {
    return this._raw === other._raw;
  }
}
