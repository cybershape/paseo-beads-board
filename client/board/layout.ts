export const MIN_COLUMN_WIDTH = 220;
export const COLUMN_GAP = 12;

/** Divide the board's measured inner width between its visible columns. */
export function columnWidthForBoard(containerWidth: number, columnCount: number): number {
  const gapsWidth = COLUMN_GAP * (columnCount - 1);
  return Math.max(MIN_COLUMN_WIDTH, (containerWidth - gapsWidth) / columnCount);
}
