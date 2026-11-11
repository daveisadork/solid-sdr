import type { PolymorphicProps } from "@kobalte/core";
import { ToggleButton } from "@kobalte/core/toggle-button";
import type { SliceController } from "@repo/flexlib";
import { splitProps, type ValidComponent } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { SliceState } from "~/context/flexradio";
import { cn } from "~/lib/utils";
import MdiLock from "~icons/material-symbols/lock-open-circle-outline";
import MdiClose from "~icons/mdi/close-circle-outline";
import MdiPlay from "~icons/mdi/play-circle-outline";
import MdiRecord from "~icons/mdi/record-circle-outline";
import MdiStop from "~icons/mdi/stop-circle-outline";

export const ExtraSliceControls = <T extends ValidComponent = "div">(
  props: PolymorphicProps<
    T,
    {
      slice: SliceState;
      controller: SliceController;
      class?: string | undefined;
    }
  >,
) => {
  const [local, others] = splitProps(props, ["slice", "controller", "class"]);

  return (
    <div
      class={cn(
        "grid grid-rows-4 py-1 gap-1 opacity-75 [&_svg]:pointer-events-none [&_svg]:h-full *:aspect-square",
        local.class,
      )}
      {...others}
    >
      <ToggleButton onChange={() => local.controller.close()}>
        <MdiClose />
      </ToggleButton>
      <ToggleButton
        class="data-pressed:text-yellow-500"
        pressed={props.slice.isLocked}
        onChange={(pressed) => local.controller.setLocked(pressed)}
      >
        <MdiLock />
      </ToggleButton>
      <ToggleButton
        class="data-pressed:text-red-500"
        pressed={local.slice.recordingEnabled}
        onChange={(pressed) => local.controller.setRecordingEnabled(pressed)}
      >
        <Dynamic
          component={local.slice.recordingEnabled ? MdiStop : MdiRecord}
        />
      </ToggleButton>
      <ToggleButton
        class="data-pressed:text-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        pressed={local.slice.playbackEnabled}
        disabled={!local.slice.playbackAvailable}
        onChange={(pressed) => local.controller.setPlaybackEnabled(pressed)}
      >
        <Dynamic component={local.slice.playbackEnabled ? MdiStop : MdiPlay} />
      </ToggleButton>
    </div>
  );
};
