import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as SliderPrimitive from "@kobalte/core/slider";

import { cn } from "~/lib/utils";
import { Label } from "~/components/ui/label";

type SliderRootProps<T extends ValidComponent = "div"> =
  SliderPrimitive.SliderRootProps<T> & {
    class?: string | undefined;
  };

const Slider = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SliderRootProps<T>>,
) => {
  const [local, others] = splitProps(props as SliderRootProps, ["class"]);
  return (
    <SliderPrimitive.Root
      class={cn(
        "relative flex w-full touch-none select-none flex-col items-center",
        local.class,
      )}
      {...others}
    />
  );
};

type SliderTrackProps<T extends ValidComponent = "div"> =
  SliderPrimitive.SliderTrackProps<T> & {
    class?: string | undefined;
  };

const SliderTrack = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SliderTrackProps<T>>,
) => {
  const [local, others] = splitProps(props as SliderTrackProps, ["class"]);
  return (
    <SliderPrimitive.Track
      class={cn(
        "relative h-2 w-full grow rounded-full bg-input data-disabled:opacity-50",
        local.class,
      )}
      {...others}
    />
  );
};

type SliderFillProps<T extends ValidComponent = "div"> =
  SliderPrimitive.SliderFillProps<T> & {
    class?: string | undefined;
  };

const SliderFill = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SliderFillProps<T>>,
) => {
  const [local, others] = splitProps(props as SliderFillProps, ["class"]);
  return (
    <SliderPrimitive.Fill
      class={cn("absolute h-full rounded-full bg-primary", local.class)}
      {...others}
    />
  );
};

type SliderThumbProps<T extends ValidComponent = "span"> =
  SliderPrimitive.SliderThumbProps<T> & {
    class?: string | undefined;
    style?: JSX.CSSProperties | undefined;
    ref?: T | ((el: T) => void);
    children?: JSX.Element;
  };

const SliderThumb = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, SliderThumbProps<T>>,
) => {
  const [local, others] = splitProps(props as SliderThumbProps, [
    "class",
    "children",
    "style",
  ]);
  const context = SliderPrimitive.useSliderContext();
  let ref: HTMLElement | undefined;

  const index = () =>
    ref ? context.thumbs().findIndex((v) => v.ref() === ref) : -1;

  const position = () => {
    return context.state.getThumbPercent(index());
  };

  const transform = () => {
    /*
    let value = 50;
    const isVertical = context.state.orientation() === "vertical";

    if (isVertical) {
      value *= context.isSlidingFromBottom() ? 1 : -1;
    } else {
      value *= context.isSlidingFromLeft() ? -1 : 1;
    }

    return isVertical ? `translate(-50%, ${value}%)` : `translate(${value}%, -50%)`;
     */
    const pos = `${position() * 100}%`;

    if (context.state.orientation() === "vertical") {
      return context.inverted() ? `translateY(-${pos})` : `translateY(${pos})`;
    }

    return context.inverted() ? `translateX(${pos})` : `translateX(-${pos})`;
  };

  return (
    <SliderPrimitive.Thumb
      class={cn(
        "-top-1.5 block size-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-disabled:pointer-events-none",
        local.class,
      )}
      ref={ref}
      // style={{
      //   transform: transform(),
      //   ...(local.style ?? {}),
      // }}
      {...others}
    >
      <SliderPrimitive.Input />
    </SliderPrimitive.Thumb>
  );
};

const SliderLabel = <T extends ValidComponent = "label">(
  props: PolymorphicProps<T, SliderPrimitive.SliderLabelProps<T>>,
) => {
  return <SliderPrimitive.Label as={Label} {...props} />;
};

const SliderValueLabel = <T extends ValidComponent = "label">(
  props: PolymorphicProps<T, SliderPrimitive.SliderValueLabelProps<T>>,
) => {
  return <SliderPrimitive.ValueLabel as={Label} {...props} />;
};

export {
  Slider,
  SliderTrack,
  SliderFill,
  SliderThumb,
  SliderLabel,
  SliderValueLabel,
};
