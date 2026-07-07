import type * as DialogPrimitive from "@kobalte/core/dialog";
import { createDisclosureState } from "@kobalte/core/primitives/create-disclosure-state";
import { RadioGroup } from "@kobalte/core/radio-group";
import type { Radio } from "@repo/flexlib";
import {
  createEffect,
  createSignal,
  For,
  type JSX,
  Show,
  splitProps,
} from "solid-js";
import useFlexRadio from "~/context/flexradio";
import MaterialSymbolsDelete from "~icons/material-symbols/delete";
import MaterialSymbolsDeviceReset from "~icons/material-symbols/device-reset";
import MaterialSymbolsSave from "~icons/material-symbols/save";
import { Button } from "../ui/button";
import { ConfirmButton } from "../ui/confirm-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { SimpleSwitch } from "../ui/simple-switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/text-field";

const LABELS = {
  global: "Global",
  mic: "Microphone",
  tx: "Transmit",
};

export function CreateProfileDialog(
  props: DialogPrimitive.DialogRootProps & {
    radio: Radio;
    kind: "global" | "mic" | "tx";
    children?: JSX.Element;
  },
) {
  const [local, rest] = splitProps(props, [
    "children",
    "defaultOpen",
    "kind",
    "onOpenChange",
    "open",
    "radio",
  ]);
  const [name, setName] = createSignal("");
  const disclosureState = createDisclosureState({
    open: () => local.open,
    defaultOpen: () => local.defaultOpen,
    onOpenChange: (isOpen) => local.onOpenChange?.(isOpen),
  });

  createEffect(() => {
    if (!disclosureState.isOpen()) setName("");
  });

  return (
    <Dialog
      open={disclosureState.isOpen()}
      onOpenChange={disclosureState.setIsOpen}
      {...rest}
    >
      {local.children}
      <DialogContent
        as="form"
        onSubmit={(event) => {
          event.preventDefault();
          const profileName = name();
          if (!profileName.length) return;
          const method = {
            global: "saveGlobalProfile",
            tx: "createTxProfile",
            mic: "createMicProfile",
          }[local.kind];

          local.radio[method](profileName)
            .then(() => {
              disclosureState.setIsOpen(false);
            })
            .catch(console.error);
        }}
      >
        <DialogHeader>
          <DialogTitle>Create {LABELS[props.kind]} Profile</DialogTitle>
        </DialogHeader>
        <TextField
          value={name()}
          onChange={setName}
          class="flex flex-col gap-2"
        >
          <TextFieldLabel for="profile-name">Profile Name</TextFieldLabel>
          <TextFieldInput id="profile-name" placeholder="New Profile Name" />
        </TextField>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => disclosureState.setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={name().length === 0}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GlobalProfiles(props: { radio: Radio }) {
  const { state } = useFlexRadio();

  return (
    <Table class="whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead class="w-full">Name</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <RadioGroup
        as={TableBody}
        value={state.status.radio.profileGlobalSelection}
        onChange={(value) => props.radio.loadGlobalProfile(value)}
      >
        <For each={Array.from(state.status.radio.profileGlobalList)}>
          {(profile) => {
            return (
              <RadioGroup.Item as={TableRow} value={profile}>
                <TableCell>
                  <RadioGroup.ItemInput />
                  <RadioGroup.ItemControl class="aspect-square size-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <RadioGroup.ItemIndicator class="flex h-full items-center justify-center ">
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="size-2.5 fill-current text-current"
                      >
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                      </svg>
                    </RadioGroup.ItemIndicator>
                  </RadioGroup.ItemControl>
                </TableCell>
                <TableCell>{profile}</TableCell>
                <TableCell class="flex justify-end gap-1">
                  <ConfirmButton
                    size="icon"
                    title="Save"
                    message={`Update global profile "${profile}" with the current settings?`}
                    onConfirm={() => props.radio.saveGlobalProfile(profile)}
                  >
                    <MaterialSymbolsSave />
                  </ConfirmButton>
                  <ConfirmButton
                    size="icon"
                    variant="destructive"
                    title="Delete"
                    message={`Delete global profile "${profile}"?`}
                    onConfirm={() => props.radio.deleteGlobalProfile(profile)}
                  >
                    <MaterialSymbolsDelete />
                  </ConfirmButton>
                </TableCell>
              </RadioGroup.Item>
            );
          }}
        </For>
      </RadioGroup>
    </Table>
  );
}

function TxProfiles(props: { radio: Radio }) {
  const { state } = useFlexRadio();

  return (
    <Table class="whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead class="w-full">Name</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <RadioGroup
        as={TableBody}
        value={state.status.radio.profileTxSelection}
        onChange={(value) => props.radio.loadTxProfile(value)}
      >
        <For each={Array.from(state.status.radio.profileTxList)}>
          {(profile) => {
            return (
              <RadioGroup.Item as={TableRow} value={profile}>
                <TableCell>
                  <RadioGroup.ItemInput />
                  <RadioGroup.ItemControl class="aspect-square size-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <RadioGroup.ItemIndicator class="flex h-full items-center justify-center ">
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="size-2.5 fill-current text-current"
                      >
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                      </svg>
                    </RadioGroup.ItemIndicator>
                  </RadioGroup.ItemControl>
                </TableCell>
                <TableCell>{profile}</TableCell>
                <TableCell class="flex justify-end gap-1">
                  <ConfirmButton
                    size="icon"
                    title="Reset"
                    message={`Reset transmit profile "${profile}" to default settings?`}
                    onConfirm={() => props.radio.resetTxProfile(profile)}
                  >
                    <MaterialSymbolsDeviceReset />
                  </ConfirmButton>
                  <ConfirmButton
                    disabled={
                      profile === state.status.radio.profileTxSelection &&
                      !state.status.radio.profileUnsavedChangesTx
                    }
                    size="icon"
                    title="Save"
                    message={`Update transmit profile "${profile}" with the current settings?`}
                    onConfirm={() => props.radio.createTxProfile(profile)}
                  >
                    <MaterialSymbolsSave />
                  </ConfirmButton>
                  <ConfirmButton
                    size="icon"
                    variant="destructive"
                    title="Delete"
                    message={`Delete transmit profile "${profile}"?`}
                    onConfirm={() => props.radio.deleteTxProfile(profile)}
                  >
                    <MaterialSymbolsDelete />
                  </ConfirmButton>
                </TableCell>
              </RadioGroup.Item>
            );
          }}
        </For>
      </RadioGroup>
    </Table>
  );
}

function MicProfiles(props: { radio: Radio }) {
  const { state } = useFlexRadio();

  return (
    <Table class="whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead class="w-full">Name</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <RadioGroup
        as={TableBody}
        value={state.status.radio.profileMicSelection}
        onChange={(value) => props.radio.loadMicProfile(value)}
      >
        <For each={Array.from(state.status.radio.profileMicList)}>
          {(profile) => {
            return (
              <RadioGroup.Item as={TableRow} value={profile}>
                <TableCell>
                  <RadioGroup.ItemInput />
                  <RadioGroup.ItemControl class="aspect-square size-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <RadioGroup.ItemIndicator class="flex h-full items-center justify-center ">
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="size-2.5 fill-current text-current"
                      >
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                      </svg>
                    </RadioGroup.ItemIndicator>
                  </RadioGroup.ItemControl>
                </TableCell>
                <TableCell>{profile}</TableCell>
                <TableCell class="flex justify-end gap-1">
                  <ConfirmButton
                    size="icon"
                    title="Reset"
                    message={`Reset microphone profile "${profile}" to default settings?`}
                    onConfirm={() => props.radio.resetMicProfile(profile)}
                  >
                    <MaterialSymbolsDeviceReset />
                  </ConfirmButton>
                  <ConfirmButton
                    disabled={
                      profile === state.status.radio.profileMicSelection &&
                      !state.status.radio.profileUnsavedChangesMic
                    }
                    size="icon"
                    title="Save"
                    message={`Update microphone profile "${profile}" with the current settings?`}
                    onConfirm={() => props.radio.createMicProfile(profile)}
                  >
                    <MaterialSymbolsSave />
                  </ConfirmButton>
                  <ConfirmButton
                    size="icon"
                    variant="destructive"
                    title="Delete"
                    message={`Delete microphone profile "${profile}"?`}
                    onConfirm={() => props.radio.deleteMicProfile(profile)}
                  >
                    <MaterialSymbolsDelete />
                  </ConfirmButton>
                </TableCell>
              </RadioGroup.Item>
            );
          }}
        </For>
      </RadioGroup>
    </Table>
  );
}

function ProfileSettingsInner(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const [activeTab, setActiveTab] = createSignal<"global" | "mic" | "tx">(
    "global",
  );

  return (
    <>
      <div class="flex flex-col gap-4 overflow-hidden py-4">
        <SimpleSwitch
          label="Enable Profile Auto-Save"
          checked={state.status.radio.profileAutoSave}
          onChange={(checked) => props.radio.setProfileAutoSave(checked)}
        />
        <Tabs
          value={activeTab()}
          onChange={setActiveTab}
          class=" flex flex-col overflow-hidden"
        >
          <TabsList class="grid w-fit grid-cols-3 m-auto">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="tx">Transmit</TabsTrigger>
            <TabsTrigger value="mic">Microphone</TabsTrigger>
          </TabsList>
          <div class="shrink overflow-auto">
            <TabsContent value="global">
              <GlobalProfiles radio={props.radio} />
            </TabsContent>
            <TabsContent value="tx">
              <TxProfiles radio={props.radio} />
            </TabsContent>
            <TabsContent value="mic">
              <MicProfiles radio={props.radio} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <DialogFooter>
        <CreateProfileDialog radio={props.radio} kind={activeTab()}>
          <DialogTrigger as={Button}>Create Profile</DialogTrigger>
        </CreateProfileDialog>
      </DialogFooter>
    </>
  );
}

export function ProfileSettings() {
  const { radio } = useFlexRadio();
  return (
    <DialogContent class="translate-y-0 top-1/12 flex max-h-10/12 flex-col overflow-hidden text-sm">
      <DialogHeader>
        <DialogTitle>Profile Manager</DialogTitle>
      </DialogHeader>
      <Show when={radio()} fallback={<div class="text-sm">Not Connected</div>}>
        <ProfileSettingsInner radio={radio()} />
      </Show>
    </DialogContent>
  );
}
