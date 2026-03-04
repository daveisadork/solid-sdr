import { createSignal } from "solid-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type colorSpace =
  | "srgb"
  | "srgb-linear"
  | "display-p3"
  | "display-p3-linear"
  | "a98-rgb"
  | "prophoto-rgb"
  | "rec2020"
  | "lab"
  | "oklab"
  | "lch"
  | "oklch"
  | "hsl"
  | "hwb"
  | "lch"
  | "oklch";

const colorSpaces: colorSpace[] = [
  "srgb",
  "srgb-linear",
  "lab",
  "oklab",
  "lch",
  "oklch",
];

export function TestThing() {
  const [base, setBase] = createSignal<colorSpace>("srgb");
  const [compare, setCompare] = createSignal<colorSpace>("lab");

  return (
    <div
      class="absolute left-5 top-96 border border-black w-512 bg-linear-to-r/decreasing from-blue-500 via-yellow-300 via-50% to-red-500 to-70%"
      style={{
        "--stops":
          "#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00, #ff0, #0f0, #0ff, #00f",
      }}
    >
      {/* <img src="/public/gradients/gradient.png" /> */}
      <div
        class="w-512 h-3"
        style={{
          background: `linear-gradient(to right in oklch decreasing hue, #000000, #400040 15%, #00ff00 60%, #ffffff)`,
        }}
      />
      <Select
        value={base()}
        onChange={setBase}
        options={colorSpaces}
        itemComponent={(props) => (
          <SelectItem item={props.item}>
            {props.item.rawValue as string}
          </SelectItem>
        )}
      >
        <SelectTrigger>
          <SelectValue<colorSpace>>
            {(state) => state.selectedOption()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <div class="relative h-30 w-full">
        <div
          class="absolute top-0 left-0 right-0 bottom-1/3 "
          style={{
            "background-image": `linear-gradient(to right in var(--color-space), var(--stops))`,
            "--color-space": base(),
          }}
        />
        <div
          class="absolute top-1/3 left-0 right-0 bottom-0 mix-blend-difference"
          style={{
            "background-image": `linear-gradient(to right in var(--color-space), var(--stops))`,
            "--color-space": compare(),
          }}
        />
      </div>
      <Select
        value={compare()}
        onChange={setCompare}
        options={colorSpaces}
        itemComponent={(props) => (
          <SelectItem item={props.item}>
            {props.item.rawValue as string}
          </SelectItem>
        )}
      >
        <SelectTrigger>
          <SelectValue<colorSpace>>
            {(state) => state.selectedOption()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
      <div
        class="h-10 w-full"
        style={{
          background: `linear-gradient(to right, #000, #00f 15%, #0ff 22.5%, #0f0 30%, #ff0 45%, #f00 60%, #f0f 75%, #fff 100%)`,

          // { color: "#000000", offset: 0.0 },
          // { color: "#0000ff", offset: 0.15 },
          // { color: "#00ffff", offset: 0.225 },
          // { color: "#00ff00", offset: 0.3 },
          // { color: "#ffff00", offset: 0.45 },
          // { color: "#ff0000", offset: 0.6 },
          // { color: "#ff00ff", offset: 0.75 },
          // { color: "#ffffff", offset: 1.0 },
        }}
      />
      <div
        class="h-10 w-full"
        style={{
          background: `linear-gradient(to right in oklch decreasing hue, #000, #00f 15%, #0ff 25%, #f00 60%, #fff 100%)`,

          // { color: "#000000", offset: 0.0 },
          // { color: "#0000ff", offset: 0.15 },
          // { color: "#00ffff", offset: 0.225 },
          // { color: "#00ff00", offset: 0.3 },
          // { color: "#ffff00", offset: 0.45 },
          // { color: "#ff0000", offset: 0.6 },
          // { color: "#ff00ff", offset: 0.75 },
          // { color: "#ffffff", offset: 1.0 },
        }}
      />
    </div>
  );
}
