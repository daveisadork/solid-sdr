import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  JSX,
  Show,
} from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { createStore } from "solid-js/store";
import { unzip, zip } from "fflate";

import useFlexRadio from "~/context/flexradio";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Radio } from "@repo/flexlib";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { cn } from "~/lib/utils";
import Upload from "~icons/material-symbols/upload";
import Download from "~icons/material-symbols/download";
import Spinner from "~icons/svg-spinners/180-ring";
import { Dynamic } from "solid-js/web";
import { showToast } from "../ui/toast";
import {
  FileField,
  FileFieldHiddenInput,
  FileFieldDropzone,
  FileFieldItemList,
  FileFieldItem,
  FileFieldItemSize,
  FileFieldItemName,
} from "../ui/file-field";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Callout, CalloutContent, CalloutTitle } from "../ui/callout";

// --- Types ---

type ParsedMeta = {
  GLOBAL_PROFILES: string[];
  HW_PROFILES: string[];
  MIC_PROFILES: string[];
  MEMORIES: string[];
  preferences: boolean;
  TNFS: boolean;
  USB_CABLES: boolean;
  XVTRS: boolean;
};

type SelectionState = {
  GLOBAL_PROFILES: Record<string, boolean>;
  HW_PROFILES: Record<string, boolean>;
  MIC_PROFILES: Record<string, boolean>;
  MEMORIES: Record<string, boolean>;
  preferences: boolean;
  TNFS: boolean;
  XVTRS: boolean;
  USB_CABLES: boolean;
};

// --- Parsing / Generating ---

function parseDbMetaData(raw: string): ParsedMeta {
  const meta: ParsedMeta = {
    GLOBAL_PROFILES: [],
    HW_PROFILES: [],
    MIC_PROFILES: [],
    MEMORIES: [],
    preferences: false,
    TNFS: false,
    USB_CABLES: false,
    XVTRS: false,
  };
  for (const line of raw.split("\n")) {
    const parts = line.trim().split("^").filter(Boolean);
    if (!parts.length) continue;
    const [key, ...items] = parts;
    switch (key) {
      case "GLOBAL_PROFILES":
        meta.GLOBAL_PROFILES = items;
        break;
      case "HW_PROFILES":
        meta.HW_PROFILES = items;
        break;
      case "MIC_PROFILES":
        meta.MIC_PROFILES = items;
        break;
      case "MEMORIES":
        meta.MEMORIES = items;
        break;
      case "BAND_PERSISTENCE":
      case "MODE_PERSISTENCE":
      case "GLOBAL_PERSISTENCE":
      case "GLOBAL_PERSIST_BY_CLIENT_ID":
        meta.preferences = true;
        break;
      case "TNFS":
        meta.TNFS = true;
        break;
      case "USB_CABLES":
        meta.USB_CABLES = true;
        break;
      case "XVTRS":
        meta.XVTRS = true;
        break;
    }
  }
  return meta;
}

export function generateDbMetaData(sel: SelectionState): string {
  const lines: string[] = [];
  const selected = (r: Record<string, boolean>) =>
    Object.entries(r)
      .filter(([, v]) => v)
      .map(([k]) => k);

  if (sel.TNFS) lines.push("TNFS^");
  const mems = selected(sel.MEMORIES);
  if (mems.length) lines.push(`MEMORIES^${mems.join("^")}^`);
  if (sel.preferences)
    lines.push(
      "BAND_PERSISTENCE^",
      "MODE_PERSISTENCE^",
      "GLOBAL_PERSISTENCE^",
      "GLOBAL_PERSIST_BY_CLIENT_ID^",
    );
  const hw = selected(sel.HW_PROFILES);
  if (hw.length) lines.push(`HW_PROFILES^${hw.join("^")}^`);
  const mic = selected(sel.MIC_PROFILES);
  if (mic.length) lines.push(`MIC_PROFILES^${mic.join("^")}^`);
  const glob = selected(sel.GLOBAL_PROFILES);
  if (glob.length) lines.push(`GLOBAL_PROFILES^${glob.join("^")}^`);
  if (sel.USB_CABLES) lines.push("USB_CABLES^");
  if (sel.XVTRS) lines.push("XVTRS^");

  return lines.join("\n");
}

