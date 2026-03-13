import { createEffect, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { usePanafall } from "~/context/panafall";

export function FPSCounter() {
  const [running, setRunning] = createSignal(true);
  const [fps, setFps] = createSignal(0);
  let lastTime = performance.now();
  const frameTimes: number[] = [];
  const { sizeRef } = usePanafall();

  const handleFrame = (time: number) => {
    frameTimes.push(time - lastTime);
    if (frameTimes.length > 10) frameTimes.shift();
    lastTime = time;
    if (running()) refreshLoop();
    const avgFrameTime =
      frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    setFps(Math.round(1000 / avgFrameTime));
  };

  const refreshLoop = () => window.requestAnimationFrame(handleFrame);

  createEffect(() => {
    refreshLoop();
    onCleanup(() => setRunning(false));
  });

  return (
    <Portal mount={sizeRef()}>
      <div class="absolute top-2 left-2 -z-50 text-lg font-mono whitespace-pre font-bold text-amber-400/50">
        B: {fps().toString().padStart(4, " ")}
      </div>
    </Portal>
  );
}
