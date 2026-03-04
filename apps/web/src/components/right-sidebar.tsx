import { Sidebar, SidebarContent } from "~/components/ui/sidebar";

export function RightSidebar() {
  return (
    <Sidebar
      gap={true}
      side="right"
      variant="floating"
      class="absolute h-full bg-transparent pointer-events-none"
    >
      <SidebarContent class="h-full p-4 overflow-clip pointer-events-auto">
        Hello world!
      </SidebarContent>
    </Sidebar>
  );
}
