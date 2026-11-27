import gt from "semver/functions/gt";
import {
  createEffect,
  createMemo,
  createSignal,
  onSettled,
  refresh,
  Show,
} from "solid-js";
import { Portal } from "@solidjs/web";
import { createPresence } from "@solid-primitives/presence";
import { APP_VERSION } from "~/lib/version";
import MaterialSymbolsOpenInNew from "~icons/material-symbols/open-in-new";
import { Button } from "./ui/button";
import { Callout, CalloutContent, CalloutTitle } from "./ui/callout";

// Fallback only: done() on animationend ends the exit as soon as the CSS
// animation does.
const EXIT_FALLBACK_MS = 300;

export function ReleaseNotification() {
  const [hasNewVersion, setHasNewVersion] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);
  const show = () => hasNewVersion() && !dismissed();
  const { isMounted: present, done } = createPresence(show, {
    transitionDuration: EXIT_FALLBACK_MS,
  });
  const currentRelease = createMemo(
    async (): Promise<{
      tag_name: string;
      name: string;
      html_url: string;
      draft: boolean;
      prerelease: boolean;
    }> => {
      const response = await fetch(
        "https://api.github.com/repos/daveisadork/solid-sdr/releases/latest",
      );
      return await response.json();
    },
  );

  createEffect(() => currentRelease()?.tag_name, {
    effect: (currentVersion) => {
      if (!currentVersion) return;
      setHasNewVersion(gt(currentVersion, APP_VERSION));
    },
    // An offline or rate-limited update check must not break the app.
    error: (err) => console.warn("Release check failed", err),
  });

  onSettled(() => {
    const interval = setInterval(() => refresh(currentRelease), 300_000);
    return () => clearInterval(interval);
  });

  return (
    <Show when={present()}>
      <Portal>
        <Callout
          onAnimationEnd={done}
          class="pointer-events-auto absolute fancy-bg-info! left-1/2 bottom-24 -translate-x-1/2 shadow-black/50 shadow-lg data-expanded:animate-in data-closed:animate-out data-closed:fade-out-0 data-expanded:fade-in-0 data-closed:slide-out-to-bottom data-expanded:slide-in-from-bottom data-closed:zoom-out-50 data-expanded:zoom-in-50 z-100"
          data-closed={!show() ? "" : undefined}
          data-expanded={show() ? "" : undefined}
        >
          <CalloutTitle class="text-foreground">
            SolidSDR {currentRelease()?.name} is available!
          </CalloutTitle>
          <CalloutContent class="flex justify-end gap-2">
            <Button onClick={() => setDismissed(true)}>Dismiss</Button>
            <Button as="a" href={currentRelease()?.html_url} target="_blank">
              <MaterialSymbolsOpenInNew />
              Release Notes
            </Button>
          </CalloutContent>
        </Callout>
      </Portal>
    </Show>
  );
}
