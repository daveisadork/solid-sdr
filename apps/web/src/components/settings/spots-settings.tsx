import type { Radio } from "@repo/flexlib";

import { Show } from "solid-js";
import { Button } from "~/components/ui/button";
import useFlexRadio from "~/context/flexradio";
import { usePreferences } from "~/context/preferences";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { SimpleSlider } from "../ui/simple-slider";
import { SimpleSwitch } from "../ui/simple-switch";
import { InfoItem } from "./common";

const FONT_SIZES = [
  "Extra Small",
  "Small",
  "Medium",
  "Large",
  "X Large",
  "2X Large",
  "3X Large",
  "4X Large",
  "5X Large",
  "6X Large",
  "7X Large",
  "8X Large",
  "9X Large",
];

function SpotsSettingsInner(props: { radio: Radio }) {
  const { state } = useFlexRadio();
  const { preferences, setPreferences } = usePreferences();

  return (
    <>
      <SimpleSwitch
        checked={preferences.spots.enabled}
        onChange={(isChecked) =>
          setPreferences((draft) => {
            draft.spots.enabled = isChecked;
          })
        }
        label="Enable Spots"
      />
      <SimpleSlider
        minValue={1}
        maxValue={10}
        value={[preferences.spots.levels]}
        onChange={([value]) =>
          setPreferences((draft) => {
            draft.spots.levels = value;
          })
        }
        getValueLabel={({ values }) => values[0].toString()}
        label="Levels"
      />
      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[preferences.spots.position]}
        onChange={([value]) =>
          setPreferences((draft) => {
            draft.spots.position = value;
          })
        }
        getValueLabel={({ values }) => `${values[0]}%`}
        label="Position"
      />
      <SimpleSlider
        minValue={0}
        maxValue={100}
        value={[preferences.spots.verticalSpacing]}
        onChange={([value]) =>
          setPreferences((draft) => {
            draft.spots.verticalSpacing = value;
          })
        }
        getValueLabel={({ values }) => `${values[0]}%`}
        label="Vertical Spacing"
      />
      <SimpleSlider
        minValue={0}
        maxValue={FONT_SIZES.length - 1}
        value={[preferences.spots.fontSize]}
        onChange={([value]) =>
          setPreferences((draft) => {
            draft.spots.fontSize = value;
          })
        }
        getValueLabel={({ values }) => FONT_SIZES[values[0]]}
        label="Font Size"
      />
      <InfoItem
        label="Total Spots"
        value={Object.keys(state.status.spot).length}
      />
      <DialogFooter sticky>
        <Button variant="destructive" onClick={() => props.radio.clearSpots()}>
          Clear All Spots
        </Button>
      </DialogFooter>
    </>
  );
}

export function SpotsSettings() {
  const { state, radio } = useFlexRadio();
  return (
    <DialogContent class="sm:max-w-sm text-sm">
      <DialogHeader>
        <DialogTitle>Spots</DialogTitle>
      </DialogHeader>
      <Show
        when={state.clientHandle ? radio() : null}
        fallback={<div class="text-sm w-sm">Not Connected</div>}
      >
        {(radio) => <SpotsSettingsInner radio={radio()} />}
      </Show>
    </DialogContent>
  );
}