// --- Zip helpers ---

function unzipAsync(data: Uint8Array) {
  return new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, (err, files) => (err ? reject(err) : resolve(files))),
  );
}

function zipAsync(files: Record<string, Uint8Array>) {
  return new Promise<Uint8Array>((resolve, reject) =>
    zip(files, (err, data) => (err ? reject(err) : resolve(data))),
  );
}

// --- Reactive selection state ---

type SectionKey =
  | "GLOBAL_PROFILES"
  | "HW_PROFILES"
  | "MIC_PROFILES"
  | "MEMORIES";

function createSelectionState(getMeta: () => ParsedMeta | null) {
  const [sel, setSel] = createStore<SelectionState>({
    GLOBAL_PROFILES: {},
    HW_PROFILES: {},
    MIC_PROFILES: {},
    MEMORIES: {},
    preferences: false,
    TNFS: false,
    XVTRS: false,
    USB_CABLES: false,
  });

  createEffect(() => {
    const m = getMeta();
    if (!m) return;
    const toRecord = (items: string[]) =>
      Object.fromEntries(items.map((k) => [k, true]));
    setSel({
      GLOBAL_PROFILES: toRecord(m.GLOBAL_PROFILES),
      HW_PROFILES: toRecord(m.HW_PROFILES),
      MIC_PROFILES: toRecord(m.MIC_PROFILES),
      MEMORIES: toRecord(m.MEMORIES),
      preferences: m.preferences,
      TNFS: m.TNFS,
      XVTRS: m.XVTRS,
      USB_CABLES: m.USB_CABLES,
    });
  });

  const allSelected = createMemo(() => {
    const m = getMeta();
    if (!m) return false;
    return (
      m.GLOBAL_PROFILES.every((k) => sel.GLOBAL_PROFILES[k]) &&
      m.HW_PROFILES.every((k) => sel.HW_PROFILES[k]) &&
      m.MIC_PROFILES.every((k) => sel.MIC_PROFILES[k]) &&
      m.MEMORIES.every((k) => sel.MEMORIES[k]) &&
      (!m.preferences || sel.preferences) &&
      (!m.TNFS || sel.TNFS) &&
      (!m.USB_CABLES || sel.USB_CABLES) &&
      (!m.XVTRS || sel.XVTRS)
    );
  });

  const anySelected = createMemo(
    () =>
      Object.values(sel.GLOBAL_PROFILES).some(Boolean) ||
      Object.values(sel.HW_PROFILES).some(Boolean) ||
      Object.values(sel.MIC_PROFILES).some(Boolean) ||
      Object.values(sel.MEMORIES).some(Boolean) ||
      sel.preferences ||
      sel.TNFS ||
      sel.USB_CABLES ||
      sel.XVTRS,
  );

  const toggleAll = (val: boolean) => {
    const m = getMeta();
    if (!m) return;
    const toRecord = (items: string[]) =>
      Object.fromEntries(items.map((k) => [k, val]));
    setSel({
      GLOBAL_PROFILES: toRecord(m.GLOBAL_PROFILES),
      HW_PROFILES: toRecord(m.HW_PROFILES),
      MIC_PROFILES: toRecord(m.MIC_PROFILES),
      MEMORIES: toRecord(m.MEMORIES),
      preferences: m.preferences ? val : false,
      TNFS: m.TNFS ? val : false,
      USB_CABLES: m.USB_CABLES ? val : false,
      XVTRS: m.XVTRS ? val : false,
    });
  };

  const toggleSection = (section: SectionKey, val: boolean) => {
    const m = getMeta();
    if (!m) return;
    setSel(section, Object.fromEntries(m[section].map((k) => [k, val])));
  };

  return { sel, setSel, allSelected, anySelected, toggleAll, toggleSection };
}

