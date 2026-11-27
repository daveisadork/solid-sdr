import { createSignal, onCleanup, onSettled } from "solid-js";

const [dateNow, setDateNow] = createSignal(new Date());

let subscribers = 0;
let callback: number | null = null;

function updateDateNow() {
  setDateNow(new Date());
  callback = subscribers ? window.requestAnimationFrame(updateDateNow) : null;
}

function subscribe() {
  subscribers += 1;
  if (callback === null) {
    updateDateNow();
  }
}

function unsubscribe() {
  subscribers -= 1;
}

export function createDateNow() {
  onSettled(subscribe);
  onCleanup(unsubscribe);
  return dateNow;
}
