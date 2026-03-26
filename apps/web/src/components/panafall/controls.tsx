import { ComponentProps } from "solid-js";
import { Portal } from "solid-js/web";
import { usePanafall } from "~/context/panafall";

type PanafallControlProps = ComponentProps<typeof Portal>;

export function PanafallControl(props: PanafallControlProps) {
  const { panafallControlsRef } = usePanafall();
  return <Portal mount={panafallControlsRef()} {...props} />;
}

export function PanadapterControl(props: PanafallControlProps) {
  const { panadapterControlsRef } = usePanafall();
  return <Portal mount={panadapterControlsRef()} {...props} />;
}

export function WaterfallControl(props: PanafallControlProps) {
  const { waterfallControlsRef } = usePanafall();
  return <Portal mount={waterfallControlsRef()} {...props} />;
}
