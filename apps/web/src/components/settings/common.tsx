import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";

export function InfoItem(props: { label: JSX.Element; value: JSX.Element }) {
  return (
    <Show when={props.value !== undefined}>
      <div class="flex justify-between items-center">
        <span class="font-medium">{props.label}:</span>
        <span>{props.value}</span>
      </div>
    </Show>
  );
}
