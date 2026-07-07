import * as ButtonPrimitive from "@kobalte/core/button";
import { getModelInfo } from "@repo/flexlib";
import { Key } from "@solid-primitives/keyed";
import {
  type ComponentProps,
  createEffect,
  createSignal,
  For,
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import useFlexRadio, { ConnectionState } from "~/context/flexradio";
import MdiCheckNetworkOutline from "~icons/mdi/check-network-outline";
import MdiCloseNetworkOutline from "~icons/mdi/close-network-outline";
import MdiMinusNetworkOutline from "~icons/mdi/minus-network-outline";
import MdiPlusNetworkOutline from "~icons/mdi/plus-network-outline";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ProgressCircle } from "./ui/progress-circle";
import { Skeleton } from "./ui/skeleton";

const STATUS_MAP: Record<string, ComponentProps<typeof Badge>["variant"]> = {
  Available: "success",
  In_Use: "error",
  Recovery: "warning",
  Updating: "warning",
};

export default function Connect() {
  const { connect, disconnect, state, client } = useFlexRadio();

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
        as={ButtonPrimitive.Button<"button">}
        class="size-10 not-pointer-coarse:size-5 aspect-square"
        title={state.clientHandle ? "Disconnect" : "Connect"}
      >
        <Dynamic
          component={
            state.clientHandle ? MdiCheckNetworkOutline : MdiCloseNetworkOutline
          }
          class="size-full"
        />
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
              {(radio) => {
                return (
                  <li class="flex p-2 items-center gap-2 overflow-hidden">
                    <div class="flex flex-col items-center shrink basis-0 not-sm:hidden">
                      <img
                        src={`images/radios/${getModelInfo(radio.model).imageName}`}
                        alt={getModelInfo(radio.model).modelName}
                        class="shrink"
                      />
                      <div class="min-w-20 flex justify-around">
                        <Badge variant={STATUS_MAP[radio.status] ?? "warning"}>
                          {radio.status.replaceAll("_", "\xa0")}
                        </Badge>
                      </div>
                    </div>
                    <div class="flex text-sm flex-col grow justify-center">
                      <span class="font-semibold">{radio.model}</span>
                      <div class="inline-flex gap-1">
                        <span class="truncate">
                          {[
                            radio.nickname?.replaceAll("_", "\xa0"),
                            radio.callsign,
                          ]
                            .filter(Boolean)
                            .join("\xa0|\xa0")}
                        </span>
                      </div>
                      <span class="text-muted-foreground">{radio.host}</span>
                    </div>
                    <Show when={radio.guiClients}>
                      {(guiClients) => (
                        <div>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              as={Button<"button">}
                              variant="destructive"
                              size="icon"
                              class="bg-warning text-warning-foreground [&_svg]:size-full p-2"
                            >
                              <MdiMinusNetworkOutline />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent class="overflow-visible">
                              <DropdownMenuArrow />
                              <DropdownMenuLabel>
                                {radio.licensedClients - radio.availableClients}
                                /{radio.licensedClients} Clients Connected
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <Key each={guiClients()} by="clientHandle">
                                {(guiClient) => (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      console.log(
                                        "Disconnecting client",
                                        guiClient(),
                                      );
                                      client()
                                        .disconnectClient(
                                          radio,
                                          guiClient().clientHandle,
                                        )
                                        .then(console.log)
                                        .catch(console.error);
                                    }}
                                  >
                                    Disconnect{" "}
                                    {guiClient().program ?? "Unknown"} (
                                    {guiClient().station ??
                                      guiClient().host ??
                                      guiClient().ip}
                                    )
                                  </DropdownMenuItem>
                                )}
                              </Key>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </Show>
                    <div>
                      <Button
                        size="icon"
                        classList={{
                          "bg-success text-success-foreground":
                            radio.availableClients > 0,
                          "bg-warning text-warning-foreground":
                            !radio.availableClients,
                        }}
                        class="[&_svg]:size-full p-2"
                        disabled={
                          state.connectModal.status ===
                            ConnectionState.connecting ||
                          radio.status !== "Available"
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
                        <Show
                          when={
                            state.connectModal.status ===
                              ConnectionState.connecting &&
                            state.connectModal.selectedRadio === radio.host
                          }
                          fallback={<MdiPlusNetworkOutline />}
                        >
                          <ProgressCircle
                            size="xs"
                            value={state.connectModal.stage * 33.33}
                          />
                        </Show>
                      </Button>
                    </div>
                  </li>
                );
              }}
            </For>
          </ul>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
