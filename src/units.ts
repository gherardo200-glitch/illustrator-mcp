/** Unit conversion helpers. Illustrator's scripting API works in points. */

export type Unit = "pt" | "px" | "mm" | "cm" | "in";

const PER_UNIT: Record<Unit, number> = {
  pt: 1,
  px: 1, // 72 dpi assumption: 1px === 1pt
  mm: 2.834645669,
  cm: 28.34645669,
  in: 72,
};

/** Convert a value in the given unit to points. */
export function toPoints(value: number, unit: Unit = "px"): number {
  return value * (PER_UNIT[unit] ?? 1);
}
