import useFlexRadio from "~/context/flexradio";
import { Resizable, ResizablePanel } from "../ui/resizable";
import {
  batch,
  createEffect,
  createSignal,
  Show,
  JSX,
  ComponentProps,
  splitProps,
  ValidComponent,
  For,
} from "solid-js";
import { Panadapter } from "./panadapter";
import { Waterfall } from "./waterfall";
import { Scale } from "./scale";
import { createMousePosition } from "@solid-primitives/mouse";
import { createPointerListeners } from "@solid-primitives/pointer";
import { debounce } from "@solid-primitives/scheduled";
import { createStore } from "solid-js/store";
import ArrowCollapseHorizontal from "~icons/mdi/arrow-collapse-horizontal";
import ArrowExpandHorizontal from "~icons/mdi/arrow-expand-horizontal";
import MaterialSymbolsAddCommentOutlineRounded from "~icons/material-symbols/add-comment-outline-rounded";
import MdiFilterPlus from "~icons/mdi/filter-plus";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn, frequencyToLabel, roundToDecimals } from "~/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuCheckboxItem,
  ContextMenuGroup,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
} from "../ui/context-menu";
import { usePanafall } from "~/context/panafall";
import { createWindowSize } from "@solid-primitives/resize-observer";
import { usePreferences } from "~/context/preferences";
import { Toggle } from "../ui/toggle";
import { PanafallControl } from "./controls";
import { CreateProfileDialog } from "../settings/profile-settings";

type PanafallButtonProps<T extends ValidComponent = "button"> = ComponentProps<
  typeof TooltipTrigger<T>
> &
  ComponentProps<typeof Button<T>> & {
    tooltip?: JSX.Element;
    class?: JSX.ElementClass;
  };

