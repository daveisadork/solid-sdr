import { StatusBar } from "./components/statusbar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/toast";
import useFlexRadio, { ConnectionState } from "./context/flexradio";
import { FlexRadioProvider } from "./context/flexradio-provider";
import "./app.css";
import {
  ColorModeProvider,
  ColorModeScript,
  createLocalStorageManager,
} from "@kobalte/core/color-mode";
import {
  createRouter,
  defineRoute,
  defineRoutes,
  hashHistory,
  type RouteSectionProps,
  useLocation,
  useNavigate,
  useSearchParams,
} from "@solidjs/router";
import { createEffect, Loading, onSettled, Show } from "solid-js";
import BaselineViewSidebar from "~icons/ic/baseline-view-sidebar";
import MaterialSymbolsOpenInNew from "~icons/material-symbols/open-in-new";
import { DebugBanner } from "./components/debug-mode/banner";
// import { FPSCounter } from "./components/fps";
import { Panafalls } from "./components/panafall/panafalls";
import { RadioSidebar } from "./components/radio-sidebar";
import { ReleaseNotification } from "./components/release-notification";
import { ReloadPrompt } from "./components/reload-prompt";
import { ToolsSidebar } from "./components/tools-sidebar";
import { Button } from "./components/ui/button";
import { Callout, CalloutContent, CalloutTitle } from "./components/ui/callout";
import { AudioProvider } from "./context/audio-provider";
import { ChromeInsetsProvider } from "./context/chrome-insets-provider";
import { ControlsProvider } from "./context/controls-provider";
import { DebugModeProvider } from "./context/debug-mode-provider";
import { PanafallLayoutProvider } from "./context/panafall-layout-provider";
import { usePreferences } from "./context/preferences";
import { PreferencesProvider } from "./context/preferences-provider";
import { RtcProvider } from "./context/rtc-provider";
import { RuntimeProvider } from "./context/runtime-provider";

function AppInner() {
  const { preferences, setPreferences } = usePreferences();
  const { radio } = useFlexRadio();
  return (
    <ChromeInsetsProvider>
      <PanafallLayoutProvider>
        <div class="absolute inset-0 flex flex-col items-stretch isolate">
          <DebugBanner />
          {/* Outer provider: left tools sidebar (no keyboard shortcut yet).
              Inner provider: right radio sidebar (Cmd+B). The inner one is
              display:contents so the left gap spacer, panafalls, and right
              gap spacer all share one flex row. StatusBar lives inside the
              outer provider so its SidebarTrigger reaches the left context
              (required for the mobile Sheet path). */}
          <SidebarProvider
            class="relative grow h-auto overflow-visible min-h-0 bg-transparent"
            open={!!preferences.toolsPanelOpen}
            onOpenChange={(open) =>
              setPreferences((draft) => {
                draft.toolsPanelOpen = open;
              })
            }
            shortcut={null}
          >
            <ToolsSidebar />
            <SidebarProvider
              class="contents"
              open={!!preferences.radioPanelOpen}
              onOpenChange={(open) =>
                setPreferences((draft) => {
                  draft.radioPanelOpen = open;
                })
              }
            >
              <Panafalls />
              <RadioSidebar />
              <Show when={radio()}>
                <SidebarTrigger class="z-(--z-chrome) absolute right-control-inset top-control-inset select-none aspect-square fancy-bg-background size-control pointer-coarse:border pointer-coarse:right-2 pointer-coarse:top-2">
                  <BaselineViewSidebar />
                </SidebarTrigger>
              </Show>
            </SidebarProvider>
            <StatusBar />
          </SidebarProvider>
          {/* <Show when={preferences.showFps}> */}
          {/*   <FPSCounter /> */}
          {/* </Show> */}
        </div>
      </PanafallLayoutProvider>
    </ChromeInsetsProvider>
  );
}

/**
 * Keeps the route in sync with connection state: losing the connection (or
 * deep-linking while disconnected) redirects to /connect, stashing the
 * intended destination in ?next= so a successful connect resumes it. Both
 * redirects fire only on status transitions so the user can still dismiss
 * the connect dialog while disconnected.
 */
function RouteGuard() {
  const { state } = useFlexRadio();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Apply runs only when the status changes, not on route changes.
  createEffect(
    () => state.connectModal.status,
    (status) => {
      if (status === ConnectionState.disconnected) {
        if (location.pathname !== "/connect") {
          const next = location.pathname === "/" ? null : location.pathname;
          navigate(
            next ? `/connect?next=${encodeURIComponent(next)}` : "/connect",
            { replace: true },
          );
        }
      } else if (
        status === ConnectionState.connected &&
        location.pathname === "/connect"
      ) {
        const next = searchParams.next;
        navigate(
          typeof next === "string" && next.startsWith("/") ? next : "/",
          { replace: true },
        );
      }
    },
  );

  return null;
}

function NotFound() {
  const navigate = useNavigate();
  onSettled(() => navigate("/", { replace: true }));
  return null;
}

const Router = createRouter({
  routes: defineRoutes([
    defineRoute({ path: "/" }),
    defineRoute({ path: "/connect" }),
    defineRoute({ path: "/settings/:tab" }),
    defineRoute({ path: "*404", component: NotFound }),
  ]),
  history: hashHistory(),
});

function AppRoot(props: RouteSectionProps) {
  const storageManager = createLocalStorageManager("vite-ui-theme");

  return (
    <>
      <ColorModeScript
        initialColorMode="dark"
        storageType={storageManager.type}
      />
      <ColorModeProvider
        initialColorMode="dark"
        storageManager={storageManager}
      >
        <PreferencesProvider>
          <Show
            when={window.isSecureContext}
            fallback={
              <Callout
                variant="error"
                class="absolute top-1/2 left-1/2 -translate-1/2"
              >
                <CalloutTitle>HTTPS Required</CalloutTitle>
                <CalloutContent class="flex flex-col gap-2">
                  SolidSDR requires a secure context (HTTPS) to work.
                  <div class="flex justify-end">
                    <Button
                      as="a"
                      href="https://github.com/daveisadork/solid-sdr/wiki/Secure-Contexts"
                      target="_blank"
                    >
                      <MaterialSymbolsOpenInNew />
                      View Docs
                    </Button>
                  </div>
                </CalloutContent>
              </Callout>
            }
          >
            <DebugModeProvider>
              <RtcProvider>
                <FlexRadioProvider>
                  <RouteGuard />
                  <RuntimeProvider>
                    <AudioProvider>
                      <ControlsProvider>
                        <AppInner />
                      </ControlsProvider>
                    </AudioProvider>
                  </RuntimeProvider>
                </FlexRadioProvider>
              </RtcProvider>
            </DebugModeProvider>
          </Show>
          {/* Own boundary: the GitHub release check must not hold the app's
              Loading boundary above. */}
          <Loading>
            <ReleaseNotification />
          </Loading>
          <ReloadPrompt />
        </PreferencesProvider>
        <Toaster />
      </ColorModeProvider>
      {props.children}
    </>
  );
}

function App() {
  return <Router>{(props) => <AppRoot {...props} />}</Router>;
}

export default App;
