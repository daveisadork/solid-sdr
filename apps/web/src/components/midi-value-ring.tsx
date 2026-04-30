import { createEffect, createSignal, onCleanup } from "solid-js";
import type { ParsedMidiMessage } from "./midi-control";

type MidiValueRingProps = {
  message: ParsedMidiMessage;
};

const SIZE = 120;
const STROKE = 16;
const RADIUS = SIZE / 2 - STROKE;
const CENTER = SIZE / 2;
const GAP_DEGREES = 90;
const START_ANGLE = 180 + GAP_DEGREES / 2;
const SWEEP_ANGLE = 360 - GAP_DEGREES;

function polarToCartesian(angleDegrees: number, radius = RADIUS) {
  const angleRadians = (angleDegrees - 90) * (Math.PI / 180);
  return {
    x: CENTER + Math.cos(angleRadians) * radius,
    y: CENTER + Math.sin(angleRadians) * radius,
  };
}

function arcPath(startAngle: number, endAngle: number) {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
  ].join(" ");
}

function normalizedValue(message: ParsedMidiMessage) {
  return message.command === 14 ? message.value / 16383 : message.value / 127;
}

function isNoteMessage(message: ParsedMidiMessage) {
  return message.command === 8 || message.command === 9;
}

function isNoteOn(message: ParsedMidiMessage) {
  return normalizedValue(message) >= 0.5;
}

export function MidiValueRing(props: MidiValueRingProps) {
  const [latchedOn, setLatchedOn] = createSignal(isNoteOn(props.message));
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const message = props.message;

    if (!isNoteMessage(message)) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      setLatchedOn(false);
      return;
    }

    if (isNoteOn(message)) {
      if (timeoutId) clearTimeout(timeoutId);
      setLatchedOn(true);
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        setLatchedOn(false);
      }, 250);
      return;
    }

    if (!timeoutId) setLatchedOn(false);
  });

  onCleanup(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  const value = () => Math.max(0, Math.min(1, normalizedValue(props.message)));
  const percent = () => Math.round(value() * 100);
  const markerAngle = () => START_ANGLE + value() * SWEEP_ANGLE;
  const marker = () => polarToCartesian(markerAngle(), RADIUS);
  const track = arcPath(START_ANGLE, START_ANGLE + SWEEP_ANGLE);
  const noteLabel = () => (latchedOn() ? "on" : "off");
  const noteColorClass = () =>
    latchedOn() ? "fill-emerald-500" : "fill-red-500";

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      class="size-16 aspect-square overflow-visible"
      aria-label={
        isNoteMessage(props.message)
          ? `Last MIDI value ${noteLabel()}`
          : `Last MIDI value ${percent()} percent`
      }
    >
      <path
        d={track}
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.2"
        stroke-width={STROKE}
        stroke-linecap="round"
      />
      <circle
        cx={marker().x}
        cy={marker().y}
        r={STROKE * 0.8}
        fill="currentColor"
      />
      <text
        x={CENTER}
        y={CENTER}
        text-anchor="middle"
        dominant-baseline="middle"
        class={`text-[24px] font-bold ${
          isNoteMessage(props.message) ? noteColorClass() : "fill-current"
        }`}
      >
        {isNoteMessage(props.message) ? noteLabel() : `${percent()}%`}
      </text>
    </svg>
  );
}
