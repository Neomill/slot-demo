import type { Text } from 'pixi.js';

/** Format a number as a 2-decimal money string, e.g. 1234.5 → "1,234.50". */
export function money(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Scale a centre-anchored Text down (never up) so its rendered width fits within
 * `maxWidth`. This keeps every readout inside its slot regardless of how many
 * digits it has — so wide values shrink gracefully instead of overlapping their
 * neighbours, and the surrounding layout never shifts.
 */
export function fitWidth(text: Text, maxWidth: number): void {
  text.scale.set(1);
  if (text.width > maxWidth) text.scale.set(maxWidth / text.width);
}