export function PanafallButton(props: PanafallButtonProps) {
  const [local, others] = splitProps(props, ["class", "tooltip"]);
  return (
    <Tooltip>
      <TooltipTrigger
        as={Button}
        size="icon"
        variant="ghost"
        class={cn(
          "aspect-square fancy-bg-background not-pointer-coarse:size-5 pointer-coarse:border pointer-coarse:[&_svg]:size-6",
          local.class,
        )}
        {...others}
      />
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
}

type PanafallToggleButtonProps = ComponentProps<typeof TooltipTrigger> &
  ComponentProps<typeof Toggle> & {
    tooltip?: JSX.Element;
    class?: JSX.ElementClass;
  };

export function PanafallToggleButton(props: PanafallToggleButtonProps) {
  const [local, others] = splitProps(props, ["class", "tooltip"]);
  return (
    <Tooltip>
      <TooltipTrigger
        as={Toggle}
        size="icon"
        variant="ghost"
        class={cn(
          "aspect-square not-pointer-coarse:size-5 pointer-coarse:border fancy-bg-background data-pressed:fancy-bg-primary data-pressed:text-primary-foreground pointer-coarse:text-xl",
          local.class,
        )}
        {...others}
      />
      <Show when={local.tooltip}>
        <TooltipContent>{local.tooltip}</TooltipContent>
      </Show>
    </Tooltip>
  );
}

export function Panafall(props: { index: number }) {
  const { preferences, setPreferences } = usePreferences();
  const { radio, state } = useFlexRadio();
  const [clickRef, setClickRef] = createSignal<HTMLElement>();
  const [createProfile, setCreateProfile] = createSignal(false);

  const [dragState, setDragState] = createStore({
    down: false,
    dragging: false,
    downX: 0,
    originX: 0,
    originFreq: 0,
    offset: 0,
  });
  const pos = createMousePosition(clickRef);
  const windowSize = createWindowSize();

  const {
    panadapter,
    waterfall,
    activeSlice,
    panadapterController,
    waterfallController,
    pxPerMHz,
    pxToMHz,
    mhzToPx,
    xToFreq,
    setPanafallControlsRef,
    panafallBounds,
    setPanafallPortalRef,
  } = usePanafall();

  createEffect(
    (lastSize: { width: number; height: number }) => {
      if (
        windowSize.width !== lastSize.width ||
        windowSize.height !== lastSize.height
      ) {
        setDragState({
          down: false,
          dragging: false,
          downX: 0,
          originX: 0,
          originFreq: 0,
          offset: 0,
        });
      }
      return { ...windowSize };
    },
    { width: 0, height: 0 },
  );

  const _setPanCenter = (newCenter: number) => {
    newCenter = parseFloat(newCenter.toFixed(6));
    if (newCenter === panadapter()?.centerFrequencyMHz) {
      if (!dragState.down) setDragState("originX", 0);
      return;
    }
    panadapterController()?.setCenterFrequency(newCenter);
  };

  // eslint-disable-next-line solid/reactivity
  const _setPanCenterDebounced = debounce(_setPanCenter, 100);

  const setPanCenter = (newCenter: number, debounce: boolean = false) => {
    if (debounce) {
      return _setPanCenterDebounced(newCenter);
    }
    _setPanCenterDebounced.clear();
    return _setPanCenter(newCenter);
  };

  const fitPanadapterToPanafallBounds = () => {
    const pan = panadapter();
    const boundsWidth = panafallBounds.width;
    const boundsLeft = panafallBounds.left;

    const fullWidth = pan.width;
    const currentCenter = pan.centerFrequencyMHz;
    const currentBandwidth = pan.bandwidthMHz;

    const targetBandwidth = (currentBandwidth * fullWidth) / boundsWidth;
    const targetMhzPerPixel = targetBandwidth / fullWidth;
    const boundsCenterX = boundsLeft + boundsWidth / 2;
    const targetCenter =
      currentCenter - (boundsCenterX - fullWidth / 2) * targetMhzPerPixel;

    panadapterController().update({
      centerFrequencyMHz: targetCenter,
      bandwidthMHz: targetBandwidth,
    });
  };

  const expandPanafallBoundsToFullPanadapter = () => {
    const pan = panadapter();
    const boundsWidth = panafallBounds.width;
    const boundsLeft = panafallBounds.left;

    const fullWidth = pan.width;
    const currentCenter = pan.centerFrequencyMHz;
    const currentBandwidth = pan.bandwidthMHz;
    const mhzPerPixel = currentBandwidth / fullWidth;
    const boundsRight = boundsLeft + boundsWidth;
    const boundedLeftFrequency =
      currentCenter + (boundsLeft - fullWidth / 2) * mhzPerPixel;
    const boundedRightFrequency =
      currentCenter + (boundsRight - fullWidth / 2) * mhzPerPixel;

    const targetBandwidth = boundedRightFrequency - boundedLeftFrequency;
    const targetCenter = (boundedLeftFrequency + boundedRightFrequency) / 2;

    panadapterController().update({
      centerFrequencyMHz: targetCenter,
      bandwidthMHz: targetBandwidth,
    });
  };

  const finalizeDrag = (event: PointerEvent) => {
    if (event.button !== 0 && event.type !== "pointerleave") return;
    if (!dragState.down) return;
    batch(() => {
      setDragState("down", false);
      if (!dragState.dragging) {
        setDragState("originX", 0);
        return;
      }
      setDragState("dragging", false);
      if (!preferences.smoothScroll) {
        setDragState("originX", 0);
        return;
      }
      const newOffset = event.x - dragState.originX;
      const freq = dragState.originFreq - pxToMHz(newOffset);
      setPanCenter(freq);
    });
  };

  createPointerListeners({
    target: clickRef,
    onDown({ button, x }) {
      if (button !== 0) return; // Only left mouse button

      setDragState({
        down: true,
        downX: x,
        originFreq: panadapter()?.centerFrequencyMHz,
      });
    },
    onMove(event) {
      if (!dragState.down) return;
      if (!dragState.dragging) {
        setDragState({
          dragging: true,
          originX: dragState.originX || dragState.downX,
        });
      }
      const newOffset = event.x - dragState.originX;
      const freq = dragState.originFreq - pxToMHz(newOffset);
      if (preferences.smoothScroll) {
        setDragState("offset", newOffset);
      }
      setPanCenter(freq, preferences.smoothScroll);
    },
    onUp: finalizeDrag,
    onLeave: finalizeDrag,
  });

  const updateScroll = (prevCenter: number, newCenter: number) => {
    if (dragState.offset === 0) {
      return;
    }
    const deltaPx = mhzToPx(newCenter - prevCenter);
    let offset =
      preferences.smoothScroll && dragState.down
        ? Math.round(dragState.offset + deltaPx)
        : 0;
    let originX = dragState.down ? dragState.originX - deltaPx : 0;
    if (Math.abs(deltaPx) > (panafallBounds.width ?? 0)) {
      // this typically happens when changing bands
      offset = 0;
      originX = (panafallBounds.width ?? 0) / 2;
    }
    setDragState({ offset, originX, originFreq: newCenter });
  };

  createEffect((prev?: { center?: number; pxPerMHz?: number }) => {
    const prevCenter = prev?.center;
    const prevPxPerMHz = prev?.pxPerMHz;
    const newCenter = panadapter()?.centerFrequencyMHz;
    if (prevPxPerMHz !== pxPerMHz()) {
      // bandwidth changed or screen resize
      setDragState("offset", 0);
    } else if (prevCenter && newCenter && prevCenter !== newCenter) {
      updateScroll(prevCenter, newCenter);
    }
    return { center: newCenter, pxPerMHz: pxPerMHz() };
  });

  return (
    <div
      class="size-full overflow-visible"
      classList={
        {
          // relative: !preferences.enableTransparencyEffects,
        }
      }
    >
      <div
        class="absolute overflow-visible bg-background"
        ref={setPanafallPortalRef}
        classList={{
          "top-0 left-0 w-dvw h-full": preferences.enableTransparencyEffects,
          "inset-0": !preferences.enableTransparencyEffects,
        }}
        style={{
          "--panafall-available-width": `${panafallBounds.width}px`,
          "--panafall-available-height": `${panafallBounds.height}px`,
          "--panafall-left": `${panafallBounds.left}px`,
          "--panafall-top": `${panafallBounds.top}px`,
          "--panafall-right": `${panafallBounds.right}px`,
          "--panafall-bottom": `${panafallBounds.bottom}px`,

          "--drag-offset": `${dragState.offset}px`,
        }}
      >
        <Show when={panadapter()}>
          {(pan) => (
            <>
              <CreateProfileDialog
                radio={radio()}
                kind="global"
                open={createProfile()}
                onOpenChange={setCreateProfile}
              />
              <div class="relative size-full overflow-visible select-none">
                <Resizable
                  class="size-full overflow-visible select-none"
                  orientation="vertical"
                  sizes={preferences.panadapterSizes[props.index]}
                  initialSizes={[0.25, 0.75]}
                  onSizesChange={(sizes) => {
                    if (sizes?.length !== 2) return;
                    setPreferences("panadapterSizes", props.index, sizes);
                  }}
                >
                  <ResizablePanel class="overflow-clip select-none">
                    <Panadapter
                      pan={pan()}
                      waterfall={waterfall()}
                      controller={panadapterController()}
                    />
                  </ResizablePanel>
                  <Scale pan={pan()} />
                  <ResizablePanel class="overflow-visible select-none">
                    <Show when={waterfall()}>
                      <Waterfall
                        pan={pan()}
                        waterfall={waterfall()}
                        controller={waterfallController()}
                      />
                    </Show>
                  </ResizablePanel>
                </Resizable>
                <ContextMenu>
                  <ContextMenuTrigger
                    classList={{
                      "cursor-grabbing": dragState.dragging,
                      "cursor-crosshair": !dragState.dragging,
                    }}
                    class="absolute inset-0 select-none"
                    onDblClick={(e: PointerEvent) => {
                      if (dragState.dragging) return;
                      setDragState("originX", 0);
                      const slice = activeSlice();
                      const offset = ["DIGU", "FDVU"].includes(slice?.mode)
                        ? slice.diguOffsetHz
                        : ["DIGL", "FDVL"].includes(slice?.mode)
                          ? slice.diglOffsetHz
                          : 0;
                      const freq = roundToDecimals(xToFreq(e.clientX), 3);
                      panadapterController()?.clickTune(
                        freq + offset / 1_000_000,
                      );
                    }}
                    ref={setClickRef}
                  />
                  <ContextMenuPortal>
                    <ContextMenuContent>
                      <ContextMenuGroup>
                        <ContextMenuItem
                          class="pl-8"
                          onSelect={() => {
                            radio().requestSlice({
                              panadapterStreamId: pan().streamId,
                              frequencyMHz: roundToDecimals(xToFreq(pos.x), 3),
                            });
                          }}
                        >
                          <div class="absolute left-2 flex size-3.5 items-center justify-center">
                            <MaterialSymbolsAddCommentOutlineRounded />
                          </div>
                          Create Slice at{" "}
                          {`${roundToDecimals(xToFreq(pos.x), 3)}`} MHz
                        </ContextMenuItem>
                        <ContextMenuItem
                          class="pl-8"
                          onSelect={() => {
                            radio().createTnf(
                              roundToDecimals(xToFreq(pos.x), 6),
                            );
                          }}
                        >
                          <div class="absolute left-2 flex size-3.5 items-center justify-center">
                            <MdiFilterPlus />
                          </div>
                          {`Create TNF at ${Math.round(xToFreq(pos.x) * 1_000_000).toLocaleString("de-DE")} Hz`}
                        </ContextMenuItem>
                      </ContextMenuGroup>
                      <ContextMenuSeparator />
                      <ContextMenuGroup>
                        <ContextMenuSub overlap>
                          <ContextMenuSubTrigger>Profile</ContextMenuSubTrigger>
                          <ContextMenuPortal>
                            <ContextMenuSubContent>
                              <ContextMenuGroup>
                                <Show
                                  when={state.status.radio.profileGlobalList.find(
                                    (profile) =>
                                      profile ===
                                      state.status.radio.profileGlobalSelection,
                                  )}
                                >
                                  {(profile) => (
                                    <ContextMenuItem
                                      onSelect={() =>
                                        radio().saveGlobalProfile(profile())
                                      }
                                    >
                                      {`Save ${profile()}`}
                                    </ContextMenuItem>
                                  )}
                                </Show>
                                <ContextMenuItem
                                  onSelect={() => setCreateProfile(true)}
                                >
                                  Create New...
                                </ContextMenuItem>
                              </ContextMenuGroup>
                              <ContextMenuSeparator />
                              <ContextMenuGroup>
                                <ContextMenuCheckboxItem
                                  checked={state.status.radio.profileAutoSave}
                                  onChange={(checked) => {
                                    radio().setProfileAutoSave(checked);
                                  }}
                                >
                                  Enable Profile Auto-Save
                                </ContextMenuCheckboxItem>
                              </ContextMenuGroup>
                              <ContextMenuSeparator />
                              <ContextMenuRadioGroup
                                value={
                                  state.status.radio.profileGlobalSelection
                                }
                                onChange={(profile) =>
                                  radio().loadGlobalProfile(profile)
                                }
                              >
                                <For
                                  each={Array.from(
                                    state.status.radio.profileGlobalList,
                                  )}
                                >
                                  {(profile) => (
                                    <ContextMenuRadioItem value={profile}>
                                      {profile}
                                    </ContextMenuRadioItem>
                                  )}
                                </For>
                              </ContextMenuRadioGroup>
                            </ContextMenuSubContent>
                          </ContextMenuPortal>
                        </ContextMenuSub>
                      </ContextMenuGroup>
                      <ContextMenuSeparator />
                      <ContextMenuGroup>
                        <ContextMenuCheckboxItem
                          checked={preferences.showTuningGuide}
                          onChange={(checked) => {
                            setPreferences("showTuningGuide", checked);
                          }}
                        >
                          Show Tuning Guide
                        </ContextMenuCheckboxItem>
                        <ContextMenuCheckboxItem
                          checked={preferences.spots.enabled}
                          onChange={(checked) => {
                            setPreferences("spots", "enabled", checked);
                          }}
                        >
                          Show Spots
                        </ContextMenuCheckboxItem>
                        <Show
                          when={
                            state.status.featureLicense.features
                              .PANADAPTER_VISUALS?.enabled
                          }
                        >
                          <ContextMenuCheckboxItem
                            checked={preferences.showDisplayMarkers}
                            onChange={(checked) => {
                              setPreferences("showDisplayMarkers", checked);
                            }}
                          >
                            Show Band Plan
                          </ContextMenuCheckboxItem>
                        </Show>
                        <ContextMenuCheckboxItem
                          checked={preferences.showTxFilterInPan}
                          onChange={(checked) => {
                            setPreferences("showTxFilterInPan", checked);
                          }}
                        >
                          Show TX Filter
                        </ContextMenuCheckboxItem>
                      </ContextMenuGroup>
                    </ContextMenuContent>
                  </ContextMenuPortal>
                </ContextMenu>
              </div>
              <PanafallControl>
                <div class="absolute bottom-2 left-2 grid grid-cols-2 gap-1 text-xs">
                  <PanafallToggleButton
                    pressed={pan().isBandZoomOn}
                    onChange={(pressed) =>
                      panadapterController()?.setBandZoom(pressed)
                    }
                    tooltip="Band Zoom"
                  >
                    B
                  </PanafallToggleButton>
                  <PanafallToggleButton
                    pressed={pan().isSegmentZoomOn}
                    onChange={(pressed) =>
                      panadapterController()?.setSegmentZoom(pressed)
                    }
                    tooltip="Segment Zoom"
                  >
                    S
                  </PanafallToggleButton>
                  <PanafallButton
                    disabled={pan().bandwidthMHz >= pan().maxBandwidthMHz}
                    onClick={() => {
                      const ctrl = panadapterController();
                      const newBandwidth = Math.min(
                        ctrl.bandwidthMHz * 2,
                        ctrl.maxBandwidthMHz,
                      );
                      ctrl.setBandwidth(newBandwidth);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      fitPanadapterToPanafallBounds();
                    }}
                    tooltip={
                      <>
                        Zoom Out (from {frequencyToLabel(pan().bandwidthMHz)} to{" "}
                        {frequencyToLabel(
                          Math.min(
                            pan().bandwidthMHz * 2,
                            pan().maxBandwidthMHz,
                          ),
                        )}
                        )
                      </>
                    }
                  >
                    <ArrowCollapseHorizontal />
                  </PanafallButton>
                  <PanafallButton
                    disabled={pan().bandwidthMHz <= pan().minBandwidthMHz}
                    onClick={() => {
                      const ctrl = panadapterController();
                      const newBandwidth = Math.max(
                        ctrl.bandwidthMHz / 2,
                        ctrl.minBandwidthMHz,
                      );
                      ctrl.setBandwidth(newBandwidth);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      expandPanafallBoundsToFullPanadapter();
                    }}
                    tooltip={
                      <>
                        Zoom In (from {frequencyToLabel(pan().bandwidthMHz)} to{" "}
                        {frequencyToLabel(
                          Math.max(
                            pan().bandwidthMHz / 2,
                            pan().minBandwidthMHz,
                          ),
                        )}
                        )
                      </>
                    }
                  >
                    <ArrowExpandHorizontal />
                  </PanafallButton>
                </div>
              </PanafallControl>
              <Show
                when={
                  preferences.showTuningGuide &&
                  pos.sourceType === "mouse" &&
                  pos.isInside
                }
              >
                <div
                  class="absolute inset-y-0 w-px translate-x-(--cursor-x) pointer-events-none will-change-transform pointer-coarse:hidden z-50"
                  classList={{
                    "backdrop-invert-100":
                      preferences.enableTransparencyEffects,
                    "border-x border-l-foreground border-r-background opacity-75":
                      !preferences.enableTransparencyEffects,
                  }}
                  style={{
                    "--cursor-x": `${pos.x}px`,
                    "--cursor-y": `${pos.y}px`,
                  }}
                >
                  <div class="absolute border rounded-md fancy-bg-popover py-1 px-2 text-xs top-4 translate-y-(--cursor-y) pointer-events-none -translate-x-1/2 whitespace-nowrap font-mono z-50 shadow shadow-black">
                    {`${Math.round(xToFreq(pos.x) * 1_000_000).toLocaleString("de-DE")} Hz`}
                  </div>
                </div>
              </Show>
            </>
          )}
        </Show>
      </div>
      <div
        ref={setPanafallControlsRef}
        class="relative size-full pointer-events-none *:pointer-events-auto"
      />
    </div>
  );
}
