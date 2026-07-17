import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type ParentComponent,
  useContext,
} from "solid-js";
import { useIsMobile } from "~/components/ui/sidebar";
import { LAYOUT } from "~/lib/layout-constants";
import { usePreferences } from "./preferences";

/**
 * App-chrome insets derived from known state — no measurement. Published as
 * --inset-left/right/bottom on the root element; those are registered via
 * @property in app.css with a transition, so every consumer (sidebar panel,
 * cell padding) reads the identical interpolated value mid-animation.
 *
 * JS consumers (flag/detach math) read the accessors, which step to the final
 * value immediately; the per-panafall settledInsets debounce handles the
 * animation window.
 */
const ChromeInsetsContext = createContext<{
  left: Accessor<number>;
  right: Accessor<number>;
  bottom: Accessor<number>;
}>();

export const ChromeInsetsProvider: ParentComponent = (props) => {
  const { preferences } = usePreferences();
  const isMobile = useIsMobile();

  // Reserved for the future app-level left sidebar (CWX/DVK).
  const left = () => 0;
  // On mobile the radio sidebar is a Sheet overlay and never squeezed content.
  const right = createMemo(() =>
    !isMobile() && preferences.radioPanelOpen ? LAYOUT.sidebarWidth : 0,
  );
  const bottom = () => LAYOUT.statusbarHeight;

  createEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--inset-left", `${left()}px`);
    root.setProperty("--inset-right", `${right()}px`);
    root.setProperty("--inset-bottom", `${bottom()}px`);
  });

  return (
    <ChromeInsetsContext.Provider value={{ left, right, bottom }}>
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
