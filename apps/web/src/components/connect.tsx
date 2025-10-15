import { createEffect, createSignal, For, Show, onCleanup } from "solid-js";
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
import { createStore } from "solid-js/store";
import useFlexRadio, {
  ConnectionState,
  PacketEvent,
} from "~/context/flexradio";
import { decodeDiscoveryPayload } from "~/lib/vita49";
import { ProgressCircle } from "./ui/progress-circle";

export default function Connect() {
  const { connect, disconnect, events, state } = useFlexRadio();
  const [radios, setRadios] = createStore(state.connectModal.radios);
  const [open, setOpen] = createSignal(state.connectModal.open);

  createEffect(() => {
    const textEncoder = new TextEncoder();
    const listener = ({ packet }: PacketEvent<"discovery">) => {
      const payload = decodeDiscoveryPayload(
        textEncoder.encode(packet.payload),
      );
      setRadios(payload.ip, {
        ...payload,
        last_seen: new Date(),
      });
    };

    events.addEventListener("discovery", listener);
    onCleanup(() => events.removeEventListener("discovery", listener));
  });

  createEffect((lastOpen) => {
    if (open() && !lastOpen) {
      disconnect();
    }
    return open();
  }, false);

  createEffect((prevStatus) => {
    const status = state.connectModal.status;
    if (status === ConnectionState.connected && prevStatus !== status) {
      setOpen(false);
    } else if (
      status === ConnectionState.disconnected &&
      prevStatus !== status
    ) {
      setOpen(true);
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
        size="xs"
        variant="outline"
        class="font-sans"
      >
        {state.clientHandle ? "Disconnect" : "Connect"}
      </DialogTrigger>
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect</DialogTitle>
        </DialogHeader>
        <Card>
          <ul class="grid w-full gap-0">
            <For
              each={Object.values(radios).filter(
                (radio) => radio.last_seen > new Date(Date.now() - 1000 * 20),
              )}
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
                    <div class="text-muted-foreground">{radio.ip}</div>
                  </div>
                  <div>
                    <Show
                      when={
                        state.connectModal.status ===
                          ConnectionState.connecting &&
                        state.connectModal.selectedRadio === radio.ip
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
                            connect({ host: radio.ip, port: radio.port });
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
