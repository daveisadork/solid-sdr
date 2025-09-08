class PanadapterPayload {
  startingBin: u16 = 0;
  binsInThisFrame: u16 = 0;
  binSize: u16 = 0;
  totalBins: u16 = 0;
  frame: u32 = 0;
  bins: Array<u16> = new Array<u16>();
}

export function parsePanadapterPayload(bytes: Uint8Array): PanadapterPayload {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const p = new PanadapterPayload();
  p.startingBin = dv.getUint16(0);
  p.binsInThisFrame = dv.getUint16(2);
  p.binSize = dv.getUint16(4);
  p.totalBins = dv.getUint16(6);
  p.frame = dv.getUint32(8);
  for (let i: u16 = 0; i < p.binsInThisFrame; i++) {
    p.bins.push(dv.getUint16(12 + (i << 1)));
  }
  return p;
}
