import { usePreferences } from "../../context/preferences";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogTrigger,
} from "../ui/dialog";
import MdiSettings from "~icons/mdi/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { AppSettings } from "./app-settings";
import { RadioSettings } from "./radio-settings";
import { Button } from "@kobalte/core/button";

export function Settings() {
  return (
    <Dialog modal={false}>
      <DialogTrigger
        as={Button<"button">}
        class="size-8 not-pointer-coarse:size-5 aspect-square"
      >
        <MdiSettings class="size-full" />
      </DialogTrigger>
      <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="app"
          class="w-full relative flex flex-col gap-2 shrink overflow-hidden"
        >
          <TabsList class="grid grid-cols-4">
            <TabsTrigger value="app">SolidSDR</TabsTrigger>
            <TabsTrigger value="radio">Radio</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="spots">Spots</TabsTrigger>
          </TabsList>
          <div
            class="relative overflow-y-auto shrink pb-2"
            style={{
              "scrollbar-width": "thin",
            }}
          >
            <TabsContent value="app">
              <AppSettings />
            </TabsContent>
            <TabsContent value="radio">
              <RadioSettings />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
