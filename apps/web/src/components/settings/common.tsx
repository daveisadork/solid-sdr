import { type JSXElement, Show } from "solid-js";

export function InfoItem(props: { label: JSXElement; value: JSXElement }) {
  return (
    <Show when={props.value !== undefined}>
      <div class="flex justify-between items-center">
        <span class="font-medium">{props.label}:</span>
        <span>{props.value}</span>
      </div>
    </Show>
  );
}
