class OpusPayload {
  numberOfSamples: i32 = 0;
  daxChannel: i32 = -1;
  data: Uint8Array = new Uint8Array(0);
}

export function parseOpusPayload(bytes: Uint8Array): OpusPayload {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.byteLength < 1) return new OpusPayload(); // must have at least 1 byte
  const p = new OpusPayload();
  p.numberOfSamples = dv.byteLength; // number of bytes in the packet
  p.data = bytes;
  return p;
}
