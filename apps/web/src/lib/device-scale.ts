import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";

const onChange = () =>
  setPixelDensity(Math.max(window.devicePixelRatio || 1, 1));

const [pixelDensity, setPixelDensity] = createSignal(
  Math.max(window.devicePixelRatio || 1, 1),
);

createEffect(() => {
  // A resolution media query only fires when it stops matching its fixed
  // value, so re-subscribe whenever the density changes. This catches the
  // window moving to a monitor with a different DPR, where the CSS wrapper
  // size is unchanged but the device-pixel size isn't.
  const current = pixelDensity();
  const query = window.matchMedia(`(resolution: ${current}dppx)`);
  query.addEventListener("change", onChange);
  onCleanup(() => query.removeEventListener("change", onChange));
});

// Snap a device-pixel ratio to its integer scale bucket; bins map to whole
// device pixels only at integer scales.
const deviceScale = createMemo(() => Math.max(1, Math.round(pixelDensity())));

export { pixelDensity, deviceScale };
