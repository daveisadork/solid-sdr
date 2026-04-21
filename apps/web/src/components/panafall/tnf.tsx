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
} from "../ui/context-menu";
import BaselineDelete from "~icons/ic/baseline-delete";
import MaterialSymbolsFitPageWidthOutline from "~icons/material-symbols/fit-page-width-outline";
import MaterialSymbolsFitPageHeightOutline from "~icons/material-symbols/fit-page-height-outline";
import { createStore } from "solid-js/store";
import { createPointerListeners } from "@solid-primitives/pointer";

export function Tnf(props: { tnf: TnfState; pan: PanadapterState }) {
  const { radio, state, setState } = useFlexRadio();
  const { freqToX, mhzToPx, xToFreq } = usePanafall();
  const [dragState, setDragState] = createStore({
    dragging: false,
    originX: 0,
    originFreq: 0,
    offset: 0,
  });

  const tnfCtrl = () => radio()?.tnf(props.tnf.id);

  createPointerListeners({
    async onMove(event) {
      if (!dragState.dragging) return;
      const newX = Math.max(0, Math.min(event.x, props.pan.width - 1));
      const freq = xToFreq(newX);

      if (freq === props.tnf.frequencyMHz) {
        return;
      }

      await tnfCtrl()?.setFrequency(freq);
    },
    onUp() {
      setDragState("dragging", false);
    },
    onLeave() {
      setDragState("dragging", false);
    },
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger
        class="absolute left-(--tnf-offset) -translate-x-1/2 inset-y-0 w-(--tnf-width) border-x tnf-stripes pointer-events-auto"
        classList={{
          "cursor-pointer": !dragState.dragging,
          "cursor-grabbing": dragState.dragging,
        }}
        style={{
          "--tnf-color": props.tnf.permanent
            ? "var(--color-green-500)"
            : "var(--color-yellow-500)",
          "--tnf-offset": `${freqToX(props.tnf.frequencyMHz)}px`,
          "--tnf-width": `${Math.max(1, Math.round(mhzToPx(props.tnf.bandwidthMHz))) + 2}px`,
        }}
        onPointerDown={(event) => {
          setDragState({
            dragging: true,
            originX: event.clientX,
            originFreq: props.tnf.frequencyMHz,
            offset: 0,
          });
        }}
      />
      <ContextMenuPortal>
        <ContextMenuContent>
          <ContextMenuItem class="pl-8" onClick={() => tnfCtrl()?.remove()}>
            <div class="absolute left-2 flex size-3.5 items-center justify-center">
              <BaselineDelete />
            </div>
            Remove TNF
          </ContextMenuItem>
          <ContextMenuSub overlap>
            <ContextMenuSubTrigger class="pl-8">
              <div class="absolute left-3 flex size-3.5 items-center justify-center">
                <MaterialSymbolsFitPageWidthOutline />
              </div>
              Width
            </ContextMenuSubTrigger>
            <ContextMenuPortal>
              <ContextMenuSubContent>
                <ContextMenuRadioGroup
                  value={(props.tnf.bandwidthMHz * 1_000_000).toString()}
                  onChange={(value) =>
                    tnfCtrl()?.setBandwidth(Number(value) / 1_000_000)
                  }
                >
                  <ContextMenuRadioItem value="50">50 Hz</ContextMenuRadioItem>
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
          <ContextMenuSub overlap>
            <ContextMenuSubTrigger class="pl-8">
              <div class="absolute left-3 flex size-3.5 items-center justify-center">
                <MaterialSymbolsFitPageHeightOutline />
              </div>
              Depth
            </ContextMenuSubTrigger>
            <ContextMenuPortal>
              <ContextMenuSubContent>
                <ContextMenuRadioGroup
                  value={props.tnf.depth.toString()}
                  onChange={(value) => tnfCtrl()?.setDepth(Number(value))}
                >
                  <ContextMenuRadioItem value="1">Normal</ContextMenuRadioItem>
                  <ContextMenuRadioItem value="2">Deep</ContextMenuRadioItem>
                  <ContextMenuRadioItem value="3">
                    Very Deep
                  </ContextMenuRadioItem>
                </ContextMenuRadioGroup>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>
          <ContextMenuCheckboxItem
            checked={props.tnf.permanent}
            onChange={(checked) => tnfCtrl()?.setPermanent(checked)}
          >
            Permanent
          </ContextMenuCheckboxItem>
          {/* <ContextMenuItem */}
          {/*   class="pl-8" */}
          {/*   onClick={() => { */}
          {/*     radio().requestSlice({ */}
          {/*       panadapterStreamId: pan().streamId, */}
          {/*       frequencyMHz: roundToDecimals(xToFreq(pos.x), 3), */}
          {/*     }); */}
          {/*   }} */}
          {/* > */}
          {/*   <div class="absolute left-2 flex size-3.5 items-center justify-center"> */}
          {/*     <MaterialSymbolsAddCommentOutlineRounded /> */}
          {/*   </div> */}
          {/*   Create Slice at {`${roundToDecimals(xToFreq(pos.x), 3)}`} MHz */}
          {/* </ContextMenuItem> */}
          {/* <ContextMenuItem */}
          {/*   class="pl-8" */}
          {/*   onClick={() => { */}
          {/*     radio().createTnf(roundToDecimals(xToFreq(pos.x), 6)); */}
          {/*   }} */}
          {/* > */}
          {/*   <div class="absolute left-2 flex size-3.5 items-center justify-center"> */}
          {/*     <MaterialSymbolsAddCommentOutlineRounded /> */}
          {/*   </div> */}
          {/*   Create TNF at {`${roundToDecimals(xToFreq(pos.x), 6)}`} MHz */}
          {/* </ContextMenuItem> */}
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenu>
  );
}
