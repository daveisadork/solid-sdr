import { JSXElement, Show } from "solid-js";

export function InfoItem(props: { label: JSXElement; value: JSXElement }) {
  return (
    <Show when={props.value !== undefined}>
      <div class="flex justify-between items-center">
        <span>{props.label}:</span>
        <span>{props.value}</span>
      </div>
    </Show>
  );
}
