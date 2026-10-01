import { useRegisterSW } from "virtual:pwa-register/solid";
import { createPageVisibility } from "@solid-primitives/page-visibility";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import createPresence from "solid-presence";
import RefreshIcon from "~icons/material-symbols/refresh";
import { Button } from "./ui/button";
import { Callout, CalloutContent, CalloutTitle } from "./ui/callout";
import { showToastPromise } from "./ui/toast";

const UPDATE_CHECK_MS = 5 * 60 * 1000;

export function ReloadPrompt() {
  let registration: ServiceWorkerRegistration | undefined;
  let updateTimer: number | undefined;
  const visible = createPageVisibility();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, swRegistration) {
      registration = swRegistration;
      if (!swRegistration) return;
      updateTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void swRegistration.update();
        }
      }, UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  onCleanup(() => {
    if (updateTimer !== undefined) window.clearInterval(updateTimer);
  });

  createEffect((wasVisible?: boolean) => {
    const isVisible = !!visible();
    if (isVisible && wasVisible === false) {
      void registration?.update();
    }
    return isVisible;
  });

  const reloadToNewVersion = () => {
    showToastPromise(updateServiceWorker, {
      loading: "Registering update...",
    });
    setNeedRefresh(false);
  };

  onMount(() => {
    window.addEventListener("vite:preloadError", reloadToNewVersion);
    onCleanup(() => {
      window.removeEventListener("vite:preloadError", reloadToNewVersion);
    });
  });

  const [element, setElement] = createSignal<HTMLElement | null>(null);
  const { present } = createPresence({
    show: needRefresh,
    element,
  });

  return (
    <Show when={present()}>
      <Portal>
        <Callout
          ref={setElement}
          class="pointer-events-auto w-max max-w-[90vw] absolute fancy-bg-info! left-1/2 bottom-24 -translate-x-1/2 shadow-black/50 shadow-lg data-expanded:animate-in data-closed:animate-out data-closed:fade-out-0 data-expanded:fade-in-0 data-closed:slide-out-to-bottom data-expanded:slide-in-from-bottom data-closed:zoom-out-50 data-expanded:zoom-in-50 z-100"
          data-closed={!needRefresh() ? "" : undefined}
          data-expanded={needRefresh() ? "" : undefined}
        >
          <CalloutTitle class="text-foreground">
            SolidSDR has been updated.
          </CalloutTitle>
          <CalloutContent class="flex flex-col gap-2">
            <p class="text-foreground">
              Reload the page to use the new version.
            </p>
            <div class="flex justify-end gap-2">
              <Button onClick={reloadToNewVersion}>
                <RefreshIcon />
                Reload
              </Button>
            </div>
          </CalloutContent>
        </Callout>
      </Portal>
    </Show>
  );
}
