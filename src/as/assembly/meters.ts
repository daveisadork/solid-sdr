class MeterSample {
  id: u16 = 0;
  value: i16 = 0;
}

class MetersPayload extends Array<MeterSample> {}

export function parseMeterPayload(bytes: Uint8Array): MetersPayload {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new MetersPayload();
  for (let off: i32 = 0; off < dv.byteLength; off += 4) {
    const s = new MeterSample();
    s.id = dv.getUint16(off);
    s.value = dv.getInt16(off + 2);
    out.push(s);
  }
  return out;
}
