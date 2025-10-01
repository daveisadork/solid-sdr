import { createEffect, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export function FPSCounter() {
  const [running, setRunning] = createSignal(true);
  const [fps, setFps] = createSignal(0);
  let lastTime = performance.now();
  const frameTimes: number[] = [];

  function refreshLoop() {
    window.requestAnimationFrame((time) => {
      frameTimes.push(time - lastTime);
      if (frameTimes.length > 10) frameTimes.shift();
      lastTime = time;
      if (running()) refreshLoop();
      const avgFrameTime =
        frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      setFps(Math.round(1000 / avgFrameTime));
    });
  }

  createEffect(() => {
    refreshLoop();
    onCleanup(() => setRunning(false));
  });

  return (
    <Portal>
      <div class="fixed top-2 left-2 z-50 text-lg font-bold text-amber-400">
        {fps()}
      </div>
    </Portal>
  );
}
