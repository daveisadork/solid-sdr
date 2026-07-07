import { createDraggable } from "@neodrag/solid";
import { createEffect, createSignal, For, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Card, CardContent } from "~/components/ui/card";
import { usePreferences } from "~/context/preferences";
import { useRuntime } from "~/context/runtime";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuTrigger,
} from "./ui/context-menu";

const COLORS = [
  "text-amber-400",
  "text-emerald-400",
  "text-sky-400",
  "text-pink-400",
  "text-violet-400",
];

export function FPSCounter() {
  const [running, setRunning] = createSignal(true);
  const { runtime, setRuntime } = useRuntime();
  const { setPreferences } = usePreferences();
  // biome-ignore lint/correctness/noUnusedVariables: Solid.js directive, referenced via use:draggable in JSX
  const { draggable } = createDraggable();
  let lastTime = performance.now();
  const frameTimes: number[] = [];

  const handleFrame = (time: number) => {
    frameTimes.push(time - lastTime);
    if (frameTimes.length > 10) frameTimes.shift();
    lastTime = time;
    if (running()) refreshLoop();
    const avgFrameTime =
      frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    setRuntime("fps", "B", Math.round(1000 / avgFrameTime));
  };

  const refreshLoop = () => window.requestAnimationFrame(handleFrame);

  createEffect(() => {
    refreshLoop();
    onCleanup(() => setRunning(false));
  });

  return (
    <Portal>
      <ContextMenu>
        <div use:draggable={{ handle: ".handle" }} class="absolute z-50">
          <ContextMenuTrigger>
            <Card class="fancy-bg-card! handle cursor-move">
              <CardContent class="py-2 px-4 select-none">
                <For each={Object.keys(runtime.fps)}>
                  {(key, i) => (
                    <div
                      class={`text-lg font-mono whitespace-pre font-bold ${
                        COLORS[i() % COLORS.length]
                      }`}
                    >
                      {key}: {runtime.fps[key]?.toString().padStart(4, " ")}
                    </div>
                  )}
                </For>
              </CardContent>
            </Card>
          </ContextMenuTrigger>
        </div>
        <ContextMenuPortal>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => setPreferences("showFps", false)}>
              Close
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenuPortal>
      </ContextMenu>
    </Portal>
  );
}
