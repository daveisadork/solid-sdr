import { createSignal } from "solid-js";

const [needsReload, setNeedsReload] = createSignal(false);

export { needsReload };

export function requestAppReload() {
  setNeedsReload(true);
}

export function dismissAppReload() {
  setNeedsReload(false);
}

let reloadImpl = () => {
  window.location.reload();
};

export function setReloadImpl(fn: () => void) {
  reloadImpl = fn;
}

export function reloadToNewVersion() {
  reloadImpl();
}
