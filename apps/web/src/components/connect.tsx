import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";
import useFlexRadio, { ConnectionState } from "~/context/flexradio";
import { ProgressCircle } from "./ui/progress-circle";
import { createStore } from "solid-js/store";
import { FlexRadioDescriptor } from "@repo/flexlib";

export default function Connect() {
  const { client, connect, disconnect, state } = useFlexRadio();
  const [radios, setRadios] = createStore<Record<string, FlexRadioDescriptor>>(
    client()
      .radios()
      .reduce((acc, radio) => {
        acc[radio.descriptor.host] = { ...radio.descriptor };
        return acc;
      }, {}),
  );

  const [open, setOpen] = createSignal(
    state.connectModal.status === ConnectionState.disconnected,
  );

  createEffect((lastOpen) => {
    if (open() && !lastOpen) {
      disconnect();
    }
    return open();
  }, true);

  createEffect((prevStatus) => {
    const status = state.connectModal.status;
    switch (status) {
      case prevStatus:
        break;
      case ConnectionState.connected:
        setOpen(false);
        break;
      case ConnectionState.disconnected:
        setOpen(true);
        break;
    }
    return status;
  }, state.connectModal.status);

  const updateDiscoveryRadio = (descriptor?: FlexRadioDescriptor) => {
    if (descriptor) {
      setRadios(descriptor.host, { ...descriptor });
    }
  };

  onMount(() => {
    const flexClient = client();
    const clientSubscriptions = [
      flexClient.on("radioDiscovered", (radio) =>
        updateDiscoveryRadio(radio.descriptor),
      ),
      flexClient.on("radioUpdated", (radio) =>
        updateDiscoveryRadio(radio.descriptor),
      ),
      flexClient.on("radioLost", ({ serial, endpoint }) => {
        setRadios((radios) => {
          const next = { ...radios };
          const removalKey =
            endpoint.host ??
            Object.keys(next).find(
              (existingHost) => next[existingHost]?.serial === serial,
            );
          if (removalKey) {
            delete next[removalKey];
          }
          return next;
        });
      }),
    ];

    flexClient.startDiscovery().catch((error) => {
      console.error("Failed to start discovery session", error);
    });

    onCleanup(() => {
      console.log("Cleaning up discovery subscriptions and session");
      for (const sub of clientSubscriptions) sub.unsubscribe();
      flexClient
        .stopDiscovery()
        .catch((error) =>
          console.error("Failed to stop discovery session", error),
        );
    });
  });

  return (
    <Dialog
      open={open()}
      onOpenChange={(openState) => {
        (document.activeElement as HTMLElement)?.blur();
        setOpen(openState);
      }}
    >
      <DialogTrigger
        as={Button<"button">}
        variant="outline"
        class="font-sans not-pointer-coarse:h-6 not-pointer-coarse:px-2"
      >
        <span class="not-pointer-coarse:text-xs">
          {state.clientHandle ? "Disconnect" : "Connect"}
        </span>
      </DialogTrigger>
      <DialogContent class="sm:max-w-md data-closed:slide-out-to-left data-closed:slide-out-to-bottom data-expanded:slide-in-from-left data-expanded:slide-in-from-bottom">
        <DialogHeader>
          <DialogTitle>Connect</DialogTitle>
        </DialogHeader>
        <Card>
          <ul class="grid w-full gap-0">
            <For
              each={Object.values(radios)}
              fallback={
                <li class="flex p-2">
                  <div class="flex text-sm flex-col grow">
                    <div class="grow">
                      <Skeleton height={16} width={200} radius={10} />
                    </div>
                    <div class="grow">
                      <Skeleton height={16} width={100} radius={10} />
                    </div>
                  </div>
                  <Skeleton circle height={40} />
                </li>
              }
            >
              {(radio) => (
                <li class="flex p-2 items-center">
                  <div class="text-sm flex-col grow">
                    <div class="font-semibold">{radio.nickname}</div>
                    <div class="text-muted-foreground">{radio.host}</div>
                  </div>
                  <div>
                    <Show
                      when={
                        state.connectModal.status ===
                          ConnectionState.connecting &&
                        state.connectModal.selectedRadio === radio.host
                      }
                      fallback={
                        <Button
                          disabled={
                            state.connectModal.status ===
                            ConnectionState.connecting
                          }
                          onClick={() => {
                            if (
                              state.connectModal.status !==
                              ConnectionState.disconnected
                            )
                              return;
                            connect({ host: radio.host, port: radio.port });
                          }}
                        >
                          Connect
                        </Button>
                      }
                    >
                      <ProgressCircle
                        size="xs"
                        value={state.connectModal.stage * 33.33}
                      />
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
