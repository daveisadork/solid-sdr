import type { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createContext, useContext } from "solid-js";
import type { DaxAudioSink } from "~/lib/dax-audio-sink";
import type { DaxIqAudioSink } from "~/lib/dax-iq-audio-sink";

export interface AudioContextValue {
  daxSinks: ReactiveMap<number, DaxAudioSink>;
  daxIqSinks: ReactiveMap<number, DaxIqAudioSink>;
  daxTxStream: Accessor<MediaStream | undefined>;
  remoteAudioTxStream: Accessor<MediaStream | undefined>;
  remoteAudioRxStream: Accessor<MediaStream | undefined>;
}

export const AudioContext = createContext<AudioContextValue>();

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within <AudioProvider>");
  return ctx;
}
