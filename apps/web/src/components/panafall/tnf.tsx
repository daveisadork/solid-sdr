import useFlexRadio, { PanadapterState, TnfState } from "~/context/flexradio";
import { usePanafall } from "~/context/panafall";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuGroup,
  ContextMenuGroupLabel,
} from "../ui/context-menu";
import BaselineDelete from "~icons/ic/baseline-delete";
import { createStore } from "solid-js/store";
import { createPointerListeners } from "@solid-primitives/pointer";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { batch, createSignal } from "solid-js";
import { Separator } from "../ui/separator";

const MHZ = 1_000_000;
const TNF_MIN = 5 / MHZ;
const TNF_MAX = 6_000 / MHZ;
const TNF_STEP = 50;

function quantizeBandwidth(bandwidthMHz: number) {
  const quantized =
    (Math.round((bandwidthMHz * MHZ) / TNF_STEP) / MHZ) * TNF_STEP;
  return Math.min(Math.max(quantized, TNF_MIN), TNF_MAX);
}

export function Tnf(props: { tnf: TnfState; pan: PanadapterState }) {
  const { radio, state } = useFlexRadio();
  const { freqToX, mhzToPx, pxToMHz } = usePanafall();
  const [dragState, setDragState] = createStore({
    down: false,
    dragging: false,
    originX: 0,
    originFreq: 0,
  });

  const [tooltipOpen, setTooltipOpen] = createSignal(false);
  const [contextMenuOpen, setContextMenuOpen] = createSignal(false);

  const tnfCtrl = () => radio()?.tnf(props.tnf.id);

  createPointerListeners({
    async onMove(event) {
      if (!dragState.down) return;
      const freq = dragState.originFreq + pxToMHz(event.x - dragState.originX);
      const bandwidthChangeMHz =
        Math.round(-event.movementY * TNF_STEP) / 1_000_000;
      const bandwidth = quantizeBandwidth(
        props.tnf.bandwidthMHz + bandwidthChangeMHz,
      );

      batch(() => {
        setDragState("dragging", true);
        if (freq !== props.tnf.frequencyMHz) {
          tnfCtrl()?.setFrequency(freq);
        }
        if (bandwidth !== props.tnf.bandwidthMHz) {
          tnfCtrl()?.setBandwidth(bandwidth);
        }
      });
    },
    onUp() {
      setDragState({
        down: false,
        dragging: false,
      });
    },
    onLeave() {
      setDragState({
        down: false,
        dragging: false,
      });
    },
  });

  return (
    <div
      class="absolute left-(--tnf-offset) -translate-x-1/2 inset-y-0 w-(--tnf-width) pointer-events-auto cursor-move touch-none"
      style={{
        "--tnf-color": state.status.radio.tnfEnabled
          ? props.tnf.permanent
            ? "var(--color-green-500)"
            : "var(--color-yellow-500)"
          : "var(--color-foreground)",
        "--tnf-offset": `${freqToX(props.tnf.frequencyMHz)}px`,
        "--tnf-width": `${Math.max(1, Math.round(mhzToPx(props.tnf.bandwidthMHz))) + 2}px`,
        "--tnf-depth": props.tnf.depth,
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (contextMenuOpen()) return;
        setDragState({
          down: true,
          originX: event.clientX,
          originFreq: props.tnf.frequencyMHz,
        });
      }}
    >
      <Tooltip
        disabled={contextMenuOpen()}
        open={(tooltipOpen() && !contextMenuOpen()) || dragState.dragging}
        onOpenChange={
          (open) =>
            setTooltipOpen((open && !contextMenuOpen()) || dragState.dragging)
          // setTooltipOpen(!contextMenuOpen() && (open || dragState.dragging))
        }
      >
        <TooltipTrigger as="div" class="absolute inset-0">
          <ContextMenu
            onOpenChange={(open) => {
              if (open) setDragState("dragging", false);
              setContextMenuOpen(open);
            }}
          >
            <ContextMenuTrigger
              class="absolute inset-0"
              classList={{
                "pointer-events-none": contextMenuOpen() || dragState.dragging,
              }}
            >
              <div class="absolute inset-0 border-x tnf-stripes" />
            </ContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent>
                <ContextMenuGroup>
                  <ContextMenuGroupLabel>
                    {props.tnf.frequencyMHz.toFixed(6)} MHz
                  </ContextMenuGroupLabel>
                  <ContextMenuSub overlap>
                    <ContextMenuSubTrigger>
                      Width: {Math.round(props.tnf.bandwidthMHz * MHZ)} Hz
                    </ContextMenuSubTrigger>
                    <ContextMenuPortal>
                      <ContextMenuSubContent>
                        <ContextMenuRadioGroup
                          value={(props.tnf.bandwidthMHz * MHZ).toString()}
                          onChange={(value) =>
                            tnfCtrl()?.setBandwidth(Number(value) / MHZ)
                          }
                        >
                          <ContextMenuRadioItem value="50">
                            50 Hz
                          </ContextMenuRadioItem>
                          <ContextMenuRadioItem value="100">
                            100 Hz
                          </ContextMenuRadioItem>
                          <ContextMenuRadioItem value="200">
                            200 Hz
                          </ContextMenuRadioItem>
                          <ContextMenuRadioItem value="500">
                            500 Hz
                          </ContextMenuRadioItem>
                        </ContextMenuRadioGroup>
                      </ContextMenuSubContent>
                    </ContextMenuPortal>
                  </ContextMenuSub>
                </ContextMenuGroup>
                <ContextMenuSeparator />
                <ContextMenuItem
                  class="pl-8"
                  onSelect={() => tnfCtrl()?.remove()}
                >
                  <div class="absolute left-2 flex size-3.5 items-center justify-center">
                    <BaselineDelete />
                  </div>
                  Delete TNF
                </ContextMenuItem>
                <ContextMenuCheckboxItem
                  checked={props.tnf.permanent}
                  onChange={(checked) => tnfCtrl()?.setPermanent(checked)}
                >
                  Remember
                </ContextMenuCheckboxItem>
                <ContextMenuSeparator />
                <ContextMenuGroup>
                  <ContextMenuGroupLabel>Depth</ContextMenuGroupLabel>
                  <ContextMenuRadioGroup
                    value={props.tnf.depth.toString()}
                    onChange={(value) => tnfCtrl()?.setDepth(Number(value))}
                  >
                    <ContextMenuRadioItem value="1">
                      Normal
                    </ContextMenuRadioItem>
                    <ContextMenuRadioItem value="2">Deep</ContextMenuRadioItem>
                    <ContextMenuRadioItem value="3">
                      Very Deep
                    </ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuGroup>
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenu>
        </TooltipTrigger>
        <TooltipContent class="overflow-visible">
          <TooltipArrow />
          <div class="flex flex-col gap-1">
            <span>RF Tracking Notch</span>
            <Separator />
            <span>{props.tnf.frequencyMHz.toFixed(6)} MHz</span>
            <span>
              {(props.tnf.bandwidthMHz * 1_000_000).toFixed(0)} Hz Wide
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
