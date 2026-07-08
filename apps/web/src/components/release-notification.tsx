import {
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import createPresence from "solid-presence";
import { APP_VERSION } from "~/lib/version";
import MaterialSymbolsOpenInNew from "~icons/material-symbols/open-in-new";
import { Button } from "./ui/button";
import { Callout, CalloutContent, CalloutTitle } from "./ui/callout";

export function ReleaseNotification() {
  const [hasNewVersion, setHasNewVersion] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);
  const show = () => hasNewVersion() && !dismissed();
  const [element, setElement] = createSignal<HTMLElement>(null);
  const { present } = createPresence({
    show,
    element,
  });
  const [currentRelease, { refetch }] = createResource<{
    tag_name: string;
    name: string;
    html_url: string;
    draft: boolean;
    prerelease: boolean;
  }>(async () => {
    const response = await fetch(
      "https://api.github.com/repos/daveisadork/solid-sdr/releases/latest",
    );
    return await response.json();
  });

  createEffect(() => {
    const currentVersion = currentRelease()?.tag_name;
    if (!currentVersion) return;
    setHasNewVersion(!APP_VERSION.startsWith(currentVersion));
  });

  onMount(() => {
    const interval = setInterval(refetch, 300_000);
    onCleanup(() => clearInterval(interval));
  });

  return (
    <Show when={present()}>
      <Portal>
        <Callout
          ref={setElement}
          class="absolute fancy-bg-info! left-1/2 bottom-24 -translate-x-1/2 shadow-black/50 shadow-lg duration-2000 data-expanded:animate-in data-closed:animate-out data-closed:fade-out-0 data-expanded:fade-in-0 data-closed:slide-out-to-bottom data-expanded:slide-in-from-bottom data-closed:zoom-out-50 data-expanded:zoom-in-50"
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
