export const MOVING_AVERAGE_WINDOWS = [5, 20, 60, 120] as const

export type MovingAverageWindow = (typeof MOVING_AVERAGE_WINDOWS)[number]

/**
 * Returns a value aligned with every input point. Entries before a complete
 * observation window are null so charts do not imply partial averages.
 */
export function calculateMovingAverageSeries(
  values: number[],
  window: number
): Array<number | null> {
  if (!Number.isInteger(window) || window < 1) {
    throw new Error("Moving-average window must be a positive integer.")
  }

  let sum = 0
  return values.map((value, index) => {
    sum += value
    if (index >= window) sum -= values[index - window]
    return index >= window - 1 ? sum / window : null
  })
}
