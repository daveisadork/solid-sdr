class DaxAudioPayload {
  numberOfSamples: i32 = 0;
  daxChannel: i32 = -1;
  data: Array<Float32Array> = new Array<Float32Array>();
}

export function parseDaxAudioPayload(bytes: Uint8Array): DaxAudioPayload {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.byteLength % 8 != 0) return new DaxAudioPayload(); // must be stereo f32 frames
  const samples = dv.byteLength / 8;
  const left = new Float32Array(samples);
  const right = new Float32Array(samples);
  let off = 0;
  for (let i = 0; i < samples; i++) {
    left[i] = dv.getFloat32(off);
    off += 4;
    right[i] = dv.getFloat32(off);
    off += 4;
  }
  const p = new DaxAudioPayload();
  p.numberOfSamples = samples;
  p.data.push(left);
  p.data.push(right);
  return p;
}
