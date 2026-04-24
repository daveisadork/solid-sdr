import { createEffect, createSignal, For, Show } from "solid-js";
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
import { getModelInfo } from "@repo/flexlib";
import { Badge } from "./ui/badge";

export default function Connect() {
  const { connect, disconnect, state } = useFlexRadio();

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
      <DialogContent class="flex flex-col sm:max-w-md data-closed:slide-out-to-left data-closed:slide-out-to-bottom data-expanded:slide-in-from-left data-expanded:slide-in-from-bottom overflow-hidden">
        <DialogHeader>
          <DialogTitle>Connect</DialogTitle>
        </DialogHeader>
        <Card class="overflow-y-auto shrink">
          <ul class="grid relative shrink gap-0">
            <For
              each={Object.values(state.discoveredRadios)}
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
                <li class="flex p-2 items-center gap-2 overflow-hidden">
                  <div class="flex flex-col items-center shrink basis-0 not-sm:hidden">
                    <img
                      src={`images/radios/${getModelInfo(radio.model).imageName}`}
                      class="shrink"
                    />
                    <div>
                      <Badge
                        variant={
                          radio.status === "Available" ? "success" : "error"
                        }
                      >
                        {radio.status.replace("_", "\xa0")}
                      </Badge>
                    </div>
                  </div>
                  <div class="flex text-sm flex-col grow justify-center overflow-hidden text-ellipsis">
                    <span class="font-semibold">{radio.model}</span>
                    <div class="inline-flex gap-1">
                      <Show when={radio.nickname}>
                        <span class="text-ellipsis overflow-hidden">
                          {radio.nickname.replace("_", " ")}
                        </span>
                      </Show>
                      <Show when={radio.callsign}>
                        <span class="font-mono text-ellipsis overflow-hidden">
                          {radio.callsign}
                        </span>
                      </Show>
                    </div>
                    <span class="text-muted-foreground">{radio.host}</span>
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
                          classList={{
                            "bg-success text-success-foreground":
                              radio.availableClients > 0,
                            "bg-warning text-warning-foreground":
                              !radio.availableClients,
                          }}
                          class="bg-success text-success-foreground"
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
