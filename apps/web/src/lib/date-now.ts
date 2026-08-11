import { createSignal, onCleanup, onMount } from "solid-js";

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
    console.log("starting callback");
    updateDateNow();
  }
}

function unsubscribe() {
  subscribers -= 1;
}

export function createDateNow() {
  onMount(subscribe);
  onCleanup(unsubscribe);
  return dateNow;
}
