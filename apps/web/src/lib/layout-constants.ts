/**
 * Single source of truth for panafall/chrome layout geometry.
 *
 * TS-first because the detach/flag/inset math needs these numbers in JS; the
 * same values are mirrored to CSS custom properties once at the app root (see
 * layoutCssVars) so Tailwind arbitrary-value classes like `top-(--control-inset)`
 * reference the identical numbers with no duplication.
 */
export const LAYOUT = {
  /** Inset of floating control buttons from cell/viewport corners (was top-4/left-4/right-4). */
  controlInset: 16,
  /** Size of the floating control buttons (was size-10). */
  controlSize: 40,
  /** Right-edge gutter shared by the dBm scale and waterfall time scale (was w-10). */
  scaleGutter: 40,
  /** Height of the frequency scale / its overlay offset above the waterfall bottom (was h-4/bottom-4). */
  freqScaleHeight: 16,
  /** Width of the app sidebars (mirrors ui/sidebar SIDEBAR_WIDTH = 16rem). */
  sidebarWidth: 256,
  /** Fixed height of the StatusBar overlay. */
  statusbarHeight: 36,
  /** The one transition token for chrome squeeze/slide animations (was duration-200). */
  layoutDurationMs: 200,
} as const;

/** Top padding that clears the floating control buttons (was pt-16 in DetachedSlices). */
export const DETACHED_CLEARANCE = LAYOUT.controlInset + LAYOUT.controlSize + 8;

/**
 * Stacking order. Cell-scoped layers stack inside each cell's isolated
 * context; splitHandle/chrome/modal stack at app level.
 */
export const Z = {
  cellGraphics: 0,
  cellOverlays: 10,
  cellFlags: 20,
  cellControls: 30,
  splitHandle: 40,
  chrome: 50,
  modal: 60,
} as const;

/**
 * Typed names for cross-file CSS custom-property contracts. Consumers should
 * reference these instead of retyping the literal var name.
 */
export const CSS_VARS = {
  /** Pan-drag smooth-scroll delta, set on the panafall portal layer. */
  dragOffset: "--drag-offset",
  controlInset: "--control-inset",
  controlSize: "--control-size",
  detachedClearance: "--detached-clearance",
  scaleGutter: "--scale-gutter",
  freqScaleHeight: "--freq-scale-height",
  sidebarWidth: "--sidebar-width",
  statusbarHeight: "--statusbar-height",
  layoutDuration: "--layout-duration",
  zCellGraphics: "--z-cell-graphics",
  zCellOverlays: "--z-cell-overlays",
  zCellFlags: "--z-cell-flags",
  zCellControls: "--z-cell-controls",
  zSplitHandle: "--z-split-handle",
  zChrome: "--z-chrome",
  zModal: "--z-modal",
} as const;

/** CSS custom properties mirroring LAYOUT/Z — spread into the app root's style. */
export function layoutCssVars(): Record<string, string> {
  return {
    [CSS_VARS.controlInset]: `${LAYOUT.controlInset}px`,
    [CSS_VARS.controlSize]: `${LAYOUT.controlSize}px`,
    [CSS_VARS.detachedClearance]: `${DETACHED_CLEARANCE}px`,
    [CSS_VARS.scaleGutter]: `${LAYOUT.scaleGutter}px`,
    [CSS_VARS.freqScaleHeight]: `${LAYOUT.freqScaleHeight}px`,
    [CSS_VARS.sidebarWidth]: `${LAYOUT.sidebarWidth}px`,
    [CSS_VARS.statusbarHeight]: `${LAYOUT.statusbarHeight}px`,
    [CSS_VARS.layoutDuration]: `${LAYOUT.layoutDurationMs}ms`,
    [CSS_VARS.zCellGraphics]: `${Z.cellGraphics}`,
    [CSS_VARS.zCellOverlays]: `${Z.cellOverlays}`,
    [CSS_VARS.zCellFlags]: `${Z.cellFlags}`,
    [CSS_VARS.zCellControls]: `${Z.cellControls}`,
    [CSS_VARS.zSplitHandle]: `${Z.splitHandle}`,
    [CSS_VARS.zChrome]: `${Z.chrome}`,
    [CSS_VARS.zModal]: `${Z.modal}`,
  };
}