// --- UI Primitives ---

type CheckboxRowProps = {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (val: boolean) => void;
  disabled?: boolean;
  children?: JSX.Element;
  class?: string;
};

const CheckboxRow = (props: CheckboxRowProps) => (
  <Label
    class={cn("flex gap-2 items-center", props.class)}
    classList={{
      "opacity-50": props.disabled,
    }}
  >
    <Checkbox
      class="pointer-events-none"
      checked={props.checked}
      indeterminate={props.indeterminate}
      onChange={props.onChange}
      disabled={props.disabled}
    />
    <span>{props.children}</span>
  </Label>
);

type SectionProps = {
  label: string;
  items: string[];
  checked: Record<string, boolean>;
  onToggle: (val: boolean) => void;
  onToggleItem: (item: string, val: boolean) => void;
  formatItem?: (item: string) => string;
};

const Section = (props: SectionProps) => {
  const allChecked = createMemo(
    () => props.items.length > 0 && props.items.every((k) => props.checked[k]),
  );
  const someChecked = createMemo(() =>
    props.items.some((k) => props.checked[k]),
  );

  return (
    <div class="flex flex-col gap-2">
      <CheckboxRow
        disabled={props.items.length === 0}
        checked={allChecked()}
        indeterminate={someChecked() && !allChecked()}
        onChange={props.onToggle}
      >
        {props.label}
      </CheckboxRow>
      <Show when={props.items.length > 0}>
        <div class="flex flex-col gap-2 pl-4 border-l ml-2">
          <For each={props.items}>
            {(item) => (
              <CheckboxRow
                checked={props.checked[item] ?? false}
                onChange={(val) => props.onToggleItem(item, val)}
              >
                {props.formatItem ? props.formatItem(item) : item}
              </CheckboxRow>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// --- Selection Panel ---

type SelectionPanelProps = {
  meta: ParsedMeta;
  sel: SelectionState;
  setSel: SetStoreFunction<SelectionState>;
  allSelected: boolean;
  anySelected: boolean;
  onToggleAll: (val: boolean) => void;
  onToggleSection: (section: SectionKey, val: boolean) => void;
};

const SelectionPanel = (props: SelectionPanelProps) => (
  <Card class="flex flex-col bg-transparent flex-1 overflow-hidden relative">
    <CardHeader>
      <CardTitle>Selections</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-4 overflow-y-auto flex-1">
      <CheckboxRow
        checked={props.allSelected}
        indeterminate={props.anySelected && !props.allSelected}
        onChange={props.onToggleAll}
        class="font-medium"
      >
        Select All
      </CheckboxRow>
      <hr class="border-border" />
      <Section
        label="Global Profiles"
        items={props.meta.GLOBAL_PROFILES}
        checked={props.sel.GLOBAL_PROFILES}
        onToggle={(val) => props.onToggleSection("GLOBAL_PROFILES", val)}
        onToggleItem={(item, val) => props.setSel("GLOBAL_PROFILES", item, val)}
      />
      <Section
        label="TX Profiles"
        items={props.meta.HW_PROFILES}
        checked={props.sel.HW_PROFILES}
        onToggle={(val) => props.onToggleSection("HW_PROFILES", val)}
        onToggleItem={(item, val) => props.setSel("HW_PROFILES", item, val)}
      />
      <Section
        label="Mic Profiles"
        items={props.meta.MIC_PROFILES}
        checked={props.sel.MIC_PROFILES}
        onToggle={(val) => props.onToggleSection("MIC_PROFILES", val)}
        onToggleItem={(item, val) => props.setSel("MIC_PROFILES", item, val)}
      />
      <Section
        label="Memories"
        items={props.meta.MEMORIES}
        checked={props.sel.MEMORIES}
        onToggle={(val) => props.onToggleSection("MEMORIES", val)}
        onToggleItem={(item, val) => props.setSel("MEMORIES", item, val)}
        formatItem={(item) => item.replace("|", " – ")}
      />
      <CheckboxRow
        disabled={!props.meta.preferences}
        checked={props.sel.preferences}
        onChange={(val) => props.setSel("preferences", val)}
      >
        Preferences
      </CheckboxRow>
      <CheckboxRow
        disabled={!props.meta.TNFS}
        checked={props.sel.TNFS}
        onChange={(val) => props.setSel("TNFS", val)}
      >
        TNFs
      </CheckboxRow>
      <CheckboxRow
        disabled={!props.meta.XVTRS}
        checked={props.sel.XVTRS}
        onChange={(val) => props.setSel("XVTRS", val)}
      >
        XVTRs
      </CheckboxRow>
      <CheckboxRow
        disabled={!props.meta.USB_CABLES}
        checked={props.sel.USB_CABLES}
        onChange={(val) => props.setSel("USB_CABLES", val)}
      >
        USB Cables
      </CheckboxRow>
    </CardContent>
  </Card>
);

// --- Main Component ---

function ImportExportInner(props: { radio: Radio }) {
  const [activeTab, setActiveTab] = createSignal("export");
  const busy = () => exporting() || importing();

  // Export
  const [exportMeta] = createResource(async () => {
    const buf = await props.radio.createDownload("db_meta_data").start();
    return parseDbMetaData(new TextDecoder().decode(buf));
  });
  const {
    sel: exportSel,
    setSel: setExportSel,
    allSelected: exportAllSelected,
    anySelected: exportAnySelected,
    toggleAll: exportToggleAll,
    toggleSection: exportToggleSection,
  } = createSelectionState(() => exportMeta() ?? null);

  const [exporting, setExporting] = createSignal(false);
  const doExport = async (metadata: string) => {
    setExporting(true);
    try {
      const upload = await props.radio.uploadFile({
        target: "db_meta_subset",
        data: new TextEncoder().encode(metadata),
      });
      await new Promise<void>((resolve, reject) => {
        upload.on("done", resolve);
        upload.on("failed", reject);
      });
      // Radio returns "File server busy" if we request db_package immediately after upload
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      const pkg = await props.radio.createDownload("db_package").start();
      const url = URL.createObjectURL(
        new Blob([pkg.buffer as ArrayBuffer], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `SSDR_Config_${new Date().toISOString().replaceAll(":", ".")}_v${props.radio.version}.ssdr_cfg`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // Import
  const [importFile, setImportFile] = createSignal<File>();
  const [importMeta, setImportMeta] = createSignal<ParsedMeta | null>(null);
  const [flexPayload, setFlexPayload] = createSignal<Uint8Array | null>(null);
  const {
    sel: importSel,
    setSel: setImportSel,
    allSelected: importAllSelected,
    anySelected: importAnySelected,
    toggleAll: importToggleAll,
    toggleSection: importToggleSection,
  } = createSelectionState(importMeta);

  const [importError, setImportError] = createSignal<string | null>(null);

  const handleFileChange = async (file: File) => {
    try {
      const files = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
      console.log("backup zip contents:", Object.keys(files));
      if (!files.meta_data || !files.flex_payload) {
        setImportError(
          `Invalid backup file — found: ${Object.keys(files).join(", ") || "(empty)"}`,
        );
        return;
      }
      setImportMeta(parseDbMetaData(new TextDecoder().decode(files.meta_data)));
      setFlexPayload(files.flex_payload);
    } catch (err) {
      setImportError(`Could not read file: ${err}`);
    }
  };

  createEffect(() => {
    setImportError(null);
    setImportMeta(null);
    setFlexPayload(null);
    const file = importFile();
    if (!file) return;
    handleFileChange(file);
  });

  createEffect(() => {
    if (activeTab() === "import") {
      setImportFile();
    }
  });

  const [importing, setImporting] = createSignal(false);
  const doImport = async (metadata: string, payload: Uint8Array) => {
    setImporting(true);
    try {
      const bundle = await zipAsync({
        meta_subset: new TextEncoder().encode(metadata),
        flex_payload: payload,
      });
      const upload = await props.radio.uploadFile({
        target: "db_import",
        data: bundle,
      });
      await new Promise<void>((resolve, reject) => {
        upload.on("done", resolve);
        upload.on("failed", reject);
      });
      showToast({ title: "Imported Successfully", variant: "success" });
    } catch (err) {
      showToast({ title: "Import Failed", description: err, variant: "error" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Tabs
        value={activeTab()}
        onChange={setActiveTab}
        class="flex flex-col flex-1 min-h-0"
      >
        <TabsList class="w-full grid grid-cols-2 shrink-0">
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="export" class="flex flex-col flex-1 gap-2 min-h-0">
          <Show
            when={exportMeta()}
            fallback={<div class="text-muted-foreground text-sm">Loading…</div>}
          >
            {(m) => (
              <SelectionPanel
                meta={m()}
                sel={exportSel}
                setSel={setExportSel}
                allSelected={exportAllSelected()}
                anySelected={exportAnySelected()}
                onToggleAll={exportToggleAll}
                onToggleSection={exportToggleSection}
              />
            )}
          </Show>
        </TabsContent>

        <TabsContent value="import" class="flex flex-col flex-1 gap-2 min-h-0">
          <Show when={importError()}>
            <Callout variant="error" class="flex flex-col min-h-0">
              <CalloutTitle>Import Error</CalloutTitle>
              <CalloutContent class="min-h-0 overflow-auto">
                {importError()}
              </CalloutContent>
            </Callout>
          </Show>
          <Show when={importMeta()}>
            {(m) => (
              <SelectionPanel
                meta={m()}
                sel={importSel}
                setSel={setImportSel}
                allSelected={importAllSelected()}
                anySelected={importAnySelected()}
                onToggleAll={importToggleAll}
                onToggleSection={importToggleSection}
              />
            )}
          </Show>
          <FileField
            accept=".ssdr_cfg,.zip"
            multiple={false}
            onFileChange={({ acceptedFiles }) =>
              setImportFile(acceptedFiles[0])
            }
            disabled={busy()}
          >
            <FileFieldDropzone class="flex justify-around items-center">
              <Show
                when={importFile()}
                fallback="Drop your file here or click to choose..."
              >
                <FileFieldItemList>
                  {() => (
                    <FileFieldItem>
                      <FileFieldItemName />
                      <FileFieldItemSize />
                    </FileFieldItem>
                  )}
                </FileFieldItemList>
              </Show>
            </FileFieldDropzone>
            <FileFieldHiddenInput />
          </FileField>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Show when={activeTab() === "export"}>
          <Button
            disabled={!exportAnySelected() || busy()}
            onClick={() => doExport(generateDbMetaData(exportSel))}
          >
            <Dynamic component={exporting() ? Spinner : Download} />
            Export
          </Button>
        </Show>
        <Show when={activeTab() === "import"}>
          <Button
            disabled={!importAnySelected() || busy() || !importMeta()}
            onClick={() => {
              const payload = flexPayload();
              if (payload) doImport(generateDbMetaData(importSel), payload);
            }}
          >
            <Dynamic component={importing() ? Spinner : Upload} />
            Import
          </Button>
        </Show>
      </DialogFooter>
    </>
  );
}

export function ImportExport() {
  const { radio } = useFlexRadio();
  return (
    <DialogContent class="translate-y-0 top-1/12 flex max-h-10/12 flex-col overflow-hidden text-sm">
      <DialogHeader class="shrink-0">
        <DialogTitle>Import / Export</DialogTitle>
        <DialogDescription>Import or export radio data</DialogDescription>
      </DialogHeader>

      <Show when={radio()} fallback={<div class="text-sm">Not Connected</div>}>
        <ImportExportInner radio={radio()} />
      </Show>
    </DialogContent>
  );
}
