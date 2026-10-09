import type { Column } from "../../shared/beads";

export const MIN_COLUMN_WIDTH = 220;
export const COLUMN_GAP = 12;

/** Hide the review lane when no beads remain after filtering. */
export function visibleColumnsForBoard(
  columnOrder: readonly Column[],
  showClosed: boolean,
  reviewCount: number,
): Column[] {
  return columnOrder.filter(
    (column) => (column !== "closed" || showClosed) && (column !== "in_review" || reviewCount > 0),
  );
}

/** Divide the board's measured inner width between its visible columns. */
export function columnWidthForBoard(containerWidth: number, columnCount: number): number {
  const gapsWidth = COLUMN_GAP * (columnCount - 1);
  return Math.max(MIN_COLUMN_WIDTH, (containerWidth - gapsWidth) / columnCount);
}
