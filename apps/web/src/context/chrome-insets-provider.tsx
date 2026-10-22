import { createEffect, createMemo, type ParentComponent } from "solid-js";
import { SIDEBAR_WIDTH_PX, useIsMobile } from "~/components/ui/sidebar";
import { ChromeInsetsContext } from "./chrome-insets";
import { usePreferences } from "./preferences";

export const ChromeInsetsProvider: ParentComponent = (props) => {
  const { preferences } = usePreferences();
  const isMobile = useIsMobile();

  // On mobile the sidebars are Sheet overlays and never squeeze content.
  // Without transparency effects a sidebar squeezes the whole panafall via
  // its gap spacer instead of floating over it, so no inset is needed.
  const left = createMemo(() =>
    !isMobile() &&
    preferences.toolsPanelOpen &&
    preferences.enableTransparencyEffects
      ? SIDEBAR_WIDTH_PX
      : 0,
  );
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
