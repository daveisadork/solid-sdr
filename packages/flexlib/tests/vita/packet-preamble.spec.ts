import { describe, it, expect } from "vitest";
import {
  VitaPacketType,
  VitaTimeStampIntegerType,
  VitaTimeStampFractionalType,
} from "../../src/vita/common";
import { VitaPacketPreamble } from "../../src/vita/packet-preamble";

describe("VitaPacketPreamble: minimal (no stream, no classId, no timestamps)", () => {
  it("serializes and parses a minimal preamble", () => {
    const p = new VitaPacketPreamble();

    // Minimal (no stream/class/timestamps)
    p.header.packetType = VitaPacketType.IFContext; // no streamId
    p.header.hasClassId = false;
    p.header.hasTrailer = false; // preamble doesn't include trailer bytes
    p.header.timestampIntegerType = VitaTimeStampIntegerType.None;
    p.header.timestampFractionalType = VitaTimeStampFractionalType.None;
    p.header.packetCount = 5;
    p.header.packetSize = 0x1234; // arbitrary full-packet word count (written in header)

    const bytes = p.toBytes();
    expect(bytes.byteLength).toBe(4); // header only

    const round = new VitaPacketPreamble(bytes);
    expect(round.header.packetType).toBe(VitaPacketType.IFContext);
    expect(round.header.hasClassId).toBe(false);
    expect(round.header.hasTrailer).toBe(false);
    expect(round.header.timestampIntegerType).toBe(
      VitaTimeStampIntegerType.None,
    );
    expect(round.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.None,
    );
    expect(round.header.packetCount).toBe(5);
    expect(round.header.packetSize).toBe(0x1234);

    expect(round.streamId).toBe(0);
    expect(round.classId.oui).toBe(0);
    expect(round.classId.informationClassCode).toBe(0);
    expect(round.classId.packetClassCode).toBe(0);
    expect(round.timestampInt).toBe(0);
    expect(round.timestampFrac).toBe(0n);
  });
});

describe("VitaPacketPreamble: streamId only", () => {
  it("includes streamId when packetType has a stream", () => {
    const p = new VitaPacketPreamble();
    p.header.packetType = VitaPacketType.IFDataWithStream; // requires streamId
    p.header.hasClassId = false;
    p.header.hasTrailer = false;
    p.header.timestampIntegerType = VitaTimeStampIntegerType.None;
    p.header.timestampFractionalType = VitaTimeStampFractionalType.None;
    p.header.packetCount = 9;
    p.header.packetSize = 0x002a;
    p.streamId = 0x01020304;

    const bytes = p.toBytes();
    expect(bytes.byteLength).toBe(8); // header + streamId

    const round = new VitaPacketPreamble(bytes);
    expect(round.streamId).toBe(0x01020304);
    expect(round.header.packetType).toBe(VitaPacketType.IFDataWithStream);
    expect(round.header.packetCount).toBe(9);
    expect(round.header.packetSize).toBe(0x002a);
  });
});

describe("VitaPacketPreamble: classId present", () => {
  it("includes classId words when hasClassId is true", () => {
    const p = new VitaPacketPreamble();
    p.header.packetType = VitaPacketType.ExtContext; // no streamId
    p.header.hasClassId = true;
    p.header.hasTrailer = false;
    p.header.timestampIntegerType = VitaTimeStampIntegerType.None;
    p.header.timestampFractionalType = VitaTimeStampFractionalType.None;
    p.header.packetCount = 3;
    p.header.packetSize = 0x0042;

    p.classId = {
      oui: 0x00_abc_def, // 24-bit
      informationClassCode: 0x1357,
      packetClassCode: 0x2468,
    };

    const bytes = p.toBytes();
    expect(bytes.byteLength).toBe(4 + 8); // header + classId

    const round = new VitaPacketPreamble(bytes);
    expect(round.header.hasClassId).toBe(true);
    expect(round.classId.oui).toBe(0x00_abc_def);
    expect(round.classId.informationClassCode).toBe(0x1357);
    expect(round.classId.packetClassCode).toBe(0x2468);
  });
});

describe("VitaPacketPreamble: timestamps (integer + fractional)", () => {
  it("writes and reads both timestamp fields in big-endian", () => {
    const p = new VitaPacketPreamble();
    p.header.packetType = VitaPacketType.ExtDataWithStream;
    p.header.hasClassId = true;
    p.header.hasTrailer = true; // flag only; preamble doesn't serialize trailer bytes
    p.header.timestampIntegerType = VitaTimeStampIntegerType.UTC;
    p.header.timestampFractionalType = VitaTimeStampFractionalType.RealTime;
    p.header.packetCount = 0xf;
    p.header.packetSize = 0x00ff; // arbitrary full-packet word count

    p.streamId = 0xa1b2c3d4 >>> 0;
    p.classId = {
      oui: 0x00010203,
      informationClassCode: 0x1122,
      packetClassCode: 0x3344,
    };
    p.timestampInt = 0xaabbccdd >>> 0;
    p.timestampFrac = 0x11_22_33_44_55_66_77_88n;

    const bytes = p.toBytes();

    // header(4) + streamId(4) + classId(8) + tsInt(4) + tsFrac(8)
    expect(bytes.byteLength).toBe(4 + 4 + 8 + 4 + 8);

    const round = new VitaPacketPreamble(bytes);

    // header
    expect(round.header.packetType).toBe(VitaPacketType.ExtDataWithStream);
    expect(round.header.hasClassId).toBe(true);
    expect(round.header.hasTrailer).toBe(true);
    expect(round.header.timestampIntegerType).toBe(
      VitaTimeStampIntegerType.UTC,
    );
    expect(round.header.timestampFractionalType).toBe(
      VitaTimeStampFractionalType.RealTime,
    );
    expect(round.header.packetCount).toBe(0xf);
    expect(round.header.packetSize).toBe(0x00ff);

    // fields
    expect(round.streamId).toBe(0xa1b2c3d4 >>> 0);
    expect(round.classId.oui).toBe(0x00010203);
    expect(round.classId.informationClassCode).toBe(0x1122);
    expect(round.classId.packetClassCode).toBe(0x3344);
    expect(round.timestampInt).toBe(0xaabbccdd >>> 0);
    expect(round.timestampFrac).toBe(0x11_22_33_44_55_66_77_88n);
  });
});
