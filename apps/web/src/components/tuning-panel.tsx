import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";
import useFlexRadio from "~/context/flexradio";
import { useRuntime } from "~/context/runtime";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import MaterialSymbolsKeyboardArrowUp from "~icons/material-symbols/keyboard-arrow-up";
import MaterialSymbolsKeyboardArrowDown from "~icons/material-symbols/keyboard-arrow-down";

const digitCount = (value: number) =>
  value < 10 ? 1 : Math.floor(Math.log10(value)) + 1;

interface DigitColumn {
  digit: number;
  place: number;
  leading: boolean;
  separatorBefore: boolean;
}

export const TuningPanel: Component = () => {
  const { radio, state } = useFlexRadio();
  const { runtime, setRuntime } = useRuntime();

  const activeSlice = createMemo(() =>
    Object.values(state.status.slice).find(
      (slice) => slice.isActive && slice.clientHandle === state.clientHandleInt,
    ),
  );
  const activeId = createMemo(() => activeSlice()?.id);

  // Drive the display from a local value while the panel is open, seeded from
  // the slice on open and whenever the targeted slice changes. This mirrors the
  // drag path: we don't read slice state mid-interaction, so rapid digit taps
  // don't race the radio's frequency echo.
  const [valueHz, setValueHz] = createSignal(0);

  const seed = () => {
    const slice = activeSlice();
    setValueHz(slice ? Math.round(slice.frequencyMHz * 1e6) : 0);
  };
  createEffect(on(activeId, seed));
  createEffect(
    on(
      () => runtime.tuningPanelOpen,
      (open) => open && seed(),
    ),
  );

  // Column count is stable across slices: the model's native ceiling, widened
  // to cover the highest RF frequency reachable through any configured
  // transverter (LO + the radio's ~55 MHz IF ceiling).
  const columnCount = createMemo(() => {
    const base = radio()?.modelInfo.has2Meters ? 9 : 8;
    let maxHz = valueHz();
    for (const id in state.status.xvtr) {
      const xvtr = state.status.xvtr[id];
      if (!xvtr?.valid) continue;
      const maxRfMHz = xvtr.rfFreqMHz - xvtr.ifFreqMHz + 55;
      maxHz = Math.max(maxHz, Math.round(maxRfMHz * 1e6));
    }
    return Math.max(base, digitCount(maxHz));
  });

  const columns = createMemo<DigitColumn[]>(() => {
    const n = columnCount();
    const hz = valueHz();
    let firstSignificant = n - 1;
    for (let c = 0; c < n; c++) {
      if (Math.floor(hz / 10 ** (n - 1 - c)) % 10 !== 0) {
        firstSignificant = c;
        break;
      }
    }
    const cols: DigitColumn[] = [];
    for (let c = 0; c < n; c++) {
      const place = 10 ** (n - 1 - c);
      cols.push({
        digit: Math.floor(hz / place) % 10,
        place,
        leading: c < firstSignificant,
        separatorBefore: c > 0 && (n - c) % 3 === 0,
      });
    }
    return cols;
  });

  const adjust = (deltaHz: number) => {
    const slice = activeSlice();
    if (!slice) return;
    const next = Math.max(0, valueHz() + deltaHz);
    setValueHz(next);
    radio()
      ?.slice(slice.id)
      ?.setFrequency(next / 1e6, false);
  };

  return (
    <Sheet
      open={runtime.tuningPanelOpen && Boolean(activeSlice())}
      onOpenChange={(open) => setRuntime("tuningPanelOpen", open)}
      modal={false}
      preventScroll={false}
    >
      <SheetContent
        position="bottom"
        hideOverlay
        class="select-none pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-black"
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
      >
        <Show when={activeSlice()}>
          {(slice) => (
            <>
              <SheetTitle>
                Slice {slice().indexLetter} · {slice().mode}
              </SheetTitle>
              <div class="mx-auto flex max-w-full justify-center gap-1 py-2 font-mono">
                <For each={columns()}>
                  {(col) => (
                    <>
                      <Show when={col.separatorBefore}>
                        <div
                          class="flex w-2 shrink-0 items-center justify-center text-3xl text-muted-foreground sm:text-4xl"
                          classList={{ "opacity-30": col.leading }}
                        >
                          .
                        </div>
                      </Show>
                      <div class="flex min-w-0 max-w-10 flex-1 flex-col items-center gap-1">
                        <Button
                          variant="outline"
                          aria-label={`Increase by ${col.place} Hz`}
                          class="h-10 max-w-10 w-full touch-manipulation p-0 [&_svg]:size-5 sm:[&_svg]:size-6"
                          onClick={() => adjust(col.place)}
                        >
                          <MaterialSymbolsKeyboardArrowUp />
                        </Button>
                        <span
                          class="text-3xl tabular-nums sm:text-4xl"
                          classList={{ "opacity-30": col.leading }}
                        >
                          {col.digit}
                        </span>
                        <Button
                          variant="outline"
                          aria-label={`Decrease by ${col.place} Hz`}
                          class="h-10 w-full touch-manipulation p-0 [&_svg]:size-5 sm:[&_svg]:size-6"
                          onClick={() => adjust(-col.place)}
                        >
                          <MaterialSymbolsKeyboardArrowDown />
                        </Button>
                      </div>
                    </>
                  )}
                </For>
              </div>
            </>
          )}
        </Show>
      </SheetContent>
    </Sheet>
  );
};
