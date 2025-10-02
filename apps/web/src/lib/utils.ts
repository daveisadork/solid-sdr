import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Converts a frequency in MHz to a human-readable label
// E.g., 2400 -> "2.4 GHz", 0.2 -> "200 kHz"
export function frequencyToLabel(frequencyMHz: number): string {
  if (frequencyMHz >= 1000) {
    return `${(frequencyMHz / 1000).toFixed(2)} GHz`;
  } else if (frequencyMHz >= 1) {
    return `${frequencyMHz.toFixed(2)} MHz`;
  } else {
    return `${(frequencyMHz * 1000).toFixed(0)} kHz`;
  }
}
