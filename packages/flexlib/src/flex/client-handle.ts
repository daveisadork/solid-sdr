/**
 * Render a 32-bit client handle for use in a command: `0x` and eight
 * uppercase hex digits. Throws if `handle` is not an unsigned 32-bit integer.
 */
export function formatClientHandle(handle: number): string {
  if (!Number.isInteger(handle) || handle < 0 || handle > 0xffffffff) {
    throw new Error(`Invalid client handle: ${handle}`);
  }
  return `0x${handle.toString(16).toUpperCase().padStart(8, "0")}`;
}

/**
 * Parse a client handle string as the radio emits it: hex, with or without
 * the `0x` prefix, padded or not. An unprefixed value is never decimal.
 * Returns `undefined` when the string is not a handle.
 */
export function parseClientHandle(value: string): number | undefined {
  const trimmed = value.trim();
  const digits = /^0x/i.test(trimmed) ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-f]{1,8}$/i.test(digits)) return undefined;
  return Number.parseInt(digits, 16);
}

/**
 * Compare two client handles by value, so width and `0x` prefix do not
 * matter. Falls back to a case-insensitive string compare when either side is
 * not a handle.
 */
export function clientHandlesMatch(a: string, b: string): boolean {
  const left = parseClientHandle(a);
  const right = parseClientHandle(b);
  if (left !== undefined && right !== undefined) return left === right;
  return a.toLowerCase() === b.toLowerCase();
}
