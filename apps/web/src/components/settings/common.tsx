import { JSXElement, Show } from "solid-js";

export function InfoItem(props: { label: JSXElement; value: JSXElement }) {
  return (
    <Show when={props.value !== undefined}>
      <div class="flex">
        <div class="grow">{props.label}:</div>
        <span>{props.value}</span>
      </div>
    </Show>
  );
}
