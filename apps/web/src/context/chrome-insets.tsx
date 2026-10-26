import { type Accessor, createContext, useContext } from "solid-js";

/**
 * Duration of the chrome squeeze/slide animations. Keep in sync with the
 * duration-200 classes on the inset-consuming elements and in ui/sidebar.tsx.
 */
export const CHROME_TRANSITION_MS = 200;

/**
 * App-chrome insets.
 *
 * Animation chain: ChromeInsetsProvider sets --inset-left/right inline on
 * <html> and the values snap. PanafallCell remaps them to --cell-inset-* for
 * the edges each cell touches; the consuming elements carry their own
 * transition-[left,width|right] classes, so only they animate. (The vars must
 * not transition themselves — interpolating inherited vars on :root restyles
 * the whole document per frame.) --inset-bottom is set in app.css (statusbar
 * height is a pointer-type media query, not JS state).
 *
 * JS consumers (flag/detach math) read the accessors, which step to the final
 * value immediately; the per-panafall settledInsets debounce handles the
 * animation window.
 */
export const ChromeInsetsContext = createContext<{
  left: Accessor<number>;
  right: Accessor<number>;
}>();

export function useChromeInsets() {
  const context = useContext(ChromeInsetsContext);
  if (!context) {
    throw new Error(
      "useChromeInsets must be used within a ChromeInsetsProvider",
    );
  }
  return context;
}
