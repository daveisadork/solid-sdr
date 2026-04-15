import { JSXElement } from "solid-js";

export function InfoItem(props: { label: JSXElement; value: JSXElement }) {
  return (
    <div class="flex">
      <div class="grow">{props.label}:</div>
      <span>{props.value}</span>
    </div>
  );
}
