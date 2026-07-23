import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type ParentComponent,
  useContext,
} from "solid-js";
import { SIDEBAR_WIDTH_PX, useIsMobile } from "~/components/ui/sidebar";
import { usePreferences } from "./preferences";

/**
 * Duration of the chrome squeeze/slide animations. Keep in sync with the
 * duration-200 classes on the inset-consuming elements and in ui/sidebar.tsx.
 */
export const CHROME_TRANSITION_MS = 200;

/**
 * App-chrome insets.
 *
 * Animation chain: the effect below sets --inset-left/right inline on <html>
 * and the values snap. PanafallCell remaps them to --cell-inset-* for the
 * edges each cell touches; the consuming elements carry their own
 * transition-[left,width|right] classes, so only they animate. (The vars must
 * not transition themselves — interpolating inherited vars on :root restyles
 * the whole document per frame.) --inset-bottom is set in app.css (statusbar
 * height is a pointer-type media query, not JS state).
 *
 * JS consumers (flag/detach math) read the accessors, which step to the final
 * value immediately; the per-panafall settledInsets debounce handles the
 * animation window.
 */
const ChromeInsetsContext = createContext<{
  left: Accessor<number>;
  right: Accessor<number>;
}>();

export const ChromeInsetsProvider: ParentComponent = (props) => {
  const { preferences } = usePreferences();
  const isMobile = useIsMobile();

  // Reserved for the future app-level left sidebar (CWX/DVK).
  const left = () => 0;
  // On mobile the radio sidebar is a Sheet overlay and never squeezed content.
  // Without transparency effects the sidebar squeezes the whole panafall via
  // its gap spacer instead of floating over it, so no inset is needed.
  const right = createMemo(() =>
    !isMobile() &&
    preferences.radioPanelOpen &&
    preferences.enableTransparencyEffects
      ? SIDEBAR_WIDTH_PX
      : 0,
  );

  createEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--inset-left", `${left()}px`);
    root.setProperty("--inset-right", `${right()}px`);
  });

  return (
    <ChromeInsetsContext.Provider value={{ left, right }}>
      {props.children}
    </ChromeInsetsContext.Provider>
  );
};

export function useChromeInsets() {
  const context = useContext(ChromeInsetsContext);
  if (!context) {
    throw new Error(
      "useChromeInsets must be used within a ChromeInsetsProvider",
    );
  }
  return context;
}
