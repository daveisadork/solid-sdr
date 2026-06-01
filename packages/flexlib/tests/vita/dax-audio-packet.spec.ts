import { describe, it, expect } from "vitest";
import {
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
  VITA_FLEX_OUI,
  VITA_FLEX_INFO_CLASS,
} from "../../src/vita/common";
import {
  VitaDaxAudioPacket,
  VitaDaxReducedBwPacket,
  VITA_FLEX_DAX_AUDIO_CLASS,
  VITA_FLEX_DAX_REDUCED_BW_CLASS,
} from "../../src/vita/dax-audio-packet";

// ---------------------------------------------------------------------------
// VitaDaxAudioPacket
// ---------------------------------------------------------------------------

describe("VitaDaxAudioPacket: default header", () => {
  it("has correct VITA fields out of the box", () => {
    const p = new VitaDaxAudioPacket();
    expect(p.header.packetType).toBe(VitaPacketType.IFDataWithStream);
    expect(p.header.hasClassId).toBe(true);
    expect(p.header.hasTrailer).toBe(false);
    expect(p.header.timestampIntegerType).toBe(VitaTimeStampIntegerType.Other);
    expect(p.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.SampleCount,
    );
    expect(p.classId.oui).toBe(VITA_FLEX_OUI);
    expect(p.classId.informationClassCode).toBe(VITA_FLEX_INFO_CLASS);
    expect(p.classId.packetClassCode).toBe(VITA_FLEX_DAX_AUDIO_CLASS);
  });
});

describe("VitaDaxAudioPacket: round-trip (128 frames)", () => {
  it("serializes and parses L/R samples and header fields", () => {
    const FRAMES = 128;
    const p1 = new VitaDaxAudioPacket();
    p1.streamId = 0xdeadbeef;
    p1.header.packetCount = 7;
    p1.left = Float32Array.from({ length: FRAMES }, (_, i) => (i / FRAMES) * 2 - 1);
    p1.right = Float32Array.from({ length: FRAMES }, (_, i) => -(i / FRAMES) * 2 + 1);

    const bytes = p1.toBytes();
    const p2 = new VitaDaxAudioPacket(bytes);

    expect(p2.header.packetType).toBe(VitaPacketType.IFDataWithStream);
    expect(p2.header.hasClassId).toBe(true);
    expect(p2.header.hasTrailer).toBe(false);
    expect(p2.header.timestampIntegerType).toBe(VitaTimeStampIntegerType.Other);
    expect(p2.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.SampleCount,
    );
    expect(p2.header.packetCount).toBe(7);
    expect(p2.streamId).toBe(0xdeadbeef);
    expect(p2.classId.oui).toBe(VITA_FLEX_OUI);
    expect(p2.classId.informationClassCode).toBe(VITA_FLEX_INFO_CLASS);
    expect(p2.classId.packetClassCode).toBe(VITA_FLEX_DAX_AUDIO_CLASS);
    expect(p2.numFrames).toBe(FRAMES);

    // float32 round-trip is exact
    expect(Array.from(p2.left)).toEqual(Array.from(p1.left));
    expect(Array.from(p2.right)).toEqual(Array.from(p1.right));
  });
});

describe("VitaDaxAudioPacket: size math (128 frames)", () => {
  it("computes correct byte length and packetSize", () => {
    const FRAMES = 128;
    const p = new VitaDaxAudioPacket();
    p.left = new Float32Array(FRAMES);
    p.right = new Float32Array(FRAMES);

    // preamble(28) + payload(128 * 8) = 28 + 1024 = 1052 bytes = 263 words
    const bytes = p.toBytes();
    expect(bytes.byteLength).toBe(1052);
    expect(p.header.packetSize).toBe(263);
  });
});

describe("VitaDaxAudioPacket: zero-alloc parse", () => {
  it("fills provided arrays and uses subarray views into them", () => {
    const FRAMES = 128;
    const p1 = new VitaDaxAudioPacket();
    p1.left = Float32Array.from({ length: FRAMES }, (_, i) => i * 0.001);
    p1.right = Float32Array.from({ length: FRAMES }, (_, i) => -i * 0.001);
    const bytes = p1.toBytes();

    const leftReuse = new Float32Array(256);
    const rightReuse = new Float32Array(256);

    const p2 = new VitaDaxAudioPacket();
    p2.parse(bytes, { left: leftReuse, right: rightReuse });

    expect(p2.numFrames).toBe(FRAMES);
    // views into the provided buffers — no new allocation
    expect(p2.left.buffer).toBe(leftReuse.buffer);
    expect(p2.right.buffer).toBe(rightReuse.buffer);
    expect(Array.from(p2.left)).toEqual(Array.from(p1.left));
    expect(Array.from(p2.right)).toEqual(Array.from(p1.right));
  });
});

describe("VitaDaxAudioPacket: empty payload", () => {
  it("round-trips with zero frames", () => {
    const p = new VitaDaxAudioPacket();
    // left and right default to length 0
    const bytes = p.toBytes();
    // preamble only: 28 bytes = 7 words
    expect(bytes.byteLength).toBe(28);
    expect(p.header.packetSize).toBe(7);

    const p2 = new VitaDaxAudioPacket(bytes);
    expect(p2.numFrames).toBe(0);
  });
});

describe("VitaDaxAudioPacket: packetCount wraps 0–15", () => {
  it("preserves 4-bit packetCount field", () => {
    for (const count of [0, 7, 15]) {
      const p = new VitaDaxAudioPacket();
      p.left = new Float32Array(4);
      p.right = new Float32Array(4);
      p.header.packetCount = count;
      const p2 = new VitaDaxAudioPacket(p.toBytes());
      expect(p2.header.packetCount).toBe(count);
    }
  });
});

