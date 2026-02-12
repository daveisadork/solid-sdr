import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "~/components/ui/menubar";
import useFlexRadio from "~/context/flexradio";
import RtcAudio from "./rtc-audio";

export function AppMenubar() {
  const { state } = useFlexRadio();
  return (
    <Menubar
      classList={{
        "bg-background/50 backdrop-blur-xl":
          state.display.enableTransparencyEffects,
        "bg-background": !state.display.enableTransparencyEffects,
      }}
    >
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New Tab <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>New Window</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Share</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Print</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <RtcAudio />
    </Menubar>
  );
}
