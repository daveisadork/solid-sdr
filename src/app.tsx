import {
  For,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "~/components/ui/card";
import { Flex } from "./components/ui/flex";

import { Meter as MeterElement } from "@kobalte/core/meter";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./components/ui/tooltip";
import useFlexRadio, { FlexRadioProvider } from "./context/flexradio";
import { StatusBar } from "./components/statusbar";
import { Panafall } from "./components/panafall";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import {
  ColorModeProvider,
  ColorModeScript,
  createLocalStorageManager,
} from "@kobalte/core";
import { Toaster } from "./components/ui/toast";
import "./app.css";

function OscillatorSetting() {
  const { state, sendCommand } = useFlexRadio();
  const [oscillator] = createSignal(state.status.radio.oscillator);

  const options = createMemo(() => {
    const options = ["auto"];
    const { ext_present, gnss_present, gpsdo_present, tcxo_present } =
      oscillator();
    if (gnss_present === "1") options.push("gnss");
    if (gpsdo_present === "1") options.push("gpsdo");
    if (tcxo_present === "1") options.push("tcxo");
    if (ext_present === "1") options.push("ext");
    return options;
  });

  createEffect(() => {
    sendCommand("sub gps all").then(console.log).catch(console.error);
    // sendCommand("sub slice all").then(console.log).catch(console.error);
    // sendCommand("sub meter all").then(console.log).catch(console.error);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>FlexRadio Oscillator</CardTitle>
        <CardDescription>
          A simple control panel for FlexRadio devices.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <Select
          value={oscillator().setting ?? "auto"}
          options={options()}
          itemComponent={(props) => (
            <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
          )}
        >
          <SelectTrigger class="w-[180px]">
            <SelectValue<string>>
              {(state) => state.selectedOption()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <Card>
          <CardHeader>
            <CardTitle>GPSDO - {state.status.gps?.status}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre>{JSON.stringify(state.status.gps, null, 2)}</pre>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function MeterList() {
  const { state, setState, sendCommand } = useFlexRadio();

  createEffect(() => {
    sendCommand("sub meter all");
    onCleanup(() => setState("status", "meters", {}));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meters</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <ul class="grid w-full gap-0">
          <For each={Object.values(state.status.meters)}>
            {(meter) => {
              return (
                meter.value !== undefined && (
                  <li class="flex p-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <MeterElement
                          value={meter.value}
                          minValue={meter.low}
                          maxValue={meter.hi}
                          getValueLabel={() =>
                            `${meter.value?.toFixed(2)} ${meter.unit}`
                          }
                          class="flex flex-col w-50 gap-0.5"
                        >
                          <div class="flex justify-between text-sm">
                            <MeterElement.Label class="">
                              {meter.nam}
                            </MeterElement.Label>
                            <MeterElement.ValueLabel class="font-mono" />
                          </div>
                          <MeterElement.Track class="h-2 bg-blue-100">
                            <MeterElement.Fill
                              class="h-full bg-blue-500 w-[var(--kb-meter-fill-width)]"
                              style={{
                                "transition-duration": `${meter.duration}s`,
                              }}
                            />
                          </MeterElement.Track>
                        </MeterElement>
                        <TooltipContent>{meter.desc}</TooltipContent>
                      </TooltipTrigger>
                    </Tooltip>
                  </li>
                )
              );
            }}
          </For>
        </ul>
      </CardContent>
    </Card>
  );
}

function App() {
  const storageManager = createLocalStorageManager("vite-ui-theme");

  return (
    <FlexRadioProvider>
      <ColorModeScript storageType={storageManager.type} />
      <ColorModeProvider storageManager={storageManager}>
        <SidebarProvider class="bg-transparent">
          <Flex
            flexDirection="col"
            class="w-screen h-screen max-h-screen max-w-screen select-none"
          >
            <Panafall />
            {/* {state.clientHandle && ( */}
            {/*   <Flex class="w-full items-start"> */}
            {/*     <MeterList /> */}
            {/*     <OscillatorSetting /> */}
            {/*   </Flex> */}
            {/* )} */}
          </Flex>
          <SidebarTrigger class="z-50 absolute right-2 top-2 select-none" />
          <AppSidebar />
          <StatusBar />
        </SidebarProvider>
        <Toaster />
      </ColorModeProvider>
    </FlexRadioProvider>
  );
}

export default App;