// ---------------------------------------------------------------------------
// VitaDaxReducedBwPacket
// ---------------------------------------------------------------------------

describe("VitaDaxReducedBwPacket: default header", () => {
  it("has correct VITA fields out of the box", () => {
    const p = new VitaDaxReducedBwPacket();
    expect(p.header.packetType).toBe(VitaPacketType.IFDataWithStream);
    expect(p.header.hasClassId).toBe(true);
    expect(p.header.hasTrailer).toBe(false);
    expect(p.header.timestampIntegerType).toBe(VitaTimeStampIntegerType.Other);
    expect(p.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.SampleCount,
    );
    expect(p.classId.oui).toBe(VITA_FLEX_OUI);
    expect(p.classId.informationClassCode).toBe(VITA_FLEX_INFO_CLASS);
    expect(p.classId.packetClassCode).toBe(VITA_FLEX_DAX_REDUCED_BW_CLASS);
  });
});

describe("VitaDaxReducedBwPacket: round-trip (128 frames)", () => {
  it("serializes and parses mono int16 samples and header fields", () => {
    const FRAMES = 128;
    const p1 = new VitaDaxReducedBwPacket();
    p1.streamId = 0x12345678;
    p1.header.packetCount = 3;
    p1.samples = Int16Array.from({ length: FRAMES }, (_, i) =>
      Math.round((i / FRAMES - 0.5) * 32767),
    );

    const bytes = p1.toBytes();
    const p2 = new VitaDaxReducedBwPacket(bytes);

    expect(p2.header.packetType).toBe(VitaPacketType.IFDataWithStream);
    expect(p2.header.hasClassId).toBe(true);
    expect(p2.header.hasTrailer).toBe(false);
    expect(p2.header.packetCount).toBe(3);
    expect(p2.streamId).toBe(0x12345678);
    expect(p2.classId.packetClassCode).toBe(VITA_FLEX_DAX_REDUCED_BW_CLASS);
    expect(p2.numFrames).toBe(FRAMES);
    expect(Array.from(p2.samples)).toEqual(Array.from(p1.samples));
  });
});

describe("VitaDaxReducedBwPacket: size math (128 frames)", () => {
  it("computes correct byte length and packetSize", () => {
    const p = new VitaDaxReducedBwPacket();
    p.samples = new Int16Array(128);

    // preamble(28) + payload(128 * 2) = 28 + 256 = 284 bytes = 71 words
    const bytes = p.toBytes();
    expect(bytes.byteLength).toBe(284);
    expect(p.header.packetSize).toBe(71);
  });
});

describe("VitaDaxReducedBwPacket: payload 32-bit alignment", () => {
  it("pads an odd number of int16 samples to a word boundary", () => {
    const p = new VitaDaxReducedBwPacket();
    // 3 samples = 6 bytes payload — needs 2 bytes of padding to reach 8 (2 words)
    p.samples = new Int16Array([100, -200, 300]);

    const bytes = p.toBytes();
    // preamble(28) + payload(6) + pad(2) = 36 bytes = 9 words
    expect(bytes.byteLength).toBe(36);
    expect(p.header.packetSize).toBe(9);

    // parsed frame count derived from payloadLength — parser sees 8 payload bytes → 4 frames
    // (padding bytes are read as extra zero-value samples, which is correct VITA behaviour)
    const p2 = new VitaDaxReducedBwPacket(bytes);
    // First 3 samples must survive intact
    expect(p2.samples[0]).toBe(100);
    expect(p2.samples[1]).toBe(-200);
    expect(p2.samples[2]).toBe(300);
  });
});

describe("VitaDaxReducedBwPacket: zero-alloc parse", () => {
  it("fills provided array and uses a subarray view into it", () => {
    const FRAMES = 128;
    const p1 = new VitaDaxReducedBwPacket();
    p1.samples = Int16Array.from({ length: FRAMES }, (_, i) => i * 256 - 16384);
    const bytes = p1.toBytes();

    const reuse = new Int16Array(256);
    const p2 = new VitaDaxReducedBwPacket();
    p2.parse(bytes, { samples: reuse });

    expect(p2.numFrames).toBe(FRAMES);
    expect(p2.samples.buffer).toBe(reuse.buffer);
    expect(Array.from(p2.samples)).toEqual(Array.from(p1.samples));
  });
});

describe("VitaDaxReducedBwPacket: empty payload", () => {
  it("round-trips with zero frames", () => {
    const p = new VitaDaxReducedBwPacket();
    const bytes = p.toBytes();
    expect(bytes.byteLength).toBe(28);
    expect(p.header.packetSize).toBe(7);

    const p2 = new VitaDaxReducedBwPacket(bytes);
    expect(p2.numFrames).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-class: class codes are distinct and non-overlapping
// ---------------------------------------------------------------------------

describe("class codes", () => {
  it("audio and reduced-bw class codes differ", () => {
    expect(VITA_FLEX_DAX_AUDIO_CLASS).not.toBe(VITA_FLEX_DAX_REDUCED_BW_CLASS);
  });

  it("parsing audio bytes with VitaDaxReducedBwPacket yields different frame count", () => {
    // A 128-frame stereo float32 packet parsed as reduced-bw will see 4× the frames
    // (same byte count, but int16 is 2 bytes vs 8 bytes per frame pair)
    const audio = new VitaDaxAudioPacket();
    audio.left = new Float32Array(128);
    audio.right = new Float32Array(128);
    const bytes = audio.toBytes();

    const reducedBw = new VitaDaxReducedBwPacket(bytes);
    // 1024 payload bytes / 2 = 512 int16 frames
    expect(reducedBw.numFrames).toBe(512);
  });
});
