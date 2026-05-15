import { createEffect, createSignal, For, Show } from "solid-js";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import useFlexRadio from "~/context/flexradio";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import BaselineDelete from "~icons/ic/baseline-delete";
import MdiRefresh from "~icons/mdi/refresh";
import SvgSpinners180Ring from "~icons/svg-spinners/180-ring";
import { Button } from "../ui/button";
import { WaveformController } from "@repo/flexlib";
import { Dynamic } from "solid-js/web";
import { showToast } from "../ui/toast";
import { Progress, ProgressLabel, ProgressValueLabel } from "../ui/progress";

const UninstallButton = (props: { ctrl: WaveformController }) => {
  const [working, setWorking] = createSignal(false);

  return (
    <Button
      size="icon"
      variant="destructive"
      class="not-pointer-coarse:size-5"
      disabled={working()}
      onClick={() => {
        setWorking(true);
        props.ctrl.uninstall().finally(() => setWorking(false));
      }}
    >
      <Dynamic component={working() ? SvgSpinners180Ring : BaselineDelete} />
    </Button>
  );
};

const RestartButton = (props: { ctrl: WaveformController }) => {
  const [working, setWorking] = createSignal(false);

  return (
    <Button
      size="icon"
      class="not-pointer-coarse:size-5"
      disabled={working()}
      onClick={() => {
        setWorking(true);
        props.ctrl.restart().finally(() => setWorking(false));
      }}
    >
      <Dynamic component={working() ? SvgSpinners180Ring : MdiRefresh} />
    </Button>
  );
};

export function WaveformSettings() {
  const { radio, state } = useFlexRadio();
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [uploadFile, setUploadFile] = createSignal<File>();
  const [target, setTarget] = createSignal("waveform_docker_image");

  createEffect(() => {
    setUploadProgress(0);
    const file = uploadFile();
    if (!file) return;

    radio()
      .uploadFile({
        filename: file.name,
        target: target(),
        data: file.stream().values(),
        totalBytes: file.size,
      })
      .then((upload) => {
        upload.on("progress", (p) => {
          setUploadProgress(Math.round(p * 100));
        });
        upload.on("done", () => setUploadFile());
        upload.on("failed", (f) => {
          showToast({
            title: "Upload Failed",
            variant: "error",
            description: f.reason ?? "unknown error",
          });
          setUploadFile();
        });
      })
      .catch((err: unknown) => {
        showToast({
          title: "Upload Failed",
          variant: "error",
          description: err instanceof Error ? err.message : String(err),
        });
        setUploadFile();
      });
  });

  return (
    <DialogContent class="translate-y-0 top-1/12 flex flex-col max-h-10/12 overflow-hidden">
      <DialogHeader>
        <DialogTitle>Waveform Manager</DialogTitle>
      </DialogHeader>
      <div
        class="relative flex flex-col gap-4 text-sm overflow-y-auto shrink"
        style={{ "scrollbar-width": "thin" }}
      >
        <Card class="bg-transparent">
          <CardHeader>
            <CardTitle>WFP Status</CardTitle>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-4">
            <div>Power:</div>
            <div class="text-right">
              <Badge
                variant={state.status.radio.wfpPowered ? "success" : "error"}
              >
                {state.status.radio.wfpPowered ? "On" : "Off"}
              </Badge>
            </div>
            <div>Ready:</div>
            <div class="text-right">
              <Badge
                variant={state.status.radio.wfpPowered ? "success" : "error"}
              >
                {state.status.radio.wfpReady ? "Yes" : "No"}
              </Badge>
            </div>
            <div>IP Address:</div>
            <div class="text-right">{state.status.radio.wfpIpAddress}</div>
          </CardContent>
        </Card>
        <Table class="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Type</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={Object.values(state.status.waveform)}>
              {(waveform) => {
                return (
                  <TableRow>
                    <TableCell>{waveform.name}</TableCell>
                    <TableCell>{waveform.version}</TableCell>
                    <TableCell>
                      {waveform.isContainer ? "Container" : "Legacy"}
                    </TableCell>
                    <TableCell>
                      <div class="flex gap-1">
                        <div class="grow" />
                        <UninstallButton ctrl={radio().waveform(waveform.id)} />
                        <Show when={waveform.isContainer}>
                          <RestartButton ctrl={radio().waveform(waveform.id)} />
                        </Show>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }}
            </For>
          </TableBody>
        </Table>
        <Show when={uploadFile()}>
          <Progress
            value={uploadProgress()}
            minValue={0}
            maxValue={100}
            getValueLabel={({ value }) => `${value}%`}
            class="flex flex-col gap-2"
          >
            <div class="flex justify-between">
              <ProgressLabel>Uploading {uploadFile()?.name}</ProgressLabel>
              <ProgressValueLabel />
            </div>
          </Progress>
        </Show>
      </div>
      <DialogFooter class="flex flex-col gap-2 items-stretch sm:items-center">
        <Button as="label" disabled={Boolean(uploadFile())}>
          <input
            class="hidden"
            type="file"
            value={""}
            onChange={(event) => {
              setTarget("new_waveform");
              setUploadFile(event.target.files?.item(0));
            }}
          />
          Install Legacy
        </Button>
        <Button as="label" disabled={Boolean(uploadFile())}>
          <input
            class="hidden"
            type="file"
            value={""}
            onChange={(event) => {
              setTarget("waveform_docker_image");
              setUploadFile(event.target.files?.item(0));
            }}
          />
          Install Container
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
