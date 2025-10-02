class WaterfallPayload {
  binBandwidth: f64 = 0;
  firstBinFreq: f64 = 0;
  lineDuration: u32 = 0;
  binsInThisFrame: u16 = 0;
  height: u16 = 0;
  frame: u32 = 0;
  autoBlackLevel: u32 = 0;
  totalBins: u16 = 0;
  startingBin: u16 = 0;
  bins: Array<u16> = new Array<u16>();
}

export function parseWaterfallPayload(bytes: Uint8Array): WaterfallPayload {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const SCALE: f64 = 1024.0 * 1024.0;
  const p = new WaterfallPayload();
  p.firstBinFreq = f64(dv.getInt64(0)) / SCALE;
  p.binBandwidth = f64(dv.getInt64(8)) / SCALE;
  p.lineDuration = dv.getUint32(16);
  p.binsInThisFrame = dv.getUint16(20);
  p.height = dv.getUint16(22);
  p.frame = dv.getUint32(24);
  p.autoBlackLevel = dv.getUint32(28);
  p.totalBins = dv.getUint16(32);
  p.startingBin = dv.getUint16(34);
  for (let i: u16 = 0; i < p.binsInThisFrame; i++) {
    p.bins.push(dv.getUint16(36 + (i << 1)));
  }
  return p;
}
