/** Parses a decimal string into an integer of minor units without floats.
 *  Splits at '.', right-pads or truncates the fraction to `decimals` places,
 *  and returns the concatenated integer. Throws on non-numeric input. */
export function parseDecimalMinor(raw: string, decimals = 2): number {
  const trimmed = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new RangeError(`parseDecimalMinor: not a decimal number: "${raw}"`);
  }

  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const dotIndex = abs.indexOf(".");
  const intPart = dotIndex === -1 ? abs : abs.slice(0, dotIndex);
  let fracPart = dotIndex === -1 ? "" : abs.slice(dotIndex + 1);

  fracPart = fracPart.padEnd(decimals, "0").slice(0, decimals);
  const value = Number(`${intPart}${fracPart}`);
  return negative ? -value : value;
}
