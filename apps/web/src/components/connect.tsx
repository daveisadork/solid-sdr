import { createEffect, createSignal, For } from "solid-js";
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
import useFlexRadio from "~/context/flexradio";

export default function Connect() {
  const { connect, disconnect, events, state } = useFlexRadio();
  const [radios, setRadios] = createStore(state.connectModal.radios);
  const [open, setOpen] = createSignal(state.connectModal.open);

  createEffect(() => {
    events.addEventListener("discovery", ({ packet: { payload } }) => {
      setRadios(payload.ip, {
        ...payload,
        last_seen: new Date(),
      });
    });
  });

  createEffect((lastOpen) => {
    if (open() && !lastOpen) {
      disconnect();
    }
    return open();
  }, state.connectModal.open);

  createEffect((prevHandle) => {
    if (!prevHandle && state.clientHandle) setOpen(false);
    return state.clientHandle;
  }, state.clientHandle);

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
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
                <li class="flex p-2">
                  <div class="text-sm flex-col grow">
                    <div class="font-semibold">{radio.nickname}</div>
                    <div class="text-muted-foreground">{radio.ip}</div>
                  </div>
                  <div>
                    <Button
                      onClick={() =>
                        connect({ host: radio.ip, port: radio.port })
                      }
                    >
                      Connect
                    </Button>
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
